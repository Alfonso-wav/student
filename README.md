# Student

Estudio en vez de scroll. PWA para el móvil con un feed vertical de tarjetas cortas (conceptos,
quizzes, flashcards, "encuentra el fallo" y laboratorios con Postgres real) y rutas largas para
profundizar. Repetición espaciada con FSRS, racha diaria y un `EOF` al final del feed: el scroll se acaba.

Rutas: ingeniería de datos (ecosistema, Postgres por dentro; BigQuery y modelado en cola). Después:
ciberseguridad y hacking ético, arquitectura.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173/student/
npm test           # parser, contenido, racha y feed
npm run build      # tsc + vite build + service worker
```

## Publicar en GitHub Pages

1. Crea un repo llamado `student` y sube esta carpeta.
2. En el repo: Settings → Pages → Source: **GitHub Actions**.
3. Cada push a `main` ejecuta `.github/workflows/deploy.yml` (tests + build + deploy).
   La app queda en `https://<usuario>.github.io/student/`.
4. En el móvil, abre esa URL y "Añadir a pantalla de inicio".

Si el repo se llama distinto, el workflow ajusta solo la ruta base (`BASE=/<repo>/`).

## Dónde vive cada cosa

| Qué | Dónde |
| --- | --- |
| Contenido (lecciones) | `content/<ruta>/<leccion>.md`, formato en `CLAUDE.md` |
| Rutas y su orden | `src/content.ts` (`ROUTE_META`) |
| Sistema de diseño | `DESIGN.md` → `src/styles/tokens.css` (generado) + `src/styles/app.css` |
| Progreso, racha y feed | `src/progress.ts` (puro, con tests) |
| Laboratorio Postgres | `src/lab/pg.ts` (PGlite: Postgres 18 en WASM) |

## Tu progreso

Vive en el `localStorage` del navegador donde estudias. No sale de ahí. En **stats** puedes exportar
e importar un backup en JSON: hazlo de vez en cuando y antes de cambiar de móvil.
