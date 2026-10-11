// Shared STL → world-space loading, normals and part segmentation for the RB16B mesh.
// World convention (see CLAUDE.md): metres, +X forward, +Y up, +Z to the car's right.
import fs from 'node:fs'

// STL frame: nose at min Y, Z up, car's right = -X. Scale from the 3.6 m wheelbase (126.3 model units).
export const STL_TO_WORLD = { scale: 3.6 / 126.3, xc: 155.0, ym: 163.05 }

export const FLAP_HINGE = [-2.185, 0.9, 0]

export const WHEELS = {
  Wheel_FL: { c: [1.806, 0.349], r: 0.36, zMin: 0.585, side: -1 },
  Wheel_FR: { c: [1.806, 0.349], r: 0.36, zMin: 0.585, side: 1 },
  Wheel_RL: { c: [-1.799, 0.331], r: 0.345, zMin: 0.548, side: -1 },
  Wheel_RR: { c: [-1.799, 0.331], r: 0.345, zMin: 0.548, side: 1 },
}

export function loadSTL(file) {
  const buf = fs.readFileSync(file)
  const n = buf.readUInt32LE(80)
  const { scale: s, xc, ym } = STL_TO_WORLD
  const P = new Float32Array(n * 9)
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12
    for (let v = 0; v < 3; v++) {
      const x = buf.readFloatLE(o + v * 12), y = buf.readFloatLE(o + v * 12 + 4), z = buf.readFloatLE(o + v * 12 + 8)
      P[t * 9 + v * 3] = -(y - ym) * s
      P[t * 9 + v * 3 + 1] = z * s
      P[t * 9 + v * 3 + 2] = -(x - xc) * s
    }
  }
  return { P, n }
}

// Per-corner normals averaged over welded positions within a crease angle (same idea as the prototype's smoothNormals).
export function smoothNormals(P, n, creaseDeg = 40) {
  const fn = new Float32Array(n * 3)
  for (let t = 0; t < n; t++) {
    const i = t * 9
    const ux = P[i + 3] - P[i], uy = P[i + 4] - P[i + 1], uz = P[i + 5] - P[i + 2]
    const vx = P[i + 6] - P[i], vy = P[i + 7] - P[i + 1], vz = P[i + 8] - P[i + 2]
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx
    const l = Math.hypot(x, y, z) || 1
    fn[t * 3] = x / l; fn[t * 3 + 1] = y / l; fn[t * 3 + 2] = z / l
  }
  const map = new Map(), key = new Array(n * 3)
  for (let c = 0; c < n * 3; c++) {
    const k = Math.round(P[c * 3] * 1e5) + ',' + Math.round(P[c * 3 + 1] * 1e5) + ',' + Math.round(P[c * 3 + 2] * 1e5)
    key[c] = k
    let a = map.get(k); if (!a) map.set(k, (a = [])); a.push(c)
  }
  const cos = Math.cos((creaseDeg * Math.PI) / 180), N = new Float32Array(n * 9)
  for (let c = 0; c < n * 3; c++) {
    const ft = (c / 3) | 0, fx = fn[ft * 3], fy = fn[ft * 3 + 1], fz = fn[ft * 3 + 2]
    let ax = 0, ay = 0, az = 0
    for (const d of map.get(key[c])) {
      const g = (d / 3) | 0, gx = fn[g * 3], gy = fn[g * 3 + 1], gz = fn[g * 3 + 2]
      if (fx * gx + fy * gy + fz * gz >= cos) { ax += gx; ay += gy; az += gz }
    }
    const l = Math.hypot(ax, ay, az)
    if (l < 1e-9) { ax = fx; ay = fy; az = fz } else { ax /= l; ay /= l; az /= l }
    N[c * 3] = ax; N[c * 3 + 1] = ay; N[c * 3 + 2] = az
  }
  return N
}

