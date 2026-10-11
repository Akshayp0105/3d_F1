import { useEffect, useState } from 'react'

// Scene tokens per colour scheme (prototype CSS vars --scene/--floor/--disc/--shadow).
export const THEMES = {
  light: { scene: '#c9ced5', floor: '#c3c8cf', disc: '#d3d8de', shadow: 0.42, emblem: 0.55 },
  dark: { scene: '#0e1116', floor: '#0c0e12', disc: '#13161c', shadow: 0.75, emblem: 0.7 },
} as const
export type ThemeName = keyof typeof THEMES
/** night-race horizon (fog + sky dome horizon match so distant geometry melts into the sky) */
export const NIGHT = { bg: '#141b2c', floor: '#0b0d11' }

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
