// Power unit: the supplied engine model (assets-src/f1_engine_exposed_reconstruction.glb), prepared by
// scripts/car/build-engine.mjs into car space and split into explode stages. Sits in the STL's empty engine bay
// (x −1.20 … −0.13). Added here: a tailpipe from the turbo outlet to the STL's exhaust exit, wastegates, exhaust
// glow + light, an energised MGU-K glow and running vibration (prototype behaviour, lines 910–917).
// Once the PU has lifted, its sub-assemblies come apart in stages (engine-composition reveal).
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three-stdlib'
import { transient } from '@/state/transient'
import { useStore } from '@/state/store'
import { ss } from '@/lib/math'
import { LIVERIES } from '@/config/liveries'
import type { CarMaterials } from '@/three/materials'
import { carRefs } from './refs'

export const ENGINE_URL = '/models/engine.glb'
useGLTF.preload(ENGINE_URL)

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
export const EXHAUST_EXIT = V(-1.97, 0.41, 0)
/** turbo outlet sleeve in car space (engine x 0.683, y 0.461 through ENGINE_FIT) */
const TURBO_OUT = V(-1.18, 0.341, 0)
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r)

/** Explode stage for an engine sub-assembly (car-space offset over progress [d, d + 0.2]). */
const STAGES: Record<string, { off: [number, number, number]; d: number }> = {
  PU_Intake: { off: [0, 0.46, 0], d: 0.6 },
  PU_Ancillaries: { off: [0, 0.12, 0], d: 0.62 },
  PU_Turbo: { off: [-0.3, 0.05, 0], d: 0.66 },
  PU_HeadL: { off: [0, 0.2, -0.22], d: 0.68 },
  PU_HeadR: { off: [0, 0.2, 0.22], d: 0.68 },
  PU_ExhaustL: { off: [0, -0.02, -0.32], d: 0.72 },
  PU_ExhaustR: { off: [0, -0.02, 0.32], d: 0.72 },
  PU_MGUK: { off: [0, 0.28, 0], d: 0.76 },
}

function Stage({ name, children }: { name: string; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null!)
  const def = STAGES[name]
  useEffect(() => {
    carRefs.parts[name] = ref.current
    return () => { delete carRefs.parts[name] }
  }, [name])
  useFrame(() => {
    if (!def) return
    const k = ss(def.d, def.d + 0.2, transient.explode)
    ref.current.position.set(def.off[0] * k, def.off[1] * k, def.off[2] * k)
  })
  return <group ref={ref}>{children}</group>
}

export function Tube({ points, r, material, segments = 48 }: { points: THREE.Vector3[]; r: number; material: THREE.Material; segments?: number }) {
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, r, 12, false), [points, r, segments])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={material} castShadow />
}

