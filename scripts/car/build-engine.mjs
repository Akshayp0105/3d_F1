// Build the in-car power unit from the supplied engine model (assets-src/f1_engine_exposed_reconstruction.glb).
//   node scripts/car/build-engine.mjs
// - drops the display stand, the ivory front housing, its gearbox (the car STL has one) and its tailpipe
//   (PowerUnit.tsx routes a tailpipe to the STL's real exhaust exit)
// - bakes the fit into the geometry: engine faces −X → rotate 180° about Y, scale to the engine bay, place in car space
// - groups parts into explode stages (node names = carRefs keys) and joins meshes per material to cut draw calls
import path from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { join, prune, dedup, reorder, transformMesh } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { Matrix4, Vector3 } from 'three'
import { smoothNormals } from './segment.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const inFile = path.join(root, 'assets-src/f1_engine_exposed_reconstruction.glb')
const outFile = path.join(root, 'public/models/engine.glb')

// fit: timing cover front face (x −0.667) lands just behind the fuel cell (car x −0.43); oil pan on the floor (y 0.16)
export const ENGINE_FIT = { scale: 0.56, x: -0.8, y: 0.083 }

// solid cylinder barrels are replaced at runtime by open bores with moving pistons (PowerUnit.tsx)
const BARREL = /^(left|right) bank cylinder barrel (\d)/
const DROP = /^(Carbon-fibre lower chassis pan|Lower chassis side rail|Side crash|Lower side aerodynamic blade|Rear carbon diffuser fin|Ivory composite side plenum|Plenum upper bridge|Plenum lower mounting flange|Ivory plenum filler neck|Filler neck|Rear gearbox casing|Gearbox side inspection cover|Main titanium exhaust tailpipe|Exhaust tailpipe heat-stain|Exhaust tip|Exhaust end lip)/
const GROUPS = [
  ['PU_HeadL', /^left bank (cylinder head|cam|injector|long valve cover|silver valve-cover|valve cover bolt|intake runner)/],
  ['PU_HeadR', /^right bank (cylinder head|cam|injector|long valve cover|silver valve-cover|valve cover bolt|intake runner)/],
  ['PU_ExhaustL', /^left (bank exhaust primary|exhaust flange|exhaust union)/],
  ['PU_ExhaustR', /^right (bank exhaust primary|exhaust flange|exhaust union)/],
  ['PU_Intake', /^(Sculpted carbon intake spine|Intake spine|Upper intake boost canister|Boost canister)/],
  ['PU_MGUK', /^MGU-K/],
  ['PU_Turbo', /^(Turbo turbine|Turbo centre shaft|Turbo outlet|Exhaust thermal shield)/],
  ['PU_Ancillaries', /(coolant return|braided hose|red hose|harness|actuator line|oil feed line|Sensor loom|retaining clamp|eservoir|ontrol electronics|Telemetry display|status LED|connector socket|hex coupler)/],
]

await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(inFile)
const scene = doc.getRoot().listScenes()[0]

const { scale: s, x: tx, y: ty } = ENGINE_FIT
const fit = new Matrix4().makeTranslation(tx, ty, 0).multiply(new Matrix4().makeRotationY(Math.PI)).multiply(new Matrix4().makeScale(s, s, s))

const engine = doc.createNode('Engine')
const groups = Object.fromEntries([...GROUPS.map(g => g[0]), 'PU_Block'].map(name => [name, doc.createNode(name)]))
Object.values(groups).forEach(g => engine.addChild(g))

/** The source model has no normals (NaN lighting → black frame through bloom). Compute crease-angle normals per
 *  primitive (smooth cylinders, crisp box edges) and re-index. */
function addNormals(mesh) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), idx = prim.getIndices()
    const count = idx ? idx.getCount() : pos.getCount()
    const n = count / 3, P = new Float32Array(count * 3), v = []
    for (let i = 0; i < count; i++) { pos.getElement(idx ? idx.getScalar(i) : i, v); P.set(v, i * 3) }
    const N = smoothNormals(P, n, 35)
    const map = new Map(), outP = [], outN = [], outI = []
    for (let i = 0; i < count; i++) {
      const key = `${Math.round(P[i * 3] * 1e5)},${Math.round(P[i * 3 + 1] * 1e5)},${Math.round(P[i * 3 + 2] * 1e5)},${Math.round(N[i * 3] * 100)},${Math.round(N[i * 3 + 1] * 100)},${Math.round(N[i * 3 + 2] * 100)}`
      let id = map.get(key)
      if (id === undefined) { id = outP.length / 3; map.set(key, id); outP.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); outN.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) }
      outI.push(id)
    }
    const buffer = doc.getRoot().listBuffers()[0]
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(outP)).setBuffer(buffer))
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(outN)).setBuffer(buffer))
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(outI)).setBuffer(buffer))
  }
}

