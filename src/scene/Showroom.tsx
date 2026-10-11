// Studio set dressing (realism pass): reflective turntable floor, cyclorama wall, curved LED walls with team
// graphics, vertical light strips, an overhead truss with softboxes and a volumetric spotlight over the car.
// Everything fades out with the studio → track mix `m` (same rule as Stage/RaceTrack).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial, SpotLight } from '@react-three/drei'
import * as THREE from 'three'
import { THEMES, type ThemeName } from '@/config/theme'
import { useStore } from '@/state/store'
import { isCine } from '@/state/machine'
import { transient } from '@/state/transient'

const WALL_R = 17
/** LED wall azimuths: behind the car from the default three-quarter view, and opposite */
const LED_AZ = [Math.PI + 0.78, 0.78]

/** Team LED-wall graphic: navy gradient, pixel grid, Red Bull logo, wordmark. */
async function ledTexture() {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 512
  const g = c.getContext('2d')!
  const bg = g.createLinearGradient(0, 0, 0, 512)
  bg.addColorStop(0, '#070b1c')
  bg.addColorStop(0.5, '#101a3e')
  bg.addColorStop(1, '#070b1c')
  g.fillStyle = bg
  g.fillRect(0, 0, 2048, 512)
  // diagonal livery sweep
  g.fillStyle = 'rgba(216,16,43,0.55)'
  g.beginPath(); g.moveTo(0, 430); g.lineTo(2048, 300); g.lineTo(2048, 318); g.lineTo(0, 448); g.fill()
  g.fillStyle = 'rgba(255,201,6,0.45)'
  g.beginPath(); g.moveTo(0, 456); g.lineTo(2048, 326); g.lineTo(2048, 334); g.lineTo(0, 464); g.fill()
  const logo = await new Promise<HTMLImageElement | null>(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = '/brand/redbull-logo.svg' })
  if (logo) g.drawImage(logo, 1024 - 260, -40, 520, 520)
  g.font = 'italic 800 92px "Barlow Condensed","Arial Narrow",sans-serif'
  g.textBaseline = 'middle'
  g.fillStyle = '#ffffff'
  g.textAlign = 'right'
  g.fillText('ORACLE RED BULL', 730, 250)
  g.textAlign = 'left'
  g.fillText('RACING', 1318, 250)
  // LED pixel grid
  g.fillStyle = 'rgba(0,0,0,0.35)'
  for (let x = 0; x < 2048; x += 4) g.fillRect(x, 0, 1, 512)
  for (let y = 0; y < 512; y += 4) g.fillRect(0, y, 2048, 1)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  // seen from inside the cylinder (BackSide), so mirror U to read correctly
  t.wrapS = THREE.RepeatWrapping
  t.repeat.x = -1
  return t
}

