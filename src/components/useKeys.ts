import { useEffect, useRef } from 'react'

/** Atajos de teclado para la tarjeta activa del feed. Ignora campos de texto y modificadores. */
export function useKeys(active: boolean, handler: (key: string, e: KeyboardEvent) => void) {
  const h = useRef(handler)
  h.current = handler
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) return
      h.current(e.key, e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}
