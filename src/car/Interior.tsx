// Interior the STL doesn't have: the cockpit (seat, driver, steering wheel), the rear monocoque bulkhead,
// the fuel cell and the ERS energy store. Dimensions come from scripts/car/probe-interior.mjs:
// cockpit tub floor y 0.434, walls |z| 0.29, x 0.31 … 0.75; fuel/engine bay behind the bulkhead at x 0.03,
// floor y 0.151, walls |z| ≈ 0.36.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three-stdlib'
import { transient } from '@/state/transient'
import type { CarMaterials } from '@/three/materials'
import { Tube } from './PowerUnit'

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r)

/** Fuel cell + energy store + rear bulkhead (one explode part: lifts out of the bay). */
export function FuelCell({ m }: { m: CarMaterials }) {
  const geo = useMemo(
    () => ({ cell: rbox(0.42, 0.32, 0.5, 0.07), es: rbox(0.4, 0.07, 0.44, 0.015), bulkhead: rbox(0.02, 0.58, 0.54, 0.01), stripe: rbox(0.402, 0.012, 0.442, 0.004) }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach(g => g.dispose()), [geo])
  return (
    <group>
      <mesh geometry={geo.bulkhead} material={m.carbon} position={[0.04, 0.46, 0]} castShadow />
      <mesh geometry={geo.cell} material={m.bladder} position={[-0.2, 0.42, 0]} castShadow />
      {/* filler neck + fuel pump cap on top */}
      <mesh material={m.anodised} position={[-0.12, 0.6, 0.12]}>
        <cylinderGeometry args={[0.03, 0.03, 0.04, 18]} />
      </mesh>
      <mesh material={m.castAlu} position={[-0.28, 0.59, -0.08]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 24]} />
      </mesh>
      {/* energy store under the tank, orange HV band */}
      <mesh geometry={geo.es} material={m.anodised} position={[-0.2, 0.2, 0]} castShadow />
      <mesh geometry={geo.stripe} material={m.hv} position={[-0.2, 0.2, 0]} />
    </group>
  )
}

/** Moulded carbon seat in the tub (stays with the chassis; visible once the driver lifts out). */
export function Seat({ m }: { m: CarMaterials }) {
  const geo = useMemo(() => ({ base: rbox(0.36, 0.035, 0.34, 0.015), back: rbox(0.035, 0.24, 0.36, 0.015), side: rbox(0.3, 0.12, 0.03, 0.012) }), [])
  useEffect(() => () => Object.values(geo).forEach(g => g.dispose()), [geo])
  return (
    <group>
      <mesh geometry={geo.base} material={m.carbon} position={[0.52, 0.45, 0]} rotation-z={0.12} />
      <mesh geometry={geo.back} material={m.carbon} position={[0.33, 0.56, 0]} rotation-z={-0.35} />
      {[1, -1].map(s => <mesh key={s} geometry={geo.side} material={m.carbon} position={[0.45, 0.5, s * 0.18]} rotation-z={0.05} />)}
    </group>
  )
}

/** Seated driver in race suit + HANS, under the STL helmet (same explode part as the helmet). */
export function DriverBody({ m }: { m: CarMaterials }) {
  const torso = useMemo(() => [V(0.3, 0.6, 0), V(0.42, 0.53, 0), V(0.58, 0.47, 0)], [])
  const arms = useMemo(() => [1, -1].map(s => [V(0.3, 0.63, s * 0.17), V(0.44, 0.58, s * 0.2), V(0.6, 0.6, s * 0.14), V(0.66, 0.62, s * 0.12)]), [])
  return (
    <group>
      <Tube points={torso} r={0.11} material={m.suit} segments={12} />
      <mesh material={m.suit} position={[0.3, 0.62, 0]} rotation-x={Math.PI / 2}>
        <capsuleGeometry args={[0.07, 0.2, 6, 14]} />
      </mesh>
      {arms.map((pts, i) => <Tube key={i} points={pts} r={0.04} material={m.suit} segments={16} />)}
      {/* HANS device behind the neck */}
      <mesh material={m.anodised} position={[0.24, 0.68, 0]} rotation={[Math.PI / 2, 0, 0.3]}>
        <torusGeometry args={[0.08, 0.022, 8, 20, Math.PI]} />
      </mesh>
      {[1, -1].map(s => (
        <mesh key={s} material={m.rubber} position={[0.665, 0.62, s * 0.12]}>
          <sphereGeometry args={[0.035, 12, 10]} />
        </mesh>
      ))}
    </group>
  )
}

