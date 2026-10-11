// Print GLB node names, pivots, scales and per-primitive material/attribute types.
//   node scripts/car/inspect-glb.mjs public/models/rb16b.glb
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(process.argv[2])
for (const node of doc.getRoot().listNodes()) {
  const m = node.getMesh()
  console.log(node.getName(), 't', node.getTranslation().map(v=>+v.toFixed(3)), 's', node.getScale().map(v=>+v.toFixed(3)),
    m ? m.listPrimitives().map(p => `${p.getMaterial()?.getName()}:${p.getAttribute('POSITION').getComponentType()}/${p.getAttribute('NORMAL').getComponentType()}`).join(' ') : '')
}
console.log('ext', doc.getRoot().listExtensionsUsed().map(e=>e.extensionName))
