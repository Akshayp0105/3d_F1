// Camera shot paths. All write into `out` to avoid allocation. Top/chase/side are the prototype's (lines 810–812);
// overhead and hero are Phase 4B.
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

/** Overhead tracking: high and in front of the car, looking down at its top with the track running away behind it. */
export const shotOver = (t: number, cx: number, out: Vector3) => out.set(cx + 4.6 - (t - T.over) * 0.35, 6.4 + (t - T.over) * 0.25, 0.9)
export const lookOver = (cx: number, out: Vector3) => out.set(cx - 3.2, 0.2, 0)

/** Hero: low in front of the car, looking up at it, fire behind. Slow push-in. */
export const shotHero = (t: number, cx: number, out: Vector3) => out.set(cx + 7.4 - (t - T.hero) * 0.32, 0.24, 2.3 - (t - T.hero) * 0.18)
