import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Experience } from '@/scene/Experience'
import { Overlay } from '@/ui/Overlay'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useStore } from '@/state/store'
import { engineAudio } from '@/audio/engine'
import { transient } from '@/state/transient'

export default function App() {
  useKeyboard()
  const sound = useStore(s => s.toggles.sound)
  useEffect(() => { engineAudio.enabled = sound }, [sound])
  return (
    <>
      <div id="stage" role="img" aria-label="Interactive 3D model of the Red Bull RB16B. Drag to orbit, scroll to zoom, click to take it apart, double-click to launch.">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
          camera={{ fov: 32, near: 0.05, far: 240, position: [-8, 5, 10] }}
          onCreated={({ gl, scene }) => { if (import.meta.env.DEV) Object.assign(window, { __gl: gl, __scene: scene, __transient: transient }) }}
          fallback={<div id="err"><p>This view needs WebGL. Try a recent version of Chrome, Safari, Edge or Firefox.</p></div>}
        >
          <Experience />
        </Canvas>
      </div>
      <Overlay />
    </>
  )
}