/** Cyclorama: vertical gradient, darker toward the top, faint horizon band. */
function cycloMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uOpacity: { value: 1 }, uLow: { value: new THREE.Color('#1a1e25') }, uHigh: { value: new THREE.Color('#05070a') } }]),
    vertexShader: `
      varying float vH;
      #include <fog_pars_vertex>
      void main(){
        vH = position.y;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uOpacity; uniform vec3 uLow; uniform vec3 uHigh; varying float vH;
      #include <fog_pars_fragment>
      void main(){
        float t = smoothstep(0.0, 9.0, vH);
        vec3 col = mix(uLow, uHigh, t);
        col += vec3(0.05, 0.06, 0.08) * exp(-pow((vH - 1.2) * 1.6, 2.0));
        gl_FragColor = vec4(col, uOpacity);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  })
}

export function Showroom({ theme }: { theme: ThemeName }) {
  const tokens = THEMES[theme]
  const [led, setLed] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let live = true
    ledTexture().then(t => (live ? setLed(t) : t.dispose()))
    return () => { live = false }
  }, [])
  useEffect(() => () => led?.dispose(), [led])

  const r = useMemo(() => {
    const fade: THREE.Material[] = []
    const add = <T extends THREE.Material>(m: T) => { m.transparent = true; fade.push(m); return m }
    return {
      fade,
      cyclo: cycloMaterial(),
      strip: add(new THREE.MeshBasicMaterial({ color: new THREE.Color('#dfe8ff').multiplyScalar(1.15), toneMapped: false })),
      truss: add(new THREE.MeshStandardMaterial({ color: '#1b1e23', metalness: 0.8, roughness: 0.45 })),
      softbox: add(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.2), toneMapped: false, side: THREE.DoubleSide })),
      led: add(new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.BackSide })),
      ledFrame: add(new THREE.MeshStandardMaterial({ color: '#0c0e12', metalness: 0.6, roughness: 0.5 })),
    }
  }, [])
  useEffect(() => { r.led.map = led; r.led.color.setScalar(led ? 1.15 : 0); r.led.needsUpdate = true }, [led, r])
  useEffect(() => () => { r.fade.forEach(m => m.dispose()); r.cyclo.dispose() }, [r])

  const root = useRef<THREE.Group>(null!)
  const floor = useRef<THREE.Material>(null!)
  const spot = useRef<THREE.SpotLight>(null!)
  // drei's reflector re-renders the whole scene every frame even when hidden, so it is only mounted outside the
  // launch sequence (otherwise the race track + crowd would be drawn twice per frame)
  const [reflect, setReflect] = useState(true)
  useFrame(() => {
    const M = transient.warm ? transient.warm : isCine(useStore.getState().phase) ? transient.m : 0
    root.current.visible = M < 0.999
    const want = !isCine(useStore.getState().phase)
    if (want !== reflect) setReflect(want)
    r.cyclo.uniforms.uOpacity.value = 1 - M
    for (const m of r.fade) m.opacity = 1 - M
    if (floor.current) { floor.current.transparent = M > 0; floor.current.opacity = 1 - M }
    // fade, never hide: removing a light changes the light count and recompiles every shader (a multi-second
    // stall on Windows/ANGLE). The volumetric cone mesh is a child of the light.
    const k = Math.max(0, 1 - M * 2.5)
    spot.current.intensity = 18 * k
    spot.current.traverse(o => { const mat = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined; if (mat?.uniforms?.opacity) mat.uniforms.opacity.value = 0.14 * k })
  })

  // light strips between the LED walls (none behind them)
  const strips = useMemo(() => Array.from({ length: 20 }, (_, i) => (i / 20) * Math.PI * 2 + 0.16).filter(a => LED_AZ.every(az => Math.abs(Math.atan2(Math.sin(a + az - Math.PI / 2 - Math.PI / 2), Math.cos(a + az - Math.PI))) > 0.55)), [])
  return (
    <group ref={root}>
      {/* reflective turntable (sits just above Stage's matte disc, under the emblem) */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.0025} receiveShadow visible={reflect}>
        <circleGeometry args={[3.88, 128]} />
        {reflect && <MeshReflectorMaterial
          ref={floor as React.RefObject<never>}
          color={tokens.disc}
          resolution={512}
          blur={[300, 100]}
          mixBlur={1.2}
          mixStrength={2.2}
          mixContrast={1.1}
          depthScale={1.1}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.3}
          roughness={0.82}
          metalness={0.35}
          mirror={0.55}
        />}
      </mesh>

      {/* cyclorama wall */}
      <mesh material={r.cyclo} position-y={5}>
        <cylinderGeometry args={[WALL_R, WALL_R, 10, 96, 1, true]} />
      </mesh>

      {/* vertical light strips on the wall */}
      {strips.map((a, i) => (
        <mesh key={i} material={r.strip} position={[Math.cos(a) * (WALL_R - 0.05), 3.1, Math.sin(a) * (WALL_R - 0.05)]} rotation-y={-a}>
          <boxGeometry args={[0.035, 4.2, 0.1]} />
        </mesh>
      ))}

      {/* curved LED walls */}
      {LED_AZ.map((az, i) => (
        <group key={i} rotation-y={-az + Math.PI / 2}>
          <mesh material={r.led} position-y={3.1}>
            <cylinderGeometry args={[WALL_R - 0.25, WALL_R - 0.25, 3.4, 48, 1, true, -0.42, 0.84]} />
          </mesh>
          <mesh material={r.ledFrame} position-y={1.32}>
            <cylinderGeometry args={[WALL_R - 0.22, WALL_R - 0.22, 0.12, 48, 1, true, -0.43, 0.86]} />
          </mesh>
        </group>
      ))}

      {/* overhead truss ring + softboxes */}
      <mesh material={r.truss} position-y={6.6} rotation-x={Math.PI / 2}>
        <torusGeometry args={[4.6, 0.09, 10, 96]} />
      </mesh>
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <group key={i} position={[Math.cos(a) * 3.2, 6.45, Math.sin(a) * 3.2]} rotation-y={-a}>
            <mesh material={r.truss}>
              <boxGeometry args={[2.3, 0.16, 1.3]} />
            </mesh>
            <mesh material={r.softbox} position-y={-0.09} rotation-x={Math.PI / 2}>
              <planeGeometry args={[2.1, 1.1]} />
            </mesh>
          </group>
        )
      })}

      {/* volumetric key spot over the car */}
      <group>
        <SpotLight
          ref={spot}
          position={[0.4, 7.2, 0.3]}
          angle={0.42}
          penumbra={0.6}
          distance={11}
          attenuation={8.5}
          anglePower={4.5}
          intensity={18}
          opacity={0.14}
          color="#e8eeff"
          volumetric
        />
      </group>
    </group>
  )
}
