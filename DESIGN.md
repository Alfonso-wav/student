---
version: 1
name: student
description: "Terminal de fósforo ámbar: fondo casi negro #0c0d0c, tinta gris verdosa #d7dcd5, un único acento ámbar #ffaf00 para la acción principal y el prompt. Una sola familia monoespaciada (JetBrains Mono) en todo. Superficies separadas por líneas rectas de 1 px y escalones de tono, esquinas cuadradas siempre. Sin imágenes, sin sombras en reposo, sin burbujas, sin emoji."
surface: herramienta

colors:
  canvas: "#0c0d0c"
  surface-1: "#141614"
  surface-2: "#1c1f1c"
  ink: "#d7dcd5"
  ink-muted: "#8f968f"
  primary: "#ffaf00"
  on-primary: "#0c0d0c"
  primary-hover: "#ffc54d"
  hairline: "#2a2e2a"
  semantic-success: "#5fd75f"
  semantic-warning: "#d7d75f"
  semantic-danger: "#ff6b6b"

typography:
  display:
    fontFamily: JetBrains Mono
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.03em
  headline:
    fontFamily: JetBrains Mono
    fontSize: 21px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.01em
  title:
    fontFamily: JetBrains Mono
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  body:
    fontFamily: JetBrains Mono
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  small:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  button:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px

rounded:
  none: 0px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: 12px 16px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: 12px 16px
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: 12px 14px
  panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: 16px
---

# Student — sistema de diseño

> Generado con la skill `design-md`. Manda sobre el manifiesto en todo lo visual (precedencia §0).

## Overview

Student sustituye el scroll de redes sociales por estudio. Es una PWA para el móvil y la usa una sola
persona, muchas veces al día y en ratos cortos. Superficie: **herramienta**. Tiene que abrir rápido,
leerse con una mano y no tener nada decorativo.

**Idea:** en Student, el feed infinito de las redes se convierte en la salida de una terminal.
Cada tarjeta es la respuesta a un comando (`$ cat ecosistema/oltp-vs-olap`) y el final del feed es un
`EOF` de verdad: el scroll se acaba. La racha diaria es el `uptime` de la máquina.

La monoespaciada en todo el texto es una petición explícita del usuario ("estilo terminal Linux") y
manda sobre la regla del manifiesto que la limita a código y datos (precedencia §0.1).

## Colors

### Brand & Accent
- **primary** `#ffaf00` (ámbar de fósforo, xterm 214). Va en la acción principal de cada tarjeta y en
  el `$` del prompt. Nada más.

### Surface
- **canvas** `#0c0d0c` → **surface-1** `#141614` → **surface-2** `#1c1f1c`. Escalones de tono más
  líneas `hairline` de 1 px. Nunca sombra.

### Text
- **ink** `#d7dcd5` para todo el texto corrido. **ink-muted** `#8f968f` para prompts, rutas y metadatos.

### Semantic
- success `#5fd75f` (respuesta correcta, día cumplido), warning `#d7d75f` (repaso pendiente),
  danger `#ff6b6b` (respuesta fallada, error de SQL). Solo comunican estado.

### Dark mode
Oscuro por defecto: es una terminal. Modo claro "papel de impresora de líneas" bajo
`prefers-color-scheme: light` o `[data-theme=light]`:

| Token | Claro |
| --- | --- |
| canvas | `#f3f3ef` |
| surface-1 | `#e8e9e3` |
| surface-2 | `#dcded6` |
| ink | `#161816` |
| ink-muted | `#545954` |
| primary | `#8a5100` |
| on-primary | `#ffffff` |
| primary-hover | `#6e4100` |
| hairline | `#c4c7bd` |
| success | `#22702a` |
| warning | `#6b5f00` |
| danger | `#b42318` |

`color-scheme: dark light` y `theme-color` igual a `canvas` en cada esquema.

## Typography

### Font Family
JetBrains Mono (OFL), autoalojada vía `@fontsource/jetbrains-mono` para que funcione sin conexión.
Pesos 400, 500 y 700. Fallback: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.

### Hierarchy
| Rol | Tamaño | Peso | Interlineado | Tracking | Uso |
| --- | --- | --- | --- | --- | --- |
| display | 40px | 700 | 1.1 | -0.03em | solo cifras de stats (racha) |
| headline | 21px | 700 | 1.25 | -0.01em | título de tarjeta y de pantalla |
| title | 17px | 700 | 1.3 | 0 | lección, subtítulos dentro de tarjeta |
| body | 15px | 400 | 1.6 | 0 | texto de tarjeta |
| small | 13px | 400 | 1.45 | 0 | prompt, metadatos, barra de estado, planes de EXPLAIN |
| button | 14px | 500 | 1 | 0 | botones |

