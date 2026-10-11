// Fit each wheel's true axle centre (x, y) and z extent from the tyre tread, by least-squares circle fit.
//   node scripts/car/fit-wheels.mjs
import path from 'node:path'
import { loadSTL, WHEELS } from './segment.mjs'
const { P, n } = loadSTL(path.resolve(import.meta.dirname, '../../assets-src/RB16B_FIXED!.stl'))
for (const [name, w] of Object.entries(WHEELS)) {
  // gather unique vertices on the outboard part of the wheel region (tread + sidewall), away from suspension
  const pts = [], seen = new Set()
  let z0 = 9, z1 = -9
  for (let i = 0; i < n * 3; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]
    if (Math.sign(z) !== w.side || Math.abs(z) < w.zMin) continue
    const r = Math.hypot(x - w.c[0], y - w.c[1])
    if (r > 0.42) continue
    z0 = Math.min(z0, Math.abs(z)); z1 = Math.max(z1, Math.abs(z))
    if (r < 0.28) continue
    const k = `${x.toFixed(4)},${y.toFixed(4)}`
    if (!seen.has(k)) { seen.add(k); pts.push([x, y]) }
  }
  // Kasa circle fit
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0
  for (const [x, y] of pts) { const zz = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * zz; syz += y * zz; sz += zz }
  const N = pts.length
  // solve [sxx sxy sx; sxy syy sy; sx sy N] [a b c] = [sxz syz sz]
  const A = [[sxx, sxy, sx, sxz], [sxy, syy, sy, syz], [sx, sy, N, sz]]
  for (let i = 0; i < 3; i++) { for (let j = i + 1; j < 3; j++) { const f = A[j][i] / A[i][i]; for (let k = i; k < 4; k++) A[j][k] -= f * A[i][k] } }
  const sol = [0, 0, 0]; for (let i = 2; i >= 0; i--) { let s = A[i][3]; for (let k = i + 1; k < 3; k++) s -= A[i][k] * sol[k]; sol[i] = s / A[i][i] }
  const cx = sol[0] / 2, cy = sol[1] / 2, R = Math.sqrt(sol[2] + cx * cx + cy * cy)
  let maxErr = 0; for (const [x, y] of pts) maxErr = Math.max(maxErr, Math.abs(Math.hypot(x - cx, y - cy) - R))
  // bbox of tread points for comparison
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  console.log(name, `fit c=(${cx.toFixed(4)}, ${cy.toFixed(4)}) R=${R.toFixed(4)} maxErr=${maxErr.toFixed(4)} n=${N} | bbox c=(${((Math.min(...xs) + Math.max(...xs)) / 2).toFixed(4)}, ${((Math.min(...ys) + Math.max(...ys)) / 2).toFixed(4)}) | |z| ${z0.toFixed(3)}..${z1.toFixed(3)} | configured c=(${w.c.join(', ')})`)
}
