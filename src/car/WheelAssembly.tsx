// Wheels: the supplied Pirelli P Zero wheel (public/models/tyre.glb, built by scripts/car/build-tyre.mjs) replaces
// the STL's tyre and solid wheel disc. It's fitted per wheel to the STL tyre's size (the STL meshes stay, hidden, as
// the fit reference), rendered inside the wheel node so it spins, with the car's glowing brake material on its disc.
// The caliper sits on the (non-spinning) upright in the wheel's explode group.
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { CarMaterials } from '@/three/materials'

export const TYRE_URL = '/models/tyre.glb'
useGLTF.preload(TYRE_URL)

/** Outboard/inboard face z (wheel-local) and radius from the STL tyre geometry. */
export function wheelFaces(wheel: THREE.Object3D) {
  const box = new THREE.Box3()
  wheel.traverse(o => {
    const g = (o as THREE.Mesh).geometry
    if (g && o.userData.matName === 'tyre') {
      g.computeBoundingBox()
      box.union(g.boundingBox!)
    }
  })
  const side = wheel.position.z > 0 ? 1 : -1
  // the pivot is the true axle (fit-wheels.mjs); the STL box can be a few mm off-centre, so average the extents
  const radius = (box.max.x - box.min.x + box.max.y - box.min.y) / 4
  return { side, radius, out: side > 0 ? box.max.z : box.min.z, inb: side > 0 ? box.min.z : box.max.z }
}

/** Model → wheel fit: uniform radial scale, axial scale to the STL tyre's width. */
function useWheelFit(wheel: THREE.Object3D) {
  const { scene } = useGLTF(TYRE_URL)
  return useMemo(() => {
    const { side, radius, out, inb } = wheelFaces(wheel)
    const src = scene.getObjectByName('Tyre')!.userData as { radius: number; halfWidth: number }
    const width = Math.abs(out - inb)
    const kr = radius / src.radius, kz = width / (2 * src.halfWidth)
    // brake disc (inboard, model z −0.075, radius 0.267) in wheel-local space
    return { side, kr, kz, mid: (out + inb) / 2, discR: 0.267 * kr, discZ: (out + inb) / 2 - side * 0.075 * kz }
  }, [wheel, scene])
}

export function PirelliWheel({ wheel, m }: { wheel: THREE.Object3D; m: CarMaterials }) {
  const { scene } = useGLTF(TYRE_URL)
  const fit = useWheelFit(wheel)
  const object = useMemo(() => {
    const o = scene.clone(true)
    o.traverse(c => {
      const mesh = c as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const mat = mesh.material as THREE.MeshStandardMaterial
      // the car's brake disc material glows under braking (Car.tsx drives its emissive)
      if (mat.name === 'disc') mesh.material = m.disc
      // the source rubber reads dusty grey under the studio lights: near-black satin compound, finer grain.
      // Absolute values (shared material, StrictMode re-runs this memo).
      if (mat.map && mat.normalMap) {
        mat.color.setScalar(0.55)
        mat.roughness = 0.8
        mat.normalScale.setScalar(0.55)
      }
    })
    return o
  }, [scene, m])
  // +Z is the model's outboard face; left wheels turn 180° about Y (not mirrored, so the sidewall lettering reads right)
  return (
    <primitive
      object={object}
      position={[0, 0, fit.mid]}
      rotation={[0, fit.side > 0 ? 0 : Math.PI, 0]}
      scale={[fit.kr, fit.kr, fit.kz]}
    />
  )
}

/** Brake caliper on the upright (doesn't spin), straddling the disc's trailing edge. Placed in the wheel's explode
 *  group at the wheel pivot. */
export function Caliper({ wheel, m }: { wheel: THREE.Object3D; m: CarMaterials }) {
  const { discR, discZ } = useWheelFit(wheel)
  const p = wheel.position
  const front = p.x > 0
  // trailing position on the disc: behind and above the axle
  const a = front ? Math.PI * 0.62 : Math.PI * 0.38
  const r = discR - 0.012
  return (
    <mesh material={m.caliper} position={[p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, p.z + discZ]} rotation-z={a - Math.PI / 2} castShadow>
      <boxGeometry args={[0.085, 0.04, 0.06]} />
    </mesh>
  )
}
