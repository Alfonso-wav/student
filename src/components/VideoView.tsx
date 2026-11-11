import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { markSeen } from '../progress'
import { setProgress } from '../store'
import type { VideoCard } from '../types'
import {
  AUDIO_EXT,
  audioKey,
  displayWords,
  IMAGE_EXT,
  imageKey,
  plainNarration,
  subtitleChunks,
} from '../video/narration'
import { canAutoplay, claim, isOwner, markUnlocked } from '../video/player'
import { Markdown } from './Markdown'
import { useKeys } from './useKeys'

const SPEEDS = [1, 1.25, 1.5] as const
const SPEED_KEY = 'student.video.speed'
const BAR_WIDTH = 20
/** Si aún no se conoce la duración del audio (o se usa la voz del navegador): 14 caracteres/s. */
const CHARS_PER_SECOND = 14

const base = import.meta.env.BASE_URL
const audioUrl = (narration: string) => `${base}audio/${audioKey(narration)}.${AUDIO_EXT}`
const timingUrl = (narration: string) => `${base}audio/${audioKey(narration)}.json`
const imageUrl = (prompt: string) => `${base}img/${imageKey(prompt)}.${IMAGE_EXT}`

/** Tiempos por palabra (segundos) de cada narración; se piden una vez y se guardan aquí. */
const timingCache = new Map<string, Promise<[number, number][] | null>>()
function loadTiming(narration: string): Promise<[number, number][] | null> {
  const url = timingUrl(narration)
  let p = timingCache.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { words: string[]; t: [number, number][] } | null) =>
        j && j.t.length === displayWords(narration).length ? j.t : null,
      )
      .catch(() => null)
    timingCache.set(url, p)
  }
  return p
}

/** Sin tiempos reales: reparte la duración en proporción a la longitud de cada palabra. */
function estimateTiming(words: string[], duration: number): [number, number][] {
  const total = words.reduce((n, w) => n + w.length + 1, 0)
  let t = 0
  return words.map((w) => {
    const d = (duration * (w.length + 1)) / total
    const r: [number, number] = [t, t + d]
    t += d
    return r
  })
}

function loadSpeed(): number {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY))
    return (SPEEDS as readonly number[]).includes(v) ? v : 1
  } catch {
    return 1
  }
}

function saveSpeed(v: number) {
  try {
    localStorage.setItem(SPEED_KEY, String(v))
  } catch {
    // sin almacenamiento: la velocidad vuelve a 1x la próxima vez
  }
}

type Phase = 'idle' | 'playing' | 'paused' | 'done'

interface Props {
  card: VideoCard
  /** Tarjeta visible en el feed: recibe atajos y arranca sola si el audio ya está desbloqueado. */
  active: boolean
  inFeed: boolean
}

/**
 * Vídeo corto: narración por escenas, varias imágenes por escena que se suceden con un zoom lento,
 * y subtítulos grandes con la palabra que suena resaltada. Si falta el audio pregenerado (o no
 * carga), se usa la voz del navegador y los tiempos se estiman.
 */
