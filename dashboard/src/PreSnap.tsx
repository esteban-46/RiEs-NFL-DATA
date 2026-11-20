import { useEffect, useState } from 'react'
import { Json, get, pct } from './api'
import { eq } from './equipos'
import { Barra, Contador, Escudo, Reveal, Seccion } from './ui'

const BUCKETS = ['1-3', '4-6', '7-10', '11+']
const PERSONAL = ['', '1 RB, 1 TE, 3 WR', '1 RB, 2 TE, 2 WR', '2 RB, 1 TE, 2 WR', '1 RB, 3 TE, 1 WR', '1 RB, 0 TE, 4 WR']

export function PreSnap({ a, b }: { a: string; b: string }) {
  const [def, setDef] = useState(b)
  const [down, setDown] = useState(3)
  const [distancia, setDistancia] = useState(7)
  const [caja, setCaja] = useState(6)
  const [usarCaja, setUsarCaja] = useState(false)
  const [personal, setPersonal] = useState('')
  const [modo, setModo] = useState<'man' | 'blitz'>('man')
  const [pred, setPred] = useState<Json | null>(null)
  const [tend, setTend] = useState<Json | null>(null)
  useEffect(() => setDef(b), [b])
  useEffect(() => { get(`tendencias?equipo=${def}`).then(setTend) }, [def])
  useEffect(() => {
    const q = new URLSearchParams({ equipo: def, down: String(down), distancia: String(distancia) })
    if (usarCaja) q.set('caja', String(caja))
    if (personal) q.set('personal', personal)
    get(`presnap?${q}`).then(setPred)
  }, [def, down, distancia, caja, usarCaja, personal])
  const e = eq(def)

  return (
    <Seccion id="presnap" kicker="Predicción" titulo="Lector pre-snap" color={e.t}>
      <Reveal>
        <p className="mb-10 max-w-3xl text-lg text-white/70">
          Antes del snap el entrenador ve la situación, el personal y cuántos defensores hay en la caja. Con eso, este lector predice qué cobertura viene
          y si habrá blitz, combinando las jugadas de <b style={{ color: e.t }}>{def}</b> con el resto de la liga cuando la muestra del equipo es chica.
        </p>
      </Reveal>
      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <Reveal>
          <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">Defensa a leer</p>
              <div className="grid grid-cols-2 gap-2">
                {[a, b].map((x) => (
                  <button key={x} onClick={() => setDef(x)} className="flex items-center gap-2 rounded-2xl border-2 p-2 transition"
                    style={{ borderColor: def === x ? eq(x).t : 'transparent', background: def === x ? `${eq(x).p}cc` : 'rgba(255,255,255,.04)' }}>
                    <Escudo abbr={x} size={28} /><span className="font-black text-white">{x}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">Down</p>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((d) => (
                  <button key={d} onClick={() => setDown(d)} className="rounded-xl py-2 font-black transition"
                    style={{ background: down === d ? e.t : 'rgba(255,255,255,.06)', color: down === d ? '#000' : '#fff' }}>{d === 3 ? '3º/4º' : `${d}º`}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-widest"><span className="text-white/50">Yardas por avanzar</span><span style={{ color: e.t }}>{distancia}</span></div>
              <input type="range" min={1} max={20} value={distancia} onChange={(ev) => setDistancia(+ev.target.value)} className="w-full accent-sky-400" />
            </div>
            <div>
              <label className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-white/50">
                <span>Defensores en la caja</span>
                <input type="checkbox" checked={usarCaja} onChange={(ev) => setUsarCaja(ev.target.checked)} className="accent-sky-400" />
              </label>
              <div className={`grid grid-cols-5 gap-2 transition ${usarCaja ? '' : 'pointer-events-none opacity-30'}`}>
                {[4, 5, 6, 7, 8].map((c) => (
                  <button key={c} onClick={() => setCaja(c)} className="rounded-xl py-2 font-black transition"
                    style={{ background: caja === c ? e.t : 'rgba(255,255,255,.06)', color: caja === c ? '#000' : '#fff' }}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">Tu personal ofensivo</p>
              <select value={personal} onChange={(ev) => setPersonal(ev.target.value)} className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-bold text-white">
                {PERSONAL.map((p) => <option key={p} value={p} className="bg-slate-900">{p || 'Cualquiera'}</option>)}
              </select>
            </div>
          </div>
        </Reveal>

        <div className="space-y-8">
          {pred && (
            <Reveal>
              <div className="grid gap-6 md:grid-cols-3">
                <Medidor etiqueta="Zona" valor={pred.zona} color="#22d3ee" />
                <Medidor etiqueta="Marcaje personal" valor={pred.man} color="#f472b6" />
                <Medidor etiqueta="Blitz (5+ rushers)" valor={pred.blitz} color="#f97316" />
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/50">Cobertura más probable</p>
                  <p className="text-4xl font-black" style={{ color: e.t }}>{pred.coberturas[0]?.cobertura}</p>
                  <div className="mt-4 space-y-2">
                    {pred.coberturas.slice(0, 6).map((c: Json) => (
                      <div key={c.cobertura} className="grid grid-cols-[84px_1fr_44px] items-center gap-2 text-sm">
                        <span className="font-bold text-white">{c.cobertura}</span><Barra valor={c.prob} max={pred.coberturas[0].prob} color={e.t} /><span className="text-right tabular-nums text-white/70">{pct(c.prob)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-white/40">Muestra: {pred.muestra_equipo} jugadas de {def} y {pred.muestra_liga} de la liga en esta situación.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/50">Qué hacer</p>
                  <p className="mt-2 text-lg font-bold text-white">{pred.consejo}</p>
                  <p className="mt-6 text-xs font-bold uppercase tracking-widest text-white/50">Señales de {def}</p>
                  <div className="mt-2 space-y-2">
                    {pred.señales.map((s: Json, i: number) => <p key={i} className="rounded-xl border-l-4 bg-white/[0.04] p-3 text-sm text-white/80" style={{ borderColor: e.t }}>{s.texto}</p>)}
                  </div>
                </div>
              </div>
            </Reveal>
          )}
          {tend && (
            <Reveal>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-white/50">Mapa de tendencias de {def}</p>
                    <p className="text-xl font-black text-white">Down × distancia: {modo === 'man' ? '% marcaje personal' : '% blitz'}</p>
                  </div>
                  <div className="flex rounded-full bg-white/10 p-1">
                    {(['man', 'blitz'] as const).map((m) => (
                      <button key={m} onClick={() => setModo(m)} className="rounded-full px-4 py-1 text-xs font-black uppercase transition"
                        style={{ background: modo === m ? '#fff' : 'transparent', color: modo === m ? '#000' : '#fff' }}>{m === 'man' ? 'Personal' : 'Blitz'}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-[70px_repeat(4,1fr)] gap-2">
                  <div />
                  {BUCKETS.map((x) => <p key={x} className="text-center text-xs font-bold text-white/50">{x} yds</p>)}
                  {[1, 2, 3].map((d) => (
                    <Fila key={d} d={d} celdas={tend.celdas.filter((c: Json) => c.down === d)} modo={modo} activo={down === d ? distancia : null}
                      onPick={(bk) => { setDown(d); setDistancia(bk === '1-3' ? 2 : bk === '4-6' ? 5 : bk === '7-10' ? 8 : 13) }} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-white/40">Haz clic en una celda para cargarla en el lector. Cada celda muestra la cobertura que más usa ahí.</p>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </Seccion>
  )
}

function Fila({ d, celdas, modo, activo, onPick }: { d: number; celdas: Json[]; modo: 'man' | 'blitz'; activo: number | null; onPick: (b: string) => void }) {
  const bucketDe = (x: number) => (x <= 3 ? '1-3' : x <= 6 ? '4-6' : x <= 10 ? '7-10' : '11+')
  return (
    <>
      <p className="flex items-center text-sm font-black text-white">{d === 3 ? '3º/4º' : `${d}º`}</p>
      {BUCKETS.map((b) => {
        const c = celdas.find((x) => x.bucket === b)
        const v = c?.n ? (modo === 'man' ? c.man : c.blitz) : null
        const k = v == null ? 0 : Math.min(v / (modo === 'man' ? 0.7 : 0.6), 1)
        const col = modo === 'man' ? `rgba(244,114,182,${0.12 + k * 0.85})` : `rgba(249,115,22,${0.12 + k * 0.85})`
        const sel = activo != null && bucketDe(activo) === b
        return (
          <button key={b} onClick={() => onPick(b)} className="celda rounded-xl p-3 text-left transition hover:scale-105"
            style={{ background: v == null ? 'rgba(255,255,255,.03)' : col, outline: sel ? '2px solid #fff' : 'none' }}>
            <p className="text-xl font-black text-white">{v == null ? '—' : pct(v)}</p>
            <p className="truncate text-[11px] font-bold text-white/80">{c?.n ? c.cobertura : 'sin datos'}</p>
            <p className="text-[10px] text-white/50">{c?.n ?? 0} jugadas</p>
          </button>
        )
      })}
    </>
  )
}

function Medidor({ etiqueta, valor, color }: { etiqueta: string; valor: number; color: string }) {
  const R = 52, C = Math.PI * R
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center">
      <svg viewBox="0 0 120 70" className="mx-auto w-44">
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="12" strokeLinecap="round" />
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${C * valor} ${C}`}
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <p className="-mt-6 text-3xl font-black text-white"><Contador valor={valor * 100} sufijo="%" duracion={700} /></p>
      <p className="text-xs font-bold uppercase tracking-widest text-white/50">{etiqueta}</p>
    </div>
  )
}
