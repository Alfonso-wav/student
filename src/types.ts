export type CardKind = 'concept' | 'quiz' | 'flash' | 'bug' | 'lab' | 'video'

export interface QuizOption {
  text: string
  correct: boolean
}

export interface LabQuery {
  label: string
  sql: string
}

interface CardBase {
  /** Estable entre versiones: `<lessonId>/<slug del título>` */
  id: string
  kind: CardKind
  title: string
  lessonId: string
  routeId: string
}

export interface ConceptCard extends CardBase {
  kind: 'concept'
  body: string
}

export interface QuizCard extends CardBase {
  kind: 'quiz' | 'bug'
  body: string
  options: QuizOption[]
  explanation: string
}

export interface FlashCard extends CardBase {
  kind: 'flash'
  body: string
}

export interface LabCard extends CardBase {
  kind: 'lab'
  body: string
  setup: string
  queries: LabQuery[]
}

export interface VideoScene {
  /** Lo que dice la voz (markdown en línea permitido; se quita antes del TTS). */
  narration: string
  /** Prompts de imagen (líneas `% …`): se reparten a lo largo de la escena, en orden. */
  images: string[]
  /** Apuntes de la escena (markdown): diagramas y código, visibles en la lección. */
  screen: string
}

export interface VideoCard extends CardBase {
  kind: 'video'
  scenes: VideoScene[]
}

export type Card = ConceptCard | QuizCard | FlashCard | LabCard | VideoCard

export interface Lesson {
  id: string
  routeId: string
  order: number
  title: string
  summary: string
  cards: Card[]
}

export interface Route {
  id: string
  title: string
  summary: string
  status: 'activa' | 'en cola'
  lessons: Lesson[]
}

/** Tarjetas que entran en repetición espaciada (las de concepto, lab y vídeo solo se "ven"). */
export const REVIEWABLE: ReadonlySet<CardKind> = new Set(['quiz', 'bug', 'flash'])
