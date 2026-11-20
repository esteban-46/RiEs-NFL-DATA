import { useEffect, useMemo, useRef, useState } from 'react'
import { Json, get, num, pct, post } from './api'
import { eq } from './equipos'
import { Barra, Cargando, Escudo, Reveal, Seccion } from './ui'

/* ============================================================ motor de simulación */
type V = [number, number]
type Jug = { id: string; lado: 'of' | 'de'; pos: string; nombre: string; vmax: number; rol: 'ol' | 'qb' | 'rec' | 'rush' | 'cov'; x0: number; y0: number }
type Cuadro = { p: Record<string, V>; balon: V; alto: number; evento?: string }
type Resultado = { cuadros: Cuadro[]; jugadores: Jug[]; zonas: V[]; marcas: [string, string][]; tipo: string; yardas: number; objetivo?: string; separacion?: number; tLanz: number }

const LOS = 15, MID = 26.65, DT = 0.05
const OLP = new Set(['LT', 'LG', 'C', 'RG', 'RT'])
const DL = ['DLT', 'DRT', 'NT', 'NLT', 'NRT', 'LEO', 'REO', 'LE', 'RE', 'DT', 'LOLB', 'ROLB']
const CENTRO = new Set(['SINGLEBACK', 'I_FORM', 'JUMBO', 'WILDCAT'])
const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1])
const lerp = (a: V, b: V, k: number): V => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

function rutaRel(concepto: string, tipo: string, s: number, flood: number, rango: number): V[] {
  const i = -s
  if (concepto === 'rapido') return tipo === 'out' ? [[3, 0], [9, i * 5]] : tipo === 'slot' ? [[5, 0], [5.5, s * 5]] : tipo === 'te' ? [[5, 0], [5, i]] : [[1, s * 3], [3, s * 8]]
  if (concepto === 'profundo') return tipo === 'out' ? [[30, 0]] : tipo === 'slot' ? [[6, 0], [30, i * 2]] : tipo === 'te' ? [[6, 0], [26, i * 3]] : [[1, s * 3], [4, s * 7]]
  if (concepto === 'cruces') return tipo === 'out' ? [[12, 0], [12.5, i * 12]] : tipo === 'slot' ? [[2, 0], [5, i * 8], [6, i * 22]] : tipo === 'te' ? [[3, 0], [6, i * 18]] : [[2, s * 3], [8, s * 8], [24, s * 9]]
  if (concepto === 'flood') {
    if (tipo === 'back') return [[2, flood * 4], [4, flood * 10]]
    if (s !== flood) return [[12, 0], [26, i * 6]]
    return rango === 0 ? [[30, 0]] : rango === 1 ? [[10, 0], [15, s * 8]] : [[2, s * 4], [4, s * 9]]
  }
  // screen: el corredor recibe detrás de la línea, el resto limpia
  return tipo === 'back' ? [[-1.5, s * 2.5], [-1, s * 6], [4, s * 10]] : [[22, 0]]
}

function posEnRuta(start: V, ruta: V[], d: number): V {
  let p = start
  for (const w of ruta) {
    const q: V = [start[0] + w[0], start[1] + w[1]]
    const l = dist(p, q)
    if (d <= l) return lerp(p, q, l ? d / l : 0)
    d -= l
    p = q
  }
  return [p[0], clamp(p[1], 1, 52.3)]
}

const recorrido = (v: number, t: number) => (t < 1 ? (v * t * t) / 2 : v * (t - 0.5))

function zonasDe(cob: string): { prof: V[]; bajo: V[] } {
  const flats: V[] = [[LOS + 4, MID - 20], [LOS + 4, MID + 20]], curls: V[] = [[LOS + 8, MID - 11], [LOS + 8, MID + 11]], hook: V = [LOS + 7, MID]
  if (cob === 'Cover-2') return { prof: [[LOS + 15, MID - 12], [LOS + 15, MID + 12]], bajo: [...flats, ...curls, hook] }
  if (cob === 'Quarters') return { prof: [[LOS + 12, 6], [LOS + 13, MID - 7], [LOS + 13, MID + 7], [LOS + 12, 47.3]], bajo: [...curls, hook] }
  if (cob === 'Cover-6') return { prof: [[LOS + 15, MID - 12], [LOS + 13, MID + 6], [LOS + 12, 47.3]], bajo: [...flats, ...curls, hook] }
  if (cob === 'Cover-1') return { prof: [[LOS + 16, MID]], bajo: [hook] }
  if (cob === '2-Man') return { prof: [[LOS + 15, MID - 12], [LOS + 15, MID + 12]], bajo: [hook] }
  if (cob === 'Cover-0') return { prof: [], bajo: [[LOS + 5, MID]] }
  return { prof: [[LOS + 16, MID - 17.8], [LOS + 17, MID], [LOS + 16, MID + 17.8]], bajo: [...flats, ...curls, hook] }
}

