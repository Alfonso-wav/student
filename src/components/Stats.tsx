import { useId, useRef, useState } from 'react'
import { ALL_CARDS } from '../content'
import { addDays, bestStreak, currentStreak, isDue, localDay, validate, type Progress } from '../progress'
import { setProgress, useProgress } from '../store'
import { REVIEWABLE } from '../types'

const WEEKS = 16
const fmtDate = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

function dateOf(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Nivel de la celda: 0 nada, 1 algo, 2 media meta, 3 meta cumplida. */
function level(p: Progress, day: string): number {
  const n = p.days[day] ?? 0
  if (p.doneDays[day]) return 3
  if (n === 0) return 0
  return n >= p.goal / 2 ? 2 : 1
}

function Heatmap({ p, today }: { p: Progress; today: string }) {
  // Columnas = semanas (lunes arriba), la última acaba en la semana de hoy.
  const dow = (dateOf(today).getDay() + 6) % 7
  const start = addDays(today, -dow - (WEEKS - 1) * 7)
  const weeks: string[][] = []
  for (let w = 0; w < WEEKS; w++) {
    weeks.push(Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  }
  return (
    <figure className="heat">
      <figcaption className="muted">Últimas {WEEKS} semanas · cada columna es una semana, de lunes a domingo</figcaption>
      <div className="heat-grid" role="list">
        {weeks.map((days, w) => (
          <div className="heat-col" key={w} role="presentation">
            {days.map((d) => {
              const future = d > today
              const n = p.days[d] ?? 0
              const label = `${fmtDate.format(dateOf(d))}: ${n} tarjetas${p.doneDays[d] ? ', objetivo cumplido' : ''}`
              return (
                <span
                  key={d}
                  role="listitem"
                  className={`heat-cell l${future ? 'x' : level(p, d)} ${d === today ? 'is-today' : ''}`}
                  title={future ? undefined : label}
                  aria-label={future ? 'futuro' : label}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="heat-legend muted" aria-hidden="true">
        nada <span className="heat-cell l0" /> <span className="heat-cell l1" /> <span className="heat-cell l2" />{' '}
        <span className="heat-cell l3" /> meta cumplida
      </div>
    </figure>
  )
}

export function Stats() {
  const p = useProgress()
  const now = new Date()
  const today = localDay(now)
  const { streak, todayDone } = currentStreak(p, today)
  const best = bestStreak(p)
  const studied = Object.keys(p.cards).length
  const inReview = ALL_CARDS.filter((c) => REVIEWABLE.has(c.kind) && p.cards[c.id]?.srs).length
  const due = ALL_CARDS.filter((c) => isDue(p, c, now)).length
  const n = p.days[today] ?? 0
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -i))

  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const goalId = useId()
  const newId = useId()
  const themeId = useId()
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('student:theme') ?? 'auto'
    } catch {
      return 'auto'
    }
  })

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `student-backup-${today}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Backup descargado.')
  }

  const importBackup = async (file: File) => {
    try {
      const next = validate(JSON.parse(await file.text()))
      setProgress(next)
      setMsg(`Backup restaurado: ${Object.keys(next.cards).length} tarjetas.`)
    } catch (e) {
      setMsg(`No se pudo restaurar: ${(e as Error).message}. Elige un .json exportado desde aquí.`)
    }
  }

  const changeTheme = (t: string) => {
    setTheme(t)
    try {
      localStorage.setItem('student:theme', t)
    } catch {
      /* sin almacenamiento: solo dura esta sesión */
    }
    if (t === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.dataset.theme = t
  }

  return (
    <div className="page">
      <h1 className="page-title">
        <span className="dollar">$</span> uptime
      </h1>

      <dl className="tiles">
        <div className="tile">
          <dt>racha</dt>
          <dd className="tile-num tnum">
            {streak}
            <span className="tile-unit">{streak === 1 ? 'día' : 'días'}</span>
          </dd>
          <dd className="muted">{todayDone ? 'hoy cumplido' : `hoy ${n}/${p.goal}`}</dd>
        </div>
        <div className="tile">
          <dt>mejor racha</dt>
          <dd className="tile-num tnum">
            {best}
            <span className="tile-unit">{best === 1 ? 'día' : 'días'}</span>
          </dd>
        </div>
        <div className="tile tile-wide">
          <dt>estudiadas</dt>
          <dd className="tile-num tnum">
            {studied}
            <span className="tile-unit">/ {ALL_CARDS.length}</span>
          </dd>
          <dd className="muted">
            {inReview} en repaso · {due} pendientes ahora
          </dd>
        </div>
      </dl>

      <Heatmap p={p} today={today} />

      <h2 className="section-title">Últimos 7 días</h2>
      <table className="days">
        <thead>
          <tr>
            <th scope="col">día</th>
            <th scope="col" className="num">
              tarjetas
            </th>
            <th scope="col">meta</th>
          </tr>
        </thead>
        <tbody>
          {last7.map((d) => (
            <tr key={d}>
              <td>{d === today ? 'hoy' : fmtDate.format(dateOf(d))}</td>
              <td className="num tnum">{p.days[d] ?? 0}</td>
              <td className={p.doneDays[d] ? 'ok' : 'muted'}>{p.doneDays[d] ? 'cumplida' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="section-title">Ajustes</h2>
      <div className="settings">
        <label htmlFor={goalId}>Objetivo diario (tarjetas para sumar un día a la racha)</label>
        <select
          id={goalId}
          name="goal"
          value={p.goal}
          onChange={(e) => setProgress((x) => ({ ...x, goal: Number(e.target.value) }))}
        >
          {[5, 10, 15, 20, 30].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <label htmlFor={newId}>Tarjetas nuevas por día en el feed</label>
        <select
          id={newId}
          name="newPerDay"
          value={p.newPerDay}
          onChange={(e) => setProgress((x) => ({ ...x, newPerDay: Number(e.target.value) }))}
        >
          {[10, 15, 25, 40].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <label htmlFor={themeId}>Tema</label>
        <select id={themeId} name="theme" value={theme} onChange={(e) => changeTheme(e.target.value)}>
          <option value="auto">el del sistema</option>
          <option value="dark">terminal oscura</option>
          <option value="light">papel claro</option>
        </select>
      </div>

      <h2 className="section-title">Backup</h2>
      <p className="muted">
        Tu progreso vive solo en este navegador. Exporta un backup de vez en cuando por si borras datos o cambias de
        móvil.
      </p>
      <div className="actions">
        <button type="button" className="btn-secondary" onClick={exportBackup}>
          Exportar backup
        </button>
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
          Restaurar backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importBackup(f)
            e.target.value = ''
          }}
        />
      </div>
      <p className="muted" aria-live="polite">
        {msg}
      </p>
    </div>
  )
}
