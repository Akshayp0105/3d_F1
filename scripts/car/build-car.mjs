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
    // axle centre: x/y from config, z = centre of the wheel's own extent
    let z0 = Infinity, z1 = -Infinity
    for (const { p } of parts.get(part).values()) for (let k = 2; k < p.length; k += 3) { z0 = Math.min(z0, p[k]); z1 = Math.max(z1, p[k]) }
    return [WHEELS[part].c[0], WHEELS[part].c[1], (z0 + z1) / 2]
  }
  if (part === 'RearWing_Flap') return FLAP_HINGE
  return [0, 0, 0]
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
  const pivot = pivotOf(part)
  const mesh = doc.createMesh(part)
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
