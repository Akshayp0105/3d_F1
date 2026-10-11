// Post-processing (improvement over the prototype): bloom on emissives (exhaust, brakes, rain light, MGU-K),
// speed-driven chromatic aberration during the run, vignette (replaces the CSS overlay), ACES tone mapping.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode, BlendFunction, type ChromaticAberrationEffect } from 'postprocessing'
import * as THREE from 'three'
import { useStore } from '@/state/store'
import { isCine } from '@/state/machine'
import { transient } from '@/state/transient'

export function Effects() {
  const ca = useRef<ChromaticAberrationEffect>(null)
  const reduceMotion = useStore(s => s.reduceMotion)
  const offset = useRef(new THREE.Vector2()).current
  useFrame(() => {
    const k = isCine(useStore.getState().phase) && !reduceMotion ? transient.s * transient.m : 0
    offset.set(0.0016 * k, 0.0009 * k)
    if (ca.current) ca.current.offset.copy(offset)
  })
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={1.6} luminanceSmoothing={0.3} intensity={0.8} />
      <ChromaticAberration ref={ca} offset={offset} radialModulation modulationOffset={0.25} blendFunction={BlendFunction.NORMAL} />
      <Vignette offset={0.32} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
