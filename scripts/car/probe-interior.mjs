// Interior probe: casts rays from points inside the shell to find inner walls (cockpit, fuel bay, engine bay, gearbox).
//   node scripts/car/probe-interior.mjs
import path from 'node:path'
import { loadSTL, partOf } from './segment.mjs'
const { P, n } = loadSTL(path.resolve(import.meta.dirname, '../../assets-src/RB16B_FIXED!.stl'))
function cast(o, d) {
  let best = Infinity, hit = null
  for (let t = 0; t < n; t++) {
    const i = t * 9
    const e1 = [P[i+3]-P[i], P[i+4]-P[i+1], P[i+5]-P[i+2]], e2 = [P[i+6]-P[i], P[i+7]-P[i+1], P[i+8]-P[i+2]]
    const h = [d[1]*e2[2]-d[2]*e2[1], d[2]*e2[0]-d[0]*e2[2], d[0]*e2[1]-d[1]*e2[0]]
    const a = e1[0]*h[0]+e1[1]*h[1]+e1[2]*h[2]; if (Math.abs(a) < 1e-12) continue
    const f = 1/a, s = [o[0]-P[i], o[1]-P[i+1], o[2]-P[i+2]]
    const u = f*(s[0]*h[0]+s[1]*h[1]+s[2]*h[2]); if (u < 0 || u > 1) continue
    const q = [s[1]*e1[2]-s[2]*e1[1], s[2]*e1[0]-s[0]*e1[2], s[0]*e1[1]-s[1]*e1[0]]
    const v = f*(d[0]*q[0]+d[1]*q[1]+d[2]*q[2]); if (v < 0 || u+v > 1) continue
    const tt = f*(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])
    if (tt > 1e-6 && tt < best) { best = tt; hit = o.map((c, k) => c + d[k]*tt) }
  }
  return hit
}
const dirs = { '-y': [0,-1,0], '+y': [0,1,0], '+z': [0,0,1], '-x': [-1,0,0], '+x': [1,0,0] }
const pts = {
  cockpit_mid: [0.45, 0.55, 0], cockpit_low: [0.45, 0.3, 0], cockpit_rear: [0.15, 0.45, 0], cockpit_front: [0.7, 0.5, 0],
  fuel: [-0.2, 0.4, 0], engine: [-0.85, 0.4, 0], engine_hi: [-0.85, 0.6, 0], gearbox: [-1.7, 0.33, 0], gearbox2: [-1.95, 0.33, 0],
  pod: [0.0, 0.33, 0.45],
}
for (const [name, o] of Object.entries(pts)) {
  const row = Object.entries(dirs).map(([k, d]) => { const h = cast(o, d); return `${k}:${h ? (k.includes('y') ? h[1] : k.includes('z') ? h[2] : h[0]).toFixed(3) + '(' + partOf(...h)[0] + partOf(...h).slice(-2) + ')' : '—'}` })
  console.log(name.padEnd(14), o.join(','), '|', row.join('  '))
}