export function VideoView({ card, active, inFeed }: Props) {
  const [scene, setScene] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  /** Segundos dentro de la escena actual. */
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [timing, setTiming] = useState<[number, number][] | null>(null)
  const [speed, setSpeed] = useState(loadSpeed)
  const [fallback, setFallback] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const synthTimer = useRef<number | undefined>(undefined)
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  const current = card.scenes[scene]
  const total = card.scenes.length
  const words = useMemo(() => displayWords(current.narration), [current])
  const chunks = useMemo(() => subtitleChunks(words), [words])
  const estDuration = duration || plainNarration(current.narration).length / CHARS_PER_SECOND
  const times = timing ?? estimateTiming(words, estDuration)

  useEffect(() => {
    let alive = true
    setTiming(null)
    setDuration(0)
    if (!fallback) loadTiming(current.narration).then((t) => alive && setTiming(t))
    return () => {
      alive = false
    }
  }, [current, fallback])

  const stopSynth = () => {
    window.clearInterval(synthTimer.current)
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  const finishScene = useCallback(() => {
    const i = sceneRef.current
    setTime(0)
    if (i + 1 < total) {
      setScene(i + 1)
      return
    }
    setPhase('done')
    setProgress((p) => markSeen(p, card, new Date()))
  }, [card, total])

  /** Voz del navegador para la escena; el tiempo se estima por longitud. */
  const speakFallback = useCallback(
    (i: number) => {
      stopSynth()
      if (!('speechSynthesis' in window)) return finishScene()
      const text = plainNarration(card.scenes[i].narration)
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'es-ES'
      u.rate = speed
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang === 'es-ES')
      if (voice) u.voice = voice
      const t0 = performance.now()
      synthTimer.current = window.setInterval(() => setTime(((performance.now() - t0) / 1000) * speed), 100)
      u.onend = () => {
        window.clearInterval(synthTimer.current)
        finishScene()
      }
      window.speechSynthesis.speak(u)
    },
    [card, speed, finishScene],
  )

  // Reproduce la escena actual mientras la fase sea `playing`.
  useEffect(() => {
    if (phase !== 'playing') return
    if (fallback) {
      speakFallback(scene)
      return stopSynth
    }
    const a = claim(card.id, () => setPhase((p) => (p === 'playing' ? 'paused' : p)))
    const src = audioUrl(card.scenes[scene].narration)
    if (!a.src.endsWith(src)) a.src = src
    else if (a.ended) a.currentTime = 0
    a.playbackRate = speed
    let raf = 0
    const tick = () => {
      setTime(a.currentTime)
      raf = requestAnimationFrame(tick)
    }
    const onMeta = () => setDuration(a.duration || 0)
    const onError = () => setFallback(true)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('ended', finishScene)
    a.addEventListener('error', onError)
    if (a.duration) onMeta()
    raf = requestAnimationFrame(tick)
    a.play().then(markUnlocked, (err: unknown) => {
      // NotAllowedError: el navegador exige un toque. AbortError: se cambió de escena a medio cargar.
      if (err instanceof DOMException && err.name === 'NotAllowedError') setPhase('paused')
      else if (!(err instanceof DOMException && err.name === 'AbortError')) setFallback(true)
    })
    return () => {
      cancelAnimationFrame(raf)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('ended', finishScene)
      a.removeEventListener('error', onError)
      if (isOwner(card.id)) a.pause()
    }
    // `speed` va en su propio efecto para no reiniciar la escena al cambiarla.
  }, [phase, scene, fallback, card])

  useEffect(() => {
    if (phase === 'playing' && isOwner(card.id)) claim(card.id, () => setPhase('paused')).playbackRate = speed
  }, [speed])

  // En el feed: arranca al llegar (si ya hubo un toque) y se pausa al irse.
  useEffect(() => {
    if (!inFeed) return
    if (active) {
      if (canAutoplay()) setPhase((p) => (p === 'idle' || p === 'paused' ? 'playing' : p))
    } else setPhase((p) => (p === 'playing' ? 'paused' : p))
  }, [active, inFeed])

  // Fuera del feed (lección): pausa al salir de pantalla.
  useEffect(() => {
    const el = root.current
    if (!el || inFeed) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) setPhase((p) => (p === 'playing' ? 'paused' : p))
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inFeed])

  useEffect(() => stopSynth, [])

  const toggle = () => {
    if (phase === 'playing') {
      stopSynth()
      setPhase('paused')
    } else if (phase === 'done') {
      setScene(0)
      setTime(0)
      setPhase('playing')
    } else setPhase('playing')
  }

  const go = (d: number) => {
    const next = Math.max(0, Math.min(total - 1, scene + d))
    if (next === scene) return
    stopSynth()
    setScene(next)
    setTime(0)
    if (phase === 'done') setPhase('paused')
  }

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length]
    setSpeed(next)
    saveSpeed(next)
  }

  useKeys(active, (k, e) => {
    if (k === ' ' || k === 'Enter') {
      e.preventDefault()
      toggle()
    } else if (k === 'ArrowRight') go(1)
    else if (k === 'ArrowLeft') go(-1)
  })

  // Palabra que suena y bloque de subtítulo que la contiene.
  const started = phase === 'playing' || phase === 'paused'
  let word = -1
  if (started) for (let i = 0; i < times.length && times[i][0] <= time + 0.05; i++) word = i
  let chunk = 0
  for (let c = 0; c < chunks.length && chunks[c] <= Math.max(0, word); c++) chunk = c
  const chunkEnd = chunks[chunk + 1] ?? words.length

  // Imagen activa: las de la escena se reparten a partes iguales en el tiempo.
  const images = current.images
  const progress = phase === 'done' ? 1 : Math.min(1, time / estDuration)
  const imgIndex = phase === 'done' ? images.length - 1 : Math.min(images.length - 1, Math.floor(progress * images.length))
  const segSeconds = estDuration / Math.max(1, images.length) / speed

  const overall = phase === 'done' ? 1 : (scene + progress) / total
  const filled = Math.round(overall * BAR_WIDTH)
  const label = { idle: 'play', playing: 'pausa', paused: 'seguir', done: 'otra vez' }[phase]

  return (
    <div className={`video ${inFeed ? 'is-feed' : ''} ${phase === 'playing' ? 'is-playing' : ''}`} ref={root}>
      {/* Tocar la imagen equivale al botón principal (que es el control accesible). */}
      <div className="video-stage" onClick={toggle} aria-hidden="true">
        {images.map((p, i) => (
          <img
            key={`${scene}-${i}`}
            className={`video-img ${i === imgIndex ? 'is-on' : ''} kb-${(scene + i) % 4}`}
            style={{ '--kb-dur': `${segSeconds}s` } as CSSProperties}
            src={imageUrl(p)}
            alt=""
            decoding="async"
          />
        ))}
        {!started && phase !== 'done' && <span className="video-hint">▶ toca para empezar</span>}
      </div>
      <p className="video-sub" aria-live="off" key={`${scene}-${chunk}`}>
        {words.slice(chunks[chunk], chunkEnd).map((w, k) => (
          <span key={k} className={chunks[chunk] + k === word ? 'is-now' : ''}>
            {w}{' '}
          </span>
        ))}
      </p>
      <div className="video-controls">
        <button type="button" className="btn-primary" onClick={toggle}>
          {label}
        </button>
        <button type="button" className="btn-secondary" onClick={() => go(-1)} disabled={scene === 0} aria-label="Escena anterior">
          ←
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => go(1)}
          disabled={scene === total - 1}
          aria-label="Escena siguiente"
        >
          →
        </button>
        <button type="button" className="btn-secondary" onClick={cycleSpeed} aria-label={`Velocidad ${speed}x`}>
          {speed}x
        </button>
      </div>
      <p className="video-bar tnum" aria-label={`Escena ${scene + 1} de ${total}`}>
        <span className="video-track" aria-hidden="true">
          <span className="video-fill">{'█'.repeat(filled)}</span>
          {'░'.repeat(BAR_WIDTH - filled)}
        </span>{' '}
        {scene + 1}/{total}
        {fallback && ' · voz del navegador'}
        {phase === 'done' && <span className="ok"> · exit 0{inFeed ? ' · desliza ↓' : ''}</span>}
      </p>
      <p className="sr-only">{plainNarration(current.narration)}</p>
      {!inFeed && current.screen && (
        <details className="video-notes">
          <summary>apuntes de la escena</summary>
          <Markdown src={current.screen} />
        </details>
      )}
    </div>
  )
}
