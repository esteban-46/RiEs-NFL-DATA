"""Resume los 850 MB de tracking en un JSON compacto (backend/datos/tracking_resumen.json).

Se corre una sola vez antes de entregar:  .venv\\Scripts\\python.exe -m backend.preprocesar_tracking
El servidor solo lee el JSON resultante; nunca escribe en disco.
"""
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
D = RAIZ / "data" / "nfl-big-data-bowl-regional-event-data-main" / "data"
SALIDA = Path(__file__).resolve().parent / "datos" / "tracking_resumen.json"

EVENTOS_SNAP = {"ball_snap", "autoevent_ballsnap"}
EVENTOS_FIN = {"pass_forward", "autoevent_passforward", "qb_sack", "run", "qb_strip_sack"}
JUGADAS_POR_EQUIPO = 5


def main() -> None:
    plays = pd.read_csv(D / "plays.csv")
    pff = pd.read_csv(D / "pffScoutingData.csv", usecols=["gameId", "playId", "nflId", "pff_positionLinedUp", "pff_role"])
    info = plays.set_index(["gameId", "playId"])

    vmax: dict[int, float] = {}
    amax: dict[int, float] = {}
    # alineacion[equipo][lado][formacion][posicion] -> lista de (dx, dy)
    alin = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(list))))
    t_lanz = defaultdict(list)
    candidatas = defaultdict(list)

    archivos = sorted((D / "tracking").glob("tracking_*.csv"))
    for i, f in enumerate(archivos, 1):
        t = pd.read_csv(f, usecols=["gameId", "playId", "nflId", "frameId", "team", "playDirection", "x", "y", "s", "a", "event"])
        gid = int(t.gameId.iloc[0])
        jug = t[t.team != "football"]
        ok = jug[jug.s < 11.5]
        for nid, v in ok.groupby("nflId").s.max().items():
            vmax[int(nid)] = max(vmax.get(int(nid), 0.0), float(v))
        for nid, v in jug[jug.a < 12].groupby("nflId").a.max().items():
            amax[int(nid)] = max(amax.get(int(nid), 0.0), float(v))

        # normaliza: la ofensiva siempre avanza hacia la derecha
        izq = t.playDirection == "left"
        t.loc[izq, "x"] = 120 - t.loc[izq, "x"]
        t.loc[izq, "y"] = 53.3 - t.loc[izq, "y"]

        balon = t[t.team == "football"]
        ev = balon.dropna(subset=["event"])
        snap = ev[ev.event.isin(EVENTOS_SNAP)].groupby("playId").frameId.min()
        fin = ev[ev.event.isin(EVENTOS_FIN)].groupby("playId").frameId.min()
        pg = pff[pff.gameId == gid]
        pos = dict(zip(zip(pg.playId.astype(int), pg.nflId.astype(int)), pg.pff_positionLinedUp))

        for pid, fs in snap.items():
            if (gid, pid) not in info.index:
                continue
            p = info.loc[(gid, pid)]
            of, de, form = p.possessionTeam, p.defensiveTeam, p.offenseFormation if isinstance(p.offenseFormation, str) else "SHOTGUN"
            if pid in fin.index:
                t_lanz[of].append((fin[pid] - fs) / 10)
            cuadro = t[(t.playId == pid) & (t.frameId == fs)]
            b = cuadro[cuadro.team == "football"]
            if b.empty:
                continue
            bx, by = float(b.x.iloc[0]), float(b.y.iloc[0])
            for r in cuadro[cuadro.team != "football"].itertuples():
                pl = pos.get((int(pid), int(r.nflId)))
                if pl is None:
                    continue
                lado = "of" if r.team == of else "de"
                clave = form if lado == "of" else "TODAS"
                alin[r.team][lado][clave][pl].append((r.x - bx, r.y - by))

            # candidatas para la biblioteca de jugadas reales
            if p.passResult == "C" and 6 <= p.playResult <= 40 and pid in fin.index:
                candidatas[of].append((float(p.playResult), gid, int(pid), int(fs), int(fin[pid])))
        print(f"[{i}/{len(archivos)}] {f.name}", flush=True)

    # biblioteca de jugadas reales: las mejores completas de cada equipo
    biblioteca = {}
    porjuego = defaultdict(list)
    for eq, lista in candidatas.items():
        lista.sort(reverse=True)
        elegidas = lista[:: max(1, len(lista) // JUGADAS_POR_EQUIPO)][:JUGADAS_POR_EQUIPO]
        for c in elegidas:
            porjuego[c[1]].append((eq, c))
    for gid, items in porjuego.items():
        t = pd.read_csv(D / "tracking" / f"tracking_{gid}.csv", usecols=["playId", "nflId", "frameId", "team", "playDirection", "x", "y", "s", "jerseyNumber"])
        izq = t.playDirection == "left"
        t.loc[izq, "x"] = 120 - t.loc[izq, "x"]
        t.loc[izq, "y"] = 53.3 - t.loc[izq, "y"]
        for eq, (yds, _, pid, fs, ff) in items:
            p = info.loc[(gid, pid)]
            tp = t[(t.playId == pid) & (t.frameId >= fs - 5) & (t.frameId <= ff + 5)]
            marcos = []
            for fid, g in tp.groupby("frameId"):
                if (fid - fs) % 2:
                    continue
                marcos.append([[str(r.team)[0:3], round(float(r.x), 1), round(float(r.y), 1), int(r.jerseyNumber) if not np.isnan(r.jerseyNumber) else 0]
                               for r in g.itertuples()])
            biblioteca.setdefault(eq, []).append({
                "gameId": int(gid), "playId": int(pid), "rival": p.defensiveTeam,
                "descripcion": str(p.playDescription), "yardas": int(yds), "down": int(p.down), "distancia": int(p.yardsToGo),
                "formacion": p.offenseFormation, "cobertura": p.pff_passCoverage, "marcos": marcos,
            })

    def resumen_alin(d):
        out = {}
        for clave, posiciones in d.items():
            total = max(len(v) for v in posiciones.values())
            out[clave] = {pl: {"dx": round(float(np.mean([a for a, _ in v])), 2), "dy": round(float(np.mean([b for _, b in v])), 2),
                               "frec": round(len(v) / total, 3)} for pl, v in posiciones.items() if len(v) >= 3}
        return out

    resultado = {
        "jugadores": {str(k): {"vmax": round(v, 2), "amax": round(amax.get(k, 0), 2)} for k, v in vmax.items()},
        "equipos": {eq: {"tiempo_lanzamiento": round(float(np.median(t_lanz[eq])), 2) if t_lanz[eq] else 2.7,
                         "alineacion_of": resumen_alin(alin[eq]["of"]), "alineacion_de": resumen_alin(alin[eq]["de"])}
                    for eq in alin},
        "jugadas_reales": biblioteca,
    }
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("OK", SALIDA, round(SALIDA.stat().st_size / 1e6, 2), "MB")


if __name__ == "__main__":
    main()
