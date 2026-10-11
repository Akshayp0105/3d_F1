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
// wordmarks extracted from the supplied Oracle Red Bull model (scripts/car/extract-decals.mjs), 4:1 PNGs
const ORACLE_WORD = '/brand/oracle.png'
const MOBIL = '/brand/mobil-1.png'
const BYBIT = '/brand/bybit.png'
const FORD = '/brand/ford-racing.png'
const TAG = '/brand/tag-heuer.png'
export const PZERO = '/brand/p-zero.png'

const mirror = (d: DecalDef, part = d.part): DecalDef => ({
  ...d,
  id: d.id.replace(/_R$/, '_L'),
  part,
  position: [d.position[0], d.position[1], -d.position[2]],
  normal: [d.normal[0], d.normal[1], -d.normal[2]],
})

const coverR: DecalDef = { id: 'rb-cover_R', part: 'EngineCover', src: RB, position: [-0.95, 0.78, 0.17], normal: [0, 0.35, 1], up: [0, 1, 0], scale: [0.78, 0.78, 0.22] }
const podR: DecalDef = { id: 'oracle-pod_R', part: 'Sidepod_R', src: ORACLE_WORD, position: [-0.32, 0.42, 0.567], normal: [-0.27, 0.27, 0.92], up: [0, 1, 0], scale: [0.64, 0.16, 0.12] }
const tagR: DecalDef = { id: 'tag-nose_R', part: 'Chassis', src: TAG, position: [1.1, 0.53, 0.215], normal: [0.1, 0, 1], up: [0, 1, 0], scale: [0.34, 0.085, 0.06] }
const mobilR: DecalDef = { id: 'mobil-rear_R', part: 'Chassis', src: MOBIL, position: [-1.12, 0.58, 0.309], normal: [0, 0.03, 1], up: [0, 1, 0], scale: [0.34, 0.085, 0.06] }
const bybitR: DecalDef = { id: 'bybit-floor_R', part: 'Floor', surface: 'carbon', src: BYBIT, position: [-0.6, 0.17, 0.759], normal: [0, 0, 1], up: [0, 1, 0], scale: [0.36, 0.09, 0.04] }
const fordR: DecalDef = { id: 'ford-rw_R', part: 'RearWing', surface: 'carbon', src: FORD, position: [-2.42, 0.6, 0.425], normal: [0, 0, 1], up: [0, 1, 0], scale: [0.3, 0.075, 0.04] }
const rwEndR: DecalDef = { id: 'rb-rwend_R', part: 'RearWing', surface: 'carbon', src: RB, position: [-2.42, 0.78, 0.522], normal: [0, 0, 1], up: [0, 1, 0], scale: [0.4, 0.4, 0.025] }
const fwEndR: DecalDef = { id: 'rb-fwend_R', part: 'FrontWing', surface: 'carbon', src: RB, position: [2.62, 0.2, 0.928], normal: [0, 0, 1], up: [0, 1, 0], scale: [0.24, 0.24, 0.05] }

export const DECALS: DecalDef[] = [
  coverR, mirror(coverR),
  podR, mirror(podR, 'Sidepod_L'),
  rwEndR, mirror(rwEndR),
  fwEndR, mirror(fwEndR),
  tagR, mirror(tagR), mobilR, mirror(mobilR), bybitR, mirror(bybitR), fordR, mirror(fordR),
  // nose top, reads from the car's right side
  { id: 'rb-nose', part: 'Chassis', src: RB, position: [1.55, 0.7, 0], normal: [0, 1, 0], up: [0, 0, -1], scale: [0.42, 0.42, 0.2] },
  // rear wing main plane top, reads from behind (chase cam)
  { id: 'oracle-rw', part: 'RearWing', surface: 'carbon', src: ORACLE_WORD, position: [-2.08, 0.866, 0], normal: [0.21, 0.98, 0], up: [1, 0, 0], scale: [0.72, 0.18, 0.08] },
]
