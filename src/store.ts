import { useSyncExternalStore } from 'react'
import { load, save, type Progress } from './progress'

let state: Progress = load()
const listeners = new Set<() => void>()

export function getProgress(): Progress {
  return state
}

export function setProgress(next: Progress | ((p: Progress) => Progress)): void {
  state = typeof next === 'function' ? next(state) : next
  save(state)
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress, getProgress)
}
