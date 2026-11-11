/**
 * Genera el audio de las tarjetas `video` que falten en `public/audio/`.
 *
 *   npm run tts            genera lo que falte
 *   npm run tts -- --dry   solo lista lo que falta y lo que sobra
 *   npm run tts -- --prune además borra audios que ya no usa ninguna escena
 *
 * Cada escena se guarda como `public/audio/<clave>.m4a`. La clave sale del texto que recibe el TTS
 * (narración + léxico) y de VOICE_VERSION, así que solo se regenera lo que cambia.
 *
 * Requiere: uv, ffmpeg y una GPU NVIDIA (tools/tts usa CUDA).
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseLesson } from '../src/parse.ts'
import { AUDIO_EXT, audioKey, displayWords, ttsText } from '../src/video/narration.ts'

const root = join(import.meta.dirname, '..')
const contentDir = join(root, 'content')
const audioDir = join(root, 'public', 'audio')
const ttsDir = join(root, 'tools', 'tts')
const args = new Set(process.argv.slice(2))

const jobs = new Map<string, { key: string; text: string; words: string[]; where: string }>()
for (const route of readdirSync(contentDir, { withFileTypes: true })) {
  if (!route.isDirectory()) continue
  for (const f of readdirSync(join(contentDir, route.name))) {
    if (!f.endsWith('.md') || f.startsWith('_')) continue
    const lesson = parseLesson(readFileSync(join(contentDir, route.name, f), 'utf8'), route.name, f.slice(0, -3))
    for (const card of lesson.cards) {
      if (card.kind !== 'video') continue
      card.scenes.forEach((s, i) => {
        const key = audioKey(s.narration)
        jobs.set(key, { key, text: ttsText(s.narration), words: displayWords(s.narration), where: `${card.id} #${i + 1}` })
      })
    }
  }
}

mkdirSync(audioDir, { recursive: true })
const existing = new Set(
  readdirSync(audioDir)
    .filter((f) => f.endsWith(`.${AUDIO_EXT}`))
    .map((f) => f.slice(0, -AUDIO_EXT.length - 1)),
)
const missing = [...jobs.values()].filter((j) => !existing.has(j.key))
const orphans = [...existing].filter((k) => !jobs.has(k))

console.log(`${jobs.size} escenas · ${jobs.size - missing.length} con audio · ${missing.length} por generar`)
for (const j of missing) console.log(`  + ${j.key}  ${j.where}`)
if (orphans.length) {
  console.log(`${orphans.length} audio(s) sin usar${args.has('--prune') ? ' (se borran)' : ' (--prune para borrarlos)'}`)
  for (const k of orphans) {
    console.log(`  - ${k}`)
    if (args.has('--prune')) {
      rmSync(join(audioDir, `${k}.${AUDIO_EXT}`))
      rmSync(join(audioDir, `${k}.json`), { force: true })
    }
  }
}
const untimed = [...jobs.values()].filter((j) => !existsSync(join(audioDir, `${j.key}.json`)))
if (untimed.length) console.log(`${untimed.length} escena(s) sin tiempos de subtítulo`)
if (args.has('--dry')) process.exit(0)

function run(cmd: string, argv: string[], cwd?: string) {
  const r = spawnSync(cmd, argv, { stdio: 'inherit', cwd })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`${cmd} terminó con código ${r.status}`)
}

const work = mkdtempSync(join(tmpdir(), 'student-tts-'))
try {
  if (missing.length) {
    const jobsFile = join(work, 'trabajos.json')
    writeFileSync(jobsFile, JSON.stringify(missing.map(({ key, text }) => ({ key, text }))))
    run('uv', ['run', '--project', ttsDir, 'python', join(ttsDir, 'generate.py'), jobsFile, work], ttsDir)

    for (const j of missing) {
      const wav = join(work, `${j.key}.wav`)
      if (!existsSync(wav)) throw new Error(`falta ${wav}`)
      // Mono, volumen homogéneo entre escenas y AAC (lo reproduce también Safari en iOS).
      run('ffmpeg', [
        '-loglevel', 'error', '-y', '-i', wav,
        '-af', 'loudnorm=I=-18:TP=-1.5:LRA=7',
        '-ac', '1', '-ar', '24000', '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart',
        join(audioDir, `${j.key}.${AUDIO_EXT}`),
      ])
    }
    console.log(`listo: ${missing.length} audio(s) en public/audio/`)
  }

  // Tiempos por palabra para los subtítulos (también de audios generados antes).
  const toTime = [...jobs.values()].filter((j) => !existsSync(join(audioDir, `${j.key}.json`)))
  if (toTime.length) {
    const timingFile = join(work, 'tiempos.json')
    writeFileSync(timingFile, JSON.stringify(toTime.map(({ key, words }) => ({ key, words }))))
    run('uv', ['run', '--project', ttsDir, 'python', join(ttsDir, 'timings.py'), timingFile, audioDir], ttsDir)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
