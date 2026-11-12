# Student

PWA personal anti-scroll: feed de tarjetas + rutas de estudio. Vite + React + TS, sin backend, GitHub
Pages. Diseño: `DESIGN.md` manda en todo lo visual. Dos modos: el **feed** en modo pop (colorido,
redondo, celebraciones, adulto; `src/styles/pop.css`) y el resto en modo terminal (esquinas cuadradas,
un acento ámbar). Antes de tocar UI, leer `DESIGN.md`; después, `visual-qa` de alfo-design.

## Usuario

Ingeniero de datos (Postgres, BigQuery, Metabase) que quiere nivel senior. No quiere practicar a
escribir SQL: quiere **entender** rendimiento, internals y criterio. Contenido en español.

**El contenido es general, no un traje a medida.** Nada de "tu stack", "tu empresa" ni frases que
corrijan o citen al usuario. Postgres, BigQuery o Metabase pueden salir como ejemplos, junto a sus
alternativas (MySQL, Snowflake, Redshift, Looker, Power BI…), sin que el texto gire en torno a ellos.

## Formato de una lección

`content/<ruta>/<slug>.md`. El slug y los títulos de tarjeta forman el id de cada tarjeta
(`ruta/slug/titulo-slugificado`), que es la clave del progreso guardado: **no renombrar slugs ni
títulos de tarjetas publicadas** o se pierde su historial de repaso.

````markdown
---
title: Título de la lección
order: 3
summary: Una frase.
---

## concept: Título (≤ 56 caracteres, se comprueba en tests)
Markdown. Corto: tiene que caber en una pantalla de móvil.

## quiz: Título
Enunciado.
- [ ] opción
- [x] la única correcta
- [ ] opción
> Explicación (obligatoria): por qué la buena lo es y por qué las otras no.

## bug: Título
Igual que quiz, pero el enunciado presenta código o una decisión con un fallo.

## flash: Pregunta corta (es la cara frontal)
Respuesta en markdown.

## lab: Título
Texto introductorio.
```sql setup
-- se ejecuta una vez al arrancar el lab (PGlite, Postgres 18)
```
```sql run Etiqueta del botón
EXPLAIN ANALYZE ...
```

## video: Título
> Narración de la escena 1 (lo que dice la voz; sale como subtítulo grande). Números en letra.
% Prompt de imagen en inglés: una metáfora visual concreta de lo que se dice (sin texto).
% Segunda imagen: se reparten a partes iguales a lo largo de la escena.
Apuntes (markdown, diagramas ≤ 38 caracteres por línea): solo se ven en la lección, plegados.
---
> Narración de la escena 2.
% …
````

Reglas de contenido:

- Antes de escribir un lab o un quiz sobre planes, **ejecutar las consultas en PGlite** (Node vale:
  importar `@electric-sql/pglite`) y basar el texto en la salida real.
- Nada de cifras o precios sin matizar fecha y fuente. Nada inventado.
- `npm test` valida el formato de todo el contenido.

## Vídeos (voz, imágenes y subtítulos)

Tarjeta `video`: una idea, 30–60 s. **Tono:** explicado como para un niño (el nivel, no la estética)
pero sin rebajar el concepto: frases cortas, una analogía cotidiana por idea (GPS, libro con
índice, pósits, botón de deshacer), exclamaciones y preguntas, nada de párrafos de manual. El
término técnico real sale siempre. Prompts de imagen: una metáfora concreta de objetos o escenas,
sin personajes con cara ni mascotas.

Escenas ≤ 400 caracteres de voz, ≤ 950 en total, y ≥ 2 imágenes por escena. El feed son vídeos con
una práctica (quiz/flash) cada 3; los conceptos se escriben como vídeo, no como `concept`. Nada de líneas que empiecen por `>` o `%` en los apuntes.

Todo se genera en local (GPU NVIDIA, `uv`, `ffmpeg`) y se commitea; `npm test` falla si falta algo.

- `npm run tts`: voz con Chatterbox Multilingual es-ES clonando `tools/tts/voz-referencia.wav` (no se commitea: va en `.gitignore`) →
  `public/audio/<hash>.m4a`, comprobada con Whisper, y tiempos por palabra para los subtítulos →
  `public/audio/<hash>.json`. Solo lo nuevo o cambiado.
- `npm run images`: Z-Image Turbo (Apache 2.0, bf16 guardado en fp8 para caber en 12 GB) →
  `public/img/<hash>.webp` (640×800). El estilo común está en `IMAGE_STYLE`
  (`src/video/narration.ts`); cambiarlo o subir `IMAGE_VERSION` regenera todas.
- Términos técnicos que suenen mal → `LEXICON` en `src/video/narration.ts`. Cambiar voz o modelo →
  subir `VOICE_VERSION`.
- `--prune` en cualquiera de los dos borra lo que ya no usa ninguna escena.
- Movimiento según la skill motion-design de LottieFiles (personalidad Premium): fundido entre
  imágenes de 600 ms, zoom lento con curva seno, subtítulo que entra en 240 ms. Respeta
  `prefers-reduced-motion`.

## App Android

Capacitor (`android/`, config en `capacitor.config.json`; TS 7 no tiene la API JS que necesita un
`capacitor.config.ts`). `npm run apk` construye la web con `BASE=/ NATIVE=1` (sin service worker:
todo va dentro del APK) y deja `Student.apk` (debug, para instalar a mano) en la raíz. Requiere
Android Studio (JDK en `Android Studio/jbr` como `JAVA_HOME`) y el SDK. Barras del sistema en
`android/app/src/main/res/values/styles.xml` (sin edge-to-edge forzado de Android 15).

## Rutas pendientes

BigQuery por dentro, modelado; MVCC/VACUUM, joins y estadísticas en Postgres; después
ciberseguridad/hacking ético y arquitectura (añadir en `ROUTE_META` de `src/content.ts`).
