import { ROUTES } from '../content'
import type { Progress } from '../progress'
import { useProgress } from '../store'
import type { Lesson, Route } from '../types'
import { CardView } from './CardView'

function done(p: Progress, lesson: Lesson): number {
  return lesson.cards.filter((c) => p.cards[c.id]).length
}

export function Bar({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <span className="bar" role="img" aria-label={`${value} de ${total} tarjetas`}>
      <span className="bar-track">
        <span className="bar-on" style={{ width: `${pct}%` }} />
      </span>
      <span className="bar-pct tnum">{pct}%</span>
    </span>
  )
}

export function RoutesList() {
  const p = useProgress()
  return (
    <div className="page">
      <h1 className="page-title">
        <span className="dollar">$</span> ls rutas/
      </h1>
      <ul className="list">
        {ROUTES.map((r) => {
          const total = r.lessons.reduce((n, l) => n + l.cards.length, 0)
          const seen = r.lessons.reduce((n, l) => n + done(p, l), 0)
          const body = (
            <>
              <span className="row-head">
                <span className="row-title">{r.id}/</span>
                {r.status === 'activa' ? (
                  <Bar value={seen} total={total} />
                ) : (
                  <span className="muted">en cola</span>
                )}
              </span>
              <span className="row-title-long">{r.title}</span>
              <span className="muted">{r.summary}</span>
              {r.status === 'activa' && (
                <span className="muted tnum">
                  {r.lessons.length} lecciones · {seen}/{total} tarjetas
                </span>
              )}
            </>
          )
          return (
            <li key={r.id}>
              {r.status === 'activa' && r.lessons.length > 0 ? (
                <a className="row" href={`#/rutas/${r.id}`}>
                  {body}
                </a>
              ) : (
                <div className="row is-disabled">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function RouteView({ route }: { route: Route }) {
  const p = useProgress()
  return (
    <div className="page">
      <p className="crumbs">
        <a href="#/rutas">rutas</a> / {route.id}
      </p>
      <h1 className="page-title">{route.title}</h1>
      <p className="lede">{route.summary}</p>
      <ol className="list">
        {route.lessons.map((l) => (
          <li key={l.id}>
            <a className="row" href={`#/rutas/${l.id}`}>
              <span className="row-head">
                <span className="row-title">
                  <span className="muted tnum">{String(l.order).padStart(2, '0')}</span> {l.title}
                </span>
                <Bar value={done(p, l)} total={l.cards.length} />
              </span>
              {l.summary && <span className="muted">{l.summary}</span>}
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function LessonView({ route, lesson }: { route: Route; lesson: Lesson }) {
  const idx = route.lessons.indexOf(lesson)
  const next = route.lessons[idx + 1]
  return (
    <div className="page lesson">
      <p className="crumbs">
        <a href="#/rutas">rutas</a> / <a href={`#/rutas/${route.id}`}>{route.id}</a> / {lesson.id.split('/')[1]}
      </p>
      <h1 className="page-title">{lesson.title}</h1>
      {lesson.summary && <p className="lede">{lesson.summary}</p>}
      {lesson.cards.map((c) => (
        <div className="lesson-item" key={c.id}>
          <CardView card={c} />
        </div>
      ))}
      <div className="lesson-end">
        {next ? (
          <a className="btn-primary" href={`#/rutas/${next.id}`}>
            Siguiente: {next.title}
          </a>
        ) : (
          <a className="btn-primary" href={`#/rutas/${route.id}`}>
            Fin de la ruta · volver al índice
          </a>
        )}
      </div>
    </div>
  )
}
