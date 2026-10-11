// Build the dismantle-ready car GLB from the licensed RB16B STL.
//   node scripts/car/build-car.mjs [in.stl] [out.glb]
// Output: one node per part (names match src/config/parts.ts), one primitive per surface material.
// Body parts keep car-space coordinates (node at origin) so the explode maths and the object-space
// livery shader work exactly like the prototype. Wheels and the DRS flap get pivots so they can rotate.
import path from 'node:path'
import { Document, NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions'
import { reorder, quantize } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { loadSTL, smoothNormals, clipToPlanes, partOf, materialOf, WHEELS, FLAP_HINGE } from './segment.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const inFile = process.argv[2] ?? path.join(root, 'assets-src/RB16B_FIXED!.stl')
const outFile = process.argv[3] ?? path.join(root, 'public/models/rb16b.glb')

console.time('build')
const raw = loadSTL(inFile)
const normals = smoothNormals(raw.P, raw.n, 40)
const { P, N, n } = clipToPlanes(raw.P, normals, raw.n)

// bucket triangles: part -> material -> { p: [], q: [] }
const parts = new Map()
for (let t = 0; t < n; t++) {
  const i = t * 9
  const cx = (P[i] + P[i + 3] + P[i + 6]) / 3, cy = (P[i + 1] + P[i + 4] + P[i + 7]) / 3, cz = (P[i + 2] + P[i + 5] + P[i + 8]) / 3
  const part = partOf(cx, cy, cz), mat = materialOf(part, cx, cy, cz)
  if (!parts.has(part)) parts.set(part, new Map())
  const mats = parts.get(part)
  if (!mats.has(mat)) mats.set(mat, { p: [], q: [] })
  const b = mats.get(mat)
  for (let k = 0; k < 9; k++) { b.p.push(P[i + k]); b.q.push(N[i + k]) }
}

// pivots
const pivotOf = part => {
  if (WHEELS[part]) {
    // Spin pivot = centre of the tyre's own bounding box (x, y) and of the whole wheel (z). Using a hand-measured
    // centre made the front wheels wobble ~13 mm off-axis ("loose wheel").
    let z0 = Infinity, z1 = -Infinity
    for (const { p } of parts.get(part).values()) for (let k = 2; k < p.length; k += 3) { z0 = Math.min(z0, p[k]); z1 = Math.max(z1, p[k]) }
    const tyre = parts.get(part).get('tyre').p
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (let k = 0; k < tyre.length; k += 3) { x0 = Math.min(x0, tyre[k]); x1 = Math.max(x1, tyre[k]); y0 = Math.min(y0, tyre[k + 1]); y1 = Math.max(y1, tyre[k + 1]) }
    const pivot = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]
    console.log(part, 'pivot', pivot.map(v => v.toFixed(4)).join(', '), `tyre Ø x ${(x1 - x0).toFixed(4)} y ${(y1 - y0).toFixed(4)}`)
    return pivot
  }
  if (part === 'RearWing_Flap') return FLAP_HINGE
  return [0, 0, 0]
}