function azar(semilla: number) {
  let s = semilla % 2147483647 || 1
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

export function simularJugada(ctx: Json, sim: Json, op: { concepto: string; formacion: string; play_action: boolean; distancia: number; yarda: number }, semilla: number): Resultado {
  const rnd = azar(semilla)
  const jugOf = ctx.jugadores_of, jugDe = ctx.jugadores_de
  let alinOf: Json[] = ctx.alineacion_of.length >= 9 ? ctx.alineacion_of : [
    { pos: 'LT', dx: -1.2, dy: 3.4 }, { pos: 'LG', dx: -1, dy: 1.7 }, { pos: 'C', dx: -0.4, dy: 0 }, { pos: 'RG', dx: -0.9, dy: -1.6 }, { pos: 'RT', dx: -1.1, dy: -3.2 },
    { pos: 'QB', dx: -4.6, dy: 0 }, { pos: 'HB', dx: -4.8, dy: 2.5 }, { pos: 'LWR', dx: -1, dy: 14.5 }, { pos: 'RWR', dx: -1, dy: -14.5 }, { pos: 'SLWR', dx: -1, dy: 8 }, { pos: 'TE-R', dx: -1, dy: -5 }]
  alinOf = alinOf.slice(0, 11)
  const alinDe: Json[] = ctx.alineacion_de.slice(0, 11)
  const J: Jug[] = []
  alinOf.forEach((a) => J.push({ id: 'o' + a.pos, lado: 'of', pos: a.pos, nombre: jugOf[a.pos]?.nombre ?? a.pos, vmax: jugOf[a.pos]?.vmax ?? 7.5,
    rol: OLP.has(a.pos) ? 'ol' : a.pos === 'QB' ? 'qb' : 'rec', x0: LOS + a.dx, y0: clamp(MID + a.dy, 1.5, 51.8) }))
  const orden = [...alinDe].sort((x, y) => (DL.indexOf(x.pos) < 0 ? 99 : DL.indexOf(x.pos)) - (DL.indexOf(y.pos) < 0 ? 99 : DL.indexOf(y.pos)))
  const nRush = clamp(sim.rushers, 3, 7)
  orden.forEach((a, k) => J.push({ id: 'd' + a.pos, lado: 'de', pos: a.pos, nombre: jugDe[a.pos]?.nombre ?? a.pos, vmax: jugDe[a.pos]?.vmax ?? 7.5,
    rol: k < nRush ? 'rush' : 'cov', x0: LOS + Math.max(a.dx, 0.8), y0: clamp(MID + a.dy, 1.5, 51.8) }))

  const qb = J.find((j) => j.rol === 'qb') ?? J[5]
  const recs = J.filter((j) => j.rol === 'rec')
  const ols = J.filter((j) => j.rol === 'ol')
  const rush = J.filter((j) => j.rol === 'rush')
  const cov = J.filter((j) => j.rol === 'cov')
  const lado = (j: Jug) => (j.y0 >= MID ? 1 : -1)
  const floodSide = recs.filter((r) => lado(r) > 0).length >= recs.filter((r) => lado(r) < 0).length ? 1 : -1

  // rutas de receptores (no dependen de la defensa)
  const rutas: Record<string, V[]> = {}
  for (const s of [1, -1]) {
    const delLado = recs.filter((r) => lado(r) === s).sort((a, b) => Math.abs(b.y0 - MID) - Math.abs(a.y0 - MID))
    delLado.forEach((r, k) => {
      const ady = Math.abs(r.y0 - MID), adx = LOS - r.x0
      const tipo = adx > 2.5 && ady < 5 ? 'back' : ady > 10 ? 'out' : ady > 4 ? 'slot' : 'te'
      rutas[r.id] = rutaRel(op.concepto, tipo, s, floodSide, k)
    })
  }

  const T_LANZ = sim.tiempo_concepto as number
  const pr = sim.probabilidades
  const tPres = Math.max(sim.tiempo_presion as number, 1.3)
  const esSack = rnd() < pr.sack
  const tSack = Math.min(tPres, T_LANZ - 0.1)
  const dropAtras = CENTRO.has(op.formacion) ? 6 : 2.5
  const qbPos = (t: number): V => {
    let x = qb.x0, y = qb.y0
    if (op.play_action && t < 0.6) y += Math.sin((t / 0.6) * Math.PI) * 1.5
    x -= dropAtras * clamp((t - (op.play_action ? 0.3 : 0)) / 1.0, 0, 1)
    return [x, y]
  }
  const recPos = (r: Jug, t: number): V => posEnRuta([r.x0, r.y0], rutas[r.id], recorrido(r.vmax * 0.86, t))

  // asignaciones defensivas
  const { prof, bajo } = zonasDe(sim.cobertura)
  const man = ['Cover-0', 'Cover-1', '2-Man'].includes(sim.cobertura)
  const asign: Record<string, string> = {}, zonaDe: Record<string, V> = {}
  const libres = [...cov].sort((a, b) => b.x0 - a.x0)
  for (const z of prof) {
    if (!libres.length) break
    const k = libres.slice(0, Math.max(prof.length, 2)).reduce((m, d, i, arr) => (Math.abs(d.y0 - z[1]) < Math.abs(arr[m].y0 - z[1]) ? i : m), 0)
    zonaDe[libres[k].id] = z
    libres.splice(k, 1)
  }
  if (man) {
    const objetivos = [...recs].sort((a, b) => Math.abs(b.y0 - MID) - Math.abs(a.y0 - MID))
    for (const r of objetivos) {
      if (!libres.length) break
      const k = libres.reduce((m, d, i, arr) => (dist([d.x0, d.y0], [r.x0, r.y0]) < dist([arr[m].x0, arr[m].y0], [r.x0, r.y0]) ? i : m), 0)
      asign[libres[k].id] = r.id
      libres.splice(k, 1)
    }
  }
  const bajoLibre = [...bajo]
  for (const d of libres) {
    if (!bajoLibre.length) bajoLibre.push([LOS + 7, MID])
    const k = bajoLibre.reduce((m, z, i, arr) => (dist([d.x0, d.y0], z) < dist([d.x0, d.y0], arr[m]) ? i : m), 0)
    zonaDe[d.id] = bajoLibre[k]
    bajoLibre.splice(k, 1)
  }
  // bloqueos: cada rusher con el OL más cercano
  const bloqueo: Record<string, string> = {}
  rush.forEach((d) => {
    const o = ols.reduce((m, x) => (Math.abs(x.y0 - d.y0) < Math.abs(m.y0 - d.y0) ? x : m), ols[0])
    if (o) bloqueo[o.id] = bloqueo[o.id] ?? d.id
  })

  // integración cuadro a cuadro
  const cuadros: Cuadro[] = []
  const pos: Record<string, V> = {}
  J.forEach((j) => (pos[j.id] = [j.x0, j.y0]))
  const hist: Record<string, V[]> = {}
  let tipo = esSack ? 'sack' : '', objetivo: Jug | undefined, separacion = 0, tLlegada = 0, destino: V = [0, 0], origen: V = [0, 0], yac = 0, catchX = 0, yardas = 0
  let portador: string | undefined
  const T_FIN = 9
  for (let t = 0; t <= T_FIN; t += DT) {
    const fase = esSack ? (t < tSack ? 'pocket' : 'sack') : t < T_LANZ ? 'pocket' : t < tLlegada || !tLlegada ? 'aire' : 'post'
    let evento: string | undefined
    // QB
    if (!(esSack && t >= tSack)) pos[qb.id] = qbPos(Math.min(t, T_LANZ))
    // receptores
    for (const r of recs) {
      if (portador === r.id) {
        const vx = r.vmax * 0.8 * DT
        if (pos[r.id][0] < catchX + yac) pos[r.id] = [pos[r.id][0] + vx, pos[r.id][1]]
      } else if (fase !== 'post' || tipo !== 'int') pos[r.id] = recPos(r, t)
      ;(hist[r.id] ??= []).push(pos[r.id])
    }
    // rushers
    rush.forEach((d, k) => {
      const q = pos[qb.id]
      const meta: V = [q[0] + 0.6, q[1] + (d.y0 - MID) * 0.25]
      const tope = esSack && k === 0 ? 1 : esSack ? 0.85 : 0.72
      const prog = clamp(Math.pow(t / tPres, 0.9), 0, tope)
      pos[d.id] = fase === 'post' || (fase === 'aire' && t > T_LANZ + 0.3) ? lerp(pos[d.id], meta, 0.02) : lerp([d.x0, d.y0], meta, prog)
    })
    // línea ofensiva
    for (const o of ols) {
      const rid = bloqueo[o.id]
      const base: V = [o.x0 - 1.4 * clamp(t / 0.6, 0, 1), o.y0]
      pos[o.id] = rid ? lerp(base, [pos[rid][0] - 0.9, pos[rid][1]], clamp(t / 0.8, 0, 0.75)) : base
      if (op.concepto === 'screen' && t > 1.1) pos[o.id] = [pos[o.id][0] + Math.min((t - 1.1) * 3, 6), pos[o.id][1] + (pos[o.id][1] < MID ? -1 : 1) * Math.min((t - 1.1) * 2, 4)]
    }
    // cobertura
    for (const d of cov) {
      const vd = d.vmax * 0.84 * clamp(t / 0.9, 0.25, 1) * DT
      let meta: V
      if (portador || (fase === 'aire' && objetivo)) {
        meta = portador ? pos[portador] : destino
      } else if (asign[d.id]) {
        const r = recs.find((x) => x.id === asign[d.id])!
        const h = hist[r.id], atras = h[Math.max(0, h.length - 1 - 5)]
        meta = [atras[0] + 1.0, atras[1]]
      } else {
        const z = zonaDe[d.id] ?? [LOS + 8, MID]
        meta = z
        if (t > 0.8) {
          const cerca = recs.map((r) => pos[r.id]).filter((p) => dist(p, z) < 7).sort((a, b) => dist(a, z) - dist(b, z))[0]
          if (cerca) {
            const m = lerp(z, [cerca[0] + 0.8, cerca[1]], 0.7)
            meta = dist(m, z) > 5 ? lerp(z, m, 5 / dist(m, z)) : m
          }
        }
      }
      const p = pos[d.id], l = dist(p, meta)
      pos[d.id] = l < 1e-6 ? p : lerp(p, meta, Math.min(1, vd / l))
    }

    // eventos
    let balon: V = pos[qb.id], alto = 0
    if (esSack && t >= tSack && tipo === 'sack') {
      if (!cuadros.some((c) => c.evento === 'sack')) evento = 'sack'
      yardas = Math.round(LOS - pos[qb.id][0])
      yardas = -Math.max(yardas, 2)
    }
    if (!esSack && t >= T_LANZ && !objetivo) {
      // el QB lee la cobertura y lanza al receptor más abierto
      const cand = recs.filter((r) => op.concepto === 'screen' ? true : pos[r.id][0] > LOS - 0.5)
      const puntaje = (r: Jug) => {
        const sep = Math.min(...cov.map((d) => dist(pos[d.id], pos[r.id])), 15)
        return sep + 0.06 * Math.min(pos[r.id][0] - LOS, op.distancia + 4) + (op.concepto === 'screen' && rutas[r.id][0][0] < 0 ? 20 : 0)
      }
      objetivo = cand.sort((a, b) => puntaje(b) - puntaje(a))[0] ?? recs[0]
      separacion = Math.min(...cov.map((d) => dist(pos[d.id], pos[objetivo!.id])))
      origen = pos[qb.id]
      let tv = 0.6
      for (let k = 0; k < 3; k++) { destino = recPos(objetivo, t + tv); tv = dist(origen, destino) / 21 + 0.25 }
      tLlegada = t + tv
      // la separación real ajusta la probabilidad de completar
      const ajuste = clamp(0.7 + separacion * 0.12, 0.55, 1.3)
      const pc = pr.completo * ajuste, pi = pr.intercepcion * (separacion < 1.5 ? 1.8 : 0.7), pinc = pr.incompleto
      const tot = pc + pi + pinc, r = rnd() * tot
      tipo = r < pc ? 'completo' : r < pc + pi ? 'int' : 'incompleto'
      evento = 'lanza'
    }
    if (objetivo && t >= T_LANZ && t < tLlegada) {
      const k = (t - T_LANZ) / (tLlegada - T_LANZ)
      balon = lerp(origen, destino, k)
      alto = Math.sin(k * Math.PI) * clamp(dist(origen, destino) / 8, 0.6, 4)
    } else if (objetivo && t >= tLlegada) {
      if (!cuadros.some((c) => c.evento === tipo)) {
        evento = tipo
        if (tipo === 'completo') {
          portador = objetivo.id
          catchX = pos[objetivo.id][0]
          const prof2 = catchX - LOS
          yac = Math.max(0, (sim.yardas_completo - prof2) * (0.4 + rnd() * 0.9)) + rnd() * 3 * clamp(separacion / 3, 0.2, 1.5)
        }
        if (tipo === 'int') {
          const d = cov.reduce((m, x) => (dist(pos[x.id], destino) < dist(pos[m.id], destino) ? x : m), cov[0])
          pos[d.id] = destino
          portador = undefined
        }
      }
      balon = tipo === 'completo' && portador ? pos[portador] : tipo === 'incompleto' ? [destino[0] + 1.2, destino[1] + 1] : destino
      if (tipo === 'completo') yardas = Math.round(pos[portador!][0] - LOS)
    }
    if (t === 0) evento = 'snap'
    cuadros.push({ p: { ...pos }, balon, alto, evento })
    const fin = esSack ? t > tSack + 1 : tLlegada && t > tLlegada + (tipo === 'completo' ? Math.max(yac / 6, 0.6) + 0.8 : 1)
    if (fin) break
  }
  const marcas: [string, string][] = Object.entries(asign)
  return { cuadros, jugadores: J, zonas: Object.values(zonaDe), marcas, tipo, yardas, objetivo: objetivo?.id, separacion, tLanz: T_LANZ }
}

/* ============================================================ campo */
function Campo({ yarda, distancia, children, ventana = [LOS - 15, LOS + 40] }: { yarda: number; distancia: number; children: React.ReactNode; ventana?: [number, number] }) {
  const [x0, x1] = ventana, ancho = x1 - x0
  const absLos = 10 + yarda
  const lineas = []
  for (let a = Math.ceil((absLos - (LOS - x0)) / 5) * 5; a <= absLos + (x1 - LOS); a += 5) {
    const x = LOS + (a - absLos)
    if (a < 0 || a > 120) continue
    lineas.push(<line key={a} x1={x} x2={x} y1={0} y2={53.3} stroke="#fff" strokeOpacity={a % 10 === 0 ? 0.5 : 0.25} strokeWidth={0.15} />)
    if (a % 10 === 0 && a > 10 && a < 110) {
      const n = a <= 60 ? a - 10 : 110 - a
      lineas.push(<text key={'t' + a} x={x} y={8} fill="#fff" fillOpacity={0.35} fontSize={2.6} fontWeight={900} textAnchor="middle">{n}</text>)
      lineas.push(<text key={'b' + a} x={x} y={47.5} fill="#fff" fillOpacity={0.35} fontSize={2.6} fontWeight={900} textAnchor="middle" transform={`rotate(180 ${x} 46.6)`}>{n}</text>)
    }
  }
  const zonaFin = LOS + (110 - absLos)
  return (
    <svg viewBox={`${x0} 0 ${ancho} 53.3`} className="h-auto w-full rounded-3xl" style={{ background: 'linear-gradient(180deg,#0f5132,#0b3d26)' }}>
      {Array.from({ length: Math.ceil(ancho / 5) }, (_, i) => <rect key={i} x={x0 + i * 5} y={0} width={5} height={53.3} fill="#fff" opacity={i % 2 ? 0.025 : 0} />)}
      {zonaFin < x1 && <rect x={zonaFin} y={0} width={10} height={53.3} fill="#000" opacity={0.25} />}
      {lineas}
      {Array.from({ length: Math.ceil(ancho) }, (_, i) => <g key={'h' + i}><line x1={x0 + i} x2={x0 + i} y1={0.5} y2={1.3} stroke="#fff" strokeOpacity=".3" strokeWidth=".1" /><line x1={x0 + i} x2={x0 + i} y1={23.3} y2={24} stroke="#fff" strokeOpacity=".3" strokeWidth=".1" /><line x1={x0 + i} x2={x0 + i} y1={29.3} y2={30} stroke="#fff" strokeOpacity=".3" strokeWidth=".1" /><line x1={x0 + i} x2={x0 + i} y1={52} y2={52.8} stroke="#fff" strokeOpacity=".3" strokeWidth=".1" /></g>)}
      <line x1={LOS} x2={LOS} y1={0} y2={53.3} stroke="#38bdf8" strokeWidth={0.35} />
      <line x1={LOS + distancia} x2={LOS + distancia} y1={0} y2={53.3} stroke="#facc15" strokeWidth={0.35} />
      {children}
    </svg>
  )
}

const ETIQUETA: Record<string, [string, string]> = {
  snap: ['SNAP', '#38bdf8'], lanza: ['¡LANZA!', '#fff'], completo: ['¡COMPLETO!', '#34d399'], incompleto: ['INCOMPLETO', '#fbbf24'], int: ['¡INTERCEPCIÓN!', '#f43f5e'], sack: ['¡SACK!', '#f43f5e'],
}

/* ============================================================ sección */
export function Simulador({ a, b }: { a: string; b: string }) {
  const [ataca, setAtaca] = useState<'a' | 'b'>('a')
  const of = ataca === 'a' ? a : b, de = ataca === 'a' ? b : a
  const eo = eq(of), ed = eq(de)
  const [op, setOp] = useState({ down: 3, distancia: 7, yarda: 35, formacion: 'SHOTGUN', concepto: 'cruces', play_action: false, cobertura: '' })
  const [ctx, setCtx] = useState<Json | null>(null)
  const [sim, setSim] = useState<Json | null>(null)
  const [semilla, setSemilla] = useState(7)
  const [cuadro, setCuadro] = useState(0)
  const [play, setPlay] = useState(false)
  const [vel, setVel] = useState(1)
  const [cargando, setCargando] = useState(false)

  useEffect(() => { get(`simulacion/contexto?ofensiva=${of}&defensa=${de}&formacion=${op.formacion}`).then(setCtx) }, [of, de, op.formacion])
  useEffect(() => { setSim(null); setPlay(false); setCuadro(0) }, [of, de])

  const res = useMemo(() => (ctx && sim ? simularJugada(ctx, sim, op, semilla) : null), [ctx, sim, semilla]) // eslint-disable-line react-hooks/exhaustive-deps

  // animación
  const raf = useRef(0)
  useEffect(() => {
    if (!play || !res) return
    let ult = performance.now(), acc = 0
    const paso = (t: number) => {
      acc += ((t - ult) / 1000) * vel
      ult = t
      const n = Math.floor(acc / DT)
      if (n > 0) {
        acc -= n * DT
        setCuadro((c) => {
          const s = c + n
          if (s >= res.cuadros.length - 1) { setPlay(false); return res.cuadros.length - 1 }
          return s
        })
      }
      raf.current = requestAnimationFrame(paso)
    }
    raf.current = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf.current)
  }, [play, res, vel])

  const simular = async (nueva = false) => {
    setCargando(true)
    try {
      const s = await post('simular', { ofensiva: of, defensa: de, ...op, cobertura: op.cobertura || null })
      setSim(s)
      setSemilla(nueva ? Math.floor(Math.random() * 1e6) + 1 : semilla)
      setCuadro(0)
      setPlay(true)
      document.getElementById('campo')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } finally { setCargando(false) }
  }

  const c = res?.cuadros[Math.min(cuadro, (res?.cuadros.length ?? 1) - 1)]
  const t = cuadro * DT
  const eventoActual = res ? [...res.cuadros.slice(0, cuadro + 1)].reverse().find((x) => x.evento)?.evento : undefined
  const conceptos = [['rapido', 'Juego rápido', 'Slants, outs y flat. Balón fuera en 1.8 s.'], ['cruces', 'Cruces (mesh)', 'Rutas cruzadas por debajo. Rompe el marcaje personal.'],
    ['flood', 'Niveles (flood)', 'Tres niveles en una banda. Sobrecarga la zona.'], ['profundo', 'Verticales', 'Cuatro rutas profundas. Ataca a los safeties.'], ['screen', 'Screen al RB', 'Pase detrás de la línea con bloqueadores.']]

  return (
    <Seccion id="simulacion" kicker="Laboratorio" titulo="Simulador de jugada" color={eo.t}>
      <Reveal>
        <p className="mb-8 max-w-3xl text-lg text-white/70">
          Diseña la jugada. Los jugadores se alinean en las <b className="text-white">posiciones promedio reales</b> de cada equipo al momento del snap y corren a su
          <b className="text-white"> velocidad máxima medida por el tracking</b>. La defensa responde con la cobertura que <b style={{ color: ed.t }}>{de}</b> usa más en esa situación,
          y la presión llega en el tiempo que su rush tarda contra esta línea.
        </p>
      </Reveal>
      <div className="grid gap-8 xl:grid-cols-[380px_1fr]">
        {/* -------- controles */}
        <Reveal>
          <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">¿Quién ataca?</p>
              <div className="grid grid-cols-2 gap-2">
                {(['a', 'b'] as const).map((l) => {
                  const ab = l === 'a' ? a : b, e = eq(ab)
                  return (
                    <button key={l} onClick={() => setAtaca(l)} className="flex items-center gap-2 rounded-2xl border-2 p-2 text-left transition hover:scale-[1.02]"
                      style={{ borderColor: ataca === l ? e.t : 'transparent', background: ataca === l ? `${e.p}cc` : 'rgba(255,255,255,.04)' }}>
                      <Escudo abbr={ab} size={30} /><span className="text-sm font-black text-white">{ab}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">Down</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((d) => (
                  <button key={d} onClick={() => setOp({ ...op, down: d })} className="rounded-xl py-2 font-black transition"
                    style={{ background: op.down === d ? eo.t : 'rgba(255,255,255,.06)', color: op.down === d ? '#000' : '#fff' }}>{d}º</button>
                ))}
              </div>
            </div>
            <Rango etiqueta="Yardas por avanzar" valor={op.distancia} min={1} max={20} set={(x) => setOp({ ...op, distancia: x })} color={eo.t} fmt={(x) => `${x} yds`} />
            <Rango etiqueta="Balón en" valor={op.yarda} min={1} max={95} set={(x) => setOp({ ...op, yarda: x })} color={eo.t}
              fmt={(x) => (x <= 50 ? `Propia ${x}` : `Rival ${100 - x}`)} />
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">Formación ({of})</p>
              <select value={op.formacion} onChange={(e) => setOp({ ...op, formacion: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-bold text-white">
                {(ctx?.formaciones?.length ? ctx.formaciones : ['SHOTGUN']).map((f: string) => <option key={f} className="bg-slate-900">{f}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">Concepto de rutas</p>
              <div className="grid gap-2">
                {conceptos.map(([k, n, d]) => (
                  <button key={k} onClick={() => setOp({ ...op, concepto: k })} className="rounded-xl border p-3 text-left transition hover:bg-white/10"
                    style={{ borderColor: op.concepto === k ? eo.t : 'rgba(255,255,255,.08)', background: op.concepto === k ? `${eo.t}22` : undefined }}>
                    <p className="text-sm font-black text-white">{n}</p><p className="text-xs text-white/50">{d}</p>
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-xl bg-white/[0.04] p-3">
              <span className="text-sm font-bold text-white">Play action</span>
              <input type="checkbox" checked={op.play_action} onChange={(e) => setOp({ ...op, play_action: e.target.checked })} className="h-5 w-5 accent-sky-400" />
            </label>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">Cobertura de {de}</p>
              <select value={op.cobertura} onChange={(e) => setOp({ ...op, cobertura: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-bold text-white">
                <option value="" className="bg-slate-900">Automática (la más probable)</option>
                {['Cover-0', 'Cover-1', 'Cover-2', '2-Man', 'Cover-3', 'Quarters', 'Cover-6'].map((x) => <option key={x} className="bg-slate-900">{x}</option>)}
              </select>
            </div>
            <button onClick={() => simular(false)} disabled={!ctx || cargando}
              className="w-full rounded-2xl py-4 text-lg font-black uppercase tracking-widest text-black transition hover:scale-[1.02] disabled:opacity-50"
              style={{ background: `linear-gradient(90deg, ${eo.t}, ${eo.s === '#000000' ? '#fff' : eo.s})` }}>
              {cargando ? 'Calculando…' : '▶ Simular jugada'}
            </button>
          </div>
        </Reveal>

        {/* -------- campo y resultados */}
        <div className="space-y-6">
          <div id="campo" className="relative">
            {!ctx ? <Cargando texto="Cargando alineaciones reales…" /> : (
              <Campo yarda={op.yarda} distancia={op.distancia}>
                {!res && ctx.alineacion_of.map((p: Json) => <Ficha key={'o' + p.pos} x={LOS + p.dx} y={MID + p.dy} color={eo.t} borde={eo.p} txt={p.pos} />)}
                {!res && ctx.alineacion_de.slice(0, 11).map((p: Json) => <Ficha key={'d' + p.pos} x={LOS + Math.max(p.dx, 0.8)} y={MID + p.dy} color={ed.t} borde={ed.p} txt={p.pos} cuadrada />)}
                {res && c && (
                  <g>
                    {!res.marcas.length && res.zonas.map((z, i) => <circle key={i} cx={z[0]} cy={z[1]} r={t < 0.3 ? t * 20 : 6} fill={ed.t} opacity={0.08} stroke={ed.t} strokeOpacity={0.3} strokeWidth={0.15} />)}
                    {t < 1.2 && res.marcas.map(([d, r]) => c.p[d] && c.p[r] && <line key={d} x1={c.p[d][0]} y1={c.p[d][1]} x2={c.p[r][0]} y2={c.p[r][1]} stroke={ed.t} strokeDasharray="0.6 0.6" strokeWidth={0.18} opacity={1 - t / 1.2} />)}
                    {res.jugadores.filter((j) => j.rol === 'rec' || j.rol === 'cov').map((j) => {
                      const pts = res.cuadros.slice(Math.max(0, cuadro - 40), cuadro + 1).map((q) => q.p[j.id]).filter(Boolean)
                      return <polyline key={'tr' + j.id} points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={j.lado === 'of' ? eo.t : ed.t} strokeWidth={0.25} strokeOpacity={0.45} strokeLinecap="round" />
                    })}
                    {res.objetivo && cuadro * DT >= res.tLanz && c.p[res.objetivo] && <circle cx={c.p[res.objetivo][0]} cy={c.p[res.objetivo][1]} r={2.2} fill="none" stroke="#fff" strokeWidth={0.2} className="animate-pulse" />}
                    {res.jugadores.map((j) => (
                      <Ficha key={j.id} x={c.p[j.id][0]} y={c.p[j.id][1]} color={j.lado === 'of' ? eo.t : ed.t} borde={j.lado === 'of' ? eo.p : ed.p} txt={j.pos} cuadrada={j.lado === 'de'}
                        titulo={`${j.nombre} · ${j.pos} · ${(j.vmax * 2.045).toFixed(1)} mph máx.`} />
                    ))}
                    <ellipse cx={c.balon[0]} cy={c.balon[1] + c.alto * 0.4} rx={0.5} ry={0.3} fill="#000" opacity={0.3} />
                    <ellipse cx={c.balon[0]} cy={c.balon[1] - c.alto} rx={0.6 + c.alto * 0.08} ry={0.38 + c.alto * 0.05} fill="#9a5b2a" stroke="#fff" strokeWidth={0.1} />
                  </g>
                )}
              </Campo>
            )}
            {eventoActual && ETIQUETA[eventoActual] && (
              <div key={eventoActual} className="banner pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-black/70 px-6 py-2 text-2xl font-black tracking-widest backdrop-blur"
                style={{ color: ETIQUETA[eventoActual][1] }}>
                {ETIQUETA[eventoActual][0]}{eventoActual === 'completo' && res ? ` ${res.yardas >= 0 ? '+' : ''}${res.yardas} yds` : ''}{eventoActual === 'sack' && res ? ` ${res.yardas} yds` : ''}
              </div>
            )}
            {res && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-2xl bg-black/60 px-4 py-2 backdrop-blur">
                <button onClick={() => { if (cuadro >= res.cuadros.length - 1) setCuadro(0); setPlay(!play) }} className="w-8 text-xl text-white">{play ? '❚❚' : '▶'}</button>
                <input type="range" min={0} max={res.cuadros.length - 1} value={cuadro} onChange={(e) => { setPlay(false); setCuadro(+e.target.value) }} className="flex-1 accent-sky-400" />
                <span className="w-14 text-right font-mono text-sm text-white">{t.toFixed(1)} s</span>
                <button onClick={() => setVel(vel === 1 ? 0.4 : 1)} className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white">{vel === 1 ? '1x' : '0.4x'}</button>
                <button onClick={() => simular(true)} className="rounded-lg bg-white px-3 py-1 text-xs font-black text-black">Otra tirada</button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-white/60">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: eo.t }} />{of} ofensiva</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: ed.t }} />{de} defensa</span>
            <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-sky-400" />Línea de golpeo</span>
            <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-yellow-400" />Primer down</span>
            <span>Pasa el cursor sobre un jugador para ver su nombre y velocidad.</span>
          </div>

          {sim && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-white/50">Reacción esperada de {de}</p>
                <p className="mt-1 text-3xl font-black" style={{ color: ed.t }}>{sim.cobertura}</p>
                <p className="text-sm text-white/60">{sim.man ? 'Marcaje personal' : 'Zona'} · {sim.rushers} rushers · blitz {pct(sim.blitz)} en esta situación</p>
                <div className="mt-4 space-y-2">
                  {sim.coberturas.slice(0, 5).map((x: Json) => (
                    <div key={x.cobertura} className="grid grid-cols-[80px_1fr_44px] items-center gap-2 text-sm">
                      <span className="font-bold text-white">{x.cobertura}</span><Barra valor={x.prob} max={sim.coberturas[0].prob} color={ed.t} /><span className="text-right tabular-nums text-white/70">{pct(x.prob)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 rounded-xl bg-white/[0.05] p-3 text-sm text-white/75">💡 {sim.consejo}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-white/50">Proyección · {sim.concepto}</p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-3xl font-black text-white">{num(sim.yardas_esperadas)}</p><p className="text-[10px] uppercase text-white/50">yds esperadas</p></div>
                  <div><p className="text-3xl font-black text-white">{pct(sim.primero)}</p><p className="text-[10px] uppercase text-white/50">primer down</p></div>
                  <div><p className="text-3xl font-black text-white">{pct(sim.presion)}</p><p className="text-[10px] uppercase text-white/50">presión</p></div>
                </div>
                <div className="mt-4 space-y-2">
                  {[['Completo', sim.probabilidades.completo, '#34d399'], ['Incompleto', sim.probabilidades.incompleto, '#fbbf24'], ['Sack', sim.probabilidades.sack, '#f97316'], ['Intercepción', sim.probabilidades.intercepcion, '#f43f5e']].map(([n, p, col]) => (
                    <div key={n as string} className="grid grid-cols-[90px_1fr_44px] items-center gap-2 text-sm">
                      <span className="font-bold text-white">{n}</span><Barra valor={p as number} color={col as string} /><span className="text-right tabular-nums text-white/70">{pct(p as number)}</span>
                    </div>
                  ))}
                </div>
                {res?.objetivo && <p className="mt-4 text-sm text-white/70">El QB lanzó a <b className="text-white">{res.jugadores.find((j) => j.id === res.objetivo)?.nombre}</b> con <b className="text-white">{num(res.separacion)} yds</b> de separación.</p>}
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white/50">Mejor concepto contra {sim.cobertura}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sim.alternativas.map((x: Json, i: number) => (
                    <button key={x.concepto} onClick={() => setOp({ ...op, concepto: x.concepto })} className="rounded-full px-3 py-1 text-xs font-bold transition hover:scale-105"
                      style={{ background: i === 0 ? '#34d399' : 'rgba(255,255,255,.08)', color: i === 0 ? '#000' : '#fff' }}>{x.nombre} · {num(x.yds)} yds</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <JugadasReales of={of} />
        </div>
      </div>
    </Seccion>
  )
}

function Rango({ etiqueta, valor, min, max, set, color, fmt }: { etiqueta: string; valor: number; min: number; max: number; set: (x: number) => void; color: string; fmt: (x: number) => string }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-widest"><span className="text-white/50">{etiqueta}</span><span style={{ color }}>{fmt(valor)}</span></div>
      <input type="range" min={min} max={max} value={valor} onChange={(e) => set(+e.target.value)} className="w-full accent-sky-400" />
    </div>
  )
}

function Ficha({ x, y, color, borde, txt, cuadrada, titulo }: { x: number; y: number; color: string; borde: string; txt: string; cuadrada?: boolean; titulo?: string }) {
  const corto = txt.replace(/^(TE|HB)-.*/, '$1').slice(0, 4)
  return (
    <g transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }}>
      {titulo && <title>{titulo}</title>}
      {cuadrada ? <rect x={-1.05} y={-1.05} width={2.1} height={2.1} rx={0.4} fill={color} stroke="#000" strokeOpacity={0.6} strokeWidth={0.15} />
        : <circle r={1.1} fill={color} stroke={borde} strokeWidth={0.25} />}
      <text y={0.38} textAnchor="middle" fontSize={corto.length > 2 ? 0.75 : 0.95} fontWeight={900} fill="#000">{corto}</text>
    </g>
  )
}

/* ============================================================ jugadas reales del tracking */
function JugadasReales({ of }: { of: string }) {
  const [lista, setLista] = useState<Json[]>([])
  const [sel, setSel] = useState<Json | null>(null)
  const [k, setK] = useState(0)
  const e = eq(of)
  useEffect(() => { get(`jugadas-reales?equipo=${of}`).then((r) => { setLista(r.jugadas); setSel(null) }) }, [of])
  useEffect(() => {
    if (!sel) return
    setK(0)
    const id = setInterval(() => setK((x) => (x + 1 >= sel.marcos.length ? (clearInterval(id), x) : x + 1)), 200)
    return () => clearInterval(id)
  }, [sel])
  if (!lista.length) return null
  const m = sel?.marcos[k]
  const balon0 = sel?.marcos[0].find((p: Json) => p[0] === 'foo')
  const bx = balon0 ? balon0[1] : 60
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-white/50">Repetición con tracking real</p>
      <p className="mb-4 text-xl font-black text-white">Pases completos de {of} reconstruidos cuadro por cuadro</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {lista.map((j) => (
          <button key={j.gameId + '-' + j.playId} onClick={() => setSel(j)} className="rounded-full border px-3 py-1 text-xs font-bold text-white transition hover:bg-white/10"
            style={{ borderColor: sel === j ? e.t : 'rgba(255,255,255,.15)' }}>vs {j.rival} · {j.down}º y {j.distancia} · +{j.yardas} yds</button>
        ))}
      </div>
      {sel && m && (
        <>
          <svg viewBox={`${bx - 15} 0 55 53.3`} className="w-full rounded-2xl" style={{ background: 'linear-gradient(180deg,#0f5132,#0b3d26)' }}>
            {Array.from({ length: 12 }, (_, i) => <line key={i} x1={Math.floor((bx - 15) / 5) * 5 + i * 5} x2={Math.floor((bx - 15) / 5) * 5 + i * 5} y1={0} y2={53.3} stroke="#fff" strokeOpacity={0.2} strokeWidth={0.15} />)}
            <line x1={bx} x2={bx} y1={0} y2={53.3} stroke="#38bdf8" strokeWidth={0.3} />
            {m.map((p: Json, i: number) => p[0] === 'foo'
              ? <ellipse key={i} cx={p[1]} cy={p[2]} rx={0.6} ry={0.38} fill="#9a5b2a" stroke="#fff" strokeWidth={0.1} />
              : <g key={i} transform={`translate(${p[1]},${p[2]})`} style={{ transition: 'transform 200ms linear' }}>
                  <circle r={1} fill={p[0] === of ? e.t : eq(sel.rival).t} stroke="#000" strokeOpacity={0.5} strokeWidth={0.12} />
                  <text y={0.35} textAnchor="middle" fontSize={0.9} fontWeight={900} fill="#000">{p[3]}</text>
                </g>)}
          </svg>
          <p className="mt-3 text-sm text-white/70">{sel.descripcion}</p>
          <p className="text-xs text-white/40">Cobertura: {sel.cobertura} · Formación: {sel.formacion} · El tracking termina medio segundo después del pase.</p>
        </>
      )}
    </div>
  )
}
