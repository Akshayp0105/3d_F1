// Inspect any GLB: node tree with world-space bounding boxes, materials, triangle counts, textures.
//   node scripts/car/inspect-any.mjs file.glb
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { getBounds } from '@gltf-transform/core'
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(process.argv[2])
const root = doc.getRoot()
console.log('scenes', root.listScenes().length, 'nodes', root.listNodes().length, 'meshes', root.listMeshes().length, 'materials', root.listMaterials().length, 'textures', root.listTextures().length, 'anims', root.listAnimations().length)
console.log('extensions', root.listExtensionsUsed().map(e => e.extensionName).join(', '))
let tris = 0
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3 }
console.log('triangles', tris)
const scene = root.listScenes()[0]
const b = getBounds(scene)
console.log('scene bounds min', b.min.map(v => +v.toFixed(3)), 'max', b.max.map(v => +v.toFixed(3)))
const walk = (n, d) => {
  const m = n.getMesh()
  const nb = getBounds(n)
  const sz = nb.max.map((v, k) => +(v - nb.min[k]).toFixed(3))
  if (d < 4) console.log('  '.repeat(d) + (n.getName() || '(unnamed)'), m ? `[mesh ${m.listPrimitives().map(p => p.getMaterial()?.getName()).join(',')}]` : '', 'size', sz.join('x'), 'ctr', nb.min.map((v, k) => +((v + nb.max[k]) / 2).toFixed(3)).join(','))
  n.listChildren().forEach(c => walk(c, d + 1))
}
scene.listChildren().forEach(n => walk(n, 0))
console.log('materials:', root.listMaterials().map(m => `${m.getName()}(${m.getBaseColorFactor().map(v => v.toFixed(2)).join(' ')} met${m.getMetallicFactor()} rgh${m.getRoughnessFactor()}${m.getBaseColorTexture() ? ' tex' : ''})`).join('\n  '))