const inWheel = (w, x, y, z) => Math.sign(z) === w.side && Math.abs(z) >= w.zMin && Math.hypot(x - w.c[0], y - w.c[1]) <= w.r
export const wheelOf = (x, y, z) => {
  for (const [name, w] of Object.entries(WHEELS)) if (inWheel(w, x, y, z)) return name
  return null
}

// Cut thresholds. Every value here is also an exact clipping plane (see CUT_PLANES), so part edges are clean.
const C = {
  fwX: 2.2, rwX: -2.02, rwY: 0.19,
  // DRS flap: upper rear-wing element, hinged at its leading edge
  flapX: -2.165, flapY: 0.895, flapZ: 0.49, drvC: [0.2, 0.8, 0], drvR: 0.15,
  haloX0: 0.22, haloX1: 1.08, haloY: 0.75, haloZ: 0.34,
  covX1: 0.22, covX0: -2.02, covY: 0.6, covZ: 0.42,
  // floor has rake: plane y = floorY0 - floorK * x
  floorY0: 0.17, floorK: 0.025, floorX1: 1.35,
  podZ: 0.27, podX1: 0.95, podX0: -1.6,
}
// Planes as [nx, ny, nz, c, region]: signed distance = n·p - c. A plane only splits triangles whose
// bounding box overlaps its region box [[x0,y0,z0],[x1,y1,z1]], so cuts stay local and the tri count stays low.
const INF = 9
const box = (x0 = -INF, x1 = INF, y0 = -INF, y1 = INF, z0 = -INF, z1 = INF) => [[x0, y0, z0], [x1, y1, z1]]
const X = (v, r = box()) => [1, 0, 0, v, r], Y = (v, r = box()) => [0, 1, 0, v, r], Z = (v, r = box()) => [0, 0, 1, v, r]
const flapR = box(-INF, -2.1, 0.85), haloR = box(0.17, 1.13, 0.7, INF, -0.4, 0.4), covR = box(-2.07, 0.27, 0.55)
const podR = box(-1.65, 1.0, -INF, 0.65)
export const CUT_PLANES = [
  X(C.fwX), X(C.rwX),
  X(C.flapX, flapR), Y(C.flapY, flapR), Z(C.flapZ, flapR), Z(-C.flapZ, flapR),
  X(C.haloX0, box(-INF, INF, 0.55)), X(C.haloX1, haloR), Y(C.haloY, haloR), Z(C.haloZ, haloR), Z(-C.haloZ, haloR),
  Y(C.covY, box(-2.07, 1.0)), Z(C.covZ, covR), Z(-C.covZ, covR),
  Y(C.rwY, box(-INF, -1.97)),
  [C.floorK, 1, 0, C.floorY0, box(-INF, 1.4)], X(C.floorX1, box(-INF, INF, -INF, 0.25)),
  X(C.podX1, box(-INF, INF, -INF, 0.65)), X(C.podX0, box(-INF, INF, -INF, 0.65)), Z(C.podZ, podR), Z(-C.podZ, podR),
]
const belowFloor = (x, y) => y + C.floorK * x < C.floorY0

// Part segmentation by triangle centroid (after clipping). Order matters: first match wins.
export function partOf(x, y, z) {
  const az = Math.abs(z)
  const wheel = wheelOf(x, y, z)
  if (wheel) return wheel
  if (x > C.fwX) return 'FrontWing'
  if (x < C.flapX && y > C.flapY && az < C.flapZ) return 'RearWing_Flap'
  if (x < C.rwX) return y > C.rwY ? 'RearWing' : 'CrashStructure'
  if (Math.hypot(x - C.drvC[0], y - C.drvC[1], z - C.drvC[2]) < C.drvR) return 'Driver'
  if (x > C.haloX0 && x < C.haloX1 && y > C.haloY && az < C.haloZ) return 'Halo'
  if (x < C.covX1 && y > C.covY && az < C.covZ) return 'EngineCover'
  if (belowFloor(x, y) && x < C.floorX1) return 'Floor'
  if (az > C.podZ && x < C.podX1 && x > C.podX0 && y < C.covY) return z > 0 ? 'Sidepod_R' : 'Sidepod_L'
  return 'Chassis'
}

