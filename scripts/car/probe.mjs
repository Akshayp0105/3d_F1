// Ray-cast probe against the car mesh (world coords) to find surface points + normals for decals/labels.
//   node scripts/car/probe.mjs
import path from 'node:path'
import { loadSTL, partOf } from './segment.mjs'

const { P, n } = loadSTL(path.resolve(import.meta.dirname, '../../assets-src/RB16B_FIXED!.stl'))

function cast(o, d) {
  let best = null
  for (let t = 0; t < n; t++) {
    const i = t * 9
    const e1 = [P[i + 3] - P[i], P[i + 4] - P[i + 1], P[i + 5] - P[i + 2]], e2 = [P[i + 6] - P[i], P[i + 7] - P[i + 1], P[i + 8] - P[i + 2]]
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]]
    const a = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2]
    if (Math.abs(a) < 1e-12) continue
    const f = 1 / a, s = [o[0] - P[i], o[1] - P[i + 1], o[2] - P[i + 2]]
    const u = f * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]); if (u < 0 || u > 1) continue
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]]
    const v = f * (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]); if (v < 0 || u + v > 1) continue
    const tt = f * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2])
    if (tt > 1e-6 && (!best || tt < best.t)) {
      let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l
      if (nx * d[0] + ny * d[1] + nz * d[2] > 0) { nx = -nx; ny = -ny; nz = -nz }
      best = { t: tt, p: o.map((c, k) => c + d[k] * tt), nrm: [nx, ny, nz] }
    }
  }
  return best
}

const PROBES = {
  coverRearSideR: [[-1.5, 0.56, 2], [0, 0, -1]],
  coverMidSideR: [[-1.15, 0.6, 2], [0, 0, -1]],
  noseSideR: [[1.25, 0.5, 2], [0, 0, -1]],
  noseSideR2: [[1.0, 0.55, 2], [0, 0, -1]],
  podSideLowR: [[0.0, 0.32, 2], [0, 0, -1]],
  podSideMidR: [[-0.35, 0.4, 2], [0, 0, -1]],
  rwEndLowR: [[-2.42, 0.6, 2], [0, 0, -1]],
  haloSideR: [[0.6, 0.85, 2], [0, 0, -1]],
  floorEdgeR2: [[-0.6, 0.17, 2], [0, 0, -1]],
  coverSideR: [[-0.95, 0.75, 2], [0, 0, -1]],
  coverSideR2: [[-1.25, 0.66, 2], [0, 0, -1]],
  coverTop: [[-0.6, 3, 0], [0, -1, 0]],
  coverSpine: [[-1.3, 3, 0], [0, -1, 0]],
  podSideR: [[0.25, 0.42, 2], [0, 0, -1]],
  podTopR: [[-0.2, 3, 0.55], [0, -1, 0]],
  noseTop: [[2.3, 3, 0], [0, -1, 0]],
  noseTop2: [[1.6, 3, 0], [0, -1, 0]],
  noseTip: [[4, 0.2, 0], [-1, 0, 0]],
  rwEndplateR: [[-2.4, 0.8, 2], [0, 0, -1]],
  rwMainTop: [[-2.08, 3, 0.25], [0, -1, 0]],
  rwFlapTop: [[-2.24, 3, 0.25], [0, -1, 0]],
  fwFlapTopR: [[2.5, 3, 0.6], [0, -1, 0]],
  fwEndplateR: [[2.6, 0.18, 2], [0, 0, -1]],
  haloTop: [[0.6, 3, 0], [0, -1, 0]],
  helmetTop: [[0.2, 3, 0], [0, -1, 0]],
  floorEdgeR: [[-0.4, 0.14, 2], [0, 0, -1]],
  floorTop: [[-0.6, 3, 0.85], [0, -1, 0]],
}
for (const [name, [o, d]] of Object.entries(PROBES)) {
  const h = cast(o, d)
  console.log(name.padEnd(13), h ? `p ${h.p.map(v => v.toFixed(3)).join(', ')}  n ${h.nrm.map(v => v.toFixed(2)).join(', ')}  ${partOf(...h.p)}` : 'miss')
}
// rear-most points (rain light / exhaust) by height
for (let y = 0.2; y <= 0.56; y += 0.03) {
  const h = cast([-4, y, 0], [1, 0, 0])
  console.log(`rear y=${y.toFixed(2)}`, h ? `x ${h.p[0].toFixed(3)} ${partOf(...h.p)}` : 'miss')
}
