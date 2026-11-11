import type { Card, CardKind, LabQuery, Lesson, QuizOption, VideoScene } from './types'

const KINDS: ReadonlySet<string> = new Set(['concept', 'quiz', 'flash', 'bug', 'lab', 'video'])

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseFrontmatter(src: string): { meta: Record<string, string>; rest: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src)
  if (!m) return { meta: {}, rest: src }
  const meta: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return { meta, rest: src.slice(m[0].length) }
}

interface RawSection {
  kind: CardKind
  title: string
  lines: string[]
}

/** Parte por `## tipo: título`, ignorando lo que haya dentro de bloques de código. */
function splitSections(body: string, where: string): RawSection[] {
  const out: RawSection[] = []
  let cur: RawSection | null = null
  let inFence = false
  for (const line of body.split(/\r?\n/)) {
    if (/^```/.test(line)) inFence = !inFence
    const h = !inFence && /^## ([a-z]+):\s*(.+)$/.exec(line)
    if (h) {
      if (!KINDS.has(h[1])) throw new Error(`${where}: tipo de tarjeta desconocido "${h[1]}"`)
      cur = { kind: h[1] as CardKind, title: h[2].trim(), lines: [] }
      out.push(cur)
    } else if (cur) {
      cur.lines.push(line)
    }
  }
  return out
}

function parseQuiz(lines: string[], where: string) {
  const options: QuizOption[] = []
  const bodyLines: string[] = []
  const explLines: string[] = []
  let inFence = false
  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence
    const opt = !inFence && /^- \[( |x)\] (.+)$/.exec(line)
    if (opt) {
      options.push({ text: opt[2].trim(), correct: opt[1] === 'x' })
    } else if (!inFence && /^>\s?/.test(line) && options.length > 0) {
      explLines.push(line.replace(/^>\s?/, ''))
    } else if (options.length === 0) {
      bodyLines.push(line)
    }
  }
  if (options.length < 2) throw new Error(`${where}: un quiz necesita al menos 2 opciones`)
  if (options.filter((o) => o.correct).length !== 1)
    throw new Error(`${where}: un quiz necesita exactamente 1 opción correcta`)
  if (explLines.join('').trim() === '') throw new Error(`${where}: falta la explicación (> …)`)
  return { body: bodyLines.join('\n').trim(), options, explanation: explLines.join('\n').trim() }
}

function parseLab(lines: string[], where: string) {
  const bodyLines: string[] = []
  const queries: LabQuery[] = []
  let setup = ''
  let fence: { kind: 'setup' | 'run'; label: string; lines: string[] } | null = null
  for (const line of lines) {
    if (fence) {
      if (/^```\s*$/.test(line)) {
        const sql = fence.lines.join('\n').trim()
        if (fence.kind === 'setup') setup = sql
        else queries.push({ label: fence.label, sql })
        fence = null
      } else fence.lines.push(line)
      continue
    }
    const open = /^```sql (setup|run)\s*(.*)$/.exec(line)
    if (open) fence = { kind: open[1] as 'setup' | 'run', label: open[2].trim(), lines: [] }
    else bodyLines.push(line)
  }
  if (fence) throw new Error(`${where}: bloque de código sin cerrar`)
  if (queries.length === 0) throw new Error(`${where}: un lab necesita al menos un \`\`\`sql run`)
  return { body: bodyLines.join('\n').trim(), setup, queries }
}

/**
 * Escenas separadas por una línea `---`. En cada escena, las líneas `> ` son la narración, las
 * `% ` son prompts de imagen y el resto son apuntes (markdown).
 */
function parseVideo(lines: string[], where: string): { scenes: VideoScene[] } {
  const raw: string[][] = [[]]
  let inFence = false
  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence
    if (!inFence && /^---\s*$/.test(line)) raw.push([])
    else raw[raw.length - 1].push(line)
  }
  const scenes = raw
    .filter((ls) => ls.join('').trim() !== '')
    .map((ls, i) => {
      const narr: string[] = []
      const images: string[] = []
      const screen: string[] = []
      let fence = false
      for (const line of ls) {
        if (/^```/.test(line)) fence = !fence
        if (!fence && /^>\s?/.test(line)) narr.push(line.replace(/^>\s?/, ''))
        else if (!fence && /^%\s/.test(line)) images.push(line.replace(/^%\s+/, '').trim())
        else screen.push(line)
      }
      const narration = narr.join(' ').replace(/\s+/g, ' ').trim()
      if (!narration) throw new Error(`${where}: la escena ${i + 1} no tiene narración (> …)`)
      return { narration, images, screen: screen.join('\n').trim() }
    })
  if (scenes.length === 0) throw new Error(`${where}: vídeo sin escenas`)
  return { scenes }
}

export function parseLesson(src: string, routeId: string, slug: string): Lesson {
  const lessonId = `${routeId}/${slug}`
  const { meta, rest } = parseFrontmatter(src)
  if (!meta.title) throw new Error(`${lessonId}: falta title en el frontmatter`)
  const seen = new Set<string>()
  const cards: Card[] = splitSections(rest, lessonId).map((s) => {
    const id = `${lessonId}/${slugify(s.title)}`
    const where = id
    if (seen.has(id)) throw new Error(`${where}: título de tarjeta duplicado en la lección`)
    seen.add(id)
    const base = { id, title: s.title, lessonId, routeId }
    switch (s.kind) {
      case 'quiz':
      case 'bug':
        return { ...base, kind: s.kind, ...parseQuiz(s.lines, where) }
      case 'lab':
        return { ...base, kind: 'lab', ...parseLab(s.lines, where) }
      case 'video':
        return { ...base, kind: 'video', ...parseVideo(s.lines, where) }
      case 'flash':
      case 'concept': {
        const body = s.lines.join('\n').trim()
        if (!body) throw new Error(`${where}: tarjeta vacía`)
        return { ...base, kind: s.kind, body }
      }
    }
  })
  if (cards.length === 0) throw new Error(`${lessonId}: lección sin tarjetas`)
  return {
    id: lessonId,
    routeId,
    order: Number(meta.order ?? 999),
    title: meta.title,
    summary: meta.summary ?? '',
    cards,
  }
}
