import { useEffect, useState } from 'react'

// Scene tokens per colour scheme (prototype CSS vars --scene/--floor/--disc/--shadow).
export const THEMES = {
  light: { scene: '#c9ced5', floor: '#c3c8cf', disc: '#d3d8de', shadow: 0.42, emblem: 0.55 },
  dark: { scene: '#0e1116', floor: '#0c0e12', disc: '#13161c', shadow: 0.75, emblem: 0.7 },
} as const
export type ThemeName = keyof typeof THEMES
export const NIGHT = { bg: '#07090c', floor: '#0a0c0f' }

const query = () => matchMedia('(prefers-color-scheme: dark)')

export function useThemeName(): ThemeName {
  const forced = document.documentElement.dataset.theme as ThemeName | undefined
  const [dark, setDark] = useState(() => query().matches)
  useEffect(() => {
    const mq = query()
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return forced ?? (dark ? 'dark' : 'light')
}
