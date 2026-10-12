// Night street circuit for the launch sequence (realism pass over the prototype's posts + walls, lines 606–637).
// Everything near the track scrolls by transient.dist on a 300 m loop; the sky dome and skyline are static
// backdrops (a distant city has no visible parallax). All materials fade with the studio → track mix `m`.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useStore } from '@/state/store'
import { isCine } from '@/state/machine'
import { transient } from '@/state/transient'
import { NIGHT } from '@/config/theme'
import { asphaltTexture, adBoardTexture, bannerTexture, fenceTexture, skylineTexture, crowdTexture, glowTexture, asphaltRoughnessTexture } from '@/three/textures'

const L = 300 // scroll loop (m)
const wrap = (base: number, dist: number) => ((((base - dist) % L) + L) % L) - L / 2
const WALL_Z = 7.6
const GANTRY_STEP = 25
const STAND_LEN = 70, STAND_ROWS = 10, STAND_Z = 13
const STAND_BASES = [20, 120, 220]
const BRIDGE_BASE = 160

/** Night sky: horizon glow (city light pollution) fading to a deep zenith, sparse stars. */
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    fog: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uHorizon: { value: new THREE.Color(NIGHT.bg) }, uGlow: { value: new THREE.Color('#3a2a2a') }, uZenith: { value: new THREE.Color('#020308') } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float uOpacity; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uZenith; uniform float uTime; varying vec3 vDir;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        float h = vDir.y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
        col += uGlow * exp(-abs(h) * 14.0) * 0.8;
        if (h < 0.0) col = uHorizon * 0.6;
        vec3 cell = floor(vDir * 420.0);
        float star = step(0.9985, hash(cell)) * smoothstep(0.08, 0.4, h);
        // night clouds: drifting fbm layer, lit warm from below by the city, thinning toward the zenith
        vec2 cp = vDir.xz / max(h + 0.12, 0.05) * 1.6 + vec2(uTime * 0.01, uTime * 0.004);
        float cloud = smoothstep(0.48, 0.82, fbm(cp)) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.35, 0.8, h));
        vec3 cloudCol = mix(vec3(0.16, 0.11, 0.1), vec3(0.06, 0.07, 0.1), smoothstep(0.05, 0.4, h));
        col = mix(col, cloudCol, cloud * 0.85);
        col += vec3(star) * 0.6 * (1.0 - cloud);
        gl_FragColor = vec4(col, uOpacity);
        #include <colorspace_fragment>
      }`,
  })
}

export function RaceTrack() {
  const gl = useThree(s => s.gl)
  const reduceMotion = useStore(s => s.reduceMotion)
  const [ads, setAds] = useState<{ ad: THREE.Texture; banner: THREE.Texture } | null>(null)

  const r = useMemo(() => {
    const fade: THREE.Material[] = []
    const add = <T extends THREE.Material>(m: T, keepTransparent = false) => {
      m.transparent = true
      m.opacity = 0
      m.userData = { ...m.userData, keepTransparent }
      fade.push(m)
      return m
    }
    const asphalt = asphaltTexture(gl.capabilities.getMaxAnisotropy())
    const asphaltRough = asphaltRoughnessTexture()
    const crowdTex = crowdTexture(7)
    const glow = glowTexture()
    const fence = fenceTexture()
    const skyline = skylineTexture()
    const skylineNear = skylineTexture({ near: true })
    skylineNear.repeat.set(4, 1)
    const mats = {
      track: add(new THREE.MeshStandardMaterial({ map: asphalt, roughnessMap: asphaltRough, color: new THREE.Color(0.46, 0.46, 0.48), roughness: 0.95, envMapIntensity: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
      wall: add(new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a8f96'), roughness: 0.9 })),
      wallTop: add(new THREE.MeshBasicMaterial({ color: new THREE.Color('#c8102e'), toneMapped: false })),
      adL: add(new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.5 })),
      adR: add(new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.5 })),
      fenceL: add(new THREE.MeshStandardMaterial({ map: fence, userData: { opacityScale: 0.5 }, alphaTest: 0.05, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4, depthWrite: false }), true),
      fenceR: add(new THREE.MeshStandardMaterial({ map: fence.clone(), userData: { opacityScale: 0.5 }, alphaTest: 0.05, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4, depthWrite: false }), true),
      steel: add(new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a3f46'), roughness: 0.5, metalness: 0.7 })),
      lamp: add(new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e0').multiplyScalar(3), toneMapped: false })),
      concrete: add(new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a4f57'), roughness: 0.95 })),
      roof: add(new THREE.MeshStandardMaterial({ color: new THREE.Color('#22262c'), roughness: 0.7, metalness: 0.3 })),
      roofLight: add(new THREE.MeshBasicMaterial({ color: new THREE.Color('#dbe8ff').multiplyScalar(2.2), toneMapped: false })),
      crowd: add(new THREE.MeshStandardMaterial({ map: crowdTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, envMapIntensity: 0.3, emissive: new THREE.Color('#ffffff'), emissiveMap: crowdTex, emissiveIntensity: 0.18 }), true),
      pool: add(new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color('#ffe9c8').multiplyScalar(0.32), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), true),
      glare: add(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color('#fff2dc').multiplyScalar(0.9), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), true),
      band: add(new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.7 })),
      // stands on the −Z side are mirrored (group scale z = −1), so their bands use a U-flipped copy of the boards
      bandMirror: add(new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.7 })),
      banner: add(new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.8 })),
      skyline: add(new THREE.MeshBasicMaterial({ map: skyline, side: THREE.BackSide, fog: false, depthWrite: false }), true),
      skylineNear: add(new THREE.MeshBasicMaterial({ map: skylineNear, side: THREE.BackSide, fog: false, depthWrite: false }), true),
      streak: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    }
    const sky = skyMaterial()

    // grandstand: stepped concrete tiers + rear wall + pillars, merged
    const tiers: THREE.BufferGeometry[] = []
    for (let i = 0; i < STAND_ROWS; i++) {
      const h = 0.45 * (i + 1)
      tiers.push(new THREE.BoxGeometry(STAND_LEN, h, 0.85).translate(0, h / 2, STAND_Z + 0.425 + i * 0.85))
    }
    const backZ = STAND_Z + STAND_ROWS * 0.85
    tiers.push(new THREE.BoxGeometry(STAND_LEN, 7, 0.3).translate(0, 3.5, backZ + 0.15))
    for (let x = -STAND_LEN / 2 + 2; x <= STAND_LEN / 2 - 2; x += 11) tiers.push(new THREE.BoxGeometry(0.35, 7, 0.35).translate(x, 3.5, STAND_Z + 0.4))
    const standGeo = mergeGeometries(tiers)!
    tiers.forEach(g => g.dispose())

    // crowd: one strip of painted fans per tier riser, merged per stand; each row gets a random U offset so rows differ
    const rows: THREE.BufferGeometry[] = []
    for (let i = 0; i < STAND_ROWS; i++) {
      const g = new THREE.PlaneGeometry(STAND_LEN, 0.95)
      g.translate(0, 0.45 * (i + 1) + 0.47, STAND_Z + 0.55 + i * 0.85)
      const uv = g.attributes.uv as THREE.BufferAttribute, off = Math.random()
      for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * (STAND_LEN / 35) + off)
      rows.push(g)
    }
    const crowdGeo = mergeGeometries(rows)!
    rows.forEach(g => g.dispose())
    // camera flashes: points on the crowd, each with a random phase (shader below)
    const N = 260, fp = new Float32Array(N * 3), ph = new Float32Array(N)
    for (let k = 0; k < N; k++) {
      const row = (Math.random() * STAND_ROWS) | 0
      fp.set([(Math.random() - 0.5) * STAND_LEN, 0.45 * (row + 1) + 0.6, STAND_Z + 0.5 + row * 0.85], k * 3)
      ph[k] = Math.random() * 100
    }
    const flashGeo = new THREE.BufferGeometry()
    flashGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3))
    flashGeo.setAttribute('phase', new THREE.BufferAttribute(ph, 1))
    const flashMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: `attribute float phase; uniform float uTime; varying float vOn;
        void main(){ float t = fract(uTime * 0.37 + phase); vOn = smoothstep(0.985, 0.99, t) * (1.0 - smoothstep(0.995, 1.0, t));
          vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 220.0 / -mv.z; }`,
      fragmentShader: `uniform float uOpacity; varying float vOn;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.0, 0.5, d)) * vOn * uOpacity; gl_FragColor = vec4(vec3(1.4, 1.4, 1.5) * a, a); }`,
    })
    const streaks = Array.from({ length: 70 }, () => ({ y: 0.15 + Math.random() * 2.6, z: (Math.random() < 0.5 ? -1 : 1) * (1.3 + Math.random() * 5.5), base: Math.random() * 120 }))
    return { fade, mats, sky, asphalt, asphaltRough, glow, crowdTex, fence, standGeo, crowdGeo, flashGeo, flashMat, streaks }
  }, [gl])

  useEffect(() => {
    let live = true
    Promise.all([adBoardTexture(), bannerTexture()]).then(([ad, banner]) => {
      if (!live) return
      setAds({ ad, banner })
    })
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (!ads) return
    const adR = ads.ad.clone()
    adR.needsUpdate = true
    r.mats.adL.map = r.mats.adL.emissiveMap = ads.ad
    r.mats.adR.map = r.mats.adR.emissiveMap = adR
    r.mats.banner.map = r.mats.banner.emissiveMap = ads.banner
    // stand LED bands: 70 m of boards (texture tile = 25 m)
    const band = ads.ad.clone()
    band.repeat.set(STAND_LEN / 25, 1)
    band.needsUpdate = true
    r.mats.band.map = r.mats.band.emissiveMap = band
    const bandM = band.clone()
    bandM.repeat.set(-STAND_LEN / 25, 1)
    bandM.needsUpdate = true
    r.mats.bandMirror.map = r.mats.bandMirror.emissiveMap = bandM
    for (const m of [r.mats.adL, r.mats.adR, r.mats.banner, r.mats.band, r.mats.bandMirror]) m.needsUpdate = true
    return () => { ads.ad.dispose(); adR.dispose(); ads.banner.dispose(); band.dispose(); bandM.dispose() }
  }, [ads, r])

  useEffect(
    () => () => {
      r.fade.forEach(m => m.dispose())
      r.sky.dispose()
      r.mats.streak.dispose()
      r.asphalt.dispose()
      r.fence.dispose()
      r.standGeo.dispose()
      r.crowdGeo.dispose()
      r.flashGeo.dispose()
      r.flashMat.dispose()
      r.asphaltRough.dispose()
      r.glow.dispose()
      r.crowdTex.dispose()
    },
    [r],
  )

  const root = useRef<THREE.Group>(null!)
  const sky = useRef<THREE.Group>(null!)

  const stands = useRef<THREE.Group[]>([])
  const bridge = useRef<THREE.Group>(null!)
  const poles = useRef<THREE.InstancedMesh>(null!)
  const arms = useRef<THREE.InstancedMesh>(null!)
  const lamps = useRef<THREE.InstancedMesh>(null!)
  const pools = useRef<THREE.InstancedMesh>(null!)
  const glares = useRef<THREE.Sprite[]>([])
  const streakGroup = useRef<THREE.Group>(null!)
  const streakRefs = useRef<THREE.Mesh[]>([])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const gantries = useMemo(() => {
    const out: { base: number; side: 1 | -1 }[] = []
    for (const side of [1, -1] as const) for (let b = 0; b < L; b += GANTRY_STEP) out.push({ base: b + (side > 0 ? GANTRY_STEP / 2 : 0), side })
    return out
  }, [])

  useFrame(() => {
    const cine = isCine(useStore.getState().phase)
    const W = transient.warm
    const M = W ? W : cine ? transient.m : 0, S = W ? 1 : cine ? transient.s : 0, CX = cine ? transient.cx : 0, dist = transient.dist
    const on = M > 0.001
    root.current.visible = sky.current.visible = on
    if (!on) { streakGroup.current.visible = false; return }
    for (const m of r.fade) {
      m.opacity = M * (m.userData.opacityScale ?? 1)
      m.transparent = m.userData.keepTransparent || M < 0.999
    }
    r.sky.uniforms.uOpacity.value = M
    r.sky.uniforms.uTime.value += 0.016
    r.flashMat.uniforms.uTime.value += 0.016
    r.flashMat.uniforms.uOpacity.value = M

    // scrolling textures
    r.asphalt.offset.x = (dist / 8) % 1
    r.mats.fenceL.map!.offset.x = (dist / 4) % 1
    r.mats.fenceR.map!.offset.x = -(dist / 4) % 1
    if (r.mats.adL.map) r.mats.adL.map.offset.x = (dist / 25) % 1
    if (r.mats.adR.map) r.mats.adR.map.offset.x = -(dist / 25) % 1

    // floodlight gantries
    gantries.forEach((gz, i) => {
      const x = wrap(gz.base, dist)
      tmp.rotation.set(0, 0, 0)
      tmp.position.set(x, 5.5, gz.side * 9.4); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); poles.current.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x, 10.9, gz.side * 8.0); tmp.updateMatrix(); arms.current.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x, 10.6, gz.side * 6.9); tmp.rotation.set(gz.side * 0.5, 0, 0); tmp.updateMatrix(); lamps.current.setMatrixAt(i, tmp.matrix)
      // pool of light on the asphalt under the lamp, and a glare halo on the lamp head
      tmp.position.set(x, 0.012, gz.side * 4.2); tmp.rotation.set(-Math.PI / 2, 0, 0); tmp.scale.set(11, 8, 1); tmp.updateMatrix(); pools.current.setMatrixAt(i, tmp.matrix)
      tmp.scale.set(1, 1, 1)
      const halo = glares.current[i]
      if (halo) halo.position.set(x, 10.45, gz.side * 6.85)
    })
    poles.current.instanceMatrix.needsUpdate = arms.current.instanceMatrix.needsUpdate = lamps.current.instanceMatrix.needsUpdate = pools.current.instanceMatrix.needsUpdate = true

    stands.current.forEach((g, i) => { g.position.x = wrap(STAND_BASES[i % STAND_BASES.length] + (i >= STAND_BASES.length ? 50 : 0), dist) })
    bridge.current.position.x = wrap(BRIDGE_BASE, dist)

    const sv = S * M > 0.02 && !reduceMotion
    streakGroup.current.visible = sv
    if (sv) {
      r.mats.streak.opacity = 0.32 * S * M
      streakRefs.current.forEach((st, i) => { st.position.x = (((r.streaks[i].base - dist * 1.25) % 120) + 120) % 120 - 60 + CX })
    }
  })

  const m = r.mats
  return (
    <>
      {/* static backdrops */}
      <group ref={sky} visible={false}>
        <mesh material={r.sky} renderOrder={-2} frustumCulled={false}>
          <sphereGeometry args={[190, 48, 24]} />
        </mesh>
        <mesh material={m.skyline} position-y={28} renderOrder={-1} frustumCulled={false}>
          <cylinderGeometry args={[165, 165, 64, 96, 1, true]} />
        </mesh>
        <mesh material={m.skylineNear} position-y={17} rotation-y={0.9} renderOrder={-1} frustumCulled={false}>
          <cylinderGeometry args={[118, 118, 38, 96, 1, true]} />
        </mesh>
      </group>

      <group ref={root} visible={false}>
        {/* asphalt + run-off */}
        <mesh material={m.track} rotation-x={-Math.PI / 2} position-y={0.003} receiveShadow>
          <planeGeometry args={[L, 16]} />
        </mesh>
        {/* concrete barriers with LED ad boards + red cap, catch fence above */}
        {([-1, 1] as const).map(side => (
          <group key={side}>
            <mesh material={m.wall} position={[0, 0.45, side * WALL_Z]}>
              <boxGeometry args={[L, 0.9, 0.25]} />
            </mesh>
            <mesh material={m.wallTop} position={[0, 0.92, side * WALL_Z]}>
              <boxGeometry args={[L, 0.04, 0.26]} />
            </mesh>
            <mesh material={side < 0 ? m.adL : m.adR} position={[0, 0.46, side * (WALL_Z - 0.128)]} rotation-y={side < 0 ? 0 : Math.PI}>
              <planeGeometry args={[L, 0.85]} />
            </mesh>
            <mesh material={side < 0 ? m.fenceL : m.fenceR} position={[0, 0.94 + 1.65, side * (WALL_Z + 0.05)]} rotation-y={side < 0 ? 0 : Math.PI}>
              <planeGeometry args={[L, 3.3]} />
            </mesh>
          </group>
        ))}

        {/* floodlight gantries */}
        <instancedMesh ref={poles} args={[undefined, undefined, gantries.length]} material={m.steel} frustumCulled={false}>
          <boxGeometry args={[0.3, 11, 0.3]} />
        </instancedMesh>
        <instancedMesh ref={arms} args={[undefined, undefined, gantries.length]} material={m.steel} frustumCulled={false}>
          <boxGeometry args={[0.2, 0.2, 3.2]} />
        </instancedMesh>
        <instancedMesh ref={lamps} args={[undefined, undefined, gantries.length]} material={m.lamp} frustumCulled={false}>
          <boxGeometry args={[2.6, 0.18, 0.7]} />
        </instancedMesh>
        <instancedMesh ref={pools} args={[undefined, undefined, gantries.length]} material={m.pool} frustumCulled={false} renderOrder={1}>
          <planeGeometry args={[1, 1]} />
        </instancedMesh>
        {gantries.map((_, i) => (
          <sprite key={i} ref={el => { if (el) glares.current[i] = el }} material={m.glare} scale={[2.4, 1.3, 1]} />
        ))}

        {/* grandstands with crowd, both sides */}
        {[...STAND_BASES, ...STAND_BASES].map((_, i) => {
          const side = i < STAND_BASES.length ? 1 : -1
          return (
            <group key={i} ref={el => { if (el) stands.current[i] = el }}>
              <group scale={[1, 1, side]}>
                <mesh geometry={r.standGeo} material={m.concrete} />
                <mesh geometry={r.crowdGeo} material={m.crowd} />
                <points geometry={r.flashGeo} material={r.flashMat} frustumCulled={false} />
                {/* LED advertising band on the stand front and the roof fascia */}
                <mesh material={side > 0 ? m.band : m.bandMirror} position={[0, 0.23, STAND_Z - 0.01]} rotation-y={Math.PI}>
                  <planeGeometry args={[STAND_LEN, 0.42]} />
                </mesh>
                <mesh material={side > 0 ? m.band : m.bandMirror} position={[0, 7.05, STAND_Z - 0.62]} rotation-y={Math.PI}>
                  <planeGeometry args={[STAND_LEN + 2, 0.7]} />
                </mesh>
                <mesh material={m.roof} position={[0, 7.4, STAND_Z + 4.6]} rotation-x={-0.12}>
                  <boxGeometry args={[STAND_LEN + 2, 0.3, 10.5]} />
                </mesh>
                <mesh material={m.roofLight} position={[0, 7.0, STAND_Z + 0.2]}>
                  <boxGeometry args={[STAND_LEN, 0.08, 0.25]} />
                </mesh>
              </group>
            </group>
          )
        })}

        {/* overhead branded bridge */}
        <group ref={bridge}>
          {[-1, 1].map(s => (
            <mesh key={s} material={m.steel} position={[0, 3.6, s * 8.7]}>
              <boxGeometry args={[0.7, 7.2, 0.7]} />
            </mesh>
          ))}
          <mesh material={m.steel} position={[0, 7.0, 0]}>
            <boxGeometry args={[0.9, 1.7, 18.2]} />
          </mesh>
          {[-1, 1].map(s => (
            <mesh key={s} material={m.banner} position={[s * 0.46, 7.0, 0]} rotation-y={s * Math.PI / 2}>
              <planeGeometry args={[17.4, 1.5]} />
            </mesh>
          ))}
        </group>
      </group>

      <group ref={streakGroup} visible={false}>
        {r.streaks.map((s, i) => (
          <mesh key={i} ref={el => { if (el) streakRefs.current[i] = el }} material={m.streak} position={[0, s.y, s.z]}>
            <boxGeometry args={[3.2, 0.012, 0.012]} />
          </mesh>
        ))}
      </group>
    </>
  )
}
