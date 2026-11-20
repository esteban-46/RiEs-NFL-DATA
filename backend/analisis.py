"""Carga, depura y analiza el dataset del Big Data Bowl. Todo se calcula en memoria al arrancar."""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
D = RAIZ / "data" / "nfl-big-data-bowl-regional-event-data-main" / "data"
RESULTADOS = RAIZ / "data" / "resultados_2021_nflverse.csv"
TRACKING_RESUMEN = Path(__file__).resolve().parent / "datos" / "tracking_resumen.json"

COBERTURAS_PRINCIPALES = ["Cover-0", "Cover-1", "Cover-2", "2-Man", "Cover-3", "Quarters", "Cover-6"]
OL = ["LT", "LG", "C", "RG", "RT"]
EDGES = {"LEO", "REO", "LOLB", "ROLB", "LE", "RE"}
CONCEPTOS = {
    # tiempo que necesita el QB (s), yardas promedio al completar, nombre
    "rapido": {"tiempo": 1.8, "yardas": 7.0, "nombre": "Juego rápido (slants)"},
    "screen": {"tiempo": 1.4, "yardas": 6.0, "nombre": "Pantalla (screen)"},
    "cruces": {"tiempo": 2.6, "yardas": 10.0, "nombre": "Cruces (mesh)"},
    "flood": {"tiempo": 2.9, "yardas": 12.0, "nombre": "Niveles (flood)"},
    "profundo": {"tiempo": 3.4, "yardas": 22.0, "nombre": "Verticales (4 verts)"},
}
# Ajuste táctico (conocimiento experto): qué tan bien ataca cada concepto a cada cobertura, de -1 a 1
MATRIZ_CONCEPTO = {
    "Cover-0": {"rapido": 1.0, "profundo": 0.5, "cruces": 0.5, "flood": -0.5, "screen": 0.8},
    "Cover-1": {"rapido": 0.5, "profundo": 0.0, "cruces": 1.0, "flood": -0.2, "screen": 0.0},
    "Cover-2": {"rapido": 0.0, "profundo": 0.6, "cruces": 0.2, "flood": 0.8, "screen": 0.2},
    "2-Man": {"rapido": -0.3, "profundo": -0.5, "cruces": 0.4, "flood": 0.0, "screen": 0.6},
    "Cover-3": {"rapido": 0.3, "profundo": 0.4, "cruces": 0.2, "flood": 1.0, "screen": 0.3},
    "Quarters": {"rapido": 0.6, "profundo": -0.8, "cruces": 0.4, "flood": 0.2, "screen": 0.5},
    "Cover-6": {"rapido": 0.3, "profundo": -0.3, "cruces": 0.3, "flood": 0.6, "screen": 0.3},
}
CONSEJO_COBERTURA = {
    "Cover-0": "Cero safeties y blitz: rutas calientes y lanzamiento en menos de 2 segundos (slants, screens).",
    "Cover-1": "Marcaje personal con un safety profundo: rutas cruzadas (mesh) y bloqueos de ruta para generar separación.",
    "Cover-2": "Dos safeties profundos: ataca el hoyo entre el corner y el safety (smash, flood) y el centro profundo.",
    "2-Man": "Personal con dos safeties: rutas de escape horizontales, screens y movilidad del QB.",
    "Cover-3": "Tres zonas profundas: concepto de niveles (flood) en una banda y seams contra los safeties.",
    "Quarters": "Cuatro profundos: lanza por debajo (curl-flat, slants) y castiga con YAC; evita los verticales.",
    "Cover-6": "Mitad Quarters, mitad Cover-2: lee el lado de Cover-2 y ataca su hoyo con flood.",
}


def _bucket(d: int) -> str:
    return "1-3" if d <= 3 else "4-6" if d <= 6 else "7-10" if d <= 10 else "11+"


def _exito(r) -> bool:
    if r.down == 1:
        return r.playResult >= 0.4 * r.yardsToGo
    if r.down == 2:
        return r.playResult >= 0.6 * r.yardsToGo
    return r.playResult >= r.yardsToGo


def _r(x, n=3):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), n)


