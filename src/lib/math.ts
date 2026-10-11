// Prototype utilities (reference/aurora-studio.html 178–183, 807–808).
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** smoothstep(a, b, x) */
export const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
/** gaussian bump centred at c */
export const bump = (t: number, c: number, w = 0.12) => Math.exp(-Math.pow((t - c) / w, 2))
/** cubic ease-in-out (= GSAP power2.inOut) */
export const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
/** frame-rate independent damping factor */
export const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt)
