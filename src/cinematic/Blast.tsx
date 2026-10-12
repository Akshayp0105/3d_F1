// The explosion on the track behind the car (Phase 4B). Everything here is driven by transient.blastAge, the blast's
// own clock in *scaled* seconds (it slows down with the slow-motion time scale), and anchored to the scrolling track at
// transient.blastX. Parts: raymarched fireball + smoke volume, smoke-column sprites, outward dust, instanced debris
// with ballistic arcs and spin, 300+ sparks with gravity, a ground shockwave ring, lingering ground fire, a scorch
// mark, and a strong flickering orange light (always in the scene; only its intensity changes, see CLAUDE.md).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { transient } from '@/state/transient'
import { LIVERIES } from '@/config/liveries'
import { useStore } from '@/state/store'
import { createFireballMaterial, FB_HALF } from './fireball'

const N_SPARK = 340, N_DEBRIS = 64, N_SMOKE = 46, N_DUST = 36, N_FLAME = 14
const G = 9.81

/** seeded PRNG so every launch looks the same (matches "reference timing", easier to art-direct) */
function prng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/** Soft, noisy smoke puff (alpha) */
function puffTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const rnd = prng(11)
  for (let i = 0; i < 26; i++) {
    const x = 64 + (rnd() - 0.5) * 50, y = 64 + (rnd() - 0.5) * 50, r = 18 + rnd() * 26
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, `rgba(255,255,255,${0.28 + rnd() * 0.2})`)
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 128, 128)
  }
  // fade the square's edges
  const id = g.getImageData(0, 0, 128, 128)
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const d = Math.hypot(x - 64, y - 64) / 64
      id.data[(y * 128 + x) * 4 + 3] *= Math.max(0, 1 - d * d)
    }
  g.putImageData(id, 0, 0)
  return new THREE.CanvasTexture(c)
}

/** Charred scorch mark (dark centre, ragged edge, soot streaks) */
function scorchTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const rnd = prng(5)
  const gr = g.createRadialGradient(256, 256, 0, 256, 256, 250)
  gr.addColorStop(0, 'rgba(0,0,0,0.95)')
  gr.addColorStop(0.45, 'rgba(8,6,5,0.8)')
  gr.addColorStop(1, 'rgba(10,8,6,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 512, 512)
  g.strokeStyle = 'rgba(0,0,0,0.35)'
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2, r0 = 60 + rnd() * 60, r1 = 160 + rnd() * 90
    g.lineWidth = 2 + rnd() * 8
    g.beginPath(); g.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0); g.lineTo(256 + Math.cos(a) * r1, 256 + Math.sin(a) * r1); g.stroke()
  }
  return new THREE.CanvasTexture(c)
}

/** Camera-facing instanced sprites (smoke, dust): per-instance pos, size, rotation, alpha, heat. */
function spriteMaterial(tex: THREE.Texture, base: THREE.Color, lit: THREE.Color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTex: { value: tex }, uBase: { value: base }, uLit: { value: lit }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 iPos; attribute vec4 iData; // size, rot, alpha, heat
      varying vec2 vUv; varying float vA; varying float vHeat;
      void main(){
        vUv = uv; vA = iData.z; vHeat = iData.w;
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
        float c = cos(iData.y), s = sin(iData.y);
        vec2 p = mat2(c, -s, s, c) * position.xy * iData.x;
        mv.xy += p;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; uniform vec3 uBase; uniform vec3 uLit; uniform float uOpacity;
      varying vec2 vUv; varying float vA; varying float vHeat;
      void main(){
        float a = texture2D(uTex, vUv).a * vA * uOpacity;
        if (a < 0.003) discard;
        // lit from inside (lower half brighter) while hot
        vec3 col = uBase + uLit * vHeat * (1.2 - vUv.y);
        gl_FragColor = vec4(col, a);
      }`,
  })
}

/** Ground fire: Y-axis billboards with a procedural flame (scrolling fbm, teardrop mask), HDR, additive. */
function flameMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 iPos; attribute vec3 iData; // width, height, seed
      varying vec2 vUv; varying float vSeed;
      void main(){
        vUv = uv; vSeed = iData.z;
        vec3 wp = (modelMatrix * vec4(iPos, 1.0)).xyz;
        vec3 d = cameraPosition - wp; d.y = 0.0; d = normalize(d);
        vec3 right = vec3(d.z, 0.0, -d.x);
        wp += right * position.x * iData.x + vec3(0.0, 1.0, 0.0) * (position.y + 0.5) * iData.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uOpacity; varying vec2 vUv; varying float vSeed;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++){ v += a*n(p); p *= 2.1; a *= 0.5; } return v; }
      void main(){
        vec2 uv = vUv;
        // licking flame: turbulence rising faster than the base, tongues breaking off toward the top
        float f = fbm(vec2(uv.x * 4.0 + vSeed, uv.y * 3.0 - uTime * 3.2 + vSeed * 3.0));
        float g = fbm(vec2(uv.x * 9.0 - vSeed, uv.y * 6.0 - uTime * 5.0));
        float x = (uv.x - 0.5) + (f - 0.5) * 0.35 * uv.y;
        float shape = 1.0 - smoothstep(0.08, 0.5, abs(x) * (1.6 + uv.y * 2.6));
        float heat = shape * pow(1.0 - uv.y, 0.7) * (0.45 + 0.9 * f) + (g - 0.5) * 0.25 - uv.y * 0.35;
        float a = smoothstep(0.12, 0.45, heat);
        vec3 c = mix(vec3(0.5, 0.04, 0.0) * 1.2, vec3(1.0, 0.36, 0.04) * 2.4, smoothstep(0.2, 0.55, heat));
        c = mix(c, vec3(1.0, 0.72, 0.35) * 3.4, smoothstep(0.6, 0.9, heat));
        gl_FragColor = vec4(c * a * uOpacity, 1.0);
      }`,
  })
}

