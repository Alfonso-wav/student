import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { ALL_CARDS } from '../content'
import { buildFeed, currentStreak, localDay } from '../progress'
import { getProgress, useProgress } from '../store'
import type { Card } from '../types'
import { CardView } from './CardView'

/** Tono (oklch) de cada tarjeta del feed: rosa, violeta, azul, cian, verde, naranja. */
const HUES = [350, 300, 255, 200, 150, 40]
const hue = (i: number) => ({ '--hue': HUES[i % HUES.length] }) as CSSProperties

export function Feed() {
  // El feed se calcula al entrar y no cambia mientras haces scroll.
  const [cards, setCards] = useState<Card[]>(() => buildFeed(ALL_CARDS, getProgress(), new Date()))
  const [active, setActive] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
        }
      },
      { root, threshold: 0.55 },
    )
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [cards])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const dir = e.key === 'j' ? 1 : e.key === 'k' ? -1 : 0
      if (!dir) return
      const next = scroller.current?.querySelector(`[data-index="${active + dir}"]`)
      next?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  const reload = () => {
    setCards(buildFeed(ALL_CARDS, getProgress(), new Date()))
    scroller.current?.scrollTo({ top: 0 })
  }

  return (
    <div className="feed" ref={scroller}>
      <h1 className="sr-only">Feed de hoy</h1>
      <p className="kbd-hint" aria-hidden="true">
        j/k moverte · espacio play/revelar · ←/→ escena · 1–4 responder
      </p>
      {cards.map((c, i) => (
        <section
          className={`feed-item pop ${c.kind === 'video' ? 'is-video' : ''} ${i === active ? 'is-active' : ''}`}
          style={hue(i)}
          key={c.id}
          data-index={i}
        >
          <CardView card={c} active={i === active} inFeed />
        </section>
      ))}
      <section
        className={`feed-item pop ${active === cards.length ? 'is-active' : ''}`}
        style={hue(cards.length)}
        data-index={cards.length}
      >
        <Eof onReload={reload} hadCards={cards.length > 0} />
      </section>
    </div>
  )
}

function Eof({ onReload, hadCards }: { onReload: () => void; hadCards: boolean }) {
  const p = useProgress()
  const today = localDay(new Date())
  const { streak, todayDone } = currentStreak(p, today)
  const n = p.days[today] ?? 0
  return (
    <article className="card eof" aria-labelledby="eof-title">
      <p className="pop-head">
        <span className="pop-chip">fin</span>
      </p>
      <h2 className="card-title" id="eof-title">
        {todayDone ? '¡Objetivo cumplido!' : '¡Hecho por hoy!'}
      </h2>
      <p>
        {hadCards
          ? 'Se acabó el feed de hoy. Aquí no hay scroll infinito: lo que no has visto hoy sale mañana.'
          : 'No hay nada pendiente ahora mismo. Las tarjetas nuevas y los repasos se reparten por días.'}
      </p>
      <dl className="pop-stats tnum">
        <div>
          <dt>hoy</dt>
          <dd>
            {n}/{p.goal}
          </dd>
        </div>
        <div>
          <dt>racha</dt>
          <dd>
            {streak} {streak === 1 ? 'día' : 'días'}
          </dd>
        </div>
      </dl>
      <div className="actions">
        <a className="btn-primary" href="#/rutas">
          Profundizar en una ruta
        </a>
        <button type="button" className="btn-secondary" onClick={onReload}>
          Buscar repasos nuevos
        </button>
      </div>
      {!todayDone && (
        <p className="hint">
          Para no romper la racha te faltan {p.goal - n}. En rutas puedes seguir con lecciones enteras.
        </p>
      )}
    </article>
  )
}
