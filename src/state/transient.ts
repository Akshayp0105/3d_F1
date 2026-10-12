// Per-frame values shared between scene components. Mutated in useFrame / GSAP, never React state.
export const transient = {
  /** shader warm-up (scene/Warmup.tsx): when > 0 forces studio→track mix = warm (and speed 1) for hidden frames */
  warm: 0,
  /** warm-up finished; the loader waits for this */
  ready: false,
  /** 0..1 explode progress (prototype exT), tweened by GSAP at 1/1.9 per second */
  explode: 0,
  /** cinematic clock (s); only meaningful while phase is cinematic/returning */
  cineT: 0,
  /** speed 0..1 */
  s: 0,
  /** car x nudge during the run */
  cx: 0,
  /** studio → track mix 0..1 */
  m: 0,
  /** engine on 0/1 */
  eng: 0,
  /** normalised rpm 0..1 */
  rpm: 0,
  /** distance travelled (m), drives track scrolling */
  dist: 0,
  /** car body roll (rad) on launch squat / brake dive */
  roll: 0,
  /** brake disc glow intensity during the run */
  brake: 0,
  /** eased wheel speed when "Spin wheels" is on (rad/s) */
  spinSpeed: 0,
  /** DRS flap angle (rad, relative to closed) */
  flap: 0,
  /** HUD numbers */
  kmh: 0,
  gear: 'N',

  // --- Phase 4B: blast + jump (written by CinematicDirector, read by Car / Blast / Landing / Effects / Overlay) ---
  /** time scale for particles, track scroll and wheels (1 = normal, SLOWMO during the jump) */
  ts: 1,
  /** car height above its rest pose (m) and pitch (rad, + = nose up) */
  carY: 0,
  pitch: 0,
  /** blast simulation clock (scaled seconds since detonation; < 0 = no blast) and its world x on the track */
  blastAge: -1,
  blastX: 0,
  /** blast centre in screen UV (for the heat-haze pass) */
  blastU: 0.5,
  blastV: 0.5,
  /** landing clock (real seconds since touchdown; < 0 = not landed) */
  landAge: -1,
  /** post fx channels 0..1 */
  flash: 0,
  ca: 0,
  haze: 0,
  dof: 0,
  grain: 0,
  vig: 0,
  /** GPU quality 0.5..1 (drei PerformanceMonitor): scales raymarch steps and particle counts */
  quality: 1,
}
export type Transient = typeof transient
