import { useEffect, useState } from 'react'
import { Json, get } from './api'
import { eq } from './equipos'
import { PreSnap } from './PreSnap'
import { Simulador } from './Simulador'
import { Cargando, Contador, Escudo, Reveal } from './ui'
import { Analisis, Portada } from './Versus'

const SECCIONES = [
  ['panorama', 'Panorama'], ['factores', '% Victoria'], ['historial', 'Historial'], ['ventajas', 'Ventajas'],
  ['presion', 'Presión'], ['plan', 'Plan de juego'], ['simulacion', 'Simulador'], ['presnap', 'Pre-snap'],
] as const

export default function App() {
  const [equipos, setEquipos] = useState<Json[]>([])
  const [resumen, setResumen] = useState<Json | null>(null)
  const [a, setA] = useState('TB')
  const [b, setB] = useState('DAL')
  const [v, setV] = useState<Json | null>(null)
  const [error, setError] = useState('')
  const [nav, setNav] = useState(false)
  const [activa, setActiva] = useState('')

  useEffect(() => { get('equipos').then((r) => { setEquipos(r.equipos); setResumen(r.resumen) }).catch(() => setError('No se pudo conectar con la API.')) }, [])
  useEffect(() => { get(`versus?a=${a}&b=${b}`).then(setV).catch(() => setError('No se pudo cargar el análisis.')) }, [a, b])

  // menú pegajoso que aparece al pasar la portada + sección activa
  useEffect(() => {
    const onScroll = () => setNav(window.scrollY > window.innerHeight * 0.8)
    window.addEventListener('scroll', onScroll, { passive: true })
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActiva(e.target.id)), { rootMargin: '-40% 0px -55% 0px' })
    const t = setInterval(() => SECCIONES.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el) }), 1000)
    return () => { window.removeEventListener('scroll', onScroll); io.disconnect(); clearInterval(t) }
  }, [])

  const ea = eq(a), eb = eq(b)
  return (
    <div className="min-h-screen bg-[#070b14] text-white" style={{ ['--a' as string]: ea.t, ['--b' as string]: eb.t }}>
      <Portada a={a} b={b} setA={setA} setB={setB} equipos={equipos} v={v} />

      <nav className={`fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#070b14]/85 backdrop-blur-xl transition-all duration-500 ${nav ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <div className="flex shrink-0 items-center gap-2">
            <Escudo abbr={a} size={28} /><span className="text-sm font-black" style={{ color: ea.t }}>{a}</span>
            <span className="text-xs font-black text-white/40">VS</span>
            <span className="text-sm font-black" style={{ color: eb.t }}>{b}</span><Escudo abbr={b} size={28} />
            {v && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs font-black tabular-nums">{Math.round(v.prob_a * 100)}%</span>}
          </div>
          <div className="flex flex-1 gap-1 overflow-x-auto">
            {SECCIONES.map(([id, n]) => (
              <a key={id} href={`#${id}`} className="relative whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition hover:bg-white/10"
                style={{ color: activa === id ? '#000' : 'rgba(255,255,255,.7)', background: activa === id ? ea.t : undefined }}>{n}</a>
            ))}
          </div>
        </div>
        <div className="h-0.5 transition-all duration-700" style={{ background: `linear-gradient(90deg, ${ea.t} ${v ? v.prob_a * 100 : 50}%, ${eb.t} ${v ? v.prob_a * 100 : 50}%)` }} />
      </nav>

      {resumen && (
        <section className="border-y border-white/5 bg-white/[0.02]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-12 md:grid-cols-5">
            {[[resumen.partidos, 'partidos analizados'], [resumen.jugadas, 'jugadas de pase'], [resumen.registros_pff, 'registros de scouting PFF'], [resumen.jugadores, 'jugadores'], [850, 'MB de tracking procesados']].map(([n, t], i) => (
              <Reveal key={t as string} delay={i * 100}>
                <p className="text-4xl font-black text-white md:text-5xl"><Contador valor={n as number} /></p>
                <p className="text-xs font-bold uppercase tracking-widest text-white/50">{t as string}</p>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {error && <p className="mx-auto max-w-7xl px-6 py-10 text-rose-300">{error}</p>}
      {!v && !error && <div className="mx-auto max-w-7xl px-6"><Cargando /></div>}
      {v && v.a.equipo === a && v.b.equipo === b && (
        <div key={`${a}-${b}`} className="entrada-texto">
          <Analisis v={v} />
          <Simulador a={a} b={b} />
          <PreSnap a={a} b={b} />
        </div>
      )}

      <footer className="border-t border-white/10 py-12 text-center text-sm text-white/40">
        <p>Datos: NFL Big Data Bowl 2023 (Next Gen Stats + PFF), temporada 2021, semanas 1-8. Marcadores finales: nflverse.</p>
        <p className="mt-1">Solo incluye jugadas de pase. Hackathon AWS · UNAM.</p>
      </footer>
    </div>
  )
}
