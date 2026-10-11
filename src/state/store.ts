import { create } from 'zustand'
import { transition, type Phase, type PhaseEvent } from './machine'

export type ToggleKey = 'auto' | 'spin' | 'drs' | 'sound'

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

interface AppState {
  phase: Phase
  livery: number
  toggles: Record<ToggleKey, boolean>
  /** index into VIEWS, or -1 after the user drags */
  activeView: number
  /** bumped on every setView so the camera rig re-targets even when the same view is chosen twice */
  viewNonce: number
  reduceMotion: boolean
  dispatch: (e: PhaseEvent) => void
  setLivery: (i: number) => void
  setToggle: (k: ToggleKey, v: boolean) => void
  setView: (i: number, keepAuto?: boolean) => void
  clearView: () => void
}

export const useStore = create<AppState>((set, get) => ({
  phase: 'idle',
  livery: 0,
  toggles: { auto: !reduceMotion, spin: false, drs: false, sound: true },
  activeView: 0,
  viewNonce: 0,
  reduceMotion,
  dispatch: e => {
    const prev = get().phase
    const next = transition(prev, e)
    if (next === prev) return
    // entering the launch sequence resets show toggles (prototype startCine)
    if (next === 'cinematic') set(s => ({ phase: next, activeView: -1, toggles: { ...s.toggles, spin: false, drs: false } }))
    else set({ phase: next })
  },
  setLivery: i => set({ livery: i }),
  setToggle: (k, v) => set(s => ({ toggles: { ...s.toggles, [k]: v } })),
  setView: (i, keepAuto) =>
    set(s => ({ activeView: i, viewNonce: s.viewNonce + 1, toggles: keepAuto ? s.toggles : { ...s.toggles, auto: false } })),
  clearView: () => get().activeView !== -1 && set({ activeView: -1 }),
}))

/** Explode toggle as the panel sees it: true while exploded. */
export const selectExploded = (s: AppState) => s.phase === 'exploded'
