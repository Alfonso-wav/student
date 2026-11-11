import { useEffect, useRef, useState } from 'react'
import type { Grade } from 'ts-fsrs'
import { grade, isDue, markSeen, Rating } from '../progress'
import { getProgress, setProgress } from '../store'
import type { Card, FlashCard, QuizCard } from '../types'
import { LabView } from './LabView'
import { Markdown } from './Markdown'
import { useKeys } from './useKeys'
import { VideoView } from './VideoView'

const VERB: Record<Card['kind'], string> = {
  concept: 'cat',
  quiz: 'quiz',
  bug: 'diff',
  flash: 'flash',
  lab: 'psql',
  video: 'play',
}

interface Props {
  card: Card
  /** Tarjeta visible en el feed: recibe los atajos de teclado. */
  active?: boolean
  /** Pintada en el feed (pantalla completa, autoplay de vídeo) y no en la lección. */
  inFeed?: boolean
}

export function CardView({ card, active = false, inFeed = false }: Props) {
  const due = isDue(getProgress(), card, new Date())
  return (
    <article className={`card ${card.kind === 'video' ? 'is-video' : ''}`} aria-labelledby={`t-${card.id}`}>
      <p className="prompt">
        <span className="dollar">$</span> {VERB[card.kind]} {card.lessonId}
        {due && <span className="tag-due"> # repaso</span>}
      </p>
      <h2 className="card-title" id={`t-${card.id}`}>
        {card.title}
      </h2>
      {card.kind === 'concept' && <Concept card={card} />}
      {(card.kind === 'quiz' || card.kind === 'bug') && <Quiz card={card} active={active} />}
      {card.kind === 'flash' && <Flash card={card} active={active} />}
      {card.kind === 'video' && <VideoView card={card} active={active} inFeed={inFeed} />}
      {card.kind === 'lab' && <LabView card={card} onRun={() => setProgress((p) => markSeen(p, card, new Date()))} />}
    </article>
  )
}

/** Un concepto cuenta como leído tras 1,5 s con al menos la mitad en pantalla. */
function Concept({ card }: { card: Card & { body: string } }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer: number | undefined
    const io = new IntersectionObserver(
      ([e]) => {
        window.clearTimeout(timer)
        if (e.isIntersecting) {
          timer = window.setTimeout(() => setProgress((p) => markSeen(p, card, new Date())), 1500)
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      window.clearTimeout(timer)
    }
  }, [card])
  return (
    <div ref={ref}>
      <Markdown src={card.body} />
    </div>
  )
}

function Quiz({ card, active }: { card: QuizCard; active: boolean }) {
  const [picked, setPicked] = useState<number | null>(null)
  const answered = picked !== null

  const pick = (i: number) => {
    if (answered) return
    setPicked(i)
    const ok = card.options[i].correct
    setProgress((p) => grade(p, card, ok ? Rating.Good : Rating.Again, new Date()))
  }

  useKeys(active, (k) => {
    const n = Number(k)
    if (n >= 1 && n <= card.options.length) pick(n - 1)
  })

  const correct = answered && card.options[picked].correct
  return (
    <>
      {card.body && <Markdown src={card.body} />}
      <ol className="options" aria-label="Opciones">
        {card.options.map((o, i) => {
          const state = !answered ? '' : o.correct ? 'is-correct' : i === picked ? 'is-wrong' : 'is-dim'
          return (
            <li key={i}>
              <button type="button" className={`option ${state}`} onClick={() => pick(i)} disabled={answered}>
                <span className="key" aria-hidden="true">
                  [{i + 1}]
                </span>
                <span className="option-text">
                  <Markdown src={o.text} inline />
                </span>
                {answered && o.correct && <span className="mark">ok</span>}
                {answered && i === picked && !o.correct && <span className="mark">fallo</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <div aria-live="polite">
        {answered && (
          <div className="explain">
            <p className={correct ? 'result ok' : 'result ko'}>
              {correct ? 'exit 0 — correcto' : 'exit 1 — vuelve a salir en el próximo repaso'}
            </p>
            <Markdown src={card.explanation} />
          </div>
        )}
      </div>
    </>
  )
}

const GRADES: { r: Grade; label: string }[] = [
  { r: Rating.Again, label: 'otra vez' },
  { r: Rating.Hard, label: 'difícil' },
  { r: Rating.Good, label: 'bien' },
  { r: Rating.Easy, label: 'fácil' },
]

function Flash({ card, active }: { card: FlashCard; active: boolean }) {
  const [shown, setShown] = useState(false)
  const [graded, setGraded] = useState<Grade | null>(null)

  const rate = (r: Grade) => {
    if (graded !== null) return
    setGraded(r)
    setProgress((p) => grade(p, card, r, new Date()))
  }

  useKeys(active, (k) => {
    if (!shown && (k === ' ' || k === 'Enter')) return setShown(true)
    const n = Number(k)
    if (shown && n >= 1 && n <= 4) rate(GRADES[n - 1].r)
  })

  if (!shown) {
    return (
      <div className="actions">
        <button type="button" className="btn-primary" onClick={() => setShown(true)}>
          Revelar respuesta
        </button>
        <span className="hint">o pulsa espacio</span>
      </div>
    )
  }
  return (
    <>
      <Markdown src={card.body} />
      <div className="grades" role="group" aria-label="¿Cómo de bien lo sabías?">
        {GRADES.map((g, i) => (
          <button
            key={g.r}
            type="button"
            className={`btn-secondary ${graded === g.r ? 'is-picked' : ''}`}
            onClick={() => rate(g.r)}
            disabled={graded !== null}
          >
            <span className="key" aria-hidden="true">
              [{i + 1}]
            </span>{' '}
            {g.label}
          </button>
        ))}
      </div>
      <div aria-live="polite">{graded !== null && <p className="result ok">guardado · vuelve cuando toque</p>}</div>
    </>
  )
}