/** Points with per-particle life → HDR white-hot → orange → red, additive. */
function sparkMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aLife; varying float vLife;
      void main(){ vLife = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (aLife > 0.0 ? (14.0 + 26.0 * aLife) : 0.0) / -mv.z; }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying float vLife;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.1, 0.5, d)) * smoothstep(0.0, 0.15, vLife);
        vec3 c = mix(vec3(3.0, 0.5, 0.08), vec3(9.0, 6.5, 3.5), smoothstep(0.4, 0.95, vLife));
        gl_FragColor = vec4(c * a * uOpacity, a * uOpacity); }`,
  })
}

/** Expanding ground shockwave ring. */
function ringMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uR: { value: 0 }, uA: { value: 0 }, uColor: { value: new THREE.Color(0.75, 0.5, 0.32) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uR; uniform float uA; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float r = length(vUv - 0.5) * 2.0; float w = 0.06 + 0.1 * uR;
        float ring = smoothstep(w, 0.0, abs(r - uR)) * smoothstep(1.0, 0.85, r);
        float inner = 0.0;
        gl_FragColor = vec4(uColor * (ring + inner) * uA, 1.0); }`,
  })
}

export function Blast() {
  const camera = useThree(s => s.camera)
  const r = useMemo(() => {
    const rnd = prng(42)
    const puff = puffTexture()
    const scorch = scorchTexture()
    const fireball = createFireballMaterial()
    const smokeMat = spriteMaterial(puff, new THREE.Color(0.018, 0.016, 0.015), new THREE.Color(1.6, 0.55, 0.12))
    const dustMat = spriteMaterial(puff, new THREE.Color(0.2, 0.17, 0.13), new THREE.Color(0.6, 0.3, 0.1))
    const flameMat = flameMaterial()
    const sparkMat = sparkMaterial()
    const ringMat = ringMaterial()
    const scorchMat = new THREE.MeshBasicMaterial({ map: scorch, transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2 })
    scorchMat.alphaMap = scorch
    const debrisMat = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.6, metalness: 0.4, emissive: new THREE.Color('#ff5a14'), emissiveIntensity: 0 })

    // instanced sprite geometry helper
    const spriteGeo = (n: number) => {
      const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1) as unknown as THREE.InstancedBufferGeometry)
      g.instanceCount = n
      g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3))
      g.setAttribute('iData', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4))
      return g
    }
    const smokeGeo = spriteGeo(N_SMOKE), dustGeo = spriteGeo(N_DUST)
    const flameGeo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1) as unknown as THREE.InstancedBufferGeometry)
    flameGeo.instanceCount = N_FLAME
    const fpos = new Float32Array(N_FLAME * 3), fdat = new Float32Array(N_FLAME * 3)
    for (let i = 0; i < N_FLAME; i++) {
      const a = rnd() * Math.PI * 2, d = 1.2 + rnd() * 4.5
      fpos.set([Math.cos(a) * d, 0, Math.sin(a) * d * 0.8], i * 3)
      fdat.set([0.9 + rnd() * 1.2, 1.2 + rnd() * 2.2, rnd() * 10], i * 3)
    }
    flameGeo.setAttribute('iPos', new THREE.InstancedBufferAttribute(fpos, 3))
    flameGeo.setAttribute('iData', new THREE.InstancedBufferAttribute(fdat, 3))

    const sparkGeo = new THREE.BufferGeometry()
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_SPARK * 3), 3))
    sparkGeo.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(N_SPARK), 1))

    // particle seeds (velocities, lifetimes, spawn delays) — deterministic
    const sparks = Array.from({ length: N_SPARK }, () => {
      const a = rnd() * Math.PI * 2, el = 0.15 + rnd() * 1.25, sp = 9 + rnd() * 30
      return { v: new THREE.Vector3(Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp, Math.sin(a) * Math.cos(el) * sp), life: 0.7 + rnd() * 1.8, delay: rnd() * 0.25 }
    })
    const debris = Array.from({ length: N_DEBRIS }, () => {
      const a = rnd() * Math.PI * 2, el = 0.35 + rnd() * 1.0, sp = 7 + rnd() * 17
      return {
        v: new THREE.Vector3(Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp, Math.sin(a) * Math.cos(el) * sp),
        spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(18),
        size: new THREE.Vector3(0.05 + rnd() * 0.18, 0.02 + rnd() * 0.05, 0.04 + rnd() * 0.14),
      }
    })
    const smoke = Array.from({ length: N_SMOKE }, () => ({
      delay: rnd() * 1.3, a: rnd() * Math.PI * 2, out: 0.6 + rnd() * 2.4, up: 1.6 + rnd() * 3.2, s0: 1.6 + rnd() * 1.6, s1: 5 + rnd() * 5, rot: rnd() * 6, spin: (rnd() - 0.5) * 0.4, y0: 1 + rnd() * 3,
    }))
    const dust = Array.from({ length: N_DUST }, () => ({ a: rnd() * Math.PI * 2, sp: 9 + rnd() * 9, y: 0.3 + rnd() * 1.0, s1: 3 + rnd() * 4, rot: rnd() * 6 }))
    return { puff, scorch, fireball, smokeMat, dustMat, flameMat, sparkMat, ringMat, scorchMat, debrisMat, smokeGeo, dustGeo, flameGeo, sparkGeo, sparks, debris, smoke, dust }
  }, [])

  useEffect(
    () => () => {
      Object.values(r).forEach(v => (v as { dispose?: () => void })?.dispose?.())
    },
    [r],
  )

  const root = useRef<THREE.Group>(null!)
  const box = useRef<THREE.Mesh>(null!)
  const debrisMesh = useRef<THREE.InstancedMesh>(null!)
  const ring = useRef<THREE.Mesh>(null!)
  const light = useRef<THREE.PointLight>(null!)
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), v: new THREE.Vector3(), m: new THREE.Matrix4() }), [])

  useFrame(({ clock }) => {
    const warm = transient.warm > 0
    const a = warm ? 0.6 : transient.blastAge
    const on = a >= 0
    const fade = warm ? 1 : transient.m
    root.current.visible = on && fade > 0.001
    if (!root.current.visible) { light.current.intensity = 0; return }
    root.current.position.set(warm ? -6 : transient.blastX, 0, 0.3)
    root.current.updateMatrixWorld()
    const q = transient.quality

    // --- fireball volume ---
    const fb = r.fireball.uniforms
    fb.uAge.value = a
    fb.uSteps.value = Math.round(24 + 22 * q)
    fb.uOpacity.value = fade * Math.min(1, a * 25)
    tmp.m.copy(box.current.matrixWorld).invert()
    fb.uCamObj.value.copy(camera.position).applyMatrix4(tmp.m)

    // --- light: flash peak, decays to the lingering ground fire, flickers ---
    const flick = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 37) * Math.sin(clock.elapsedTime * 23 + 1)
    light.current.intensity = fade * (900 * Math.exp(-a * 3.0) * Math.min(1, a * 30) + 110 * Math.exp(-a * 0.25)) * flick
    light.current.position.set(root.current.position.x, 2.4 + Math.min(a, 2) * 1.2, 0.3)

    // --- sparks ---
    const sp = r.sparkGeo.attributes.position as THREE.BufferAttribute, life = r.sparkGeo.attributes.aLife as THREE.BufferAttribute
    const nSpark = Math.round(N_SPARK * (0.5 + 0.5 * q))
    for (let i = 0; i < N_SPARK; i++) {
      const s = r.sparks[i], t = a - s.delay
      if (t < 0 || i >= nSpark || t > s.life) { life.setX(i, 0); continue }
      const drag = Math.exp(-t * 0.6)
      const k = (1 - drag) / 0.6
      let y = 1.2 + s.v.y * k - 0.5 * G * t * t
      if (y < 0.02) y = 0.02 + Math.abs(y) * 0.15
      sp.setXYZ(i, s.v.x * k, y, s.v.z * k)
      life.setX(i, 1 - t / s.life)
    }
    sp.needsUpdate = life.needsUpdate = true
    r.sparkMat.uniforms.uOpacity.value = fade

    // --- debris ---
    const nDeb = Math.round(N_DEBRIS * (0.5 + 0.5 * q))
    debrisMesh.current.count = nDeb
    for (let i = 0; i < nDeb; i++) {
      const d = r.debris[i]
      // flight until it hits the ground, then it slides to a stop
      const tHit = (d.v.y + Math.sqrt(d.v.y * d.v.y + 2 * G * 1.0)) / G
      const t = Math.min(a, tHit), slide = Math.max(0, a - tHit)
      const y = Math.max(0.03, 1.0 + d.v.y * t - 0.5 * G * t * t)
      const sl = (1 - Math.exp(-slide * 3)) * 0.35
      tmp.o.position.set(d.v.x * (t + sl), y, d.v.z * (t + sl))
      const spinT = t + (1 - Math.exp(-slide * 4)) * 0.2
      tmp.o.rotation.set(d.spin.x * spinT, d.spin.y * spinT, d.spin.z * spinT)
      tmp.o.scale.copy(d.size)
      tmp.o.updateMatrix()
      debrisMesh.current.setMatrixAt(i, tmp.o.matrix)
    }
    debrisMesh.current.instanceMatrix.needsUpdate = true
    // charred chunks; only a faint ember glow that dies quickly
    r.debrisMat.emissiveIntensity = 0.6 * Math.exp(-a * 2.5)
    r.debrisMat.opacity = fade
    r.debrisMat.transparent = true

    // --- smoke column sprites ---
    const smP = r.smokeGeo.attributes.iPos as THREE.InstancedBufferAttribute, smD = r.smokeGeo.attributes.iData as THREE.InstancedBufferAttribute
    r.smokeGeo.instanceCount = Math.round(N_SMOKE * (0.5 + 0.5 * q))
    for (let i = 0; i < N_SMOKE; i++) {
      const s = r.smoke[i], t = a - s.delay
      if (t < 0) { smD.setXYZW(i, 0, 0, 0, 0); continue }
      const out = s.out * (1 - Math.exp(-t * 0.8)) * 2
      smP.setXYZ(i, Math.cos(s.a) * out, s.y0 + s.up * t * (1 - 0.06 * t), Math.sin(s.a) * out)
      const size = s.s0 + (s.s1 - s.s0) * (1 - Math.exp(-t * 0.6))
      const alpha = Math.min(1, t * 2.5) * Math.exp(-t * 0.16) * 0.85
      smD.setXYZW(i, size, s.rot + s.spin * t, alpha, Math.exp(-t * 1.4) * 1.2)
    }
    smP.needsUpdate = smD.needsUpdate = true
    r.smokeMat.uniforms.uOpacity.value = fade

    // --- dust thrown outward along the ground ---
    const duP = r.dustGeo.attributes.iPos as THREE.InstancedBufferAttribute, duD = r.dustGeo.attributes.iData as THREE.InstancedBufferAttribute
    for (let i = 0; i < N_DUST; i++) {
      const d = r.dust[i]
      const dist = (d.sp / 1.4) * (1 - Math.exp(-a * 1.4))
      duP.setXYZ(i, Math.cos(d.a) * dist, d.y + a * 0.3, Math.sin(d.a) * dist)
      duD.setXYZW(i, 1.2 + d.s1 * (1 - Math.exp(-a * 1.2)), d.rot + a * 0.2, Math.min(1, a * 6) * Math.exp(-a * 0.55) * 0.32, Math.exp(-a * 2) * 0.25)
    }
    duP.needsUpdate = duD.needsUpdate = true
    r.dustMat.uniforms.uOpacity.value = fade

    // --- shockwave ring (fast), ground fire (lingers), scorch ---
    const ra = Math.min(1, a / 0.7)
    r.ringMat.uniforms.uR.value = 1 - Math.pow(1 - ra, 2)
    r.ringMat.uniforms.uA.value = fade * (1 - ra) * Math.min(1, a * 40)
    ring.current.visible = a < 0.7
    r.flameMat.uniforms.uTime.value = clock.elapsedTime * Math.max(transient.ts, 0.35)
    r.flameMat.uniforms.uOpacity.value = fade * Math.min(1, Math.max(0, (a - 0.3) * 3)) * (0.45 + 0.55 * Math.exp(-a * 0.3))
    r.scorchMat.opacity = fade * Math.min(0.9, a * 4)
  })

  return (
    <>
    {/* outside the toggled group: three only counts *visible* lights, and a changing light count recompiles every shader */}
    <pointLight ref={light} color="#ff7a2a" intensity={0} distance={70} decay={2} />
    <group ref={root} visible={false}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} material={r.scorchMat} renderOrder={1}>
        <planeGeometry args={[11, 11]} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.05} material={r.ringMat} renderOrder={2}>
        <planeGeometry args={[40, 40]} />
      </mesh>
      <instancedMesh ref={debrisMesh} args={[undefined, r.debrisMat, N_DEBRIS]} frustumCulled={false} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <mesh geometry={r.dustGeo} material={r.dustMat} frustumCulled={false} renderOrder={3} />
      <mesh ref={box} position-y={FB_HALF} scale={FB_HALF * 2} material={r.fireball} frustumCulled={false} renderOrder={4}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh geometry={r.smokeGeo} material={r.smokeMat} frustumCulled={false} renderOrder={5} />
      <mesh geometry={r.flameGeo} material={r.flameMat} frustumCulled={false} renderOrder={6} />
      <points geometry={r.sparkGeo} material={r.sparkMat} frustumCulled={false} renderOrder={7} />
    </group>
    </>
  )
}

