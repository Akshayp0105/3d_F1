// Studio floor, race track and the studio ↔ night-track crossfade (prototype 594–637, 656–667, 924–931).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { THEMES, NIGHT, type ThemeName } from '@/config/theme'
import { LIVERIES } from '@/config/liveries'
import { useStore } from '@/state/store'
import { isCine } from '@/state/machine'
import { transient } from '@/state/transient'
import { lerp, ss } from '@/lib/math'
import { radialTex, svgTexture, trackTexture } from '@/three/textures'

export function Stage({ theme }: { theme: ThemeName }) {
  const { scene, gl } = useThree()
  const tokens = THEMES[theme]
  const livery = useStore(s => s.livery)
  const reduceMotion = useStore(s => s.reduceMotion)

  const r = useMemo(() => {
    const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 })
    const discMat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.05, envMapIntensity: 0.45, transparent: true })
    const ringMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true })
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.25 })
    const emblemMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.3, 0.3, 0.3), transparent: true, roughness: 0.85, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
    const contactMat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: radialTex(), transparent: true, depthWrite: false })
    const trackTex = trackTexture(gl.capabilities.getMaxAnisotropy())
    const trackMat = new THREE.MeshStandardMaterial({ map: trackTex, color: new THREE.Color(0.38, 0.38, 0.4), roughness: 0.82, metalness: 0, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    const postMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false })
    const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#15181c'), roughness: 0.7, transparent: true, opacity: 0 })
    const lineMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false })
    const streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    const postGeo = new THREE.BoxGeometry(0.07, 2.6, 0.07).translate(0, 1.3, 0)
    const streakGeo = new THREE.BoxGeometry(3.2, 0.012, 0.012)
    const posts: { z: number; base: number }[] = []
    for (const z of [7.2, -7.2]) for (let i = 0; i < 30; i++) posts.push({ z, base: i * 10 + (z > 0 ? 5 : 0) })
    const streaks = Array.from({ length: 70 }, () => ({
      y: 0.15 + Math.random() * 2.6,
      z: (Math.random() < 0.5 ? -1 : 1) * (1.3 + Math.random() * 5.5),
      base: Math.random() * 120,
    }))
    return { floorMat, discMat, ringMat, ring2Mat, emblemMat, contactMat, trackTex, trackMat, postMat, wallMat, lineMat, streakMat, postGeo, streakGeo, posts, streaks }
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
    r.lineMat.color.set(LIVERIES[livery].accent)
  }, [livery, r])

  const disc = useRef<THREE.Group>(null!)
  const contact = useRef<THREE.Mesh>(null!)
  const track = useRef<THREE.Group>(null!)
  const postRefs = useRef<THREE.Mesh[]>([])
  const streakGroup = useRef<THREE.Group>(null!)
  const streakRefs = useRef<THREE.Mesh[]>([])

  useFrame(() => {
    const cine = isCine(useStore.getState().phase)
    const M = cine ? transient.m : 0, S = cine ? transient.s : 0, CX = cine ? transient.cx : 0
    // applyMix
    const bg = scene.background as THREE.Color
    bg.copy(themeBg).lerp(nightBg, M)
    const fog = scene.fog as THREE.Fog
    fog.color.copy(bg)
    fog.near = lerp(14, 24, M)
    fog.far = lerp(40, 140, M)
    r.floorMat.color.copy(themeFloor).lerp(nightFloor, M)
    r.discMat.opacity = 1 - M
    r.ringMat.opacity = 1 - M
    r.ring2Mat.opacity = 0.25 * (1 - M)
    r.emblemMat.opacity = tokens.emblem * (1 - M)
    disc.current.visible = M < 0.999
    r.trackMat.opacity = r.postMat.opacity = r.wallMat.opacity = r.lineMat.opacity = M
    track.current.visible = M > 0.001

    const e = ss(0, 0.6, transient.explode)
    contact.current.position.x = CX
    contact.current.scale.set(1 - 0.25 * e, 1 - 0.25 * e, 1)

    if (M > 0) {
      r.trackTex.offset.x = (transient.dist / 8) % 1
      postRefs.current.forEach((p, i) => { p.position.x = (((r.posts[i].base - transient.dist) % 300) + 300) % 300 - 150 })
      const sv = S * M > 0.02 && !reduceMotion
      streakGroup.current.visible = sv
      if (sv) {
        r.streakMat.opacity = 0.32 * S * M
        streakRefs.current.forEach((st, i) => { st.position.x = (((r.streaks[i].base - transient.dist * 1.25) % 120) + 120) % 120 - 60 + CX })
      }
    } else streakGroup.current.visible = false
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

      <group ref={track} visible={false}>
        <mesh material={r.trackMat} rotation-x={-Math.PI / 2} position-y={0.003} receiveShadow>
          <planeGeometry args={[300, 16]} />
        </mesh>
        {r.posts.map((p, i) => (
          <mesh key={i} ref={el => { if (el) postRefs.current[i] = el }} geometry={r.postGeo} material={r.postMat} position-z={p.z} />
        ))}
        {[7.6, -7.6].map(z => (
          <group key={z}>
            <mesh material={r.wallMat} position={[0, 0.45, z]}>
              <boxGeometry args={[300, 0.9, 0.25]} />
            </mesh>
            <mesh material={r.lineMat} position={[0, 0.92, z]}>
              <boxGeometry args={[300, 0.04, 0.26]} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={streakGroup} visible={false}>
        {r.streaks.map((s, i) => (
          <mesh key={i} ref={el => { if (el) streakRefs.current[i] = el }} geometry={r.streakGeo} material={r.streakMat} position={[0, s.y, s.z]} />
        ))}
      </group>
    </>
  )
}
