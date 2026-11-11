import { createEmptyCard, fsrs, Rating, type Card as SrsCard, type Grade } from 'ts-fsrs'
import { REVIEWABLE, type Card } from './types'

/** Estado serializable. Todo lo de aquí vive en localStorage y se puede exportar a JSON. */
export interface CardProgress {
  /** Día local (YYYY-MM-DD) en que la tarjeta entró en el estudio. */
  firstDay: string
  srs?: SrsCard
}

export interface Progress {
  version: 1
  cards: Record<string, CardProgress>
  /** Interacciones contadas por día local. */
  days: Record<string, number>
  /** Días en que se cumplió el objetivo (con el objetivo vigente ese día). */
  doneDays: Record<string, true>
  /** Tarjetas ya contadas hoy, para no contar dos veces la misma. */
  today: { day: string; ids: string[] }
  goal: number
  newPerDay: number
}

export function emptyProgress(): Progress {
  return { version: 1, cards: {}, days: {}, doneDays: {}, today: { day: '', ids: [] }, goal: 10, newPerDay: 15 }
}

export function localDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y, m - 1, d + n))
}

/** Racha actual: días seguidos cumplidos acabando hoy, o ayer si hoy aún no está cumplido. */
export function currentStreak(p: Progress, today: string): { streak: number; todayDone: boolean } {
  const todayDone = !!p.doneDays[today]
  let day = todayDone ? today : addDays(today, -1)
  let streak = 0
  while (p.doneDays[day]) {
    streak++
    day = addDays(day, -1)
  }
  return { streak, todayDone }
}

export function bestStreak(p: Progress): number {
  const days = Object.keys(p.doneDays).sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

const scheduler = fsrs({ enable_fuzz: true })

function countInteraction(p: Progress, cardId: string, now: Date): Progress {
  const day = localDay(now)
  const today = p.today.day === day ? p.today : { day, ids: [] }
  if (today.ids.includes(cardId)) return { ...p, today }
  const n = (p.days[day] ?? 0) + 1
  const doneDays = n >= p.goal ? { ...p.doneDays, [day]: true as const } : p.doneDays
  return { ...p, today: { day, ids: [...today.ids, cardId] }, days: { ...p.days, [day]: n }, doneDays }
}

/** Concepto leído o lab ejecutado. */
export function markSeen(p: Progress, card: Card, now: Date): Progress {
  const cur = p.cards[card.id]
  const cards = cur ? p.cards : { ...p.cards, [card.id]: { firstDay: localDay(now) } }
  return countInteraction({ ...p, cards }, card.id, now)
}

/** Respuesta a quiz/bug o nota de flash. Programa el siguiente repaso con FSRS. */
export function grade(p: Progress, card: Card, rating: Grade, now: Date): Progress {
  if (!REVIEWABLE.has(card.kind)) return markSeen(p, card, now)
  const cur = p.cards[card.id]
  const srs = scheduler.next(cur?.srs ?? createEmptyCard(now), now, rating).card
  const entry: CardProgress = { firstDay: cur?.firstDay ?? localDay(now), srs }
  return countInteraction({ ...p, cards: { ...p.cards, [card.id]: entry } }, card.id, now)
}

export function isDue(p: Progress, card: Card, now: Date): boolean {
  const srs = p.cards[card.id]?.srs
  return !!srs && new Date(srs.due).getTime() <= now.getTime()
}

/** En el feed, una práctica (quiz, bug o flash) cada tantos vídeos. */
export const PRACTICE_EVERY = 3

/**
 * Feed del día: vídeos nuevos en orden de estudio y, cada `PRACTICE_EVERY` vídeos, una práctica.
 * La práctica es un repaso vencido o, si no hay, una pregunta nueva de algo cuyos vídeos ya han
 * salido (nunca pregunta por lo que aún no has visto). Las nuevas están limitadas por `newPerDay`:
 * el feed se acaba. Labs y conceptos de texto no entran: se ven en rutas.
 */
export function buildFeed(all: Card[], p: Progress, now: Date): Card[] {
  const day = localDay(now)
  const introducedToday = Object.values(p.cards).filter((c) => c.firstDay === day).length
  const budget = Math.max(0, p.newPerDay - introducedToday)
  const pos = new Map(all.map((c, i) => [c.id, i]))

  const freshVideos = all.filter((c) => c.kind === 'video' && !p.cards[c.id])
  // Del cupo, una plaza de cada PRACTICE_EVERY + 1 se reserva para preguntas nuevas.
  const videos = freshVideos.slice(0, budget - Math.floor(budget / (PRACTICE_EVERY + 1)))
  const freshPractice = all.filter((c) => REVIEWABLE.has(c.kind) && !p.cards[c.id])
  const due = all
    .filter((c) => REVIEWABLE.has(c.kind) && isDue(p, c, now))
    .sort((a, b) => +new Date(p.cards[a.id].srs!.due) - +new Date(p.cards[b.id].srs!.due))

  let used = videos.length
  let d = 0
  let f = 0
  /** `frontier`: posición del primer vídeo que aún no ha salido. */
  const nextPractice = (frontier: number): Card | undefined => {
    if (d < due.length) return due[d++]
    const c = freshPractice[f]
    if (c && used < budget && pos.get(c.id)! < frontier) {
      used++
      f++
      return c
    }
    return undefined
  }
  const frontierAfter = (shown: number) => pos.get(freshVideos[shown]?.id ?? '') ?? Infinity

  const out: Card[] = []
  videos.forEach((v, i) => {
    out.push(v)
    if ((i + 1) % PRACTICE_EVERY === 0) {
      const c = nextPractice(frontierAfter(i + 1))
      if (c) out.push(c)
    }
  })
  // Sin vídeos nuevos (o tras el último): lo que quede de práctica, hasta agotar el cupo.
  for (let c = nextPractice(frontierAfter(videos.length)); c; c = nextPractice(frontierAfter(videos.length)))
    out.push(c)
  return out
}

export { Rating }

const KEY = 'student:v1'

export function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProgress()
    return validate(JSON.parse(raw))
  } catch {
    return emptyProgress()
  }
}

export function save(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* almacenamiento lleno o bloqueado: se pierde solo este guardado */
  }
}

export function validate(x: unknown): Progress {
  const base = emptyProgress()
  if (!x || typeof x !== 'object' || (x as Progress).version !== 1) throw new Error('No es un backup de Student v1')
  const p = x as Partial<Progress>
  return {
    ...base,
    ...p,
    cards: p.cards ?? {},
    days: p.days ?? {},
    doneDays: p.doneDays ?? {},
    today: p.today ?? base.today,
  }
}
