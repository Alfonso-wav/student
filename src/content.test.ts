import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildRoutes } from './content'
import { parseLesson } from './parse'
import { AUDIO_EXT, audioKey, IMAGE_EXT, imageKey, ttsText } from './video/narration'

const root = join(__dirname, '..', 'content')

function loadAll(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    for (const f of readdirSync(join(root, dir.name))) {
      if (f.endsWith('.md')) out[`../content/${dir.name}/${f}`] = readFileSync(join(root, dir.name, f), 'utf8')
    }
  }
  return out
}

describe('contenido', () => {
  const routes = buildRoutes(loadAll())
  const cards = routes.flatMap((r) => r.lessons.flatMap((l) => l.cards))

  it('todas las lecciones parsean y las rutas activas tienen lecciones', () => {
    for (const r of routes.filter((r) => r.status === 'activa')) expect(r.lessons.length).toBeGreaterThan(0)
  })

  it('ids de tarjeta únicos en todo el curso', () => {
    const ids = cards.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('orden de lecciones sin huecos ni repetidos', () => {
    for (const r of routes) {
      expect(r.lessons.map((l) => l.order)).toEqual(r.lessons.map((_, i) => i + 1))
    }
  })

  it('títulos caben en dos líneas a 390 px (≤ 56 caracteres)', () => {
    for (const c of cards) expect(c.title.length, c.id).toBeLessThanOrEqual(56)
  })

  describe('vídeos', () => {
    const videos = cards.flatMap((c) => (c.kind === 'video' ? [c] : []))

    it('narración con números en letra (el TTS lee mal las cifras)', () => {
      for (const v of videos)
        v.scenes.forEach((s, i) => expect(s.narration, `${v.id} escena ${i + 1}`).not.toMatch(/\d/))
    })

    it('escenas cortas (≤ 400 caracteres de voz) y vídeo de 60 s como mucho (≤ 950)', () => {
      for (const v of videos) {
        v.scenes.forEach((s, i) => expect(s.narration.length, `${v.id} escena ${i + 1}`).toBeLessThanOrEqual(400))
        expect(v.scenes.reduce((n, s) => n + s.narration.length, 0), v.id).toBeLessThanOrEqual(950)
      }
    })

    it('el código de pantalla cabe a 390 px (≤ 38 caracteres por línea)', () => {
      for (const v of videos)
        v.scenes.forEach((s, i) => {
          let fence = false
          for (const line of s.screen.split('\n')) {
            if (/^```/.test(line)) fence = !fence
            else if (fence) expect([...line].length, `${v.id} escena ${i + 1}: ${line}`).toBeLessThanOrEqual(38)
          }
        })
    })

    it('cada escena tiene su audio generado (npm run tts)', () => {
      const missing = videos.flatMap((v) =>
        v.scenes
          .map((s, i) => ({ where: `${v.id} escena ${i + 1}`, key: audioKey(s.narration) }))
          .filter(({ key }) => !existsSync(join(__dirname, '..', 'public', 'audio', `${key}.${AUDIO_EXT}`))),
      )
      expect(missing, 'falta audio: ejecuta `npm run tts`').toEqual([])
    })

    it('cada escena tiene sus tiempos de subtítulo (npm run tts)', () => {
      const missing = videos.flatMap((v) =>
        v.scenes
          .map((s, i) => ({ where: `${v.id} escena ${i + 1}`, key: audioKey(s.narration) }))
          .filter(({ key }) => !existsSync(join(__dirname, '..', 'public', 'audio', `${key}.json`))),
      )
      expect(missing, 'faltan tiempos: ejecuta `npm run tts`').toEqual([])
    })

    it('cada escena tiene al menos dos imágenes, generadas (npm run images)', () => {
      for (const v of videos) {
        v.scenes.forEach((s, i) => {
          expect(s.images.length, `${v.id} escena ${i + 1}`).toBeGreaterThanOrEqual(2)
          for (const p of s.images)
            expect(
              existsSync(join(__dirname, '..', 'public', 'img', `${imageKey(p)}.${IMAGE_EXT}`)),
              `falta imagen (npm run images): ${v.id} escena ${i + 1}: ${p}`,
            ).toBe(true)
        })
      }
    })
  })
})

describe('parser', () => {
  it('lee un quiz con opciones y explicación', () => {
    const l = parseLesson(
      `---\ntitle: T\norder: 1\n---\n\n## quiz: ¿Qué?\nTexto\n- [ ] a\n- [x] b\n> porque sí`,
      'r',
      'l',
    )
    const q = l.cards[0]
    expect(q.kind).toBe('quiz')
    if (q.kind !== 'quiz') return
    expect(q.options).toEqual([
      { text: 'a', correct: false },
      { text: 'b', correct: true },
    ])
    expect(q.explanation).toBe('porque sí')
    expect(q.id).toBe('r/l/que')
  })

  it('no parte secciones dentro de bloques de código', () => {
    const l = parseLesson('---\ntitle: T\n---\n## concept: A\n```\n## quiz: no\n```\n', 'r', 'l')
    expect(l.cards).toHaveLength(1)
  })

  it('rechaza un quiz sin respuesta correcta', () => {
    expect(() => parseLesson('---\ntitle: T\n---\n## quiz: Q\n- [ ] a\n- [ ] b\n> x', 'r', 'l')).toThrow(/exactamente 1/)
  })

  it('lee setup y consultas de un lab', () => {
    const l = parseLesson('---\ntitle: T\n---\n## lab: L\nIntro\n```sql setup\nCREATE TABLE t();\n```\n```sql run 1 · ver\nSELECT 1;\n```\n', 'r', 'l')
    const lab = l.cards[0]
    if (lab.kind !== 'lab') throw new Error('no es lab')
    expect(lab.setup).toBe('CREATE TABLE t();')
    expect(lab.queries).toEqual([{ label: '1 · ver', sql: 'SELECT 1;' }])
    expect(lab.body).toBe('Intro')
  })

  it('quita comillas del frontmatter', () => {
    expect(parseLesson("---\ntitle: 'A: b'\n---\n## concept: x\ny", 'r', 'l').title).toBe('A: b')
  })

  it('lee las escenas de un vídeo: > es voz, el resto pantalla', () => {
    const l = parseLesson(
      '---\ntitle: T\n---\n## video: V\n> Hola **mundo**.\n> Sigue.\n```sql\n---\n```\n---\n> Dos.\n',
      'r',
      'l',
    )
    const v = l.cards[0]
    if (v.kind !== 'video') throw new Error('no es vídeo')
    expect(v.scenes).toEqual([
      { narration: 'Hola **mundo**. Sigue.', images: [], screen: '```sql\n---\n```' },
      { narration: 'Dos.', images: [], screen: '' },
    ])
  })

  it('rechaza una escena sin narración', () => {
    expect(() => parseLesson('---\ntitle: T\n---\n## video: V\n> a\n---\nsolo pantalla\n', 'r', 'l')).toThrow(
      /narración/,
    )
  })
})

describe('narración', () => {
  it('aplica el léxico respetando límites de palabra y quita markdown', () => {
    expect(ttsText('Un `Seq Scan` y luego EXPLAIN ANALYZE sobre cliente_id.')).toBe(
      'Un sek scan y luego explein ánalais sobre cliente id.',
    )
    expect(ttsText('NoSQL no es SQL')).toBe('NoSQL no es ese cu ele')
  })

  it('la clave depende solo del texto que oye el TTS', () => {
    expect(audioKey('Hola **mundo**')).toBe(audioKey('Hola mundo'))
    expect(audioKey('Hola mundo')).not.toBe(audioKey('Hola mundo.'))
    expect(audioKey('Hola')).toMatch(/^[0-9a-f]{14}$/)
  })
})