### Principles
- Titulares en dos líneas o menos a 390 px. Si no caben, se acorta el título en el contenido.
- Sentence case en todo. Los comandos van en minúscula, como en una shell.
- `tabular-nums` en la racha, los contadores y los tiempos de EXPLAIN.
- Medida máxima de texto: 68ch.

## Layout

### Spacing System
`xs` 4 para el hueco entre prompt y título, `sm` 8 dentro de controles, `md` 16 de margen lateral y
entre bloques de una tarjeta, `lg` 24 entre secciones de una tarjeta, `xl` 40 al pie de la tarjeta.

### Grid & Container
Una columna. Margen lateral 16 px en móvil y 24 px desde 768 px. Ancho máximo de contenido 720 px,
centrado. El texto se alinea a un solo eje izquierdo.

### Whitespace Philosophy
Una tarjeta ocupa la pantalla entera del feed y respira por dentro. Entre tarjetas solo hay una línea
`hairline`.

## Elevation & Depth
Plano. Lo único que flota es el aviso de actualización de la PWA: lleva borde `hairline` y fondo
`surface-2`, sin sombra.

## Shapes
Cuadrado (`0px`) en todo. Barras de progreso hechas con caracteres de bloque (`█░`) o rectángulos
rectos.

## Components

### Buttons
- Primario: fondo `primary`, texto `on-primary`, uno por tarjeta como mucho (responder, revelar,
  ejecutar).
- Secundario: fondo `surface-1`, borde `hairline`, texto `ink`. Las opciones de quiz y las notas de
  repaso son secundarios.
- Estados: hover sube a `surface-2`; `focus-visible` con contorno de 2 px `primary` y desplazamiento
  de 2 px; disabled con opacidad 0.5; loading con texto `ejecutando…`.
- Un atajo de teclado delante cuando existe: `[1] otra vez`.

### Status bar (arriba)
`alfo@student:~/feed$` a la izquierda (el `$` en `primary`) y `uptime 12d · hoy 4/10` a la derecha.
Fondo `canvas`, línea `hairline` debajo.

### Tab bar (abajo)
Tres destinos: `feed`, `rutas`, `stats`. El activo lleva `>` delante y la tinta plena. Los demás van
en `ink-muted`. Línea `hairline` encima y respeta `safe-area-inset-bottom`.

### Card
Prompt `$ cat ruta/leccion` en `small`/`ink-muted`, título `headline`, cuerpo `body`. Bloques de
código sobre `surface-1` con borde izquierdo `hairline`. Tipo de tarjeta en el prompt
(`cat` concepto, `quiz` pregunta, `flash` repaso, `lab` laboratorio, `diff` encuentra el fallo).

### Lab
Botones de consulta preparada (secundarios). La salida va en un `<pre>` sobre `surface-1` en `small`,
con scroll horizontal propio dentro del bloque (nunca de la página).

## Do's and Don'ts

### Do
- Separar todo con líneas rectas de 1 px (`hairline`).
- Esquinas cuadradas en todo, sin excepción.
- Hablar como una terminal: `EOF`, `uptime`, `exit 0`, rutas con `/`.
- Diseñar el final del feed (`EOF`) como un estado, no como un error.

### Don't
- Nada de burbujas, pastillas, chips redondeados ni tarjetas flotantes con sombra.
- Nada de emoji ni iconos decorativos. Si hace falta un símbolo, carácter ASCII o de caja.
- Nada de verde Matrix brillante como acento ni efectos de scanlines, glow o parpadeo de CRT.
- Nada de eyebrows ni numeración índice decorativa. La numeración de las lecciones es dato (orden).
- Nada de feed infinito real: siempre hay un `EOF` diario.

## Responsive Behavior

### Breakpoints
| Nombre | Ancho | Qué cambia |
| --- | --- | --- |
| phone | 390 | composición principal: feed con snap vertical a pantalla completa |
| tablet | 768 | margen 24 px, misma columna |
| desktop | 1440 | columna centrada de 720 px, atajos `j`/`k` y `1`–`4` visibles |

### Touch Targets
Mínimo 44 × 44 px. Las opciones de quiz ocupan todo el ancho.

### Collapsing Strategy
Móvil primero. En escritorio no se añaden columnas; solo crece el margen y aparecen los atajos.

## Iteration Guide
- Nueva clase de tarjeta: reutiliza el prompt + `headline` + `body` y elige un verbo de shell nuevo
  para el prompt.
- Cambiar el acento: solo `primary`, `primary-hover` y sus equivalentes claros.
- Todo color del CSS sale de `src/styles/tokens.css`. Se comprueba con `design.mjs drift`.

## Known Gaps
- `design.mjs drift` marca los 11 hex del modo claro en `src/styles/app.css`: son los tokens de la
  tabla de Dark mode de arriba, que el script no lee porque no están en el frontmatter. Contraste
  comprobado a mano: todos ≥ 5,5:1 sobre `canvas`.
- No hay notificaciones push (requerirían servidor). El recordatorio diario queda pendiente.
