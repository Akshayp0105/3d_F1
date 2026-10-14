// Prepares the supplied Pirelli wheel (assets-src/pirelli_f1_slick_tire_hub_cover.glb) for the car:
//   public/models/tyre.glb, one node "Tyre" with one primitive per material, in the source's own units
//   (axle on local Z, centred on the origin; extras { radius, halfWidth } let the runtime fit it to each STL tyre).
// - Drops: the brake calipers (they'd spin with the wheel; Caliper stays on the upright), the inboard hub cover /
//   hub / spokes / bolts (the inboard face is open on a real wheel: you see the brake), and the outboard brake disc.
//   +Z is the outboard face; left wheels are mirrored at runtime.
// - Normals: the source has none, so crease-angle normals are computed (UVs kept for the tyre and carbon textures).
// - Materials: the moulded sidewall rings get rubber instead of "forged alloy"; the brake disc is renamed "disc" so the
//   runtime can give it the car's glowing brake material.
// - Simplified (the tyre alone is ~200k triangles), textures → WebP, meshopt-compressed.
//   node scripts/car/build-tyre.mjs
import path from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { PropertyType } from '@gltf-transform/core'
import { join, prune, dedup, reorder, flatten, transformMesh, textureCompress, simplify, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { smoothNormals } from './segment.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const inFile = path.join(root, 'assets-src/pirelli_f1_slick_tire_hub_cover.glb')
const outFile = path.join(root, 'public/models/tyre.glb')

const DROP = /^(Brake_caliper_|Ventilated_brake_disc_1$|Rotor_vent_1_|Carbon_forged_spoke_-1_|Center_hub_-1|Hub_outer_ring_-1|Center_lock_cap_-1|Wheel_bolt_seat_-1_|Titanium_wheel_bolt_-1_|Carbon_aero_hub_cover_-1|Carbon_cover_edge_-1|Fluorescent_yellow_center_ring_-1|Inner_center_recess_-1|Hub_indicator_button_-1)/

await MeshoptEncoder.ready
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(inFile)
const R = doc.getRoot()
const scene = R.listScenes()[0]
const buffer = R.listBuffers()[0]

const matByName = Object.fromEntries(R.listMaterials().map(m => [m.getName(), m]))
const ridge = matByName['Sidewall_mould_grey_1_1'].setName('sidewall_ridge')
const disc = matByName['Dark brake steel'].clone().setName('disc')

/** crease-angle normals, keeping TEXCOORD_0 when present; re-indexed */
function addNormals(prim) {
  const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices()
  const count = idx ? idx.getCount() : pos.getCount()
  const P = new Float32Array(count * 3), U = uv ? new Float32Array(count * 2) : null, v = [], t = [0, 0]
  for (let i = 0; i < count; i++) {
    const k = idx ? idx.getScalar(i) : i
    pos.getElement(k, v); P.set(v, i * 3)
    if (U) { uv.getElement(k, t); U.set(t, i * 2) }
  }
  const N = smoothNormals(P, count / 3, 50)
  const map = new Map(), oP = [], oN = [], oU = [], oI = []
  for (let i = 0; i < count; i++) {
    const r = (a, j, s) => Math.round(a[j] * s)
    const key = `${r(P, i * 3, 1e5)},${r(P, i * 3 + 1, 1e5)},${r(P, i * 3 + 2, 1e5)},${r(N, i * 3, 100)},${r(N, i * 3 + 1, 100)},${r(N, i * 3 + 2, 100)}${U ? `,${r(U, i * 2, 1e5)},${r(U, i * 2 + 1, 1e5)}` : ''}`
    let id = map.get(key)
    if (id === undefined) {
      id = oP.length / 3; map.set(key, id)
      oP.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); oN.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2])
      if (U) oU.push(U[i * 2], U[i * 2 + 1])
    }
    oI.push(id)
  }
  prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(oP)).setBuffer(buffer))
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(oN)).setBuffer(buffer))
  if (U) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(oU)).setBuffer(buffer))
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(oI)).setBuffer(buffer))
}

await doc.transform(flatten())
const tyre = doc.createNode('Tyre')
let dropped = 0, kept = 0
for (const n of R.listNodes()) {
  const name = n.getName(), mesh = n.getMesh()
  if (!mesh || n === tyre) continue
  if (DROP.test(name)) { n.dispose(); dropped++; continue }
  const copy = mesh.clone()
  transformMesh(copy, n.getWorldMatrix())
  for (const p of copy.listPrimitives()) {
    const mn = p.getMaterial()?.getName() ?? ''
    if (/^Sidewall_moulded_ridge_/.test(name) || /^Sidewall_mould_grey/.test(mn)) p.setMaterial(ridge)
    if (/^Ventilated_brake_disc_/.test(name)) p.setMaterial(disc)
    addNormals(p)
  }
  tyre.addChild(doc.createNode(name).setMesh(copy))
  n.dispose(); kept++
}
scene.listChildren().forEach(c => c !== tyre && c.dispose())
scene.addChild(tyre)
tyre.setExtras({ radius: 0.72, halfWidth: 0.203 })

await doc.transform(
  // materials are not deduplicated: 'disc' is a copy of the steel on purpose
  prune(), dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }), join({ keepNamed: false }), prune(),
  // the source tyre is ~200k triangles (×4 wheels); 0.3 mm of error at real scale is invisible
  weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.2, error: 0.0008, lockBorder: true }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 88 }),
  reorder({ encoder: MeshoptEncoder, target: 'size' }),
)
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
await io.write(outFile, doc)

let draws = 0
R.listMeshes().forEach(me => (draws += me.listPrimitives().length))
console.log(`dropped ${dropped}, kept ${kept} nodes; ${draws} primitives →`, path.relative(root, outFile))
