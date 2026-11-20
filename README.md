# Playbook Lab · Hackathon NFL Big Data Bowl UNAM

Sitio para entrenadores que convierte los datos del NFL Big Data Bowl 2023 (temporada 2021, semanas 1 a 8) en decisiones de juego. Eliges tu equipo y un rival, y todo el análisis se recalcula y se pinta con los colores de ambos.

## Hallazgo principal

El juego aéreo se decide en el cruce entre la cobertura que usa la defensa y el concepto de rutas que llama la ofensiva, y en si la protección aguanta el tiempo que ese concepto necesita. La app mide ese cruce con datos reales para cualquier pareja de equipos y lo traduce en un % de victoria explicado, un plan de juego y una simulación animada.

## Secciones

1. **Versus.** Portada dividida a media pantalla con los dos equipos y su probabilidad de victoria. Debajo vienen:
   - **Panorama:** texto con las cifras clave y un radar comparativo.
   - **Velocidades máximas:** medidas por el tracking.
   - **Por qué ese %:** el aporte de cada factor del modelo.
   - **Historial:** partido directo, rivales en común y diferencial de puntos por semana.
   - **Ventajas y desventajas:** coberturas del rival contra el rendimiento propio.
   - **Mapa de presión:** presión permitida por posición de la línea ofensiva y de dónde viene el rush.
   - **Duelos clave:** mejor pass rusher contra el bloqueador más débil.
   - **Plan de juego:** recomendaciones al atacar y al defender, más un plan narrado por IA (opcional).
2. **Simulador de jugada.** Eliges quién ataca, el down, la distancia, la posición en el campo, la formación, el concepto de rutas, el play action y la cobertura. Los jugadores salen de sus posiciones promedio reales al snap y corren a la velocidad máxima medida por el tracking. La defensa reacciona con la cobertura más probable del rival (personal o zona), la presión llega en el tiempo estimado y el QB lanza al receptor más abierto. El resultado sale de las probabilidades calculadas con los datos. Incluye repeticiones de jugadas reales reconstruidas con el tracking.
3. **Lector pre-snap.** Con la situación, los defensores en la caja y tu personal ofensivo, predice la cobertura, la probabilidad de marcaje personal o zona y la de blitz. También muestra un mapa de tendencias por down y distancia.

## Datos y depuración

- `plays.csv`: se conservan la situación, la formación, el personal, la cobertura, el play action y el resultado. Se descartan las columnas de segunda y tercera falta (más del 99% vacías). Se derivan éxito, jugadas explosivas, conversión y rango de distancia.
- `pffScoutingData.csv`: presión generada por cada rusher, presión permitida por cada bloqueador y número de rushers por jugada (5 o más cuenta como blitz).
- `tracking/*.csv` (850 MB): `backend/preprocesar_tracking.py` los resume en `backend/datos/tracking_resumen.json` (1.7 MB). El resumen guarda la velocidad máxima de cada jugador, la alineación promedio al snap por equipo y posición, el tiempo hasta el lanzamiento y una biblioteca de jugadas reales.
- `data/resultados_2021_nflverse.csv`: marcadores finales de los 122 partidos, tomados de [nflverse](https://github.com/nflverse/nfldata), que es dato público y está permitido por el reglamento del Big Data Bowl. El dataset original solo trae el marcador antes de cada jugada de pase.

Limitaciones: el dataset solo trae jugadas de pase y el tracking termina medio segundo después del lanzamiento. Lo que pasa después del pase (vuelo del balón, atrapada y yardas después de la recepción) se modela con estadísticas. La matriz que dice qué concepto funciona mejor contra cada cobertura es conocimiento táctico experto y está marcada así en el código.

## Cómo correrlo

```powershell
# backend (desde la raíz)
.\.venv\Scripts\uvicorn backend.main:app --reload
# frontend (otra terminal)
cd dashboard; npm run dev
```

Para regenerar el resumen del tracking: `.\.venv\Scripts\python.exe -m backend.preprocesar_tracking`.

La IA es opcional: usa Amazon Nova en Bedrock con Strands. En local toma las llaves temporales de `.env`. Si no está disponible, la app funciona igual.