export function PowerUnit({ m }: { m: CarMaterials }) {
  const { nodes } = useGLTF(ENGINE_URL)
  const livery = useStore(s => s.livery)
  const reduceMotion = useStore(s => s.reduceMotion)
  const bob = useRef<THREE.Group>(null!)
  const exGlow = useRef<THREE.Mesh>(null!)
  const exLight = useRef<THREE.PointLight>(null!)

  // prepare groups once: shadows, tone down hot metals for the studio, Inconel on the headers,
  // private emissive materials for the MGU-K so it can glow when energised
  const { groups, mgukMats } = useMemo(() => {
    const groups: Record<string, THREE.Object3D> = {}
    const mgukMats: THREE.MeshStandardMaterial[] = []
    for (const name of [...Object.keys(STAGES), 'PU_Block']) {
      const g = nodes[name]
      if (!g) continue
      g.traverse(o => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = true
        mesh.receiveShadow = true
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (name.startsWith('PU_Exhaust') && mat.name === 'Polished exhaust steel') mesh.material = m.inconel
        else if (name === 'PU_MGUK') {
          const own = (mesh.userData.own ??= mat.clone()) as THREE.MeshStandardMaterial
          own.emissive = new THREE.Color()
          mesh.material = own
          mgukMats.push(own)
        } else {
          // bright machined/polished parts bloom under the studio lights: keep them below the bloom threshold
          const hot = /Machined aluminium|Polished exhaust steel|Ceramic reservoir/.test(mat.name)
          mat.envMapIntensity = hot ? 0.5 : 0.85
          if (hot) mat.roughness = Math.max(mat.roughness, 0.32)
        }
      })
      groups[name] = g
    }
    return { groups, mgukMats }
  }, [nodes, m])
  useEffect(() => { mgukMats.forEach(mat => mat.emissive.set(LIVERIES[livery].accent)) }, [mgukMats, livery])

  const tailpipe = useMemo(() => [TURBO_OUT.clone(), V(-1.32, 0.385, 0), V(-1.6, 0.4, 0), V(-1.82, 0.405, 0), EXHAUST_EXIT.clone()], [])
  const wastegates = useMemo(() => [1, -1].map(s => [V(-1.16, 0.42, s * 0.05), V(-1.45, 0.46, s * 0.06), V(-1.95, 0.48, s * 0.06)]), [])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime * 1000
    const ENG = transient.eng, RPM = transient.rpm
    const ea = ss(0.65, 1, transient.explode), act = Math.max(ea, ENG)
    const pulse = 0.25 + 1.4 * act * (0.5 + 0.5 * Math.sin(now * 0.005))
    mgukMats.forEach(mat => { mat.emissiveIntensity = pulse * 0.35 })
    bob.current.position.y = !reduceMotion ? 0.0025 * ea * Math.sin(now * 0.09) + 0.0012 * ENG * (0.4 + RPM) * Math.sin(now * 0.21) : 0
    m.exGlow.opacity = ENG * (0.3 + 0.7 * RPM)
    exGlow.current.scale.setScalar(1 + 1.5 * RPM * ENG)
    exLight.current.intensity = ENG * (0.4 + 1.6 * RPM) * 1.2
  })

  return (
    <group ref={bob}>
      {groups.PU_Block && <primitive object={groups.PU_Block} />}
      {Object.keys(STAGES).map(name =>
        groups[name] ? (
          <Stage key={name} name={name}>
            <primitive object={groups[name]} />
            {name === 'PU_Turbo' && (
              <>
                <Tube points={tailpipe} r={0.034} material={m.inconel} />
                {wastegates.map((pts, i) => <Tube key={i} points={pts} r={0.012} material={m.inconel} segments={24} />)}
                <mesh material={m.inconel} position={EXHAUST_EXIT} rotation-y={Math.PI / 2}>
                  <torusGeometry args={[0.036, 0.006, 10, 28]} />
                </mesh>
                <mesh ref={exGlow} material={m.exGlow} position={[EXHAUST_EXIT.x - 0.03, EXHAUST_EXIT.y, 0]}>
                  <sphereGeometry args={[0.05, 16, 12]} />
                </mesh>
                <pointLight ref={exLight} color="#ff6a1a" intensity={0} distance={2.4} decay={2} position={[EXHAUST_EXIT.x - 0.18, EXHAUST_EXIT.y, 0]} />
              </>
            )}
          </Stage>
        ) : null,
      )}
    </group>
  )
}

/** Sidepod radiator: finned core, alloy end tanks, coolant hose toward the engine. */
export function Radiator({ side, m }: { side: 1 | -1; m: CarMaterials }) {
  const geo = useMemo(() => ({ core: rbox(0.5, 0.32, 0.05, 0.008), tank: rbox(0.5, 0.035, 0.07, 0.012) }), [])
  useEffect(() => () => { geo.core.dispose(); geo.tank.dispose() }, [geo])
  const hose = useMemo(() => [V(-0.45, 0.25, side * 0.4), V(-0.5, 0.26, side * 0.33), V(-0.55, 0.3, side * 0.27)], [side])
  return (
    <group>
      <group position={[-0.2, 0.37, 0.43 * side]} rotation={[side * 0.18, side * 0.12, 0]}>
        <mesh geometry={geo.core} material={m.radiator} castShadow />
        <mesh geometry={geo.tank} material={m.alu} position={[0, 0.175, 0]} />
        <mesh geometry={geo.tank} material={m.alu} position={[0, -0.175, 0]} />
      </group>
      <Tube points={hose} r={0.018} material={m.rubber} segments={16} />
    </group>
  )
}
