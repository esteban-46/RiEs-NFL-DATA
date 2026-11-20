// Rutas relativas SIN diagonal inicial: la app se publica en una subruta
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any

export async function get(ruta: string): Promise<Json> {
  const r = await fetch(`api/${ruta}`)
  if (!r.ok) throw new Error(`${r.status} ${ruta}`)
  return r.json()
}

export async function post(ruta: string, cuerpo: unknown): Promise<Json> {
  const r = await fetch(`api/${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  if (!r.ok) throw new Error(`${r.status} ${ruta}`)
  return r.json()
}

export const pct = (x: number | null | undefined, d = 0) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`)
export const num = (x: number | null | undefined, d = 1) => (x == null ? '—' : x.toFixed(d))
