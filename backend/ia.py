"""Coordinador IA opcional: Amazon Nova en Bedrock vía Strands. Si falla, la app sigue funcionando."""
import json
import os

SISTEMA = (
    "Eres un coordinador ofensivo y defensivo de la NFL. Hablas español de México, directo y táctico. "
    "Recibes estadísticas reales de pases (semanas 1-8, temporada 2021) de dos equipos. "
    "Escribe un plan de juego breve para el entrenador del equipo A: 3 claves ofensivas, 3 claves defensivas "
    "y una jugada de tercera y larga. Cita los números que recibes. No inventes jugadores ni estadísticas. "
    "Máximo 180 palabras, en viñetas con guion."
)


def plan_ia(resumen: dict) -> str | None:
    try:
        from strands import Agent
        from strands.models import BedrockModel

        modelo = BedrockModel(
            model_id=os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0"),
            region_name=os.environ.get("AWS_REGION", "us-east-1"),
            temperature=0.4,
        )
        agente = Agent(model=modelo, system_prompt=SISTEMA, callback_handler=None)
        respuesta = agente(json.dumps(resumen, ensure_ascii=False))
        texto = str(respuesta).strip()
        return texto or None
    except Exception:  # noqa: BLE001 - la IA es opcional; cualquier error regresa None
        return None
