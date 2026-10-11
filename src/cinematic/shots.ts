// Camera shot paths (prototype 810–813). All write into `out` to avoid allocation.
import type { Vector3 } from 'three'
import { T } from '@/config/timeline'
import { ss } from '@/lib/math'

export const shotTop = (t: number, fit: number, out: Vector3) => {
  const k = ss(T.top, T.launch, t)
  return out.set(0, (9.6 - 0.9 * k) * fit, 0.9 * fit)
}
export const shotChase = (t: number, cx: number, out: Vector3) =>
  out.set(cx - 7.2 + 0.5 * Math.sin(t * 0.8), 1.45 + 0.12 * Math.sin(t * 1.3), 0.85 * Math.sin(t * 0.6))
export const shotSide = (t: number, cx: number, out: Vector3) => out.set(cx + 1.3 - (t - T.side) * 0.6, 0.3, 4.4)
export const shotFront = (t: number, cx: number, out: Vector3) => out.set(cx + 8.6 - (t - T.front) * 0.7, 0.42, 1.5)