// Front wheels = the rear wheels, re-sized. Cutting the front wheels out of the fused STL also cuts out
// non-round bits of the front upright/brake duct that sit inside the wheel; they spin with it and make the
// front wheels look loose and wiggly. The rear wheels cut cleanly, so each front wheel is replaced by the rear
// wheel of the same side, scaled to the front tyre's diameter and width and centred on the front axle.
const pivots = Object.fromEntries(Object.keys(WHEELS).map(w => [w, pivotOf(w)]))
const tyreSize = w => {
  const p = parts.get(w).get('tyre').p
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (let k = 0; k < p.length; k += 3) { x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); z0 = Math.min(z0, p[k + 2]); z1 = Math.max(z1, p[k + 2]) }
  return { dia: x1 - x0, width: z1 - z0, cz: (z0 + z1) / 2 }
}
for (const [front, rear] of [['Wheel_FL', 'Wheel_RL'], ['Wheel_FR', 'Wheel_RR']]) {
  const f = tyreSize(front), r = tyreSize(rear)
  const s = [f.dia / r.dia, f.dia / r.dia, f.width / r.width]
  // align on the tyres' own z-centres (the old front extent included the upright bits)
  const pr = [pivots[rear][0], pivots[rear][1], r.cz]
  const pf = (pivots[front] = [pivots[front][0], pivots[front][1], f.cz])
  const mats = new Map()
  for (const [mat, { p, q }] of parts.get(rear)) {
    const np = new Array(p.length), nq = new Array(q.length)
    for (let k = 0; k < p.length; k += 3) {
      for (let a = 0; a < 3; a++) np[k + a] = (p[k + a] - pr[a]) * s[a] + pf[a]
      // normals under non-uniform scale: divide by the scale, renormalise
      const nx = q[k] / s[0], ny = q[k + 1] / s[1], nz = q[k + 2] / s[2], l = Math.hypot(nx, ny, nz) || 1
      nq[k] = nx / l; nq[k + 1] = ny / l; nq[k + 2] = nz / l
    }
    mats.set(mat, { p: np, q: nq })
  }
  parts.set(front, mats)
  console.log(front, `← ${rear} scaled`, s.map(v => v.toFixed(3)).join(' × '), `(front tyre Ø ${f.dia.toFixed(3)} w ${f.width.toFixed(3)}, rear Ø ${r.dia.toFixed(3)} w ${r.width.toFixed(3)})`)
}

// weld a non-indexed buffer into indexed position/normal arrays
function weld(p, q, pivot) {
  const map = new Map(), pos = [], nor = [], idx = []
  for (let v = 0; v < p.length / 3; v++) {
    const x = p[v * 3] - pivot[0], y = p[v * 3 + 1] - pivot[1], z = p[v * 3 + 2] - pivot[2]
    const key = `${Math.round(x * 2e4)},${Math.round(y * 2e4)},${Math.round(z * 2e4)},${Math.round(q[v * 3] * 100)},${Math.round(q[v * 3 + 1] * 100)},${Math.round(q[v * 3 + 2] * 100)}`
    let id = map.get(key)
    if (id === undefined) { id = pos.length / 3; map.set(key, id); pos.push(x, y, z); nor.push(q[v * 3], q[v * 3 + 1], q[v * 3 + 2]) }
    idx.push(id)
  }
  // drop degenerate triangles produced by clipping through vertices
  const out = []
  for (let t = 0; t < idx.length; t += 3) if (idx[t] !== idx[t + 1] && idx[t + 1] !== idx[t + 2] && idx[t] !== idx[t + 2]) out.push(idx[t], idx[t + 1], idx[t + 2])
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint32Array(out) }
}

const doc = new Document()
const buffer = doc.createBuffer()
const scene = doc.createScene('RB16B')
const carNode = doc.createNode('Car')
scene.addChild(carNode)
const materials = new Map()
const material = name => {
  if (!materials.has(name)) materials.set(name, doc.createMaterial(name).setDoubleSided(true))
  return materials.get(name)
}

const stats = {}
for (const [part, mats] of parts) {
  const pivot = pivots[part] ?? pivotOf(part)
  const mesh = doc.createMesh(`${part}_mesh`) // distinct from the node name: GLTFLoader uniquifies clashes
  let tris = 0
  for (const [mat, { p, q }] of mats) {
    const g = weld(p, q, pivot)
    tris += g.idx.length / 3
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.nor).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(g.idx).setBuffer(buffer))
      .setMaterial(material(mat))
    mesh.addPrimitive(prim)
  }
  const node = doc.createNode(part).setMesh(mesh).setTranslation(pivot)
  carNode.addChild(node)
  stats[part] = tris
}

await MeshoptEncoder.ready
// Not using meshopt(): it force-quantizes POSITION, which adds node transforms and breaks the car-space
// livery shader and decal projection. Positions stay float; normals are quantized; meshopt still compresses.
await doc.transform(
  reorder({ encoder: MeshoptEncoder, target: 'size' }),
  quantize({ pattern: /^NORMAL$/, quantizeNormal: 10 }),
)
doc.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })

const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
await io.write(outFile, doc)
console.table(stats)
console.log('triangles', Object.values(stats).reduce((a, b) => a + b, 0), '→', path.relative(root, outFile))
console.timeEnd('build')
