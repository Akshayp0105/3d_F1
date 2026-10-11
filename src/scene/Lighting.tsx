// Prototype lights (lines 232–242). three ≥ r155 uses physical light units; the prototype ran in legacy
// mode, where direct light was implicitly scaled by π, so intensities are multiplied by π for parity.
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { THEMES, type ThemeName } from '@/config/theme'

const PI = Math.PI

export function Lighting() {
  return (
    <>
      <hemisphereLight args={[0xe6eeff, 0x0b0d10, 0.35 * PI]} />
      <directionalLight
        position={[3.5, 9, 4.5]}
        intensity={2.1 * PI}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={1}
        shadow-camera-far={25}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-7, 4, -5]} color={0xcfe3ff} intensity={1.3 * PI} />
      <directionalLight position={[-2, 3, 7]} color={0xfff1e2} intensity={0.5 * PI} />
    </>
  )
}

/** Studio reflections: the prototype's PMREM scene of emissive panels (buildEnv, lines 211–230) as Lightformers. */
const PANELS: [w: number, h: number, color: string, intensity: number, pos: [number, number, number]][] = [
  [12, 3.2, '#ffffff', 5.0, [0, 9, 0]],
  [7, 2.2, '#ffffff', 3.0, [9, 3.5, 3]],
  [7, 2.2, '#d8ecff', 2.4, [-9, 3.5, -3]],
  [5, 6, '#ffe9d2', 1.6, [0, 3, -10]],
  [22, 0.35, '#ffffff', 1.6, [0, 1.2, 10]],
  [0.4, 10, '#ffffff', 2.0, [-6, 2, 8]],
]

export function StudioEnvironment({ theme }: { theme: ThemeName }) {
  const bg = new THREE.Color(THEMES[theme].scene).multiplyScalar(0.6)
  return (
    <Environment key={theme} resolution={256} frames={1}>
      <color attach="background" args={[bg]} />
      {PANELS.map(([w, h, color, intensity, pos], i) => (
        <Lightformer key={i} form="rect" scale={[w, h, 1]} color={color} intensity={intensity} position={pos} target={[0, 0, 0]} />
      ))}
    </Environment>
  )
}
