// Realistic 13" wheel internals replacing the STL's solid wheel disc: spoked magnesium rim, centre-lock hub and
// nut, carbon brake disc (glows under braking). Rendered inside the wheel node so it spins; the caliper sits on the
// (non-spinning) upright in the wheel's explode group.
import { useMemo } from 'react'
import * as THREE from 'three'
import type { CarMaterials } from '@/three/materials'
import { PZERO } from '@/config/decals'
import type { Vec3 } from '@/config/parts'
import { OneDecal } from './Decals'

/** Outboard/inboard face z (wheel-local) from the tyre geometry. */
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
  return { side, out: side > 0 ? box.max.z : box.min.z, inb: side > 0 ? box.min.z : box.max.z }
}

const R_RIM = 0.198

export function WheelInternals({ wheel, m }: { wheel: THREE.Object3D; m: CarMaterials }) {
  const { side, out, inb } = useMemo(() => wheelFaces(wheel), [wheel])
  const width = Math.abs(out - inb)
  const mid = (out + inb) / 2
  const face = out - side * 0.035 // spoke plane, slightly inset from the tyre face
  return (
    <group>
      {/* rim barrel + outer lip */}
      <mesh material={m.rimMetal} position={[0, 0, mid]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[R_RIM, R_RIM, width * 0.86, 56, 1, true]} />
      </mesh>
      <mesh material={m.rimMetal} position={[0, 0, out - side * 0.012]}>
        <torusGeometry args={[R_RIM, 0.009, 8, 56]} />
      </mesh>
      {/* spokes */}
      {Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2
        const r0 = 0.055, r1 = R_RIM - 0.006, rm = (r0 + r1) / 2
        return (
          <mesh key={k} material={m.rimMetal} position={[Math.cos(a) * rm, Math.sin(a) * rm, face]} rotation-z={a} castShadow>
            <boxGeometry args={[r1 - r0, 0.022, 0.014]} />
          </mesh>
        )
      })}
      {/* hub + centre-lock nut */}
      <mesh material={m.rimMetal} position={[0, 0, face]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.062, 0.062, 0.04, 28]} />
      </mesh>
      <mesh material={m.accentMat} position={[0, 0, face + side * 0.026]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.034, 0.038, 0.03, 6]} />
      </mesh>
      {/* carbon brake disc, inboard of the spokes */}
      <mesh material={m.disc} position={[0, 0, mid - side * 0.02]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.14, 0.14, 0.032, 48]} />
      </mesh>
    </group>
  )
}

/** Brake caliper on the upright (doesn't spin). Placed in the wheel's explode group at the wheel pivot. */
export function Caliper({ wheel, m }: { wheel: THREE.Object3D; m: CarMaterials }) {
  const { side, out, inb } = useMemo(() => wheelFaces(wheel), [wheel])
  const mid = (out + inb) / 2
  const p = wheel.position
  const front = p.x > 0
  // trailing position on the disc: behind and above the axle
  const a = front ? Math.PI * 0.62 : Math.PI * 0.38
  return (
    <mesh material={m.caliper} position={[p.x + Math.cos(a) * 0.13, p.y + Math.sin(a) * 0.13, p.z + mid - side * 0.02]} rotation-z={a - Math.PI / 2} castShadow>
      <boxGeometry args={[0.1, 0.045, 0.07]} />
    </mesh>
  )
}

/** Pirelli P Zero markings on the outboard sidewall (top + bottom, like the real tyre). Rendered inside the wheel
 *  node, so they spin with it; projected onto the tyre mesh in wheel-local space. */
export function TyreDecals({ wheel, tyre }: { wheel: THREE.Object3D; tyre: THREE.Mesh }) {
  const defs = useMemo(() => {
    const { side, out } = wheelFaces(wheel)
    return [1, -1].map(s => ({
      id: `pzero-${s}`,
      part: wheel.name,
      src: PZERO,
      position: [0, 0.296 * s, out] as Vec3,
      normal: [0, 0, side] as Vec3,
      up: [0, s, 0] as Vec3,
      scale: [0.2, 0.05, 0.05] as Vec3,
    }))
  }, [wheel])
  return <>{defs.map(d => <OneDecal key={d.id} def={d} mesh={tyre} />)}</>
}
