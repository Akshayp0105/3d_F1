// Procedural power unit, ported from the prototype (reference/aurora-studio.html 489–510, 910–917).
// The STL is a closed shell with no interior, so the PU lives inside the engine bay and is revealed when
// the engine cover lifts. The exhaust runs to the STL's exhaust exit.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three-stdlib'
import { transient } from '@/state/transient'
import { useStore } from '@/state/store'
import { ss } from '@/lib/math'
import type { CarMaterials } from '@/three/materials'

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
export const EXHAUST_EXIT = V(-1.97, 0.41, 0)

/** Cylinder between two points (prototype rod) */
function Rod({ a, b, r, material }: { a: THREE.Vector3; b: THREE.Vector3; r: number; material: THREE.Material }) {
  const { position, quaternion, len } = useMemo(() => {
    const d = new THREE.Vector3().subVectors(b, a)
    return {
      len: d.length(),
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()),
    }
  }, [a, b])
  return (
    <mesh position={position} quaternion={quaternion} material={material} castShadow>
      <cylinderGeometry args={[r, r, len, 10]} />
    </mesh>
  )
}

const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r)

export function PowerUnit({ m }: { m: CarMaterials }) {
  const bob = useRef<THREE.Group>(null!)
  const imp = useRef<THREE.Group>(null!)
  const pistons = useRef<THREE.Mesh[]>([])
  const exGlow = useRef<THREE.Mesh>(null!)
  const exLight = useRef<THREE.PointLight>(null!)
  const reduceMotion = useStore(s => s.reduceMotion)

  const geo = useMemo(
    () => ({ block: rbox(0.9, 0.22, 0.32, 0.04), bank: rbox(0.82, 0.08, 0.15, 0.03) }),
    [],
  )
  const pistonDefs = useMemo(() => {
    const out: { pos: [number, number, number]; ph: number }[] = []
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) out.push({ pos: [-1.12 + i * 0.27, 0.53, 0.15 * s], ph: ((i * 2 + (s > 0 ? 0 : 1)) * Math.PI) / 3 })
    return out
  }, [])

  useFrame(({ clock }, dt) => {
    const now = clock.elapsedTime * 1000
    const ENG = transient.eng, RPM = transient.rpm
    const ea = ss(0.65, 1, transient.explode), act = Math.max(ea, ENG)
    imp.current.rotation.x += dt * (ea * 14 + ENG * (10 + 90 * RPM))
    pistons.current.forEach((p, i) => {
      p.position.y = 0.53 + 0.022 * act * Math.sin(now * (ENG ? 0.03 + 0.05 * RPM : 0.012) + pistonDefs[i].ph)
    })
    m.mguk.emissiveIntensity = 0.25 + 1.6 * act * (0.5 + 0.5 * Math.sin(now * 0.005))
    m.hv.emissiveIntensity = 1.4 * act * (0.5 + 0.5 * Math.sin(now * 0.005 - 1.2))
    bob.current.position.y = ea > 0 && !reduceMotion ? 0.0025 * ea * Math.sin(now * 0.09) : 0
    m.exGlow.opacity = ENG * (0.3 + 0.7 * RPM)
    exGlow.current.scale.setScalar(1 + 1.5 * RPM * ENG)
    // physical light units (prototype ran legacy); tuned down vs ×π, bloom carries the glow
    exLight.current.intensity = ENG * (0.4 + 1.6 * RPM) * 1.2
  })

  const turbo = V(-1.38, 0.42, 0)
  return (
    <group ref={bob}>
      <mesh geometry={geo.block} material={m.alu} position={[-0.85, 0.3, 0]} castShadow />
      {[1, -1].map(s => (
        <group key={s}>
          <mesh geometry={geo.bank} material={m.accentMat} position={[-0.85, 0.46, 0.1 * s]} rotation={[-0.5 * s, 0, 0]} castShadow />
          <Rod a={V(-0.5, 0.25, 0.17 * s)} b={V(-1.2, 0.28, 0.17 * s)} r={0.012} material={m.hv} />
        </group>
      ))}
      <mesh material={m.ti} position={turbo} rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[0.07, 0.035, 16, 32]} />
      </mesh>
      <mesh material={m.mguk} position={[-0.5, 0.2, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.16, 28]} />
      </mesh>
      <Rod a={turbo} b={EXHAUST_EXIT} r={0.04} material={m.ti} />
      <mesh material={m.ti} position={EXHAUST_EXIT} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.042, 0.008, 10, 28]} />
      </mesh>
      {/* turbo impeller */}
      <group ref={imp} position={turbo}>
        {Array.from({ length: 9 }, (_, k) => {
          const a = (k / 9) * Math.PI * 2
          return (
            <mesh key={k} material={m.chrome} position={[0, Math.cos(a) * 0.035, Math.sin(a) * 0.035]} rotation={[a, 0.4, 0]}>
              <boxGeometry args={[0.012, 0.06, 0.01]} />
            </mesh>
          )
        })}
        <mesh material={m.ti}>
          <sphereGeometry args={[0.02, 12, 10]} />
        </mesh>
      </group>
      {pistonDefs.map((p, i) => (
        <mesh key={i} ref={el => { if (el) pistons.current[i] = el }} material={m.chrome} position={p.pos}>
          <cylinderGeometry args={[0.035, 0.035, 0.06, 16]} />
        </mesh>
      ))}
      <mesh ref={exGlow} material={m.exGlow} position={[EXHAUST_EXIT.x - 0.03, EXHAUST_EXIT.y, 0]}>
        <sphereGeometry args={[0.05, 16, 12]} />
      </mesh>
      <pointLight ref={exLight} color="#ff6a1a" intensity={0} distance={2.4} decay={2} position={[EXHAUST_EXIT.x - 0.18, EXHAUST_EXIT.y, 0]} />
    </group>
  )
}

/** Sidepod radiator (prototype 512–513) */
export function Radiator({ side, m }: { side: 1 | -1; m: CarMaterials }) {
  const geo = useMemo(() => rbox(0.06, 0.26, 0.26, 0.015), [])
  // inset vs the prototype (z 0.5) so it stays inside the STL sidepod skin until exploded
  return <mesh geometry={geo} material={m.radiator} position={[-0.05, 0.33, 0.36 * side]} rotation={[0, 0.35 * side, 0]} castShadow />
}
