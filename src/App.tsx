import { useEffect } from 'react'
import { Feed } from './components/Feed'
import { LessonView, RoutesList, RouteView } from './components/Routes'
import { Stats } from './components/Stats'
import { LESSON_BY_ID, ROUTES } from './content'
import { currentStreak, localDay } from './progress'
import { parseHash, useHash, viewPath, type View } from './router'
import { useProgress } from './store'

function StatusBar({ view }: { view: View }) {
  const p = useProgress()
  const today = localDay(new Date())
  const { streak, todayDone } = currentStreak(p, today)
  const n = p.days[today] ?? 0
  return (
    <header className="statusbar">
      <p className="sb-prompt">
        <span className="muted">alfo@student:</span>
        {viewPath(view)}
        <span className="dollar">$</span>
      </p>
      <a className="sb-uptime tnum" href="#/stats" aria-label={`Racha de ${streak} días. Hoy ${n} de ${p.goal}.`}>
        <span className={todayDone ? 'ok' : ''}>up {streak}d</span>
        <span className="muted">
          · {Math.min(n, p.goal)}/{p.goal}
        </span>
      </a>
    </header>
  )
}

const TABS = [
  { id: 'feed', href: '#/feed' },
  { id: 'rutas', href: '#/rutas' },
  { id: 'stats', href: '#/stats' },
] as const

function TabBar({ view }: { view: View }) {
  const current = view.name === 'ruta' || view.name === 'leccion' ? 'rutas' : view.name
  return (
    <nav className="tabbar" aria-label="Secciones">
      {TABS.map((t) => (
        <a key={t.id} href={t.href} className="tab" aria-current={current === t.id ? 'page' : undefined}>
          <span className="tab-caret" aria-hidden="true">
            {current === t.id ? '>' : ' '}
          </span>
          {t.id}
        </a>
      ))}
    </nav>
  )
}

function NotFound() {
  return (
    <div className="page">
      <h1 className="page-title">No existe esa ruta</h1>
      <p>
        <code>cd</code> falló: el directorio no existe. <a href="#/rutas">Volver a rutas</a>.
      </p>
    </div>
  )
}

function Screen({ view }: { view: View }) {
  switch (view.name) {
    case 'feed':
      return <Feed />
    case 'rutas':
      return <RoutesList />
    case 'stats':
      return <Stats />
    case 'ruta': {
      const r = ROUTES.find((x) => x.id === view.routeId && x.lessons.length > 0)
      return r ? <RouteView route={r} /> : <NotFound />
    }
    case 'leccion': {
      const r = ROUTES.find((x) => x.id === view.routeId)
      const l = LESSON_BY_ID.get(`${view.routeId}/${view.lessonSlug}`)
      return r && l ? <LessonView route={r} lesson={l} key={l.id} /> : <NotFound />
    }
  }
}

export function App() {
  const hash = useHash()
  const view = parseHash(hash)

  useEffect(() => {
    if (view.name !== 'feed') document.getElementById('main')?.scrollTo({ top: 0 })
  }, [hash, view.name])

  return (
    <div className="shell">
      <StatusBar view={view} />
      <main id="main" className={view.name === 'feed' ? 'main is-feed' : 'main'}>
        <Screen view={view} />
      </main>
      <TabBar view={view} />
    </div>
  )
}
