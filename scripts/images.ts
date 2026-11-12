/**
 * Genera las imágenes de las escenas de vídeo que falten en `public/img/`.
 *
 *   npm run images            genera lo que falte
 *   npm run images -- --dry   solo lista lo que falta y lo que sobra
 *   npm run images -- --prune además borra imágenes que ya no usa ninguna escena
 *   npm run images -- --limit=40  genera como mucho 40 (por tandas)
 *   npm run images -- --only=postgres/leer-un-plan  solo esa lección (o ruta: --only=postgres)
 *
 * Cada prompt (`% …` en el guion) se guarda como `public/img/<clave>.webp`; la clave sale del
 * prompt, del estilo común y de IMAGE_VERSION (src/video/narration.ts).
 *
 * Requiere: uv y una GPU NVIDIA (tools/img usa CUDA).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseLesson } from '../src/parse.ts'
import { IMAGE_EXT, imageKey, imagePrompt } from '../src/video/narration.ts'

const root = join(import.meta.dirname, '..')
const contentDir = join(root, 'content')
const imgDir = join(root, 'public', 'img')
const toolDir = join(root, 'tools', 'img')
const args = new Set(process.argv.slice(2))

const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.slice(7)
const jobs = new Map<string, { key: string; prompt: string; where: string }>()
for (const route of readdirSync(contentDir, { withFileTypes: true })) {
  if (!route.isDirectory()) continue
  for (const f of readdirSync(join(contentDir, route.name))) {
    if (!f.endsWith('.md') || f.startsWith('_')) continue
    const lesson = parseLesson(readFileSync(join(contentDir, route.name, f), 'utf8'), route.name, f.slice(0, -3))
    for (const card of lesson.cards) {
      if (card.kind !== 'video') continue
      if (onlyArg && !`${card.lessonId}/`.startsWith(`${onlyArg}/`)) continue
      card.scenes.forEach((s, i) =>
        s.images.forEach((p, k) => {
          const key = imageKey(p)
          jobs.set(key, { key, prompt: imagePrompt(p), where: `${card.id} #${i + 1}.${k + 1}` })
        }),
      )
    }
  }
}

mkdirSync(imgDir, { recursive: true })
const existing = new Set(
  readdirSync(imgDir)
    .filter((f) => f.endsWith(`.${IMAGE_EXT}`))
    .map((f) => f.slice(0, -IMAGE_EXT.length - 1)),
)
const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const missingAll = [...jobs.values()].filter((j) => !existing.has(j.key))
const missing = limitArg ? missingAll.slice(0, Number(limitArg.slice(8))) : missingAll
// Con --only, `jobs` es parcial: no se calculan huérfanas (y --prune no borra nada).
const orphans = onlyArg ? [] : [...existing].filter((k) => !jobs.has(k))

console.log(`${jobs.size} imágenes · ${jobs.size - missingAll.length} hechas · ${missingAll.length} por generar · ahora ${missing.length}`)
if (orphans.length) {
  console.log(`${orphans.length} imagen(es) sin usar${args.has('--prune') ? ' (se borran)' : ' (--prune para borrarlas)'}`)
  if (args.has('--prune')) for (const k of orphans) rmSync(join(imgDir, `${k}.${IMAGE_EXT}`))
}
if (args.has('--dry') || missing.length === 0) process.exit(0)

const work = mkdtempSync(join(tmpdir(), 'student-img-'))
try {
  const jobsFile = join(work, 'trabajos.json')
  writeFileSync(jobsFile, JSON.stringify(missing.map(({ key, prompt }) => ({ key, prompt }))))
  const r = spawnSync('uv', ['run', '--project', toolDir, 'python', join(toolDir, 'generate.py'), jobsFile, imgDir], {
    stdio: 'inherit',
    cwd: toolDir,
  })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`generate.py terminó con código ${r.status}`)
  const still = missing.filter((j) => !existsSync(join(imgDir, `${j.key}.${IMAGE_EXT}`)))
  if (still.length) throw new Error(`faltan ${still.length} imágenes`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