/** Touchdown on the platform: a ring of dust rolling outward and an accent-coloured shockwave across the floor.
 *  Driven by transient.landAge (real seconds since touchdown). */
export function Landing() {
  const livery = useStore(s => s.livery)
  const r = useMemo(() => {
    const rnd = prng(77)
    const puff = puffTexture()
    const dustMat = spriteMaterial(puff, new THREE.Color(0.32, 0.31, 0.3), new THREE.Color(0, 0, 0))
    const ringMat = ringMaterial()
    const N = 40
    const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1) as unknown as THREE.InstancedBufferGeometry)
    geo.instanceCount = N
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3))
    geo.setAttribute('iData', new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4))
    const seeds = Array.from({ length: N }, (_, i) => ({ a: (i / N) * Math.PI * 2 + rnd() * 0.2, sp: 3.5 + rnd() * 2.5, s1: 1.2 + rnd() * 1.4, rot: rnd() * 6 }))
    return { puff, dustMat, ringMat, geo, seeds, N }
  }, [])
  useEffect(() => () => { r.puff.dispose(); r.dustMat.dispose(); r.ringMat.dispose(); r.geo.dispose() }, [r])
  useEffect(() => { r.ringMat.uniforms.uColor.value.set(LIVERIES[livery].accent).multiplyScalar(2.2) }, [r, livery])

  const root = useRef<THREE.Group>(null!)
  useFrame(() => {
    const a = transient.warm > 0 ? 0.3 : transient.landAge
    root.current.visible = a >= 0 && a < 3
    if (!root.current.visible) return
    const P = r.geo.attributes.iPos as THREE.InstancedBufferAttribute, D = r.geo.attributes.iData as THREE.InstancedBufferAttribute
    for (let i = 0; i < r.N; i++) {
      const s = r.seeds[i]
      // starts at the car's footprint (≈2.6 m) and rolls outward, slowing down
      const d = 2.4 + (s.sp / 1.8) * (1 - Math.exp(-a * 1.8))
      P.setXYZ(i, Math.cos(s.a) * d, 0.25 + a * 0.15, Math.sin(s.a) * d * 0.7)
      D.setXYZW(i, 0.6 + s.s1 * (1 - Math.exp(-a * 1.5)), s.rot + a * 0.3, Math.min(1, a * 8) * Math.exp(-a * 1.3) * 0.55, 0)
    }
    P.needsUpdate = D.needsUpdate = true
    const ra = Math.min(1, a / 0.9)
    r.ringMat.uniforms.uR.value = 1 - Math.pow(1 - ra, 2.4)
    r.ringMat.uniforms.uA.value = (1 - ra) * Math.min(1, a * 30)
  })
  return (
    <group ref={root} visible={false}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.008} material={r.ringMat} renderOrder={2}>
        <planeGeometry args={[9, 9]} />
      </mesh>
      <mesh geometry={r.geo} material={r.dustMat} frustumCulled={false} renderOrder={3} />
    </group>
  )
}
