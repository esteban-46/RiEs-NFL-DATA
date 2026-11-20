"""API de Playbook Lab. Ejecuta: .venv\\Scripts\\uvicorn backend.main:app --reload"""
import os
from pathlib import Path


def cargar_env():
    f = Path(__file__).resolve().parent.parent / ".env"
    if f.exists():
        for linea in f.read_text(encoding="utf-8-sig").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


cargar_env()

from fastapi import FastAPI, HTTPException, Query  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from backend.analisis import CONCEPTOS, datos  # noqa: E402
from backend.ia import plan_ia  # noqa: E402

app = FastAPI(title="Hackathon NFL UNAM")


@app.on_event("startup")
def precargar() -> None:
    datos()


def _equipo(eq: str) -> str:
    eq = eq.upper()
    if eq not in datos().equipos:
        raise HTTPException(404, f"Equipo desconocido: {eq}")
    return eq


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/equipos")
def equipos() -> dict:
    d = datos()
    return {"equipos": [{"equipo": e, "record": {k: v for k, v in d.record(e).items() if k != "partidos"}} for e in d.equipos],
            "liga": d.liga, "resumen": {"partidos": int(len(d.games)), "jugadas": int(len(d.plays)),
                                        "jugadores": int(len(d.players)), "registros_pff": int(len(d.pff)),
                                        "jugadas_tracking": sum(len(v) for v in d.tracking["jugadas_reales"].values())}}


@app.get("/api/versus")
def versus(a: str = Query(...), b: str = Query(...)) -> dict:
    a, b = _equipo(a), _equipo(b)
    if a == b:
        raise HTTPException(400, "Elige dos equipos distintos")
    return datos().versus(a, b)


@app.get("/api/tendencias")
def tendencias(equipo: str) -> dict:
    return datos().tendencias(_equipo(equipo))


@app.get("/api/presnap")
def presnap(equipo: str, down: int = Query(3, ge=1, le=4), distancia: int = Query(7, ge=1, le=40),
            caja: int | None = Query(None, ge=3, le=11), personal: str | None = None) -> dict:
    return datos().presnap(_equipo(equipo), down, distancia, caja, personal)


@app.get("/api/simulacion/contexto")
def contexto(ofensiva: str, defensa: str, formacion: str = "SHOTGUN") -> dict:
    return datos().contexto_sim(_equipo(ofensiva), _equipo(defensa), formacion.upper())


class Simulacion(BaseModel):
    ofensiva: str
    defensa: str
    down: int = Field(1, ge=1, le=4)
    distancia: int = Field(10, ge=1, le=40)
    yarda: int = Field(25, ge=1, le=99)
    formacion: str = "SHOTGUN"
    concepto: str = "rapido"
    play_action: bool = False
    cobertura: str | None = None


@app.post("/api/simular")
def simular(s: Simulacion) -> dict:
    if s.concepto not in CONCEPTOS:
        raise HTTPException(400, "Concepto desconocido")
    return datos().simular(_equipo(s.ofensiva), _equipo(s.defensa), s.down, s.distancia, s.yarda,
                           s.formacion.upper(), s.concepto, s.play_action, s.cobertura)


@app.get("/api/jugadas-reales")
def jugadas_reales(equipo: str) -> dict:
    return {"jugadas": datos().jugadas_reales(_equipo(equipo))}


@app.get("/api/plan-ia")
def plan_con_ia(a: str, b: str) -> dict:
    v = datos().versus(_equipo(a), _equipo(b))
    resumen = {
        "equipo_A": a, "equipo_B": b, "prob_victoria_A": v["prob_a"],
        "ofensiva_A": v["a"]["ofensiva"], "defensa_A": v["a"]["defensa"],
        "ofensiva_B": v["b"]["ofensiva"], "defensa_B": v["b"]["defensa"],
        "coberturas_B": v["b"]["coberturas_def"][:4], "ventajas": v["ventajas"], "plan_reglas": v["plan"],
        "duelos": v["duelos"],
    }
    texto = plan_ia(resumen)
    return {"disponible": texto is not None, "texto": texto}
