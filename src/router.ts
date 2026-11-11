import { useSyncExternalStore } from 'react'

export type View =
  | { name: 'feed' }
  | { name: 'rutas' }
  | { name: 'ruta'; routeId: string }
  | { name: 'leccion'; routeId: string; lessonSlug: string }
  | { name: 'stats' }

export function parseHash(hash: string): View {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 'rutas' && parts[1] && parts[2]) return { name: 'leccion', routeId: parts[1], lessonSlug: parts[2] }
  if (parts[0] === 'rutas' && parts[1]) return { name: 'ruta', routeId: parts[1] }
  if (parts[0] === 'rutas') return { name: 'rutas' }
  if (parts[0] === 'stats') return { name: 'stats' }
  return { name: 'feed' }
}

/** Ruta tipo shell que se pinta en el prompt de la barra de estado. */
export function viewPath(v: View): string {
  switch (v.name) {
    case 'feed':
      return '~/feed'
    case 'rutas':
      return '~/rutas'
    case 'ruta':
      return `~/rutas/${v.routeId}`
    case 'leccion':
      return `~/rutas/${v.routeId}/${v.lessonSlug}`
    case 'stats':
      return '~/stats'
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash)
}