class Datos:
    def __init__(self) -> None:
        games = pd.read_csv(D / "games.csv")
        plays = pd.read_csv(D / "plays.csv")
        pff = pd.read_csv(D / "pffScoutingData.csv")
        players = pd.read_csv(D / "players.csv")

        # ---- depuración de jugadas: solo columnas útiles, tipos y variables derivadas
        plays = plays[["gameId", "playId", "quarter", "down", "yardsToGo", "possessionTeam", "defensiveTeam",
                       "absoluteYardlineNumber", "passResult", "playResult", "penaltyYards", "foulName1",
                       "offenseFormation", "personnelO", "defendersInBox", "personnelD", "dropBackType",
                       "pff_playAction", "pff_passCoverage", "pff_passCoverageType", "playDescription"]].copy()
        plays["down"] = plays["down"].replace(0, 3)
        plays["offenseFormation"] = plays["offenseFormation"].fillna("SHOTGUN")
        plays["defendersInBox"] = plays["defendersInBox"].fillna(plays["defendersInBox"].median())
        plays["dropBackType"] = plays["dropBackType"].fillna("TRADITIONAL")
        plays["intento"] = plays.passResult.isin(["C", "I", "IN"])
        plays["completo"] = plays.passResult == "C"
        plays["sack"] = plays.passResult == "S"
        plays["intercepcion"] = plays.passResult == "IN"
        plays["explosiva"] = plays.playResult >= 20
        plays["exito"] = plays.apply(_exito, axis=1)
        plays["primero"] = plays.playResult >= plays.yardsToGo
        plays["bucket"] = plays.yardsToGo.apply(_bucket)

        # ---- presión y número de rushers por jugada (PFF)
        pff = pff.merge(plays[["gameId", "playId", "possessionTeam", "defensiveTeam"]], on=["gameId", "playId"])
        pff["presion"] = pff[["pff_hit", "pff_hurry", "pff_sack"]].fillna(0).max(axis=1) > 0
        pff["presion_perm"] = pff[["pff_hitAllowed", "pff_hurryAllowed", "pff_sackAllowed"]].fillna(0).max(axis=1) > 0
        rush = pff[pff.pff_role == "Pass Rush"]
        por_jugada = rush.groupby(["gameId", "playId"]).agg(rushers=("nflId", "size"), presion=("presion", "max")).reset_index()
        plays = plays.merge(por_jugada, on=["gameId", "playId"], how="left")
        plays["rushers"] = plays["rushers"].fillna(4)
        plays["presion"] = plays["presion"].eq(True)
        plays["blitz"] = plays.rushers >= 5

        # ---- resultados reales (nflverse, dato público suplementario)
        res = pd.read_csv(RESULTADOS) if RESULTADOS.exists() else pd.DataFrame()
        games = games.merge(res, on="gameId", how="left") if not res.empty else games
        self.games, self.plays, self.pff, self.rush = games, plays, pff, rush
        self.players = players.set_index("nflId")
        self.tracking = json.loads(TRACKING_RESUMEN.read_text(encoding="utf-8")) if TRACKING_RESUMEN.exists() else {
            "jugadores": {}, "equipos": {}, "jugadas_reales": {}}
        self.equipos = sorted(set(games.homeTeamAbbr) | set(games.visitorTeamAbbr))
        self.liga = self._resumen(plays)
        self.liga_def = self.liga
        self.liga_cob = plays.groupby("pff_passCoverage").apply(self._cob).to_dict()

    # ------------------------------------------------------------------ utilidades
    @staticmethod
    def _cob(g: pd.DataFrame) -> dict:
        i = g[g.intento]
        return {"n": int(len(g)), "ypp": float(g.playResult.mean()), "comp": float(i.completo.mean()) if len(i) else 0.6}

    @staticmethod
    def _resumen(g: pd.DataFrame) -> dict:
        i = g[g.intento]
        return {
            "jugadas": int(len(g)),
            "ypp": float(g.playResult.mean()),
            "comp": float(i.completo.mean()) if len(i) else 0.0,
            "sack": float(g.sack.mean()),
            "int": float(g.intercepcion.mean()),
            "explosivas": float(g.explosiva.mean()),
            "exito": float(g.exito.mean()),
            "presion": float(g.presion.mean()),
            "blitz": float(g.blitz.mean()),
            "rushers": float(g.rushers.mean()),
            "tercera": float(g[g.down == 3].primero.mean()) if (g.down == 3).any() else 0.0,
            "play_action": float(g.pff_playAction.mean()),
            "man": float((g.pff_passCoverageType == "Man").mean()),
        }

    def _nombre(self, nid) -> str:
        try:
            return str(self.players.loc[int(nid), "displayName"])
        except KeyError:
            return "—"

    def _vmax(self, nid) -> float | None:
        j = self.tracking["jugadores"].get(str(int(nid)))
        return j["vmax"] if j else None

    # ------------------------------------------------------------------ perfiles
    @lru_cache(maxsize=64)
    def record(self, eq: str) -> dict:
        g = self.games
        if "home_score" not in g:
            return {"g": 0, "p": 0, "e": 0, "pf": 0, "pc": 0, "partidos": []}
        partidos = []
        for r in g[(g.homeTeamAbbr == eq) | (g.visitorTeamAbbr == eq)].sort_values("week").itertuples():
            local = r.homeTeamAbbr == eq
            pf, pc = (r.home_score, r.away_score) if local else (r.away_score, r.home_score)
            partidos.append({"semana": int(r.week), "rival": r.visitorTeamAbbr if local else r.homeTeamAbbr, "local": bool(local),
                             "pf": int(pf), "pc": int(pc), "res": "G" if pf > pc else "P" if pf < pc else "E", "gameId": int(r.gameId)})
        return {"g": sum(p["res"] == "G" for p in partidos), "p": sum(p["res"] == "P" for p in partidos),
                "e": sum(p["res"] == "E" for p in partidos), "pf": sum(p["pf"] for p in partidos),
                "pc": sum(p["pc"] for p in partidos), "partidos": partidos}

    @lru_cache(maxsize=64)
    def perfil(self, eq: str) -> dict:
        p = self.plays
        of, de = p[p.possessionTeam == eq], p[p.defensiveTeam == eq]
        ofr, der = self._resumen(of), self._resumen(de)
        # presión permitida por la ofensiva = presión generada por el rival en sus jugadas
        cob_def = de.pff_passCoverage.value_counts(normalize=True)
        of_vs_cob = {c: self._cob(g) for c, g in of.groupby("pff_passCoverage")}
        de_vs_cob = {c: self._cob(g) for c, g in de.groupby("pff_passCoverage")}
        form = of.groupby("offenseFormation").agg(n=("playId", "size"), ypp=("playResult", "mean"))
        form = form[form.n >= 10].sort_values("n", ascending=False)

        # línea ofensiva: presión permitida por posición
        pb = self.pff[(self.pff.possessionTeam == eq) & (self.pff.pff_role == "Pass Block")]
        linea = {}
        for pos in OL:
            g = pb[pb.pff_positionLinedUp == pos]
            top = g.nflId.value_counts().index[0] if len(g) else None
            linea[pos] = {"tasa": _r(g.presion_perm.mean()) if len(g) else 0, "snaps": int(len(g)),
                          "jugador": self._nombre(top) if top is not None else "—"}
        # pass rush: de dónde viene la presión
        rr = self.rush[self.rush.defensiveTeam == eq].copy()
        rr["zona"] = rr.pff_positionLinedUp.apply(
            lambda x: "Extremos" if x in EDGES else "Linebackers" if "LB" in x else "Secundaria" if ("CB" in x or x.startswith(("FS", "SS"))) else "Interior")
        origen = rr[rr.presion].zona.value_counts()
        rushers_top = (rr.groupby("nflId").agg(snaps=("presion", "size"), pres=("presion", "sum"), sacks=("pff_sack", "sum"))
                       .query("snaps >= 40").sort_values("pres", ascending=False).head(3))
        bloq = (pb.groupby("nflId").agg(snaps=("presion_perm", "size"), perm=("presion_perm", "sum"))
                .query("snaps >= 60").assign(tasa=lambda d: d.perm / d.snaps).sort_values("tasa", ascending=False))
        # jugadores clave ofensivos
        rec = self.pff[(self.pff.possessionTeam == eq) & (self.pff.pff_role == "Pass Route")]
        qb = self.pff[(self.pff.possessionTeam == eq) & (self.pff.pff_role == "Pass")].nflId.value_counts()
        rapidos = sorted(((self._vmax(n) or 0, n) for n in rec.nflId.value_counts().head(8).index), reverse=True)[:3]
        tr = self.tracking["equipos"].get(eq, {})
        pa, nopa = of[of.pff_playAction == 1], of[of.pff_playAction == 0]

        return {
            "equipo": eq, "record": self.record(eq), "ofensiva": ofr, "defensa": der,
            "tiempo_lanzamiento": tr.get("tiempo_lanzamiento", 2.7),
            "coberturas_def": [{"cobertura": c, "pct": _r(v)} for c, v in cob_def.items() if v >= 0.02],
            "of_vs_cob": {c: {k: _r(v) for k, v in d.items()} for c, d in of_vs_cob.items()},
            "de_vs_cob": {c: {k: _r(v) for k, v in d.items()} for c, d in de_vs_cob.items()},
            "formaciones": [{"formacion": f, "n": int(r.n), "ypp": _r(r.ypp, 2)} for f, r in form.iterrows()],
            "play_action": {"con": _r(pa.playResult.mean(), 2), "sin": _r(nopa.playResult.mean(), 2), "pct": _r(len(pa) / max(len(of), 1))},
            "linea": linea,
            "origen_presion": [{"zona": z, "n": int(n)} for z, n in origen.items()],
            "rushers_top": [{"nombre": self._nombre(n), "pos": str(self.players.loc[n, "officialPosition"]) if n in self.players.index else "",
                             "presiones": int(r.pres), "sacks": int(r.sacks), "tasa": _r(r.pres / r.snaps)} for n, r in rushers_top.iterrows()],
            "bloqueador_debil": ({"nombre": self._nombre(bloq.index[0]), "pos": str(self.players.loc[bloq.index[0], "officialPosition"]),
                                  "tasa": _r(bloq.tasa.iloc[0]), "permitidas": int(bloq.perm.iloc[0])} if len(bloq) else None),
            "qb": self._nombre(qb.index[0]) if len(qb) else "—",
            "rapidos": [{"nombre": self._nombre(n), "vmax": _r(v, 2), "mph": _r(v * 2.045, 1)} for v, n in rapidos if v],
        }

    # ------------------------------------------------------------------ versus
    def versus(self, a: str, b: str) -> dict:
        A, B, L = self.perfil(a), self.perfil(b), self.liga
        ao, ad, bo, bd = A["ofensiva"], A["defensa"], B["ofensiva"], B["defensa"]

        def esperado(of, de, k):
            return of[k] + de[k] - L[k]

        factores = []

        def factor(nombre, va, vb, coef, fmt, explicacion, invertido=False):
            diff = (va - vb) * (-1 if invertido else 1)
            factores.append({"nombre": nombre, "a": va, "b": vb, "logit": diff * coef, "fmt": fmt, "explicacion": explicacion})

        factor("Yardas por pase esperadas", esperado(ao, bd, "ypp"), esperado(bo, ad, "ypp"), 0.22, "yds",
               "Ofensiva aérea de cada equipo ajustada por la defensa que enfrenta.")
        factor("Tasa de éxito esperada", esperado(ao, bd, "exito"), esperado(bo, ad, "exito"), 3.0, "pct",
               "Jugadas que mantienen la serie viva (40% en 1a, 60% en 2a, 100% en 3a/4a).")
        factor("Presión generada", esperado(ad, bo, "presion"), esperado(bd, ao, "presion"), 3.0, "pct",
               "Probabilidad de presionar al QB rival según rush propio y protección rival.")
        factor("Riesgo de intercepción", esperado(ao, bd, "int"), esperado(bo, ad, "int"), 12.0, "pct",
               "Intercepciones por jugada de pase esperadas (menos es mejor).", invertido=True)
        factor("Jugadas explosivas (+20 yds)", esperado(ao, bd, "explosivas"), esperado(bo, ad, "explosivas"), 6.0, "pct",
               "Capacidad de generar jugadas grandes contra esa defensa.")
        ra, rb = A["record"], B["record"]
        ga, gb = max(ra["g"] + ra["p"] + ra["e"], 1), max(rb["g"] + rb["p"] + rb["e"], 1)
        factor("Diferencial de puntos por juego", (ra["pf"] - ra["pc"]) / ga, (rb["pf"] - rb["pc"]) / gb, 0.03, "pts",
               "Rendimiento real en el marcador, semanas 1 a 8 de 2021.")
        logit = sum(f["logit"] for f in factores)
        prob = 1 / (1 + math.exp(-logit))
        for f in factores:
            f["puntos"] = round(f["logit"] * 25, 1)  # aporte aproximado en puntos porcentuales
            f["a"], f["b"], f["logit"] = _r(f["a"]), _r(f["b"]), _r(f["logit"])

        return {
            "a": A, "b": B, "liga": {k: _r(v) for k, v in L.items()}, "prob_a": _r(prob), "factores": factores,
            "historial": self.historial(a, b), "ventajas": self.ventajas(A, B),
            "plan": self.plan(A, B), "duelos": self.duelos(A, B),
        }

    def historial(self, a: str, b: str) -> dict:
        ra, rb = self.record(a), self.record(b)
        directo = [p for p in ra["partidos"] if p["rival"] == b]
        rivales_a = {p["rival"]: p for p in ra["partidos"]}
        comunes = [{"rival": p["rival"], "a": rivales_a[p["rival"]], "b": p}
                   for p in rb["partidos"] if p["rival"] in rivales_a and p["rival"] not in (a, b)]
        return {"directo": directo, "comunes": comunes}

    def ventajas(self, A: dict, B: dict) -> dict:
        ventajas, desventajas = [], []
        lc = self.liga_cob
        for c in B["coberturas_def"][:4]:
            cob, pct = c["cobertura"], c["pct"]
            mio = A["of_vs_cob"].get(cob)
            if not mio or mio["n"] < 15 or cob not in lc:
                continue
            delta = mio["ypp"] - lc[cob]["ypp"]
            txt = f"Su defensa juega {cob} el {pct * 100:.0f}% de las veces y tu ofensiva promedia {mio['ypp']:.1f} yds por pase contra ella (liga {lc[cob]['ypp']:.1f})."
            (ventajas if delta > 0.4 else desventajas if delta < -0.4 else []).append({"texto": txt, "valor": _r(delta, 2), "tipo": "cobertura"})
        ao, bd, bo, ad = A["ofensiva"], B["defensa"], B["ofensiva"], A["defensa"]
        L = self.liga
        if bd["presion"] > L["presion"] + 0.03 and ao["presion"] > L["presion"]:
            desventajas.append({"texto": f"Su pass rush presiona en el {bd['presion'] * 100:.0f}% de las jugadas y tu línea permite presión en el {ao['presion'] * 100:.0f}%.", "valor": _r(bd["presion"] - L["presion"]), "tipo": "presion"})
        elif bd["presion"] < L["presion"] - 0.02:
            ventajas.append({"texto": f"Su defensa casi no presiona ({bd['presion'] * 100:.0f}% vs {L['presion'] * 100:.0f}% de la liga): tu QB tendrá tiempo en el pocket.", "valor": _r(L["presion"] - bd["presion"]), "tipo": "presion"})
        if ad["presion"] > L["presion"] + 0.02 and bo["presion"] > L["presion"]:
            ventajas.append({"texto": f"Tu defensa presiona en el {ad['presion'] * 100:.0f}% y su línea cede presión en el {bo['presion'] * 100:.0f}% de sus pases.", "valor": _r(ad["presion"] - L["presion"]), "tipo": "presion"})
        if bd["explosivas"] > L["explosivas"] + 0.01:
            ventajas.append({"texto": f"Su defensa permite jugadas de +20 yds en el {bd['explosivas'] * 100:.1f}% de los pases (liga {L['explosivas'] * 100:.1f}%).", "valor": _r(bd["explosivas"] - L["explosivas"]), "tipo": "explosivas"})
        if bo["explosivas"] > L["explosivas"] + 0.01 and ad["explosivas"] >= L["explosivas"]:
            desventajas.append({"texto": f"Su ofensiva genera jugadas de +20 yds en el {bo['explosivas'] * 100:.1f}% y tu defensa las permite en el {ad['explosivas'] * 100:.1f}%.", "valor": _r(bo["explosivas"] - L["explosivas"]), "tipo": "explosivas"})
        if ao["tercera"] > L["tercera"] + 0.03:
            ventajas.append({"texto": f"Conviertes el {ao['tercera'] * 100:.0f}% de terceras oportunidades por pase (liga {L['tercera'] * 100:.0f}%).", "valor": _r(ao["tercera"] - L["tercera"]), "tipo": "tercera"})
        elif ao["tercera"] < L["tercera"] - 0.03:
            desventajas.append({"texto": f"Solo conviertes el {ao['tercera'] * 100:.0f}% de terceras por pase (liga {L['tercera'] * 100:.0f}%): evita 3a y larga.", "valor": _r(ao["tercera"] - L["tercera"]), "tipo": "tercera"})
        if bd["int"] > L["int"] + 0.005:
            desventajas.append({"texto": f"Su secundaria intercepta en el {bd['int'] * 100:.1f}% de los pases (liga {L['int'] * 100:.1f}%).", "valor": _r(bd["int"] - L["int"]), "tipo": "int"})
        return {"ventajas": ventajas[:5], "desventajas": desventajas[:5]}

    def plan(self, A: dict, B: dict) -> dict:
        ofensivo, defensivo = [], []
        if B["coberturas_def"]:
            c = B["coberturas_def"][0]["cobertura"]
            ofensivo.append({"titulo": f"Prepárate para {c}", "texto": CONSEJO_COBERTURA.get(c, "Cobertura situacional: identifica la rotación antes del snap."),
                             "dato": f"{B['coberturas_def'][0]['pct'] * 100:.0f}% de sus jugadas"})
        mejor = [(d["ypp"], c) for c, d in A["of_vs_cob"].items() if d["n"] >= 15 and c in [x["cobertura"] for x in B["coberturas_def"]]]
        if mejor:
            y, c = max(mejor)
            ofensivo.append({"titulo": f"Castiga su {c}", "texto": "Es la cobertura del rival contra la que mejor te va. " + CONSEJO_COBERTURA.get(c, ""),
                             "dato": f"{y:.1f} yds por pase"})
        if A["formaciones"]:
            f = max(A["formaciones"], key=lambda x: x["ypp"] if x["n"] >= 20 else -9)
            ofensivo.append({"titulo": f"Formación base: {f['formacion']}", "texto": "Es tu formación más productiva con muestra suficiente.", "dato": f"{f['ypp']:.1f} yds por jugada ({f['n']} jugadas)"})
        pa = A["play_action"]
        if pa["con"] is not None and pa["sin"] is not None and pa["con"] > pa["sin"] + 1:
            ofensivo.append({"titulo": "Más play action", "texto": f"Tu play action rinde {pa['con'] - pa['sin']:.1f} yds más por jugada y solo lo usas el {pa['pct'] * 100:.0f}% de las veces.", "dato": f"{pa['con']:.1f} vs {pa['sin']:.1f} yds"})
        if B["defensa"]["presion"] > self.liga["presion"] + 0.02:
            ofensivo.append({"titulo": "Saca el balón rápido", "texto": "Su rush es de los más agresivos: lanzamientos en menos de 2.5 s, screens y protección con 6.", "dato": f"{B['defensa']['blitz'] * 100:.0f}% blitz"})

        # defensivo: con qué cobertura frenarlos y por dónde atacar su línea
        peor = [(d["ypp"], c) for c, d in B["of_vs_cob"].items() if d["n"] >= 15 and c in COBERTURAS_PRINCIPALES]
        if peor:
            y, c = min(peor)
            defensivo.append({"titulo": f"Llama {c}", "texto": f"Es la cobertura contra la que peor rinde su ofensiva.", "dato": f"{y:.1f} yds por pase"})
        lin = B["linea"]
        if lin:
            pos = max(lin, key=lambda k: lin[k]["tasa"] or 0)
            defensivo.append({"titulo": f"Ataca por su {pos}", "texto": f"{lin[pos]['jugador']} es el punto débil de su protección. Alinea a tu mejor rusher ahí.", "dato": f"{(lin[pos]['tasa'] or 0) * 100:.1f}% presión permitida"})
        if B["ofensiva"]["presion"] > self.liga["presion"]:
            defensivo.append({"titulo": "Blitz en 3a oportunidad", "texto": "Su protección cede más presión que la media: manda 5 en terceras largas.", "dato": f"{B['ofensiva']['presion'] * 100:.0f}% presión permitida"})
        if B["rapidos"]:
            r = B["rapidos"][0]
            defensivo.append({"titulo": f"Safety sobre {r['nombre']}", "texto": "Su receptor más rápido: no lo dejes sin ayuda profunda.", "dato": f"{r['mph']} mph máx."})
        return {"ofensivo": ofensivo[:4], "defensivo": defensivo[:4]}

    def duelos(self, A: dict, B: dict) -> list:
        out = []
        if A["rushers_top"] and B["bloqueador_debil"]:
            out.append({"lado": "a", "atacante": A["rushers_top"][0], "defensor": B["bloqueador_debil"],
                        "texto": "Tu mejor pass rusher contra su bloqueador que más presión permite."})
        if B["rushers_top"] and A["bloqueador_debil"]:
            out.append({"lado": "b", "atacante": B["rushers_top"][0], "defensor": A["bloqueador_debil"],
                        "texto": "Su mejor pass rusher contra tu bloqueador más vulnerable: dale ayuda."})
        return out

    # ------------------------------------------------------------------ lector pre-snap
    def tendencias(self, eq: str) -> dict:
        de = self.plays[self.plays.defensiveTeam == eq]
        celdas = []
        for down in [1, 2, 3]:
            for b in ["1-3", "4-6", "7-10", "11+"]:
                g = de[(de.down == down) & (de.bucket == b)] if down < 3 else de[(de.down >= 3) & (de.bucket == b)]
                if len(g) == 0:
                    celdas.append({"down": down, "bucket": b, "n": 0})
                    continue
                top = g.pff_passCoverage.value_counts(normalize=True)
                celdas.append({"down": down, "bucket": b, "n": int(len(g)), "man": _r((g.pff_passCoverageType == "Man").mean()),
                               "blitz": _r(g.blitz.mean()), "cobertura": top.index[0], "cob_pct": _r(top.iloc[0]),
                               "ypp": _r(g.playResult.mean(), 1)})
        return {"equipo": eq, "celdas": celdas}

    def presnap(self, eq: str, down: int, distancia: int, caja: int | None, personal: str | None) -> dict:
        p = self.plays
        filtro = lambda g: g[((g.down == down) if down < 3 else (g.down >= 3)) & (g.bucket == _bucket(distancia))]
        liga, team = filtro(p), filtro(p[p.defensiveTeam == eq])
        if caja is not None:
            liga_c, team_c = liga[liga.defendersInBox == caja], team[team.defendersInBox == caja]
            if len(liga_c) >= 20:
                liga, team = liga_c, team_c
        if personal:
            team_p = team[team.personnelO == personal]
            if len(team_p) >= 5:
                team = team_p
        k = 12.0  # suavizado bayesiano hacia la liga cuando la muestra del equipo es chica

        def mezcla(serie_t, serie_l):
            n = len(serie_t)
            return (serie_t.mean() * n + serie_l.mean() * k) / (n + k) if n else serie_l.mean()

        cobs = {}
        for c in COBERTURAS_PRINCIPALES + ["Red Zone", "Bracket", "Goal Line"]:
            cobs[c] = mezcla((team.pff_passCoverage == c).astype(float), (liga.pff_passCoverage == c).astype(float))
        tot = sum(cobs.values()) or 1
        cobs = sorted(({"cobertura": c, "prob": _r(v / tot)} for c, v in cobs.items() if v / tot >= 0.01), key=lambda x: -x["prob"])
        man = mezcla((team.pff_passCoverageType == "Man").astype(float), (liga.pff_passCoverageType == "Man").astype(float))
        blitz = mezcla(team.blitz.astype(float), liga.blitz.astype(float))
        pres = mezcla(team.presion.astype(float), liga.presion.astype(float))
        señales = []
        de = p[p.defensiveTeam == eq]
        for c in [6, 7, 8]:
            g = de[de.defendersInBox >= c]
            if len(g) >= 15:
                señales.append({"texto": f"Con {c}+ defensores en la caja manda blitz el {g.blitz.mean() * 100:.0f}% y juega personal el {(g.pff_passCoverageType == 'Man').mean() * 100:.0f}%.",
                                "valor": _r(g.blitz.mean())})
        sub = de[de.personnelD.str.contains("6 DB", na=False)]
        if len(sub) >= 15:
            señales.append({"texto": f"Con 6 DBs (dime) juega zona el {(sub.pff_passCoverageType == 'Zone').mean() * 100:.0f}% de las veces.", "valor": _r((sub.pff_passCoverageType == 'Zone').mean())})
        return {"coberturas": cobs, "man": _r(man), "zona": _r(1 - man), "blitz": _r(blitz), "presion": _r(pres),
                "muestra_equipo": int(len(team)), "muestra_liga": int(len(liga)), "señales": señales,
                "consejo": CONSEJO_COBERTURA.get(cobs[0]["cobertura"], "") if cobs else ""}

    # ------------------------------------------------------------------ simulación
    def contexto_sim(self, of: str, de: str, formacion: str) -> dict:
        tr = self.tracking["equipos"]
        alin_of = tr.get(of, {}).get("alineacion_of", {})
        alin = alin_of.get(formacion) or alin_of.get("SHOTGUN") or {}
        alin_de = tr.get(de, {}).get("alineacion_de", {}).get("TODAS", {})

        def top11(d, lado):
            items = sorted(d.items(), key=lambda kv: -kv[1]["frec"])
            if lado == "of":
                base = [kv for kv in items if kv[0] in OL or kv[0] == "QB"]
                resto = [kv for kv in items if kv not in base]
                items = base + resto
            return [{"pos": k, **v} for k, v in items[:11]]

        def plantilla(eq, rol):
            g = self.pff[(self.pff.possessionTeam == eq) if rol == "of" else (self.pff.defensiveTeam == eq)]
            out = {}
            for pos, s in g.groupby("pff_positionLinedUp").nflId:
                n = s.value_counts().index[0]
                out[pos] = {"nombre": self._nombre(n), "vmax": self._vmax(n) or 7.0,
                            "numero": None}
            return out

        return {"alineacion_of": top11(alin, "of"), "alineacion_de": top11(alin_de, "de"),
                "jugadores_of": plantilla(of, "of"), "jugadores_de": plantilla(de, "de"),
                "formaciones": [f["formacion"] for f in self.perfil(of)["formaciones"]],
                "tiempo_lanzamiento": self.perfil(of)["tiempo_lanzamiento"]}

    def simular(self, of: str, de: str, down: int, distancia: int, yarda: int, formacion: str,
                concepto: str, play_action: bool, cobertura: str | None) -> dict:
        A, B, L = self.perfil(of), self.perfil(de), self.liga
        ps = self.presnap(de, down, distancia, None, None)
        cob = cobertura or ps["coberturas"][0]["cobertura"]
        lc = self.liga_cob.get(cob, {"comp": L["comp"], "ypp": L["ypp"], "n": 1})

        def suav(d, campo, k=15):
            if not d:
                return lc[campo]
            return (d[campo] * d["n"] + lc[campo] * k) / (d["n"] + k)

        comp_base = (suav(A["of_vs_cob"].get(cob), "comp") + suav(B["de_vs_cob"].get(cob), "comp")) / 2
        c = CONCEPTOS.get(concepto, CONCEPTOS["rapido"])
        adv = MATRIZ_CONCEPTO.get(cob, {}).get(concepto, 0.0)
        tiempo = c["tiempo"] + (0.4 if play_action else 0)
        p_base = (A["ofensiva"]["presion"] + B["defensa"]["presion"]) / 2
        p_pres = 1 - (1 - p_base) ** (tiempo / max(A["tiempo_lanzamiento"], 1.5))
        p_sack = min(p_pres * 0.22, 0.25)
        pa_bonus = 0.04 if play_action and (A["play_action"]["con"] or 0) > (A["play_action"]["sin"] or 0) else 0.01 if play_action else 0
        comp = min(max(comp_base + 0.08 * adv - 0.2 * p_pres + pa_bonus, 0.15), 0.92)
        p_int = max(((A["ofensiva"]["int"] + B["defensa"]["int"]) / 2) * (1 - 0.6 * adv) * (1.6 if concepto == "profundo" else 1), 0.003)
        resto = max(1 - p_sack, 0)
        p_comp, p_int = comp * resto, min(p_int, 0.15) * resto
        p_inc = max(resto - p_comp - p_int, 0)
        yc = c["yardas"] * (1 + 0.15 * adv) * (A["ofensiva"]["ypp"] / L["ypp"]) ** 0.5
        yc = min(yc, 100 - yarda)
        yds_exp = p_comp * yc - p_sack * 7
        p_primero = p_comp * min(1.0, max(0.05, 1 - (distancia - yc) / (yc + 4))) if distancia > yc else p_comp * 0.9
        alternativas = []
        for k2, c2 in CONCEPTOS.items():
            a2 = MATRIZ_CONCEPTO.get(cob, {}).get(k2, 0.0)
            pp2 = 1 - (1 - p_base) ** ((c2["tiempo"]) / max(A["tiempo_lanzamiento"], 1.5))
            cp2 = min(max(comp_base + 0.08 * a2 - 0.2 * pp2, 0.15), 0.92) * (1 - min(pp2 * 0.22, 0.25))
            alternativas.append({"concepto": k2, "nombre": c2["nombre"], "yds": _r(cp2 * c2["yardas"] * (1 + 0.15 * a2) - pp2 * 0.22 * 7, 2)})
        alternativas.sort(key=lambda x: -x["yds"])
        return {
            "cobertura": cob, "coberturas": ps["coberturas"], "man": cob in ("Cover-0", "Cover-1", "2-Man"),
            "rushers": int(round(B["defensa"]["rushers"] + (1.3 if cob == "Cover-0" else 0))), "blitz": ps["blitz"],
            "tiempo_concepto": tiempo, "tiempo_presion": _r(max(A["tiempo_lanzamiento"] * (1.25 - p_base), 1.6), 2),
            "probabilidades": {"completo": _r(p_comp), "incompleto": _r(p_inc), "intercepcion": _r(p_int), "sack": _r(p_sack)},
            "presion": _r(p_pres), "yardas_completo": _r(yc, 1), "yardas_esperadas": _r(yds_exp, 2), "primero": _r(p_primero),
            "ventaja_concepto": adv, "consejo": CONSEJO_COBERTURA.get(cob, ""), "alternativas": alternativas,
            "concepto": c["nombre"],
        }

    def jugadas_reales(self, eq: str) -> list:
        return self.tracking["jugadas_reales"].get(eq, [])


_datos: Datos | None = None


def datos() -> Datos:
    global _datos
    if _datos is None:
        _datos = Datos()
    return _datos
