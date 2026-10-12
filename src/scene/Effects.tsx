// Post-processing. Studio: AO, bloom on emissives, vignette, ACES. Cinematic (Phase 4B), all driven by transient
// channels from the director so nothing is mounted/unmounted mid-sequence (no recompiles): heat-haze distortion
// around the blast, depth of field focused on the car, chromatic aberration (speed + blast spike), film grain,
// stronger vignette. Bloom's threshold keeps it to emissives and the HDR fire.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, N8AO, Bloom, ChromaticAberration, Vignette, ToneMapping, DepthOfField, Noise } from '@react-three/postprocessing'
import { Effect, ToneMappingMode, BlendFunction, type ChromaticAberrationEffect, type DepthOfFieldEffect, type NoiseEffect, type VignetteEffect } from 'postprocessing'
import * as THREE from 'three'
import { useStore } from '@/state/store'
import { isCine } from '@/state/machine'
import { transient } from '@/state/transient'
import { carRefs } from '@/car/refs'

/** Screen-space heat shimmer: UV distortion inside a soft ellipse around the blast, rising ripples. */
class HeatHazeEffect extends Effect {
  constructor() {
    super(
      'HeatHaze',
      /* glsl */ `
      uniform float uStrength; uniform vec2 uCenter; uniform float uRadius;
      void mainUv(inout vec2 uv) {
        if (uStrength <= 0.0) return;
        vec2 d = (uv - uCenter) * vec2(aspect, 1.0);
        d.y *= 0.65; // taller than wide: heat rises
        float m = exp(-dot(d, d) / (uRadius * uRadius)) * smoothstep(-0.1, 0.05, uv.y - uCenter.y + uRadius * 0.6);
        vec2 n = vec2(sin(uv.y * 160.0 - time * 9.0) + 0.6 * sin(uv.y * 63.0 + uv.x * 40.0 - time * 5.0),
                      cos(uv.x * 140.0 + time * 7.0) + 0.5 * sin(uv.y * 95.0 - time * 11.0));
        uv += n * 0.0016 * uStrength * m;
      }`,
      { uniforms: new Map<string, THREE.Uniform>([['uStrength', new THREE.Uniform(0)], ['uCenter', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))], ['uRadius', new THREE.Uniform(0.35)]]) },
    )
  }
}

export function Effects() {
  const ca = useRef<ChromaticAberrationEffect>(null)
  const dof = useRef<DepthOfFieldEffect>(null)
  const noise = useRef<NoiseEffect>(null)
  const vig = useRef<VignetteEffect>(null)
  const haze = useMemo(() => new HeatHazeEffect(), [])
  const reduceMotion = useStore(s => s.reduceMotion)
  const offset = useRef(new THREE.Vector2()).current
  const focus = useRef(new THREE.Vector3()).current

  useFrame(() => {
    const cine = isCine(useStore.getState().phase)
    const k = cine && !reduceMotion ? transient.s * transient.m : 0
    const spike = cine ? transient.ca : 0
    offset.set(0.0016 * k + 0.0045 * spike, 0.0009 * k + 0.003 * spike)
    if (ca.current) ca.current.offset.copy(offset)
    // heat haze
    const hz = haze.uniforms.get('uStrength')!
    hz.value = cine && !reduceMotion ? transient.haze * transient.m : 0
    haze.uniforms.get('uCenter')!.value.set(transient.blastU, transient.blastV)
    // DOF follows the car
    if (dof.current) {
      const d = dof.current as DepthOfFieldEffect & { __update?: DepthOfFieldEffect['update'] }
      // EffectPass calls update() on every effect every frame, so outside the cinematic the DOF's blur passes are
      // skipped and its output faded to 0 (opacity is a uniform: toggling it doesn't recompile the pass)
      d.__update ??= d.update.bind(d)
      const on = (cine && transient.dof > 0.001) || transient.warm > 0 // run during the shader warm-up so its passes compile behind the loader
      d.update = on ? d.__update : () => {}
      d.blendMode.opacity.value = on ? 1 : 0
      if (carRefs.car) carRefs.car.getWorldPosition(focus).setY(focus.y + 0.6)
      d.target = focus
      d.bokehScale = 1.3 * transient.dof
    }
    if (noise.current) noise.current.blendMode.opacity.value = cine ? 0.14 * transient.grain : 0
    if (vig.current) vig.current.darkness = 0.55 + (cine ? 0.3 * transient.vig : 0)
  })

  return (
    <EffectComposer multisampling={4}>
      {/* ambient occlusion: contact darkening under the car, in panel joints, wheel wells, engine bay */}
      <N8AO halfRes aoRadius={0.55} distanceFalloff={0.8} intensity={2.4} color="black" />
      <primitive object={haze} />
      {/* focusRange is in world units in postprocessing 6.3x: 4.5 m keeps the whole car sharp */}
      <DepthOfField ref={dof} focusRange={4.5} bokehScale={0} resolutionScale={0.5} />
      <Bloom mipmapBlur luminanceThreshold={1.6} luminanceSmoothing={0.3} intensity={0.85} />
      <ChromaticAberration ref={ca} offset={offset} radialModulation modulationOffset={0.25} blendFunction={BlendFunction.NORMAL} />
      <Noise ref={noise} premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0} />
      <Vignette ref={vig} offset={0.32} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
