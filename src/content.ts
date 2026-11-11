import { parseLesson } from './parse'
import type { Card, Lesson, Route } from './types'

/** Rutas en orden de estudio. Las lecciones salen de `content/<ruta>/*.md`. */
const ROUTE_META: Omit<Route, 'lessons'>[] = [
  {
    id: 'ecosistema',
    title: 'Mapa del ecosistema de datos',
    summary: 'Qué problema resuelve cada pieza del sector y cómo encajan entre sí.',
    status: 'activa',
  },
  {
    id: 'postgres',
    title: 'Postgres por dentro',
    summary: 'Planes de ejecución, índices, estadísticas, MVCC y VACUUM. Con laboratorio real.',
    status: 'activa',
  },
  {
    id: 'bigquery',
    title: 'BigQuery por dentro',
    summary: 'Almacenamiento columnar, slots, particionado, clustering y coste por consulta.',
    status: 'en cola',
  },
  {
    id: 'modelado',
    title: 'Modelado de datos',
    summary: 'Kimball, hechos y dimensiones, SCD, granularidad y cuándo desnormalizar.',
    status: 'en cola',
  },
]

const files = import.meta.glob('../content/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export function buildRoutes(sources: Record<string, string>): Route[] {
  const byRoute = new Map<string, Lesson[]>()
  for (const [path, src] of Object.entries(sources)) {
    const m = /content\/([^/]+)\/([^/]+)\.md$/.exec(path)
    if (!m || m[2].startsWith('_')) continue
    const lesson = parseLesson(src, m[1], m[2])
    const list = byRoute.get(m[1]) ?? []
    list.push(lesson)
    byRoute.set(m[1], list)
  }
  return ROUTE_META.map((r) => ({
    ...r,
    lessons: (byRoute.get(r.id) ?? []).sort((a, b) => a.order - b.order),
  }))
}

export const ROUTES: Route[] = buildRoutes(files)

/** Todas las tarjetas en orden de estudio. */
export const ALL_CARDS: Card[] = ROUTES.flatMap((r) => r.lessons.flatMap((l) => l.cards))

export const CARD_BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]))

export const LESSON_BY_ID = new Map(ROUTES.flatMap((r) => r.lessons.map((l) => [l.id, l] as const)))
