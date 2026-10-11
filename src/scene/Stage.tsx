// Studio floor and the studio ↔ night-track crossfade (prototype 594–604, 656–667). The track itself is RaceTrack.tsx.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { THEMES, NIGHT, type ThemeName } from '@/config/theme'
import { LIVERIES } from '@/config/liveries'
import { useStore } from '@/state/store'
import { isCine } from '@/state/machine'
import { transient } from '@/state/transient'
import { lerp, ss } from '@/lib/math'
import { radialTex, svgTexture } from '@/three/textures'

export function Stage({ theme }: { theme: ThemeName }) {
  const { scene, gl } = useThree()
  const tokens = THEMES[theme]
  const livery = useStore(s => s.livery)

  const r = useMemo(() => {
    const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 })
    const discMat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.05, envMapIntensity: 0.45, transparent: true })
    const ringMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true })
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.25 })
    const emblemMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.3, 0.3, 0.3), transparent: true, roughness: 0.85, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
    const contactMat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: radialTex(), transparent: true, depthWrite: false })
    return { floorMat, discMat, ringMat, ring2Mat, emblemMat, contactMat }
  }, [gl])

  useEffect(() => () => {
    Object.values(r).forEach(v => (v as { dispose?: () => void }).dispose?.())
  }, [r])

  // brand emblem on the turntable disc (premium addition, after reference/images/floor.jpg)
  useEffect(() => {
    let live = true
    svgTexture('/brand/redbull-logo.svg', 2048).then(t => {
      if (!live) return t.dispose()
      r.emblemMat.map = t
      r.emblemMat.needsUpdate = true
    })
    return () => { live = false }
  }, [r])

  const themeBg = useMemo(() => new THREE.Color(tokens.scene), [tokens])
  const themeFloor = useMemo(() => new THREE.Color(tokens.floor), [tokens])
  const nightBg = useMemo(() => new THREE.Color(NIGHT.bg), [])
  const nightFloor = useMemo(() => new THREE.Color(NIGHT.floor), [])
  useEffect(() => {
    scene.background = themeBg.clone()
    scene.fog = new THREE.Fog(themeBg.clone(), 14, 40)
    r.discMat.color.set(tokens.disc)
    r.contactMat.opacity = tokens.shadow
  }, [scene, themeBg, tokens, r])
  useEffect(() => {
    r.ringMat.color.set(LIVERIES[livery].accent)
  }, [livery, r])

  const disc = useRef<THREE.Group>(null!)
  const contact = useRef<THREE.Mesh>(null!)

  useFrame(() => {
    const cine = isCine(useStore.getState().phase)
    const M = cine ? transient.m : 0, CX = cine ? transient.cx : 0
    // applyMix
    const bg = scene.background as THREE.Color
    bg.copy(themeBg).lerp(nightBg, M)
    const fog = scene.fog as THREE.Fog
    fog.color.copy(bg)
    // night: push the fog out so floodlit stands and the skyline stay visible
    fog.near = lerp(14, 40, M)
    fog.far = lerp(40, 210, M)
    r.floorMat.color.copy(themeFloor).lerp(nightFloor, M)
    // the studio environment reflections don't belong on a night street circuit
    scene.environmentIntensity = lerp(1, 0.28, M)
    r.discMat.opacity = 1 - M
    r.ringMat.opacity = 1 - M
    r.ring2Mat.opacity = 0.25 * (1 - M)
    r.emblemMat.opacity = tokens.emblem * (1 - M)
    disc.current.visible = M < 0.999

    const e = ss(0, 0.6, transient.explode)
    contact.current.position.x = CX
    contact.current.scale.set(1 - 0.25 * e, 1 - 0.25 * e, 1)

  })

  return (
    <>
      <mesh material={r.floorMat} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[70, 96]} />
      </mesh>
      <group ref={disc}>
        <mesh material={r.discMat} rotation-x={-Math.PI / 2} position-y={0.002} receiveShadow>
          <circleGeometry args={[3.9, 128]} />
        </mesh>
        <group rotation-y={0.78}>
          <mesh material={r.emblemMat} rotation-x={-Math.PI / 2} position-y={0.003} receiveShadow>
            <planeGeometry args={[5.8, 5.8]} />
          </mesh>
        </group>
        <mesh material={r.ringMat} rotation-x={-Math.PI / 2} position-y={0.004}>
          <ringGeometry args={[3.88, 3.92, 160]} />
        </mesh>
        <mesh material={r.ring2Mat} rotation-x={-Math.PI / 2} position-y={0.004}>
          <ringGeometry args={[3.6, 3.605, 160]} />
        </mesh>
      </group>
      <mesh ref={contact} material={r.contactMat} rotation-x={-Math.PI / 2} position-y={0.006}>
        <planeGeometry args={[6.6, 2.7]} />
      </mesh>

    </>
  )
}
