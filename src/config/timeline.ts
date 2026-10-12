// Cinematic launch timeline, seconds (real time). Platform → track beats are the prototype's (line 804) up to the
// side shot; Phase 4B replaces the old front/decel/home ending with: overhead tracking shot → blast behind the car →
// slow-motion jump → crossfade to the studio in the air → landing on the platform → glide back to the orbit pose.
export const T = {
  top: 1.8, // fly-in to the top view done
  ign: 2.0, // engine fires
  launch: 3.6, // car launches
  chase: 4.8, // chase cam settled
  side: 7.2, // low side shot (hard cut)
  over: 8.8, // overhead tracking shot (hard cut): high, in front, looking down at the car's top
  blast: 10.0, // detonation on the track behind the car
  hero: 10.5, // low hero angle in front, looking up, fire behind the car
  apex: 11.9, // top of the jump (~2.5 m)
  studio: 11.6, // track → studio crossfade starts (ends at land − 0.5)
  land: 13.8, // touchdown on the platform
  home: 15.6, // camera back at the orbit pose
  end: 16.0,
} as const
export type ShotLabel = keyof typeof T

/** top speed in m/s used for distance + wheel spin (prototype VMAX) */
export const VMAX = 82
/** HUD km/h at s = 1 */
export const KMH_MAX = 334
/** seconds from launch to full speed */
export const ACCEL_TIME = 3.4
/** slow-motion time scale for particles, track and wheels during the jump */
export const SLOWMO = 0.25
/** jump apex height (m) */
export const JUMP_H = 2.5
