// Explode choreography, ported from the prototype's part(off, d, rot) calls (reference/aurora-studio.html 403–415, 589–592),
// keyed by GLB node name (scripts/car/build-car.mjs). Offsets are car-space metres, rotations radians.
export type Vec3 = [number, number, number]

export interface PartDef {
  off: Vec3
  /** stagger delay on the 0..1 explode progress; each part moves over [d, d + 0.55] */
  d: number
  rot: Vec3
}

const Z: Vec3 = [0, 0, 0]

export const PARTS: Record<string, PartDef> = {
  Chassis: { off: Z, d: 0, rot: Z },
  FrontWing: { off: [0.85, -0.05, 0], d: 0.1, rot: [0, 0, 0.04] },
  Halo: { off: [0, 0.55, 0], d: 0.3, rot: [0, 0, -0.12] },
  Driver: { off: [0, 0.3, 0], d: 0.36, rot: Z },
  Sidepod_R: { off: [0, 0.06, 0.62], d: 0.18, rot: [0.06, 0, 0] },
  Sidepod_L: { off: [0, 0.06, -0.62], d: 0.18, rot: [-0.06, 0, 0] },
  EngineCover: { off: [0, 0.78, 0], d: 0.24, rot: [0, 0, 0.05] },
  PowerUnit: { off: [0, 0.2, 0], d: 0.42, rot: Z },
  Radiator_R: { off: [0, 0.14, 0.22], d: 0.34, rot: Z },
  Radiator_L: { off: [0, 0.14, -0.22], d: 0.34, rot: Z },
  Floor: { off: [0, -0.5, 0], d: 0.45, rot: Z },
  // prototype rearWingG + crashG: the STL's rear wing, beam wing and crash structure are one assembly
  RearWing: { off: [-0.75, 0.32, 0], d: 0.12, rot: [0, 0, -0.05] },
  Wheel_FL: { off: [0.25, 0, -0.6], d: 0, rot: Z },
  Wheel_FR: { off: [0.25, 0, 0.6], d: 0, rot: Z },
  Wheel_RL: { off: [-0.25, 0, -0.6], d: 0, rot: Z },
  Wheel_RR: { off: [-0.25, 0, 0.6], d: 0, rot: Z },
}

export const WHEEL_NODES = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'] as const

/** Exploded-view labels (prototype 641–649). Anchor is car-space, inside the part, so it travels with it. */
export const LABELS: { part: string; anchor: Vec3; title: string; sub: string }[] = [
  { part: 'FrontWing', anchor: [2.6, 0.26, 0.9], title: 'Front wing', sub: 'Multi-element, adjustable flap' },
  { part: 'Halo', anchor: [0.6, 0.95, 0], title: 'Halo', sub: 'Titanium cockpit protection' },
  { part: 'EngineCover', anchor: [-0.75, 1.08, 0], title: 'Engine cover', sub: 'Airbox, shark fin and T-cam' },
  { part: 'PowerUnit', anchor: [-1.0, 0.6, 0.2], title: 'Power unit', sub: '1.6 L V6 turbo hybrid' },
  { part: 'Sidepod_R', anchor: [-0.3, 0.5, 0.6], title: 'Sidepod', sub: 'Radiator inlets and cooling' },
  { part: 'Floor', anchor: [-0.4, 0.15, 0.8], title: 'Floor', sub: 'Ground-effect venturi tunnels' },
  { part: 'RearWing', anchor: [-2.3, 1.05, 0.5], title: 'Rear wing', sub: 'DRS upper flap' },
]

/** DRS flap angles relative to its modelled (closed) pose. Prototype: -0.55 closed → -0.12 open. */
export const DRS = { closed: 0, open: 0.43 }
