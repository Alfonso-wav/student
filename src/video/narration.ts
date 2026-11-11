/**
 * Del guion al texto que lee el TTS, y de ahí a la clave del archivo de audio.
 *
 * Lo usan la app (para saber qué audio pedir) y `scripts/tts.ts` (para saber cuál falta). Sin
 * dependencias: Node lo importa tal cual con `--experimental-strip-types`.
 */

/**
 * Sube este número al cambiar la voz de referencia, el modelo o los parámetros de generación:
 * cambia todas las claves y `npm run tts` lo regenera todo.
 */
export const VOICE_VERSION = 'chatterbox-es-es/ref1'

/**
 * Pronunciación de términos técnicos. El guion se escribe normal (`Seq Scan`) y el TTS recibe la
 * forma de la derecha. Se aplica en orden y respetando límites de palabra: los términos largos van
 * antes que sus prefijos (`EXPLAIN ANALYZE` antes que `EXPLAIN`).
 *
 * Añade aquí cualquier término que el generador marque como `REVISAR` o que suene mal.
 */
export const LEXICON: [string, string][] = [
  // Postgres
  ['EXPLAIN ANALYZE', 'explein ánalais'],
  ['EXPLAIN', 'explein'],
  ['ANALYZE', 'ánalais'],
  ['Rows Removed by Filter', 'rous rimúvd bai fílter'],
  ['Seq Scan', 'sek scan'],
  ['Index Only Scan', 'índex onli scan'],
  ['Index Scan', 'índex scan'],
  ['Bitmap Heap Scan', 'bítmap jip scan'],
  ['Bitmap Index Scan', 'bítmap índex scan'],
  ['B-tree', 'bi tri'],
  ['VACUUM', 'vácum'],
  ['MVCC', 'eme uve ce ce'],
  ['WAL', 'güal'],
  ['DELETE', 'dilít'],
  ['UPDATE', 'ápdeit'],
  ['SELECT', 'select'],
  ['buffers', 'báferes'],
  ['lower', 'lóuer'],
  // Siglas
  ['MySQL', 'mai ese cu ele'],
  ['SQLite', 'ese cu ele lait'],
  ['SQL', 'ese cu ele'],
  ['ORM', 'o erre eme'],
  ['OLTP', 'o ele te pe'],
  ['OLAP', 'ólap'],
  ['ETL', 'e te ele'],
  ['ELT', 'e ele te'],
  ['CDC', 'ce de ce'],
  ['BI', 'bi ai'],
  ['API', 'a pe i'],
  ['IA', 'i a'],
  ['RGPD', 'erre ge pe de'],
  ['DAGs', 'dags'],
  ['CSV', 'ce ese uve'],
  ['JSON', 'yéison'],
  ['dbt', 'de be te'],
  ['sqlx', 'ese cu ele equis'],
  // Productos
  ['BigQuery', 'big cuéri'],
  ['Snowflake', 'snóuflein'],
  ['Metabase', 'métabeis'],
  ['Redshift', 'rédshift'],
  ['Airflow', 'érflou'],
  ['Cloud Composer', 'claud compóuser'],
  ['Google', 'gúgel'],
  ['Python', 'páiton'],
  ['Dataform', 'dátaform'],
  ['Databricks', 'dátabriks'],
  ['DuckDB', 'dac de be'],
  ['Rust', 'rast'],
  ['Iceberg', 'áisberg'],
  ['Hudi', 'júdi'],
  ['Delta Lake', 'delta leik'],
  // Jerga
  ['lakehouses', 'leikjáuses'],
  ['lakehouse', 'leikjáus'],
  ['warehouses', 'güerjáuses'],
  ['warehouse', 'güerjáus'],
  ['data lake', 'data leik'],
  ['lake', 'leik'],
  ['dashboards', 'dásbords'],
  ['dashboard', 'dásbord'],
  ['backfills', 'bákfils'],
  ['big data', 'big deita'],
  ['machine learning', 'machín lérnin'],
  ['pipeline', 'páiplain'],
  ['dataframes', 'dátafreims'],
  ['assets', 'ásets'],
  ['assertions', 'asérshons'],
  ['staging', 'stéiyin'],
  ['Staging', 'stéiyin'],
  ['Intermediate', 'intermídiet'],
  ['Medallion', 'medálion'],
  ['feed', 'fid'],
  ['terabyte', 'terabáit'],
  ['kilobytes', 'kilobáits'],
  ['bytes', 'báits'],
]

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const LEXICON_RE = LEXICON.map(
  ([from, to]) => [new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(from)}(?![\\p{L}\\p{N}])`, 'gu'), to] as const,
)

/** Quita el markdown en línea que pueda haber en la narración. */
export function plainNarration(md: string): string {
  return md
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Texto exacto que recibe el TTS. */
export function ttsText(narration: string): string {
  let t = plainNarration(narration)
  for (const [re, to] of LEXICON_RE) t = t.replace(re, to)
  // `cliente_id` → `cliente id`: el TTS no sabe leer guiones bajos.
  return t.replace(/_/g, ' ')
}

/** cyrb53: hash de 53 bits, rápido y sin dependencias. Suficiente para nombrar archivos. */
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

/** Nombre del archivo de audio (sin extensión) para una narración. */
export function audioKey(narration: string): string {
  return cyrb53(`${VOICE_VERSION}\n${ttsText(narration)}`)
}

export const AUDIO_EXT = 'm4a'

/** Palabras tal como se muestran en los subtítulos (los tiempos de cada una van en el .json). */
export function displayWords(narration: string): string[] {
  return plainNarration(narration).split(' ').filter(Boolean)
}

/**
 * Subtítulos: agrupa palabras en bloques de como mucho `maxChars` (dos líneas grandes en móvil),
 * cortando preferentemente tras un signo de puntuación. Devuelve el índice de la primera palabra
 * de cada bloque.
 */
export function subtitleChunks(words: string[], maxChars = 34): number[] {
  const starts: number[] = []
  let len = 0
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const prevEndsClause = i > 0 && /[.,;:!?…]$/.test(words[i - 1])
    if (i === 0 || len + 1 + w.length > maxChars || (prevEndsClause && len >= 14)) {
      starts.push(i)
      len = w.length
    } else len += 1 + w.length
  }
  return starts
}

/**
 * Estilo común de todas las imágenes. Se añade a cada prompt; cambiarlo (o subir IMAGE_VERSION)
 * regenera todas con `npm run images`.
 */
export const IMAGE_VERSION = 'zimage-turbo/v1'
export const IMAGE_STYLE =
  'Minimalist editorial illustration, flat vector, thin amber orange line art and pale grey-green shapes ' +
  'on a near-black background, lots of negative space, clean geometric shapes, no text, no letters, no numbers, no logos'

export function imagePrompt(prompt: string): string {
  return `${prompt.replace(/\.?\s*$/, '.')} ${IMAGE_STYLE}`
}

export function imageKey(prompt: string): string {
  return cyrb53(`${IMAGE_VERSION}\n${imagePrompt(prompt)}`)
}

export const IMAGE_EXT = 'webp'
