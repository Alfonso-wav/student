import type { PGlite } from '@electric-sql/pglite'

/** Una base Postgres en memoria por laboratorio, creada al pulsar "arrancar". */
const dbs = new Map<string, Promise<PGlite>>()
const RELOAD_FLAG = 'student:chunk-reload'

/**
 * Tras un despliegue, una pestaña que seguía abierta ejecuta el JS viejo y pide chunks que el
 * service worker nuevo ya borró. En ese caso se recarga una vez para tomar la versión actual.
 */
async function loadPGlite() {
  try {
    const mod = await import('@electric-sql/pglite')
    try {
      sessionStorage.removeItem(RELOAD_FLAG)
    } catch {
      /* sin almacenamiento */
    }
    return mod
  } catch (e) {
    let reloaded = true
    try {
      reloaded = sessionStorage.getItem(RELOAD_FLAG) === '1'
      if (!reloaded) sessionStorage.setItem(RELOAD_FLAG, '1')
    } catch {
      /* sin almacenamiento: no arriesgar un bucle de recargas */
    }
    if (!reloaded) window.location.reload()
    throw e
  }
}

export function getLabDb(labId: string, setup: string): Promise<PGlite> {
  let p = dbs.get(labId)
  if (!p) {
    p = (async () => {
      const { PGlite } = await loadPGlite()
      const db = await PGlite.create()
      if (setup) await db.exec(setup)
      return db
    })()
    p.catch(() => dbs.delete(labId))
    dbs.set(labId, p)
  }
  return p
}

/** Reinicia el laboratorio: tira la base y la próxima consulta vuelve a ejecutar el setup. */
export async function resetLabDb(labId: string): Promise<void> {
  const p = dbs.get(labId)
  dbs.delete(labId)
  if (p) await (await p).close().catch(() => {})
}

function formatRows(fields: { name: string }[], rows: Record<string, unknown>[]): string {
  if (fields.length === 1 && fields[0].name === 'QUERY PLAN') {
    return rows.map((r) => String(r['QUERY PLAN'])).join('\n')
  }
  if (fields.length === 0) return ''
  const names = fields.map((f) => f.name)
  const cells = rows.slice(0, 20).map((r) => names.map((n) => String(r[n] ?? 'NULL')))
  const widths = names.map((n, i) => Math.max(n.length, ...cells.map((c) => c[i].length)))
  const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join(' | ')
  const out = [line(names), widths.map((w) => '-'.repeat(w)).join('-+-'), ...cells.map(line)]
  out.push(rows.length > 20 ? `(${rows.length} filas, se muestran 20)` : `(${rows.length} filas)`)
  return out.join('\n')
}

export async function runSql(db: PGlite, sql: string): Promise<string> {
  const t0 = performance.now()
  const results = await db.exec(sql)
  const ms = performance.now() - t0
  const blocks = results.map((r) => {
    if (r.fields.length > 0) return formatRows(r.fields, r.rows as Record<string, unknown>[])
    return r.affectedRows ? `OK · ${r.affectedRows} filas afectadas` : 'OK'
  })
  return `${blocks.join('\n\n')}\n\n-- ${ms.toFixed(0)} ms en total (incluye ida y vuelta al motor WASM)`
}
