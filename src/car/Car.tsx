// The RB16B: GLB parts (scripts/car/build-car.mjs) + procedural PU/radiators/lights, wired to the explode
// progress, the cinematic channels and the show toggles. Per-frame logic ports prototype lines 895–922.
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, createPortal } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { PARTS, WHEEL_NODES, DRS, type PartDef } from '@/config/parts'
import { LIVERIES } from '@/config/liveries'
import { T, VMAX } from '@/config/timeline'
import { useStore } from '@/state/store'
import { isCine } from '@/state/machine'
import { transient } from '@/state/transient'
import { ss, damp } from '@/lib/math'
import { createCarMaterials } from '@/three/materials'
import { PowerUnit, Radiator } from './PowerUnit'
import { FuelCell, Seat, DriverBody, SteeringWheel } from './Interior'
import { PirelliWheel, Caliper } from './WheelAssembly'
import { PartDecals } from './Decals'
import { carRefs } from './refs'

export const CAR_URL = '/models/rb16b.glb'
useGLTF.preload(CAR_URL)


interface PartObject {
  object: THREE.Object3D
  meshes: Record<string, THREE.Mesh>
}

function ExplodablePart({ name, def, children }: { name: string; def: PartDef; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null!)
  useEffect(() => {
    carRefs.parts[name] = ref.current
    return () => { delete carRefs.parts[name] }
  }, [name])
  useFrame(() => {
    const k = ss(def.d, def.d + 0.55, transient.explode)
    ref.current.position.set(def.off[0] * k, def.off[1] * k, def.off[2] * k)
    ref.current.rotation.set(def.rot[0] * k, def.rot[1] * k, def.rot[2] * k)
  })
  return <group ref={ref}>{children}</group>
}

export function Car() {
  const { nodes } = useGLTF(CAR_URL)
  const livery = useStore(s => s.livery)
  const reduceMotion = useStore(s => s.reduceMotion)
  const m = useMemo(createCarMaterials, [])
  useEffect(() => () => m.dispose(), [m])
  useEffect(() => m.applyLivery(LIVERIES[livery]), [m, livery])

  const parts = useMemo(() => {
    const out: Record<string, PartObject> = {}
    for (const name of [...Object.keys(PARTS), 'RearWing_Flap']) {
      const node = nodes[name]
      if (!node) continue
      const meshes: Record<string, THREE.Mesh> = {}
      node.traverse(o => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        // cache the glTF material name: StrictMode re-runs this memo after materials were swapped
        const key: string = (mesh.userData.matName ??= (mesh.material as THREE.Material).name)
        meshes[key] = mesh
        mesh.material = (m as unknown as Record<string, THREE.Material>)[key] ?? m.paint
        mesh.castShadow = true
        mesh.receiveShadow = true
        // the STL's tyre and solid wheel disc are replaced by the Pirelli wheel model (kept hidden: they're its fit reference)
        if (key === 'rim' || key === 'tyre') mesh.visible = false
      })
      out[name] = { object: node, meshes }
    }
    return out
  }, [nodes, m])

  const group = useRef<THREE.Group>(null!)
  const rain = useRef<THREE.Mesh>(null!)
  useEffect(() => {
    carRefs.car = group.current
    return () => { carRefs.car = null }
  }, [])

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(0.05, rawDt)
    const now = clock.elapsedTime * 1000
    const { phase, toggles } = useStore.getState()
    const cine = isCine(phase)
    const S = cine ? transient.s : 0, ENG = transient.eng, RPM = transient.rpm

    const e = ss(0, 0.6, transient.explode)
    const car = group.current
    car.position.set(cine ? transient.cx : 0, 0.5 * e, 0)
    car.rotation.z = cine ? transient.roll + transient.pitch : 0
    if (cine) {
      // jump height; nose-down pitch rotates about the car's centre, so lift it to keep the front wheels off the track
      car.position.y += transient.carY + Math.max(0, -Math.sin(transient.pitch)) * 1.85
    }
    if (ENG && !reduceMotion) car.position.y += 0.0018 * (0.4 + RPM) * Math.sin(now * 0.13)

    // wheels + brakes
    transient.spinSpeed += ((toggles.spin ? 22 : 0) - transient.spinSpeed) * damp(1.6, dt)
    const wv = cine ? Math.min(40, (S * VMAX) / 0.36) : transient.spinSpeed
    // slow motion (transient.ts) applies to the wheels too
    for (const w of WHEEL_NODES) { const o = parts[w]?.object; if (o) o.rotation.z -= wv * dt * (cine ? transient.ts : 1) }
    // ×3 vs the prototype so the glow crosses the bloom threshold
    m.brake.emissiveIntensity = 3 * (cine ? transient.brake : (transient.spinSpeed / 22) * 1.6)
    m.disc.emissiveIntensity = m.brake.emissiveIntensity

    // DRS flap
    const open = (cine && S > 0.9 && transient.cineT < T.blast) || toggles.drs
    transient.flap += ((open ? DRS.open : DRS.closed) - transient.flap) * damp(7, dt)
    const flap = parts.RearWing_Flap?.object
    if (flap) flap.rotation.z = transient.flap

    m.rain.emissiveIntensity = 3 * (reduceMotion
      ? 2
      : ENG
        ? 0.6 + 4 * Math.pow(Math.max(0, Math.sin(now * 0.012)), 6)
        : 0.4 + 3 * Math.pow(Math.max(0, Math.sin(now * 0.006)), 6))
  })

  const extra: Record<string, ReactNode> = {
    PowerUnit: <PowerUnit m={m} />,
    FuelCell: <FuelCell m={m} />,
    SteeringWheel: <SteeringWheel m={m} />,
    Chassis: <Seat m={m} />,
    Driver: <DriverBody m={m} />,
    Radiator_R: <Radiator side={1} m={m} />,
    Radiator_L: <Radiator side={-1} m={m} />,
    RearWing: (
      <>
        {parts.RearWing_Flap && <primitive object={parts.RearWing_Flap.object} />}
        <mesh ref={rain} material={m.rain} position={[-2.118, 0.335, 0]}>
          <boxGeometry args={[0.02, 0.05, 0.12]} />
        </mesh>
      </>
    ),
  }

  return (
    <group ref={group} name="car">
      {Object.entries(PARTS).map(([name, def]) => {
        const p = parts[name]
        return (
          <ExplodablePart key={name} name={name} def={def}>
            {p && <primitive object={p.object} />}
            {p && name.startsWith('Wheel_') && createPortal(<PirelliWheel wheel={p.object} m={m} />, p.object)}
            {p && name.startsWith('Wheel_') && <Caliper wheel={p.object} m={m} />}
            {extra[name]}
            {p && <PartDecals part={name} meshes={p.meshes} />}
          </ExplodablePart>
        )
      })}
    </group>
  )
}
