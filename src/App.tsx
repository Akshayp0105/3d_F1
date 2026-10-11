import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

// Phase 0 placeholder: proves the R3F stack boots. See CLAUDE.md for the build plan.
export default function App() {
  return (
    <Canvas shadows camera={{ position: [5.2, 2.2, 5.2], fov: 32 }}>
      <color attach="background" args={['#14171c']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3.5, 9, 4.5]} intensity={2} />
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[4.6, 0.5, 1.6]} />
        <meshStandardMaterial color="#101836" />
      </mesh>
      <OrbitControls target={[0, 0.38, 0]} />
    </Canvas>
  )
}