/** Dashboard texture for the wheel display: rev lights, gear, speed. Redrawn while the engine runs. */
function useDashTexture() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 160
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  const last = useRef('')
  useFrame(() => {
    const leds = Math.round(transient.rpm * 15)
    const key = `${leds}|${transient.gear}|${transient.kmh}`
    if (key === last.current) return
    last.current = key
    const c = tex.image as HTMLCanvasElement, g = c.getContext('2d')!
    g.fillStyle = '#05070a'
    g.fillRect(0, 0, 256, 160)
    for (let i = 0; i < 15; i++) {
      g.fillStyle = i < leds ? (i < 5 ? '#19e35a' : i < 10 ? '#ff2a2a' : '#4a7bff') : '#1a1d22'
      g.beginPath()
      g.arc(16 + i * 15.7, 16, 6, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#ffffff'
    g.font = 'bold 84px "Barlow Condensed", sans-serif'
    g.textAlign = 'center'
    g.fillText(transient.gear, 128, 118)
    g.font = '600 26px "Barlow Condensed", sans-serif'
    g.fillStyle = '#ffc906'
    g.fillText(`${transient.kmh}`, 40, 110)
    g.fillStyle = '#9aa3ad'
    g.fillText('ERS', 216, 110)
    g.fillStyle = '#19e35a'
    g.fillRect(196, 120, 40, 8)
    tex.needsUpdate = true
  })
  return tex
}

/** F1 steering wheel: carbon body, rubber grips, live display, buttons and rotaries, shift paddles. */
export function SteeringWheel({ m }: { m: CarMaterials }) {
  const dash = useDashTexture()
  const geo = useMemo(() => ({ body: rbox(0.04, 0.12, 0.2, 0.02), grip: rbox(0.05, 0.13, 0.045, 0.018), paddle: rbox(0.006, 0.07, 0.05, 0.003) }), [])
  useEffect(() => () => Object.values(geo).forEach(g => g.dispose()), [geo])
  const buttons: [number, number, string][] = [[0.035, 0.07, '#d8102b'], [0.035, -0.07, '#ffc906'], [-0.03, 0.075, '#2a7bff'], [-0.03, -0.075, '#19c35a'], [-0.045, 0.03, '#ffffff'], [-0.045, -0.03, '#ff7a1a']]
  return (
    <group position={[0.69, 0.63, 0]} rotation-z={0.45}>
      <mesh geometry={geo.body} material={m.carbon} castShadow />
      {[1, -1].map(s => <mesh key={s} geometry={geo.grip} material={m.rubber} position={[0.005, -0.005, s * 0.12]} />)}
      <mesh position={[-0.021, 0.012, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.085, 0.053]} />
        <meshBasicMaterial map={dash} toneMapped={false} />
      </mesh>
      {buttons.map(([y, z, c], i) => (
        <mesh key={i} position={[-0.022, y, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.007, 0.007, 0.006, 12]} />
          <meshStandardMaterial color={c} roughness={0.4} />
        </mesh>
      ))}
      {[0.045, -0.045].map(z => (
        <mesh key={z} material={m.castAlu} position={[-0.024, -0.042, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.009, 0.009, 0.01, 16]} />
        </mesh>
      ))}
      {[1, -1].map(s => <mesh key={s} geometry={geo.paddle} material={m.carbon} position={[0.03, 0.02, s * 0.065]} />)}
      {/* column */}
      <mesh material={m.anodised} position={[0.07, 0, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.012, 0.012, 0.1, 10]} />
      </mesh>
    </group>
  )
}
