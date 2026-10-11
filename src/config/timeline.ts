// Cinematic launch timeline, seconds. Prototype line 804–805. Phase "returning" starts at decel.
export const T = { top: 1.8, ign: 2.0, launch: 3.6, chase: 4.8, side: 7.2, front: 9.4, decel: 11.2, home: 13.6, end: 14.8 } as const
export type ShotLabel = keyof typeof T

/** top speed in m/s used for distance + wheel spin (prototype VMAX) */
export const VMAX = 82
/** HUD km/h at s = 1 */
export const KMH_MAX = 334
/** seconds from launch to full speed */
export const ACCEL_TIME = 3.4
