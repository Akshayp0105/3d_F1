// Brand decals projected onto the car's curved surfaces (drei <Decal>, DecalGeometry).
// Placements come from scripts/car/probe.mjs surface hits. Each decal sits inside its part's explode group,
// and projects in the target mesh's local (= car) space, so it travels with the part.
import { useEffect, useMemo, useState } from 'react'
import { Decal } from '@react-three/drei'
import * as THREE from 'three'
import { svgTexture } from '@/three/textures'
import { DECALS, type DecalDef } from '@/config/decals'

const cache = new Map<string, Promise<THREE.CanvasTexture>>()
function useSvgTexture(url: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let live = true
    if (!cache.has(url)) cache.set(url, svgTexture(url))
    cache.get(url)!.then(t => live && setTex(t)).catch(() => console.warn('[decals] missing', url))
    return () => { live = false }
  }, [url])
  return tex
}

/** Orientation from surface normal + desired image-up hint. */
function basisEuler(normal: THREE.Vector3Tuple, up: THREE.Vector3Tuple) {
  const z = new THREE.Vector3(...normal).normalize()
  const x = new THREE.Vector3(...up).cross(z).normalize()
  const y = z.clone().cross(x)
  return new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}

function OneDecal({ def, mesh }: { def: DecalDef; mesh: THREE.Mesh }) {
  const map = useSvgTexture(def.src)
  const rotation = useMemo(() => basisEuler(def.normal, def.up), [def])
  const ref = useMemo(() => ({ current: mesh }), [mesh])
  if (!map) return null
  return (
    <Decal mesh={ref} position={def.position} rotation={rotation} scale={def.scale}>
      <meshPhysicalMaterial
        map={map}
        transparent
        polygonOffset
        polygonOffsetFactor={-10}
        depthTest
        depthWrite={false}
        roughness={0.55}
        envMapIntensity={0.7}
      />
    </Decal>
  )
}

/** Renders every decal targeting `part`, projected onto that part's paint (or carbon) mesh. */
export function PartDecals({ part, meshes }: { part: string; meshes: Record<string, THREE.Mesh> }) {
  const defs = DECALS.filter(d => d.part === part)
  return (
    <>
      {defs.map(def => {
        const mesh = meshes[def.surface ?? 'paint']
        return mesh ? <OneDecal key={def.id} def={def} mesh={mesh} /> : null
      })}
    </>
  )
}
