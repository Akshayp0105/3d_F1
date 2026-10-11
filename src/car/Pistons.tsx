// Open cylinder bores with moving pistons, replacing the engine model's solid barrels (scripts/car/build-engine.mjs
// records each bore's top/axis/length/radius in car space as Engine extras). Visible once the cylinder heads lift
// in the exploded view; pumps at engine speed when the engine runs.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { transient } from '@/state/transient'
import { ss } from '@/lib/math'
import type { CarMaterials } from '@/three/materials'

export interface Bore { bank: 'left' | 'right'; idx: number; top: [number, number, number]; axis: [number, number, number]; length: number; radius: number }

// V6 firing order 1-4-2-5-3-6 → 120° crank spacing; left bank = 1-3, right bank = 4-6
const FIRING: Record<string, number> = { 'left1': 0, 'right1': 1, 'left2': 2, 'right2': 3, 'left3': 4, 'right3': 5 }

export function Pistons({ bores, m }: { bores: Bore[]; m: CarMaterials }) {
  const pistons = useRef<THREE.Group[]>([])
  const crank = useRef(0)
  const r0 = bores[0]?.radius ?? 0.057
  const bore = r0 * 0.8 // inner bore radius (wall thickness 20 %)
  const stroke = r0 * 0.85
  const crankR = stroke / 2, rod = crankR * 3.3

  const geo = useMemo(() => {
    const L = bores[0]?.length ?? 0.23
    const outer = new THREE.CylinderGeometry(r0, r0, L, 40, 1, true).translate(0, -L / 2, 0)
    const inner = new THREE.CylinderGeometry(bore, bore, L, 40, 1, true).translate(0, -L / 2, 0)
    const deck = new THREE.RingGeometry(bore, r0, 40).rotateX(-Math.PI / 2)
    const floor = new THREE.CircleGeometry(bore, 32).rotateX(-Math.PI / 2).translate(0, -L * 0.7, 0)
    const crown = new THREE.CylinderGeometry(bore * 0.97, bore * 0.97, 0.03, 36).translate(0, -0.015, 0)
    const dish = new THREE.CircleGeometry(bore * 0.6, 28).rotateX(-Math.PI / 2).translate(0, 0.0004, 0)
    const groove = new THREE.TorusGeometry(bore * 0.975, 0.0016, 6, 36).rotateX(Math.PI / 2)
    const rodGeo = new THREE.BoxGeometry(0.016, rod, 0.01).translate(0, -0.03 - rod / 2, 0)
    return { outer, inner, deck, floor, crown, dish, groove, rodGeo }
  }, [bores, r0, bore, rod])

  const mats = useMemo(() => ({
    wall: new THREE.MeshStandardMaterial({ color: '#2a2d31', metalness: 0.8, roughness: 0.35, side: THREE.BackSide }),
    crown: new THREE.MeshStandardMaterial({ color: '#8c9198', metalness: 0.9, roughness: 0.34, envMapIntensity: 0.6 }),
    block: new THREE.MeshStandardMaterial({ color: '#4f555c', metalness: 0.75, roughness: 0.5, envMapIntensity: 0.55 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0d0e10', metalness: 0.5, roughness: 0.6 }),
  }), [])

  const frames = useMemo(
    () => bores.map(b => ({
      pos: new THREE.Vector3(...b.top),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...b.axis).normalize()),
      phase: ((FIRING[`${b.bank}${b.idx}`] ?? 0) * 2 * Math.PI) / 6,
    })),
    [bores],
  )

  useFrame((_, dt) => {
    const ENG = transient.eng, RPM = transient.rpm
    const show = ss(0.6, 0.9, transient.explode) // pistons visible once the heads are off
    // showcase speed ~1.3 rev/s when exploded; engine speed when running
    const w = ENG ? 2 * Math.PI * (9 + 45 * RPM) : 2 * Math.PI * 1.3 * show
    crank.current += w * Math.min(dt, 0.05)
    frames.forEach((f, i) => {
      const th = crank.current + f.phase
      // slider-crank: piston pin distance from crank axis; 0 at TDC → crown flush with the deck
      const x = crankR * Math.cos(th) + Math.sqrt(rod * rod - (crankR * Math.sin(th)) ** 2)
      const tdc = crankR + rod
      const p = pistons.current[i]
      if (p) p.position.y = -(tdc - x) - 0.003
    })
  })

  return (
    <group>
      {frames.map((f, i) => (
        <group key={i} position={f.pos} quaternion={f.quat}>
          <mesh geometry={geo.outer} material={mats.block} castShadow />
          <mesh geometry={geo.inner} material={mats.wall} />
          <mesh geometry={geo.deck} material={mats.block} />
          <mesh geometry={geo.floor} material={mats.dark} />
          <group ref={el => { if (el) pistons.current[i] = el }}>
            <mesh geometry={geo.crown} material={mats.crown} />
            <mesh geometry={geo.dish} material={m.castAlu} />
            <mesh geometry={geo.groove} material={mats.dark} position-y={-0.008} />
            <mesh geometry={geo.groove} material={mats.dark} position-y={-0.016} />
            <mesh geometry={geo.rodGeo} material={m.ti} />
          </group>
        </group>
      ))}
    </group>
  )
}
