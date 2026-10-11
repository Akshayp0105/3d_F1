// Extract the sponsor decal textures from the supplied Oracle Red Bull model into public/brand/.
//   node scripts/car/extract-decals.mjs
import fs from 'node:fs'
import path from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const root = path.resolve(import.meta.dirname, '../..')
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path.join(root, 'assets-src/oracle_red_bull_f1_car.glb'))
for (const mat of doc.getRoot().listMaterials()) {
  const tex = mat.getBaseColorTexture()
  if (!tex) continue
  const ext = tex.getMimeType() === 'image/jpeg' ? 'jpg' : 'png'
  const slug = mat.getName().replace(/\(.*\)/, '').replace(/sponsor decal|decal|tire/gi, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const out = path.join(root, 'public/brand', `${slug}.${ext}`)
  fs.writeFileSync(out, tex.getImage())
  console.log(mat.getName(), '→', path.relative(root, out), tex.getSize()?.join('x'))
}