/** Bore axis of a barrel mesh (engine space): principal axis of its vertices, the end toward the head = top. */
function boreOf(mesh, worldMatrix) {
  const pts = [], v = []
  const m = new Matrix4().fromArray(worldMatrix)
  for (const p of mesh.listPrimitives()) {
    const a = p.getAttribute('POSITION')
    for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); const q = new Vector3(...v).applyMatrix4(m); pts.push(q) }
  }
  const c = pts.reduce((s, q) => s.add(q), new Vector3()).multiplyScalar(1 / pts.length)
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (const q of pts) { const d = [q.x - c.x, q.y - c.y, q.z - c.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j] }
  let ax = new Vector3(0, 1, 0.3).normalize()
  for (let it = 0; it < 64; it++) ax = new Vector3(C[0][0] * ax.x + C[0][1] * ax.y + C[0][2] * ax.z, C[1][0] * ax.x + C[1][1] * ax.y + C[1][2] * ax.z, C[2][0] * ax.x + C[2][1] * ax.y + C[2][2] * ax.z).normalize()
  if (ax.y < 0) ax.negate() // top = upward end (heads sit above)
  let lo = Infinity, hi = -Infinity, rad = 0
  for (const q of pts) { const d = q.clone().sub(c), t = d.dot(ax); lo = Math.min(lo, t); hi = Math.max(hi, t); rad = Math.max(rad, d.sub(ax.clone().multiplyScalar(t)).length()) }
  return { top: c.clone().add(ax.clone().multiplyScalar(hi)), axis: ax, length: hi - lo, radius: rad }
}
const bores = []

const meshNodes = []
scene.traverse(n => { if (n.getMesh()) meshNodes.push(n) })
const counts = {}
let dropped = 0
for (const n of meshNodes) {
  const name = n.getName()
  if (DROP.test(name)) { n.dispose(); dropped++; continue }
  if (BARREL.test(name)) {
    // record the bore in car space, then drop the solid barrel
    const b = boreOf(n.getMesh(), n.getWorldMatrix())
    const rot = new Matrix4().extractRotation(fit)
    const [, bank, idx] = name.match(BARREL)
    bores.push({ bank, idx: Number(idx), top: b.top.applyMatrix4(fit).toArray().map(x => +x.toFixed(4)), axis: b.axis.applyMatrix4(rot).normalize().toArray().map(x => +x.toFixed(4)), length: +(b.length * s).toFixed(4), radius: +(b.radius * s).toFixed(4) })
    n.dispose(); dropped++; continue
  }
  const world = n.getWorldMatrix()
  const m = fit.clone().multiply(new Matrix4().fromArray(world)).toArray()
  const mesh = n.getMesh().clone() // meshes may be shared; bake into a private copy
  transformMesh(mesh, m)
  addNormals(mesh)
  const g = (GROUPS.find(([, re]) => re.test(name)) ?? ['PU_Block'])[0]
  const child = doc.createNode(name).setMesh(mesh)
  groups[g].addChild(child)
  counts[g] = (counts[g] ?? 0) + 1
  n.dispose()
}
scene.listChildren().forEach(c => c.dispose())
scene.addChild(engine)
engine.setExtras({ bores })
console.log('bores', JSON.stringify(bores))

await doc.transform(prune(), dedup(), join({ keepNamed: false }), prune(), reorder({ encoder: MeshoptEncoder, target: 'size' }))
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
await io.write(outFile, doc)

console.log('dropped', dropped, 'nodes; kept per group:', counts)
let draws = 0
doc.getRoot().listMeshes().forEach(me => (draws += me.listPrimitives().length))
console.log('draw calls after join:', draws, '→', path.relative(root, outFile))