// Split triangles that straddle the cut planes. Input/output: flat arrays of 9 position + 9 normal floats per tri.
export function clipToPlanes(P, N, n) {
  const outP = [], outN = []
  const lerp = (a, b, t) => a + (b - a) * t
  const vert = (p, q, i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2], q[i * 3], q[i * 3 + 1], q[i * 3 + 2]]
  const mix = (a, b, t) => { const r = a.map((v, k) => lerp(v, b[k], t)); const l = Math.hypot(r[3], r[4], r[5]) || 1; r[3] /= l; r[4] /= l; r[5] /= l; return r }
  for (let t = 0; t < n; t++) {
    const p = P.subarray(t * 9, t * 9 + 9), q = N.subarray(t * 9, t * 9 + 9)
    let tris = [[vert(p, q, 0), vert(p, q, 1), vert(p, q, 2)]]
    const cx = (p[0] + p[3] + p[6]) / 3, cy = (p[1] + p[4] + p[7]) / 3, cz = (p[2] + p[5] + p[8]) / 3
    if (!wheelOf(cx, cy, cz)) {
      const lo = [0, 1, 2].map(a => Math.min(p[a], p[a + 3], p[a + 6])), hi = [0, 1, 2].map(a => Math.max(p[a], p[a + 3], p[a + 6]))
      for (const [nx, ny, nz, off, [r0, r1]] of CUT_PLANES) {
        if (lo.some((v, a) => v > r1[a]) || hi.some((v, a) => v < r0[a])) continue
        const next = []
        for (const tri of tris) {
          const d = tri.map(v => v[0] * nx + v[1] * ny + v[2] * nz - off)
          const pos = d.filter(x => x > 1e-7).length, neg = d.filter(x => x < -1e-7).length
          if (!pos || !neg) { next.push(tri); continue }
          // rotate so vertex 0 is the lone one on its side
          let k = 0
          for (let i = 0; i < 3; i++) if ((d[i] > 0) !== (d[(i + 1) % 3] > 0) && (d[i] > 0) !== (d[(i + 2) % 3] > 0)) k = i
          const a = tri[k], b = tri[(k + 1) % 3], c = tri[(k + 2) % 3], da = d[k], db = d[(k + 1) % 3], dc = d[(k + 2) % 3]
          const ab = mix(a, b, da / (da - db)), ac = mix(a, c, da / (da - dc))
          next.push([a, ab, ac], [ab, b, c], [ab, c, ac])
        }
        tris = next
      }
    }
    for (const tri of tris) for (const v of tri) { outP.push(v[0], v[1], v[2]); outN.push(v[3], v[4], v[5]) }
  }
  return { P: Float32Array.from(outP), N: Float32Array.from(outN), n: outP.length / 9 }
}

// Surface material per triangle (the STL carries none).
export function materialOf(part, x, y, z) {
  const az = Math.abs(z)
  if (part.startsWith('Wheel_')) {
    const w = WHEELS[part]
    const r = Math.hypot(x - w.c[0], y - w.c[1])
    return r < 0.2 ? 'rim' : 'tyre'
  }
  if (part === 'Floor' || part === 'CrashStructure') return 'carbon'
  if (part === 'Driver') return 'helmet'
  if (part === 'FrontWing') return az < 0.13 && y > 0.1 ? 'paint' : 'carbon'
  if (part === 'RearWing' || part === 'RearWing_Flap') return 'carbon'
  if (part === 'Chassis') {
    // suspension arms + bargeboards are bare carbon
    if (x > 1.25 && x < 2.25 && az > 0.2) return 'carbon'
    if (x < -1.3 && az > 0.28 && y < 0.6) return 'carbon'
    if (y < 0.12 && az > 0.25) return 'carbon'
  }
  return 'paint'
}
