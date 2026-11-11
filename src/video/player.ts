/**
 * Un único <audio> para toda la app.
 *
 * Los navegadores móviles (Safari sobre todo) solo dejan sonar audio tras un toque, y lo conceden
 * al elemento que se tocó. Con un único elemento, el primer «reproducir» lo desbloquea y los
 * vídeos siguientes del feed pueden arrancar solos al deslizar. Además garantiza que nunca suenan
 * dos vídeos a la vez.
 */

let el: HTMLAudioElement | null = null
let owner: { id: string; release: () => void } | null = null
let unlocked = false

export function sharedAudio(): HTMLAudioElement {
  if (!el) {
    el = new Audio()
    el.preload = 'auto'
  }
  return el
}

/** Toma el audio para una tarjeta; la que lo tuviera antes recibe `release` (pasa a pausa). */
export function claim(id: string, release: () => void): HTMLAudioElement {
  if (owner && owner.id !== id) owner.release()
  owner = { id, release }
  return sharedAudio()
}

export function isOwner(id: string): boolean {
  return owner?.id === id
}

export function release(id: string) {
  if (owner?.id === id) {
    owner = null
    el?.pause()
  }
}

/** Ya hubo un toque que hizo sonar algo: se puede reproducir sin pedir otro. */
export function canAutoplay(): boolean {
  return unlocked
}

export function markUnlocked() {
  unlocked = true
}
