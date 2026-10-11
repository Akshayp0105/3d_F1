// Keyboard shortcuts (prototype 757–767): 1–6 views, E explode, R/T turntable, W wheels, D DRS,
// Space/L launch, Esc/Space skip during the launch sequence.
import { useEffect } from 'react'
import { VIEWS } from '@/config/views'
import { useStore } from '@/state/store'
import { isCine } from '@/state/machine'
import { cineControls } from '@/cinematic/CinematicDirector'
import { launch } from '@/state/actions'

export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input,textarea')) return
      const s = useStore.getState()
      if (isCine(s.phase)) {
        if (e.key === 'Escape' || e.key === ' ') {
          e.preventDefault()
          cineControls.skip()
        }
        return
      }
      const k = e.key.toLowerCase()
      if ((e.key === ' ' && !target?.closest?.('button')) || k === 'l') {
        e.preventDefault()
        launch()
        return
      }
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= VIEWS.length) s.setView(n - 1)
      if (k === 'e') s.dispatch('tapCar')
      if (k === 'r' || k === 't') s.setToggle('auto', !s.toggles.auto)
      if (k === 'w') s.setToggle('spin', !s.toggles.spin)
      if (k === 'd') s.setToggle('drs', !s.toggles.drs)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
}
