// Shader warm-up. three compiles a material's program the first time it is drawn in a given scene state, and on
// Windows/ANGLE each compile can stall for hundreds of ms, so the launch sequence used to hitch for seconds
// when the track, streaks and night look appeared. Once all assets have loaded (behind the loader), this renders
// a few frames in the race state (transient.warm) and compiles the whole scene, then restores the studio.
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { transient } from '@/state/transient'

export function Warmup() {
  const { active, progress } = useProgress()
  const gl = useThree(s => s.gl)
  const frames = useRef(-1)
  useFrame(({ scene, camera }) => {
    if (transient.ready) return
    if (frames.current < 0) {
      if (active || progress < 100) return
      frames.current = 0
    }
    const f = frames.current++
    // two passes: fully faded-in track (opaque materials) and mid-fade (transparent materials); `transparent` is
    // part of three's shader key. Priority 1 runs after the scene systems applied the state; compile() ignores culling.
    transient.warm = f < 3 ? 1 : f < 6 ? 0.5 : 0
    if (f === 2 || f === 5) gl.compile(scene, camera)
    if (f >= 8) transient.ready = true
  }, 1)
  return null
}
