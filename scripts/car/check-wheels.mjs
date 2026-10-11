// Verify every wheel spins true: max radius of the wheel's geometry around its pivot (node-local origin) per 15°
// sector, and the wobble = max − min across sectors. Run after build-car.
//   node scripts/car/check-wheels.mjs [public/models/rb16b.glb]
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(process.argv[2] ?? 'public/models/rb16b.glb')
for (const node of doc.getRoot().listNodes().filter(n => /^Wheel_..$/.test(n.getName()))) {
  const bins = new Array(24).fill(0), v = []
  for (const p of node.getMesh().listPrimitives()) {
    const a = p.getAttribute('POSITION')
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, v)
      const r = Math.hypot(v[0], v[1]), k = Math.floor(((Math.atan2(v[1], v[0]) + Math.PI) / (2 * Math.PI)) * 24) % 24
      bins[k] = Math.max(bins[k], r)
    }
  }
  const sorted = [...bins].sort((a, b) => a - b), median = sorted[12]
  console.log(node.getName(), `radius ${median.toFixed(4)}`, `wobble ${((Math.max(...bins) - Math.min(...bins)) * 1000).toFixed(1)} mm`, `(sectors ${Math.min(...bins).toFixed(3)}–${Math.max(...bins).toFixed(3)})`)
}
