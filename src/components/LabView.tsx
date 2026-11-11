import { useId, useState } from 'react'
import { getLabDb, resetLabDb, runSql } from '../lab/pg'
import type { LabCard } from '../types'
import { Markdown } from './Markdown'

type Status = 'idle' | 'booting' | 'ready' | 'running' | 'error'

export function LabView({ card, onRun }: { card: LabCard; onRun: () => void }) {
  const [status, setStatus] = useState<Status>('idle')
  const [sql, setSql] = useState(card.queries[0].sql)
  const [output, setOutput] = useState('')
  const [failed, setFailed] = useState(false)
  const sqlId = useId()

  const boot = async () => {
    setStatus('booting')
    setFailed(false)
    try {
      await getLabDb(card.id, card.setup)
      setStatus('ready')
    } catch (e) {
      setStatus('error')
      setOutput(`No se pudo arrancar Postgres: ${(e as Error).message}. Comprueba la conexión y pulsa otra vez.`)
    }
  }

  const run = async (text: string) => {
    setSql(text)
    setStatus('running')
    try {
      const db = await getLabDb(card.id, card.setup)
      setOutput(await runSql(db, text))
      setFailed(false)
      onRun()
    } catch (e) {
      setOutput(`ERROR: ${(e as Error).message}`)
      setFailed(true)
    }
    setStatus('ready')
  }

  const reset = async () => {
    await resetLabDb(card.id)
    setOutput('')
    setSql(card.queries[0].sql)
    setStatus('idle')
  }

  return (
    <>
      <Markdown src={card.body} />
      {status === 'idle' || status === 'booting' || status === 'error' ? (
        <div className="actions">
          <button type="button" className="btn-primary" onClick={boot} disabled={status === 'booting'}>
            {status === 'booting' ? 'Arrancando Postgres…' : 'Arrancar Postgres'}
          </button>
          <span className="hint">Postgres 18 real en tu navegador · la primera vez descarga unos MB, luego va sin conexión</span>
          {status === 'error' && (
            <p className="result ko" role="alert">
              {output}
            </p>
          )}
        </div>
      ) : (
        <div className="lab">
          <p className="lab-label">Consultas preparadas</p>
          <ul className="lab-queries">
            {card.queries.map((q) => (
              <li key={q.label}>
                <button
                  type="button"
                  className="btn-secondary lab-q"
                  onClick={() => run(q.sql)}
                  disabled={status === 'running'}
                >
                  {q.label}
                </button>
              </li>
            ))}
          </ul>
          <label className="lab-label" htmlFor={sqlId}>
            SQL (puedes editarla)
          </label>
          <textarea
            id={sqlId}
            name="sql"
            className="sql"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={Math.min(8, sql.split('\n').length + 1)}
          />
          <div className="actions">
            <button type="button" className="btn-primary" onClick={() => run(sql)} disabled={status === 'running'}>
              {status === 'running' ? 'Ejecutando…' : 'Ejecutar'}
            </button>
            <button type="button" className="btn-secondary" onClick={reset} disabled={status === 'running'}>
              Reiniciar base
            </button>
          </div>
          {output && (
            <pre className={`lab-out ${failed ? 'is-error' : ''}`} aria-live="polite" tabIndex={0}>
              {output}
            </pre>
          )}
        </div>
      )}
    </>
  )
}
