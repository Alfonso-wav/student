import { marked } from 'marked'
import { useMemo } from 'react'

marked.setOptions({ gfm: true, breaks: false })

/** El contenido sale de `content/` en este mismo repo: es de confianza, no entrada de usuario. */
export function Markdown({ src, inline = false }: { src: string; inline?: boolean }) {
  const html = useMemo(
    () => (inline ? marked.parseInline(src, { async: false }) : marked.parse(src, { async: false })),
    [src, inline],
  )
  // En línea va dentro de <button>: solo contenido de frase, nada de <div> ni <p>.
  if (inline) return <span className="md-inline" dangerouslySetInnerHTML={{ __html: html }} />
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}
