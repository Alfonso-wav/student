import { describe, expect, it } from 'vitest'
import {
  addDays,
  bestStreak,
  buildFeed,
  currentStreak,
  emptyProgress,
  grade,
  localDay,
  markSeen,
  Rating,
  type Progress,
} from './progress'
import type { Card } from './types'

const concept = (n: number): Card => ({
  id: `r/l/c${n}`,
  kind: 'concept',
  title: `c${n}`,
  lessonId: 'r/l',
  routeId: 'r',
  body: 'x',
})
const video = (n: number): Card => ({
  id: `r/l/v${n}`,
  kind: 'video',
  title: `v${n}`,
  lessonId: 'r/l',
  routeId: 'r',
  scenes: [{ narration: 'x', images: [], screen: '' }],
})
const quiz = (n: number): Card => ({
  id: `r/l/q${n}`,
  kind: 'quiz',
  title: `q${n}`,
  lessonId: 'r/l',
  routeId: 'r',
  body: '',
  options: [
    { text: 'a', correct: true },
    { text: 'b', correct: false },
  ],
  explanation: 'e',
})

const at = (day: string, h = 12) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, h)
}

describe('días', () => {
  it('addDays cruza meses y años', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('localDay usa la hora local', () => {
    expect(localDay(new Date(2026, 10, 10, 23, 59))).toBe('2026-11-10')
  })
})

describe('racha', () => {
  const withDone = (days: string[]): Progress => ({
    ...emptyProgress(),
    doneDays: Object.fromEntries(days.map((d) => [d, true as const])),
  })

  it('cuenta hasta hoy si hoy está cumplido', () => {
    expect(currentStreak(withDone(['2026-11-08', '2026-11-09', '2026-11-10']), '2026-11-10')).toEqual({
      streak: 3,
      todayDone: true,
    })
  })

  it('si hoy aún no está cumplido, conserva la racha hasta ayer', () => {
    expect(currentStreak(withDone(['2026-11-08', '2026-11-09']), '2026-11-10')).toEqual({
      streak: 2,
      todayDone: false,
    })
  })

  it('un día sin cumplir rompe la racha', () => {
    expect(currentStreak(withDone(['2026-11-07', '2026-11-08']), '2026-11-10').streak).toBe(0)
  })

  it('mejor racha', () => {
    expect(bestStreak(withDone(['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07']))).toBe(3)
  })

  it('el objetivo se cumple al llegar a goal tarjetas distintas en el día', () => {
    let p = { ...emptyProgress(), goal: 2 }
    const now = at('2026-11-10')
    p = markSeen(p, concept(1), now)
    p = markSeen(p, concept(1), now) // la misma no cuenta dos veces
    expect(p.days['2026-11-10']).toBe(1)
    expect(p.doneDays['2026-11-10']).toBeUndefined()
    p = grade(p, quiz(1), Rating.Good, now)
    expect(p.days['2026-11-10']).toBe(2)
    expect(p.doneDays['2026-11-10']).toBe(true)
  })

  it('el contador del día se reinicia al cambiar de día', () => {
    let p = markSeen(emptyProgress(), concept(1), at('2026-11-10'))
    p = markSeen(p, concept(1), at('2026-11-11'))
    expect(p.days).toEqual({ '2026-11-10': 1, '2026-11-11': 1 })
  })
})

describe('feed', () => {
  // Orden de estudio: tres vídeos, su quiz, otros tres vídeos, su quiz.
  const all = [video(1), video(2), video(3), quiz(1), video(4), video(5), video(6), quiz(2)]
  const titles = (p: Progress, now: Date) => buildFeed(all, p, now).map((c) => c.title)

  it('vídeos en orden y una práctica cada tres, sin preguntar por lo no visto', () => {
    const p = { ...emptyProgress(), newPerDay: 50 }
    expect(titles(p, at('2026-11-10'))).toEqual(['v1', 'v2', 'v3', 'q1', 'v4', 'v5', 'v6', 'q2'])
  })

  it('respeta el límite de nuevas por día', () => {
    const p = { ...emptyProgress(), newPerDay: 4 }
    expect(titles(p, at('2026-11-10'))).toEqual(['v1', 'v2', 'v3', 'q1'])
  })

  it('no adelanta un quiz cuyos vídeos aún no han salido', () => {
    const p = { ...emptyProgress(), newPerDay: 2 }
    expect(titles(p, at('2026-11-10'))).toEqual(['v1', 'v2'])
  })

  it('las nuevas ya introducidas hoy consumen el cupo', () => {
    let p = { ...emptyProgress(), newPerDay: 3 }
    p = markSeen(p, video(1), at('2026-11-10', 9))
    expect(titles(p, at('2026-11-10', 10))).toEqual(['v2', 'v3'])
  })

  it('los repasos vencidos van antes que las preguntas nuevas', () => {
    let p = { ...emptyProgress(), newPerDay: 50 }
    for (const n of [1, 2, 3]) p = markSeen(p, video(n), at('2026-11-01'))
    p = grade(p, quiz(1), Rating.Again, at('2026-11-01'))
    expect(titles(p, at('2026-11-10'))).toEqual(['v4', 'v5', 'v6', 'q1', 'q2'])
  })

  it('sin vídeos nuevos, el feed son los repasos', () => {
    let p = { ...emptyProgress(), newPerDay: 0 }
    p = grade(p, quiz(1), Rating.Again, at('2026-11-01'))
    expect(titles(p, at('2026-11-10'))).toEqual(['q1'])
  })

  it('una tarjeta repasada hoy con "bien" no vuelve el mismo día', () => {
    let p = { ...emptyProgress(), newPerDay: 0 }
    p = grade(p, quiz(1), Rating.Good, at('2026-11-10', 9))
    p = grade(p, quiz(1), Rating.Good, at('2026-11-10', 9))
    expect(buildFeed(all, p, at('2026-11-10', 22))).toEqual([])
  })
})
