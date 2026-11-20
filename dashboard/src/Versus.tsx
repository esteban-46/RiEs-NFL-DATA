import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, Legend, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Pie, PieChart } from 'recharts'
import { Json, get, num, pct } from './api'
import { eq } from './equipos'
import { Barra, Contador, Escudo, Reveal, Seccion, Stat, shade } from './ui'

const tip = { contentStyle: { background: '#0b1220', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, color: '#fff' }, labelStyle: { color: '#fff' } }

/* ---------------------------------------------------------------- portada dividida */
export function Portada({ a, b, setA, setB, equipos, v }: { a: string; b: string; setA: (x: string) => void; setB: (x: string) => void; equipos: Json[]; v: Json | null }) {
  const prob = v?.prob_a ?? 0.5
  return (
    <header className="relative grid min-h-screen grid-cols-1 overflow-hidden md:grid-cols-2">
      <Mitad lado="a" abbr={a} set={setA} otro={b} equipos={equipos} perfil={v?.a} />
      <Mitad lado="b" abbr={b} set={setB} otro={a} equipos={equipos} perfil={v?.b} />
      {/* Anillo central de probabilidad */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        <Anillo prob={prob} a={a} b={b} />
      </div>
      <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 animate-bounce text-center text-xs font-bold uppercase tracking-[0.3em] text-white/70">
        Desliza para ver el análisis ↓
      </div>
      <div className="absolute left-6 top-6 z-30 flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-white backdrop-blur">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Playbook Lab · NFL 2021 · Semanas 1-8
      </div>
    </header>
  )
}

function Mitad({ lado, abbr, set, otro, equipos, perfil }: { lado: 'a' | 'b'; abbr: string; set: (x: string) => void; otro: string; equipos: Json[]; perfil?: Json }) {
  const e = eq(abbr)
  const r = perfil?.record
  return (
    <div className="relative flex min-h-[50vh] flex-col items-center justify-center overflow-hidden px-6 py-24 transition-colors duration-700"
      style={{ backgroundColor: e.p }}>
      <div className="rayas absolute inset-0 opacity-20" style={{ ['--c' as string]: e.s }} />
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at ${lado === 'a' ? '30%' : '70%'} 40%, ${e.t}55, transparent 60%), linear-gradient(${lado === 'a' ? '90deg' : '270deg'}, transparent 40%, #070b14cc)` }} />
      <div className={`absolute top-1/2 -translate-y-1/2 select-none text-[22rem] font-black leading-none text-white/[0.06] ${lado === 'a' ? '-left-10' : '-right-10'}`}>{abbr}</div>
      <div className="relative z-10 flex flex-col items-center text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-white/70">{lado === 'a' ? 'Tu equipo' : 'Rival'}</p>
        <div key={abbr} className="entrada-escudo drop-shadow-[0_20px_40px_rgba(0,0,0,.5)]"><Escudo abbr={abbr} size={150} /></div>
        <h1 key={abbr + 'n'} className="entrada-texto mt-6 text-5xl font-black uppercase leading-none tracking-tight text-white md:text-6xl">{e.nombre}</h1>
        <p className="mt-1 text-lg font-semibold text-white/70">{e.ciudad}</p>
        <select value={abbr} onChange={(ev) => set(ev.target.value)}
          className="mt-6 cursor-pointer rounded-full border-2 bg-black/40 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white outline-none backdrop-blur transition hover:bg-black/60"
          style={{ borderColor: e.t }}>
          {equipos.map((x) => <option key={x.equipo} value={x.equipo} disabled={x.equipo === otro} className="bg-slate-900">{x.equipo} · {eq(x.equipo).nombre}</option>)}
        </select>
        {r && (
          <div className="mt-8 grid grid-cols-3 gap-6 text-white">
            <div><p className="text-4xl font-black"><Contador valor={r.g} />-<Contador valor={r.p} /></p><p className="text-[10px] uppercase tracking-widest text-white/60">Récord</p></div>
            <div><p className="text-4xl font-black"><Contador valor={perfil.ofensiva.ypp} decimales={1} /></p><p className="text-[10px] uppercase tracking-widest text-white/60">Yds / pase</p></div>
            <div><p className="text-4xl font-black"><Contador valor={perfil.defensa.presion * 100} sufijo="%" /></p><p className="text-[10px] uppercase tracking-widest text-white/60">Presión def.</p></div>
          </div>
        )}
      </div>
    </div>
  )
}

function Anillo({ prob, a, b }: { prob: number; a: string; b: string }) {
  const R = 70, C = 2 * Math.PI * R
  return (
    <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-[#070b14] shadow-[0_0_80px_rgba(0,0,0,.8)] ring-4 ring-white/10">
      <svg viewBox="0 0 180 180" className="absolute inset-0 -rotate-90">
        <circle cx="90" cy="90" r={R} fill="none" stroke={eq(b).t} strokeWidth="14" opacity=".9" />
        <circle cx="90" cy="90" r={R} fill="none" stroke={eq(a).t} strokeWidth="14" strokeDasharray={`${C * prob} ${C}`}
          strokeLinecap="round" style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(.2,.8,.2,1), stroke .7s' }} />
      </svg>
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Victoria {a}</p>
        <p className="text-5xl font-black text-white"><Contador valor={prob * 100} sufijo="%" /></p>
        <p className="text-xs font-black tracking-[0.4em] text-white/40">VS</p>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- análisis */
export function Analisis({ v }: { v: Json }) {
  const A = v.a, B = v.b, ea = eq(A.equipo), eb = eq(B.equipo), L = v.liga
  return (
    <>
      <Panorama v={v} />
      <Seccion id="factores" kicker="Probabilidad de victoria" titulo={`¿Por qué ${A.equipo} tiene ${pct(v.prob_a)}?`} color={ea.t}>
        <div className="grid gap-10 lg:grid-cols-5">
          <Reveal className="lg:col-span-2">
            <p className="text-lg leading-relaxed text-white/70">
              El modelo cruza la <b className="text-white">ofensiva aérea</b> de cada equipo contra la <b className="text-white">defensa</b> que va a enfrentar,
              usando las 8,557 jugadas de pase con datos de PFF, y suma el diferencial real de puntos. Cada barra muestra cuántos
              puntos porcentuales mueve ese factor hacia <span style={{ color: ea.t }} className="font-bold">{A.equipo}</span> o hacia <span style={{ color: eb.t }} className="font-bold">{B.equipo}</span>.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <Stat etiqueta={`Victoria ${A.equipo}`} color={ea.t}><Contador valor={v.prob_a * 100} sufijo="%" /></Stat>
              <Stat etiqueta={`Victoria ${B.equipo}`} color={eb.t}><Contador valor={(1 - v.prob_a) * 100} sufijo="%" /></Stat>
            </div>
          </Reveal>
          <div className="space-y-4 lg:col-span-3">
            {v.factores.map((f: Json, i: number) => <Factor key={f.nombre} f={f} i={i} ca={ea.t} cb={eb.t} a={A.equipo} b={B.equipo} />)}
          </div>
        </div>
      </Seccion>

      <Historial v={v} />

      <Seccion id="ventajas" kicker="Cruces clave" titulo="Ventajas y desventajas" color={ea.t}>
        <div className="grid gap-8 md:grid-cols-2">
          <Columna titulo="Ventajas" items={v.ventajas.ventajas} color="#34d399" icono="▲" vacio="Sin ventajas claras: partido parejo en el juego aéreo." />
          <Columna titulo="Desventajas" items={v.ventajas.desventajas} color="#fb7185" icono="▼" vacio="No detectamos debilidades fuertes en este cruce." />
        </div>
        <Reveal className="mt-14">
          <h3 className="mb-2 text-2xl font-black text-white">Coberturas de {B.equipo} y cómo te va contra cada una</h3>
          <p className="mb-6 text-white/60">Barras: % de jugadas en que {B.equipo} usa cada cobertura. Línea: yardas por pase de {A.equipo} contra esa cobertura.</p>
          <div className="h-80 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
            <ResponsiveContainer>
              <BarChart data={B.coberturas_def.map((c: Json) => ({ ...c, pctv: c.pct * 100, ypp: A.of_vs_cob[c.cobertura]?.ypp ?? 0 }))}>
                <XAxis dataKey="cobertura" stroke="#94a3b8" fontSize={12} />
                <YAxis yAxisId="l" stroke="#94a3b8" fontSize={12} unit="%" />
                <YAxis yAxisId="r" orientation="right" stroke="#94a3b8" fontSize={12} />
                <Tooltip {...tip} formatter={((x: number, n: string) => (n === 'pctv' ? [`${x.toFixed(0)}%`, 'Uso del rival'] : [x.toFixed(1), `Yds/pase ${A.equipo}`])) as Json} />
                <Bar yAxisId="l" dataKey="pctv" radius={[8, 8, 0, 0]} animationDuration={1200}>
                  {B.coberturas_def.map((c: Json, i: number) => <Cell key={i} fill={eb.t} fillOpacity={0.4 + 0.6 * (1 - i / B.coberturas_def.length)} />)}
                </Bar>
                <Bar yAxisId="r" dataKey="ypp" radius={[8, 8, 0, 0]} fill={ea.t} animationDuration={1600} />
                <ReferenceLine yAxisId="r" y={L.ypp} stroke="#fff" strokeDasharray="4 4" label={{ value: `liga ${num(L.ypp)}`, fill: '#fff', fontSize: 11, position: 'insideTopRight' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
      </Seccion>

      <Presion v={v} />
      <Plan v={v} />
    </>
  )
}

function Panorama({ v }: { v: Json }) {
  const A = v.a, B = v.b, ea = eq(A.equipo), eb = eq(B.equipo), L = v.liga
  const ejes = [
    ['Yds/pase', 'ofensiva', 'ypp', 4, 9],
    ['% Completos', 'ofensiva', 'comp', 0.5, 0.75],
    ['Éxito', 'ofensiva', 'exito', 0.35, 0.6],
    ['Explosivas', 'ofensiva', 'explosivas', 0.04, 0.14],
    ['Presión def.', 'defensa', 'presion', 0.25, 0.5],
    ['Protección', 'ofensiva', 'presion', 0.5, 0.25],
  ] as const
  const norm = (x: number, lo: number, hi: number) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100))
  const datos = ejes.map(([n, l, k, lo, hi]) => ({ eje: n, a: norm(A[l][k], lo, hi), b: norm(B[l][k], lo, hi) }))
  return (
    <Seccion id="panorama" kicker="Panorama" titulo={`${ea.nombre} vs ${eb.nombre}`} color={ea.t}>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="text-xl leading-relaxed text-white/75">
            <span className="font-bold" style={{ color: ea.t }}>{ea.ciudad} {ea.nombre}</span> llega con récord de{' '}
            <b className="text-white">{A.record.g}-{A.record.p}{A.record.e ? `-${A.record.e}` : ''}</b> y su QB <b className="text-white">{A.qb}</b> promedia{' '}
            <b className="text-white">{num(A.ofensiva.ypp)} yardas por pase</b> (liga {num(L.ypp)}). Enfrente estará{' '}
            <span className="font-bold" style={{ color: eb.t }}>{eb.nombre}</span>, cuya defensa presiona en el{' '}
            <b className="text-white">{pct(B.defensa.presion)}</b> de los pases y juega en zona el <b className="text-white">{pct(1 - B.defensa.man)}</b> del tiempo.
            El QB de {A.equipo} suelta el balón en <b className="text-white">{num(A.tiempo_lanzamiento, 2)} s</b> desde el snap.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            <Stat etiqueta="% completos" sub={`liga ${pct(L.comp)}`} color={ea.t}><Contador valor={A.ofensiva.comp * 100} sufijo="%" /></Stat>
            <Stat etiqueta="Conversión 3a" sub={`liga ${pct(L.tercera)}`} color={ea.t}><Contador valor={A.ofensiva.tercera * 100} sufijo="%" /></Stat>
            <Stat etiqueta="Sacks / jugada" sub={`liga ${pct(L.sack, 1)}`} color={ea.t}><Contador valor={A.ofensiva.sack * 100} decimales={1} sufijo="%" /></Stat>
            <Stat etiqueta={`Blitz ${B.equipo}`} sub={`liga ${pct(L.blitz)}`} color={eb.t}><Contador valor={B.defensa.blitz * 100} sufijo="%" /></Stat>
            <Stat etiqueta={`Yds permitidas ${B.equipo}`} sub={`liga ${num(L.ypp)}`} color={eb.t}><Contador valor={B.defensa.ypp} decimales={1} /></Stat>
            <Stat etiqueta={`Intercepciones ${B.equipo}`} sub={`liga ${pct(L.int, 1)}`} color={eb.t}><Contador valor={B.defensa.int * 100} decimales={1} sufijo="%" /></Stat>
          </div>
        </Reveal>
        <Reveal delay={200}>
          <div className="h-[440px] rounded-3xl border border-white/10 bg-white/[0.02] p-4">
            <ResponsiveContainer>
              <RadarChart data={datos} outerRadius="75%">
                <PolarGrid stroke="rgba(255,255,255,.15)" />
                <PolarAngleAxis dataKey="eje" tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 700 }} />
                <Radar name={A.equipo} dataKey="a" stroke={ea.t} fill={ea.t} fillOpacity={0.35} strokeWidth={3} animationDuration={1400} />
                <Radar name={B.equipo} dataKey="b" stroke={eb.t} fill={eb.t} fillOpacity={0.25} strokeWidth={3} animationDuration={1800} />
                <Legend wrapperStyle={{ color: '#fff' }} />
                <Tooltip {...tip} formatter={((x: number) => `${x.toFixed(0)} / 100`) as Json} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-center text-xs text-white/40">Escala 0-100 relativa a la liga. "Protección" alto = la línea permite poca presión.</p>
        </Reveal>
      </div>
      <Velocidad A={A} B={B} />
    </Seccion>
  )
}

function Velocidad({ A, B }: { A: Json; B: Json }) {
  const ea = eq(A.equipo), eb = eq(B.equipo)
  const filas = [...A.rapidos.map((r: Json) => ({ ...r, eq: A.equipo, c: ea.t })), ...B.rapidos.map((r: Json) => ({ ...r, eq: B.equipo, c: eb.t }))].sort((x, y) => y.mph - x.mph)
  return (
    <Reveal className="mt-16">
      <h3 className="mb-1 text-2xl font-black text-white">Los más rápidos del duelo</h3>
      <p className="mb-6 text-white/60">Velocidad máxima registrada por el tracking de Next Gen Stats (10 mediciones por segundo).</p>
      <div className="grid gap-3">
        {filas.map((r, i) => (
          <div key={r.nombre + i} className="grid grid-cols-[180px_1fr_80px] items-center gap-4">
            <p className="truncate text-sm font-bold text-white"><span style={{ color: r.c }}>{r.eq}</span> · {r.nombre}</p>
            <Barra valor={r.mph - 14} max={9} color={r.c} alto={14} />
            <p className="text-right font-black tabular-nums text-white">{r.mph} <span className="text-xs text-white/50">mph</span></p>
          </div>
        ))}
      </div>
    </Reveal>
  )
}

function Factor({ f, i, ca, cb, a, b }: { f: Json; i: number; ca: string; cb: string; a: string; b: string }) {
  const p = f.puntos as number, w = Math.min(Math.abs(p), 30) / 30 * 50
  const fmt = (x: number) => (f.fmt === 'pct' ? pct(x, 1) : f.fmt === 'pts' ? (x > 0 ? '+' : '') + num(x) : num(x, 2))
  return (
    <Reveal delay={i * 90}>
      <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/30">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="font-bold text-white">{f.nombre}</p>
          <p className="text-sm font-black tabular-nums" style={{ color: p >= 0 ? ca : cb }}>{p >= 0 ? '+' : ''}{p.toFixed(1)} pts → {p >= 0 ? a : b}</p>
        </div>
        <div className="relative h-3 rounded-full bg-white/10">
          <div className="absolute left-1/2 top-[-4px] h-5 w-px bg-white/50" />
          <div className="absolute top-0 h-3 rounded-full transition-all duration-1000"
            style={{ background: p >= 0 ? ca : cb, width: `${w}%`, left: p >= 0 ? '50%' : `${50 - w}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-white/50">
          <span><b style={{ color: ca }}>{a}</b> {fmt(f.a)}</span>
          <span className="hidden text-center md:block">{f.explicacion}</span>
          <span><b style={{ color: cb }}>{b}</b> {fmt(f.b)}</span>
        </div>
      </div>
    </Reveal>
  )
}

function Historial({ v }: { v: Json }) {
  const A = v.a, B = v.b, ea = eq(A.equipo), eb = eq(B.equipo), h = v.historial
  const semanas = Array.from({ length: 8 }, (_, i) => i + 1).map((s) => {
    const pa = A.record.partidos.find((p: Json) => p.semana === s), pb = B.record.partidos.find((p: Json) => p.semana === s)
    return { semana: `S${s}`, a: pa ? pa.pf - pa.pc : null, b: pb ? pb.pf - pb.pc : null, ra: pa?.rival, rb: pb?.rival }
  })
  return (
    <Seccion id="historial" kicker="Histórico 2021" titulo="Historial y rivales en común" color={ea.t}>
      <div className="grid gap-10 lg:grid-cols-2">
        <Reveal>
          {h.directo.length ? h.directo.map((p: Json) => (
            <div key={p.gameId} className="mb-6 overflow-hidden rounded-3xl border border-white/10">
              <div className="grid grid-cols-3 items-center">
                <div className="p-6 text-center transition-colors duration-700" style={{ background: ea.p }}><Escudo abbr={A.equipo} size={60} /><p className="mt-2 text-5xl font-black text-white">{p.pf}</p></div>
                <div className="bg-black/60 p-6 text-center"><p className="text-xs font-bold uppercase tracking-widest text-white/50">Semana {p.semana}</p><p className="text-lg font-black text-white">{p.res === 'G' ? `Ganó ${A.equipo}` : p.res === 'P' ? `Ganó ${B.equipo}` : 'Empate'}</p><p className="text-xs text-white/50">{p.local ? `en casa de ${A.equipo}` : `en casa de ${B.equipo}`}</p></div>
                <div className="p-6 text-center transition-colors duration-700" style={{ background: eb.p }}><Escudo abbr={B.equipo} size={60} /><p className="mt-2 text-5xl font-black text-white">{p.pc}</p></div>
              </div>
            </div>
          )) : <p className="mb-6 rounded-2xl border border-dashed border-white/20 p-6 text-white/60">No se enfrentaron en las semanas 1-8 de 2021. Comparamos cómo le fue a cada uno contra los mismos rivales.</p>}
          <h3 className="mb-3 text-lg font-black text-white">Rivales en común ({h.comunes.length})</h3>
          <div className="space-y-2">
            {h.comunes.map((c: Json) => (
              <div key={c.rival + c.a.semana} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-2 text-sm">
                <Chip p={c.a} color={ea.t} />
                <span className="flex items-center gap-2 font-black text-white"><Escudo abbr={c.rival} size={22} />{c.rival}</span>
                <div className="flex justify-end"><Chip p={c.b} color={eb.t} /></div>
              </div>
            ))}
            {!h.comunes.length && <p className="text-white/50">Sin rivales en común en este periodo.</p>}
          </div>
        </Reveal>
        <Reveal delay={150}>
          <h3 className="mb-1 text-lg font-black text-white">Diferencial de puntos por semana</h3>
          <p className="mb-4 text-sm text-white/50">Arriba de cero = victoria. Pasa el cursor para ver el rival.</p>
          <div className="h-96 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
            <ResponsiveContainer>
              <BarChart data={semanas}>
                <XAxis dataKey="semana" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <ReferenceLine y={0} stroke="#fff" />
                <Tooltip {...tip} formatter={((x: number, n: string, it: Json) => [`${x > 0 ? '+' : ''}${x} vs ${n === A.equipo ? it.payload.ra : it.payload.rb}`, n]) as Json} />
                <Legend />
                <Bar dataKey="a" name={A.equipo} fill={ea.t} radius={[6, 6, 6, 6]} animationDuration={1200} />
                <Bar dataKey="b" name={B.equipo} fill={eb.t} radius={[6, 6, 6, 6]} animationDuration={1600} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
      </div>
    </Seccion>
  )
}

function Chip({ p, color }: { p: Json; color: string }) {
  const c = p.res === 'G' ? '#34d399' : p.res === 'P' ? '#fb7185' : '#fbbf24'
  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded-md px-2 py-0.5 text-xs font-black text-black" style={{ background: c }}>{p.res}</span>
      <span className="font-bold tabular-nums" style={{ color }}>{p.pf}-{p.pc}</span>
      <span className="text-xs text-white/40">S{p.semana}</span>
    </span>
  )
}

function Columna({ titulo, items, color, icono, vacio }: { titulo: string; items: Json[]; color: string; icono: string; vacio: string }) {
  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-2xl font-black" style={{ color }}>{icono} {titulo}</h3>
      <div className="space-y-3">
        {items.length ? items.map((x, i) => (
          <Reveal key={i} delay={i * 100}>
            <div className="rounded-2xl border-l-4 bg-white/[0.04] p-4 text-white/80 transition hover:translate-x-1 hover:bg-white/[0.07]" style={{ borderColor: color }}>{x.texto}</div>
          </Reveal>
        )) : <p className="text-white/50">{vacio}</p>}
      </div>
    </div>
  )
}

function Linea({ perfil, color }: { perfil: Json; color: string }) {
  const max = Math.max(...Object.values(perfil.linea).map((x: Json) => x.tasa || 0), 0.08)
  return (
    <div className="flex items-end justify-center gap-2">
      {['LT', 'LG', 'C', 'RG', 'RT'].map((pos, i) => {
        const l = perfil.linea[pos], k = (l.tasa || 0) / max
        const fondo = `rgba(${Math.round(60 + 195 * k)}, ${Math.round(200 - 150 * k)}, ${Math.round(120 - 80 * k)}, .9)`
        return (
          <Reveal key={pos} delay={i * 80}>
            <div className="group relative flex w-16 flex-col items-center md:w-20">
              <div className="mb-2 text-xs font-black tabular-nums text-white">{pct(l.tasa, 1)}</div>
              <div className="flex h-20 w-full items-center justify-center rounded-xl text-lg font-black text-black shadow-lg transition group-hover:-translate-y-1"
                style={{ background: fondo, boxShadow: `0 0 ${10 + 30 * k}px ${fondo}` }}>{pos}</div>
              <p className="mt-2 h-8 text-center text-[10px] leading-tight text-white/60">{l.jugador}</p>
            </div>
          </Reveal>
        )
      })}
      <span className="sr-only">{color}</span>
    </div>
  )
}

function Presion({ v }: { v: Json }) {
  const A = v.a, B = v.b, ea = eq(A.equipo), eb = eq(B.equipo)
  const colores = ['#f43f5e', '#f59e0b', '#a78bfa', '#22d3ee']
  return (
    <Seccion id="presion" kicker="Trincheras" titulo="Mapa de presión" color={ea.t}>
      <div className="grid gap-10 lg:grid-cols-2">
        {[{ of: A, de: B, eo: ea, ed: eb }, { of: B, de: A, eo: eb, ed: ea }].map(({ of, de, eo, ed }, i) => (
          <Reveal key={i} delay={i * 150}>
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <p className="text-sm font-bold uppercase tracking-widest" style={{ color: eo.t }}>Línea ofensiva de {of.equipo}</p>
              <p className="mb-6 text-white/60">% de snaps en que cada posición permitió hit, hurry o sack.</p>
              <Linea perfil={of} color={eo.t} />
              <div className="mx-auto my-4 h-1 w-3/4 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <p className="text-sm font-bold uppercase tracking-widest" style={{ color: ed.t }}>De dónde viene la presión de {de.equipo}</p>
              <div className="grid items-center gap-4 md:grid-cols-2">
                <div className="h-52">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={de.origen_presion} dataKey="n" nameKey="zona" innerRadius={45} outerRadius={80} paddingAngle={3} animationDuration={1400}>
                        {de.origen_presion.map((_: Json, k: number) => <Cell key={k} fill={colores[k % 4]} />)}
                      </Pie>
                      <Tooltip {...tip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 text-sm">
                  {de.origen_presion.map((o: Json, k: number) => (
                    <p key={o.zona} className="flex items-center gap-2 text-white/80"><span className="h-3 w-3 rounded-full" style={{ background: colores[k % 4] }} />{o.zona}: <b className="text-white">{o.n}</b> presiones</p>
                  ))}
                  {de.rushers_top[0] && <p className="pt-2 text-white/60">Rusher principal: <b className="text-white">{de.rushers_top[0].nombre}</b> ({de.rushers_top[0].presiones} presiones, {de.rushers_top[0].sacks} sacks)</p>}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {v.duelos.map((d: Json, i: number) => {
          const c1 = d.lado === 'a' ? ea : eb, c2 = d.lado === 'a' ? eb : ea
          return (
            <Reveal key={i} delay={i * 120}>
              <div className="relative overflow-hidden rounded-3xl border border-white/10">
                <div className="grid grid-cols-2">
                  <div className="p-6 transition-colors duration-700" style={{ background: `linear-gradient(135deg, ${c1.p}, ${shade(c1.p, -20)})` }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Pass rusher</p>
                    <p className="text-xl font-black text-white">{d.atacante.nombre}</p>
                    <p className="text-sm text-white/80">{d.atacante.pos} · {d.atacante.presiones} presiones · {pct(d.atacante.tasa)} de sus snaps</p>
                  </div>
                  <div className="p-6 text-right transition-colors duration-700" style={{ background: `linear-gradient(225deg, ${c2.p}, ${shade(c2.p, -20)})` }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Bloqueador</p>
                    <p className="text-xl font-black text-white">{d.defensor.nombre}</p>
                    <p className="text-sm text-white/80">{d.defensor.pos} · cede presión en {pct(d.defensor.tasa, 1)}</p>
                  </div>
                </div>
                <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black text-sm font-black text-white ring-2 ring-white/30">VS</div>
                <p className="bg-black/50 px-6 py-3 text-sm text-white/70">{d.texto}</p>
              </div>
            </Reveal>
          )
        })}
      </div>
    </Seccion>
  )
}

function Plan({ v }: { v: Json }) {
  const A = v.a, B = v.b, ea = eq(A.equipo)
  const [ia, setIa] = useState<{ estado: 'nada' | 'cargando' | 'listo' | 'error'; texto?: string }>({ estado: 'nada' })
  useEffect(() => setIa({ estado: 'nada' }), [A.equipo, B.equipo])
  const pedir = async () => {
    setIa({ estado: 'cargando' })
    try {
      const r = await get(`plan-ia?a=${A.equipo}&b=${B.equipo}`)
      setIa(r.disponible ? { estado: 'listo', texto: r.texto } : { estado: 'error' })
    } catch { setIa({ estado: 'error' }) }
  }
  return (
    <Seccion id="plan" kicker="Plan de juego" titulo={`Cómo vencer a ${B.equipo}`} color={ea.t}>
      <div className="grid gap-8 md:grid-cols-2">
        {[['Cuando atacas', v.plan.ofensivo, ea.t], ['Cuando defiendes', v.plan.defensivo, eq(B.equipo).t]].map(([t, items, c]) => (
          <div key={t as string}>
            <h3 className="mb-4 text-xl font-black uppercase tracking-widest" style={{ color: c as string }}>{t as string}</h3>
            <div className="space-y-4">
              {(items as Json[]).map((p, i) => (
                <Reveal key={i} delay={i * 100}>
                  <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/30">
                    <div className="absolute -right-4 -top-6 text-8xl font-black text-white/[0.04] transition group-hover:text-white/[0.08]">{i + 1}</div>
                    <p className="text-lg font-black text-white">{p.titulo}</p>
                    <p className="mt-1 text-white/70">{p.texto}</p>
                    <p className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-black text-black" style={{ background: c as string }}>{p.dato}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Reveal className="mt-12">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/10 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Coordinador IA · Amazon Nova en Bedrock</p>
              <p className="text-2xl font-black text-white">Plan narrado a partir de estos mismos datos</p>
            </div>
            <button onClick={pedir} disabled={ia.estado === 'cargando'}
              className="rounded-full bg-white px-6 py-3 text-sm font-black uppercase tracking-widest text-black transition hover:scale-105 disabled:opacity-50">
              {ia.estado === 'cargando' ? 'Pensando…' : 'Generar plan'}
            </button>
          </div>
          {ia.estado === 'listo' && <pre className="mt-6 whitespace-pre-wrap font-sans text-white/85">{ia.texto}</pre>}
          {ia.estado === 'error' && <p className="mt-6 text-amber-300">La IA no está disponible ahora. El plan de arriba se calcula directo de los datos y no depende de ella.</p>}
        </div>
      </Reveal>
    </Seccion>
  )
}
