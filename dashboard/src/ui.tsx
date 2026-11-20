import { ReactNode, useEffect, useRef, useState } from 'react'
import { eq } from './equipos'

/** Aparece con transición cuando entra al viewport */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setVisible(true), io.disconnect()), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-10 blur-sm'} ${className}`}>
      {children}
    </div>
  )
}

/** Número que cuenta hasta su valor con easing */
export function Contador({ valor, decimales = 0, sufijo = '', prefijo = '', duracion = 1200 }: { valor: number; decimales?: number; sufijo?: string; prefijo?: string; duracion?: number }) {
  const [v, setV] = useState(0)
  const desde = useRef(0)
  const ref = useRef<HTMLSpanElement>(null)
  const [activo, setActivo] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setActivo(true), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!activo) return
    let raf = 0
    const ini = performance.now(), a = desde.current
    const paso = (t: number) => {
      const k = Math.min((t - ini) / duracion, 1), e = 1 - Math.pow(1 - k, 4)
      const x = a + (valor - a) * e
      setV(x)
      if (k < 1) raf = requestAnimationFrame(paso)
      else desde.current = valor
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor, activo, duracion])
  return <span ref={ref} className="tabular-nums">{prefijo}{v.toFixed(decimales)}{sufijo}</span>
}

/** Escudo generado con los colores del equipo */
export function Escudo({ abbr, size = 120, className = '' }: { abbr: string; size?: number; className?: string }) {
  const e = eq(abbr)
  const id = `g-${abbr}`
  return (
    <svg viewBox="0 0 100 116" width={size} height={size * 1.16} className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={e.p} />
          <stop offset="1" stopColor={shade(e.p, -35)} />
        </linearGradient>
      </defs>
      <path d="M50 3 L95 16 V58 C95 86 72 104 50 113 C28 104 5 86 5 58 V16 Z" fill={`url(#${id})`} stroke={e.s} strokeWidth="4" />
      <path d="M50 12 L86 22 V58 C86 80 68 95 50 103 C32 95 14 80 14 58 V22 Z" fill="none" stroke={e.t} strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M14 46 H86" stroke={e.s} strokeWidth="6" strokeOpacity=".9" />
      <text x="50" y={abbr.length > 2 ? 78 : 80} textAnchor="middle" fontSize={abbr.length > 2 ? 30 : 36} fontWeight="900" fill="#fff"
        style={{ letterSpacing: 1, fontFamily: 'Impact, "Arial Black", system-ui' }}>{abbr}</text>
      <path d="M38 30 l12 -8 l12 8" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function shade(hex: string, pctv: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (pctv / 100) * 255)))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`
}

/** Encabezado de sección estilo perfil de Data USA */
export function Seccion({ id, kicker, titulo, children, color }: { id: string; kicker: string; titulo: string; children: ReactNode; color?: string }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-white/5 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em]" style={{ color: color ?? '#7dd3fc' }}>{kicker}</p>
          <h2 className="mb-10 text-4xl font-black tracking-tight text-white md:text-5xl">{titulo}</h2>
        </Reveal>
        {children}
      </div>
    </section>
  )
}

/** Barra horizontal que se llena al entrar en pantalla */
export function Barra({ valor, max = 1, color, alto = 10 }: { valor: number; max?: number; color: string; alto?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const w = Math.max(0, Math.min(100, (valor / max) * 100))
  return (
    <div ref={ref} className="w-full overflow-hidden rounded-full bg-white/10" style={{ height: alto }}>
      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: on ? `${w}%` : '0%', background: color, boxShadow: `0 0 12px ${color}88` }} />
    </div>
  )
}

export function Stat({ etiqueta, children, sub, color }: { etiqueta: string; children: ReactNode; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:-translate-y-1 hover:border-white/25">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">{etiqueta}</p>
      <p className="mt-1 text-3xl font-black" style={{ color: color ?? '#fff' }}>{children}</p>
      {sub && <p className="mt-1 text-xs text-white/50">{sub}</p>}
    </div>
  )
}

export function Cargando({ texto = 'Analizando datos…' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-white/60">
      <span className="h-3 w-3 animate-ping rounded-full bg-sky-400" />{texto}
    </div>
  )
}
