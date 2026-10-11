// Camera presets: [label, theta (azimuth), phi (elevation), radius]. Prototype line 702.
export type View = readonly [label: string, theta: number, phi: number, r: number]

export const VIEWS: readonly View[] = [
  ['Three-quarter', 0.78, 0.2, 7.4],
  ['Front', 0, 0.1, 6.6],
  ['Side', Math.PI / 2, 0.04, 7.8],
  ['Rear', Math.PI, 0.15, 6.8],
  ['Top', Math.PI / 2, 1.42, 8.6],
  ['Low', -0.55, 0.03, 5.6],
]

export const ORBIT_TARGET = [0, 0.38, 0] as const
export const ORBIT = {
  phiMin: 0.02,
  phiMax: 1.48,
  rMin: 3.2,
  rMax: 15,
  damping: 5,
  autoSpeed: 0.2,
  autoDelayMs: 2500,
  /** pan limits around the target (improvement over the prototype, which had no pan) */
  panMax: 2.2,
  /** exploded view pulls the camera back and up to an assembly-diagram angle (min phi / min r × fit) */
  explodedPhi: 0.52,
  explodedR: 9.6,
}
