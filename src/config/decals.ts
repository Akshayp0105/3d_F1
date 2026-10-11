// Decal placement map. Positions/normals are car-space surface hits from scripts/car/probe.mjs.
// `up` is the image's up direction hint; scale = [width, height, projection depth].
// Add official sponsor files to public/brand/ and list them here (see public/brand/README.md).
import type { Vec3 } from './parts'

export interface DecalDef {
  id: string
  part: string
  /** which material primitive of the part to project onto */
  surface?: 'paint' | 'carbon'
  src: string
  position: Vec3
  normal: Vec3
  up: Vec3
  scale: Vec3
}

const RB = '/brand/redbull-logo.svg'
const ORACLE = '/brand/oracle-mark.svg'

const mirror = (d: DecalDef, part = d.part): DecalDef => ({
  ...d,
  id: d.id.replace(/_R$/, '_L'),
  part,
  position: [d.position[0], d.position[1], -d.position[2]],
  normal: [d.normal[0], d.normal[1], -d.normal[2]],
})

const coverR: DecalDef = { id: 'rb-cover_R', part: 'EngineCover', src: RB, position: [-0.95, 0.78, 0.17], normal: [0, 0.35, 1], up: [0, 1, 0], scale: [0.78, 0.78, 0.22] }
const podR: DecalDef = { id: 'oracle-pod_R', part: 'Sidepod_R', src: ORACLE, position: [-0.25, 0.5, 0.55], normal: [-0.2, 0.7, 0.68], up: [0, 1, 0], scale: [0.36, 0.36, 0.16] }
const rwEndR: DecalDef = { id: 'rb-rwend_R', part: 'RearWing', surface: 'carbon', src: RB, position: [-2.42, 0.78, 0.522], normal: [0, 0, 1], up: [0, 1, 0], scale: [0.4, 0.4, 0.025] }
const fwEndR: DecalDef = { id: 'rb-fwend_R', part: 'FrontWing', surface: 'carbon', src: RB, position: [2.62, 0.2, 0.928], normal: [0, 0, 1], up: [0, 1, 0], scale: [0.24, 0.24, 0.05] }

export const DECALS: DecalDef[] = [
  coverR, mirror(coverR),
  podR, mirror(podR, 'Sidepod_L'),
  rwEndR, mirror(rwEndR),
  fwEndR, mirror(fwEndR),
  // nose top, reads from the car's right side
  { id: 'rb-nose', part: 'Chassis', src: RB, position: [1.55, 0.7, 0], normal: [0, 1, 0], up: [0, 0, -1], scale: [0.42, 0.42, 0.2] },
  // rear wing main plane top, reads from behind (chase cam)
  { id: 'oracle-rw', part: 'RearWing', surface: 'carbon', src: ORACLE, position: [-2.08, 0.866, 0.25], normal: [0.21, 0.98, 0], up: [1, 0, 0], scale: [0.26, 0.26, 0.08] },
  { id: 'oracle-rw2', part: 'RearWing', surface: 'carbon', src: ORACLE, position: [-2.08, 0.866, -0.25], normal: [0.21, 0.98, 0], up: [1, 0, 0], scale: [0.26, 0.26, 0.08] },
]
