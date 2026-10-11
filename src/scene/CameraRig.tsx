// Orbit camera + pointer input, ported from the prototype (lines 700–750, 885–892) so feel and timing match.
// Improvement: pan (right-drag, shift-drag, or two-finger drag), clamped around the car.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { VIEWS, ORBIT, ORBIT_TARGET } from '@/config/views'
import { useStore } from '@/state/store'
import { isCine } from '@/state/machine'
import { clamp, damp } from '@/lib/math'
import { carRefs } from '@/car/Car'
import { launch } from '@/state/actions'

const DEG = Math.PI / 180
const TAU = Math.PI * 2

/** Shared with the cinematic director. */
export const rig = {
  orbit: { theta: 2.2, phi: 0.5, r: 14 },
  want: { theta: VIEWS[0][1], phi: VIEWS[0][2], r: VIEWS[0][3] },
  pan: new THREE.Vector3(),
  wantPan: new THREE.Vector3(),
  fit: 1,
  baseFov: 32,
  lastInteract: -1e9,
  target: new THREE.Vector3(...ORBIT_TARGET),
  lookAt(out = new THREE.Vector3()) {
    return out.copy(this.target).add(this.pan)
  },
  viewPos(i: number, out: THREE.Vector3) {
    const v = VIEWS[i], r = v[3] * this.fit, cp = Math.cos(v[2])
    return out.set(this.target.x + r * cp * Math.cos(v[1]), this.target.y + r * Math.sin(v[2]), this.target.z + r * cp * Math.sin(v[1]))
  },
  /** called when the launch sequence ends (prototype endCine) */
  resetToHome(camera: THREE.PerspectiveCamera) {
    const v = VIEWS[0]
    this.orbit.theta = this.want.theta = v[1]
    this.orbit.phi = this.want.phi = v[2]
    this.orbit.r = this.want.r = v[3] * this.fit
    this.pan.set(0, 0, 0)
    this.wantPan.set(0, 0, 0)
    camera.fov = this.baseFov
    camera.updateProjectionMatrix()
    this.lastInteract = performance.now()
  },
}

function computeFit(aspect: number, camera: THREE.PerspectiveCamera) {
  const fov = aspect < 1 ? 40 : 32
  camera.fov = fov
  rig.baseFov = fov
  return (Math.max(1, 1.5 / aspect) * Math.tan(16 * DEG)) / Math.tan((fov / 2) * DEG)
}

export function CameraRig() {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera
  const gl = useThree(s => s.gl)
  const size = useThree(s => s.size)
  const booted = useRef(false)

  // fit on resize (and boot fly-in: start at 1.9× distance)
  useEffect(() => {
    const nf = computeFit(size.width / size.height, camera)
    if (!booted.current) {
      booted.current = true
      rig.fit = nf
      rig.want.r = VIEWS[0][3] * nf
      rig.orbit.r = rig.want.r * 1.9
    } else {
      rig.want.r *= nf / rig.fit
      rig.orbit.r *= nf / rig.fit
      rig.fit = nf
    }
    camera.updateProjectionMatrix()
  }, [size, camera])

  // view presets
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.viewNonce === prev.viewNonce || s.activeView < 0) return
        const v = VIEWS[s.activeView]
        rig.want.theta = v[1] + TAU * Math.round((rig.orbit.theta - v[1]) / TAU)
        rig.want.phi = v[2]
        rig.want.r = v[3] * rig.fit
        rig.wantPan.set(0, 0, 0)
      }),
    [],
  )

  // pointer input
  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; pan: boolean }>()
    let pinch = 0
    let tapTimer: ReturnType<typeof setTimeout> | null = null
    let lastTap = 0
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
    const minR = () => ORBIT.rMin * rig.fit, maxR = () => ORBIT.rMax * rig.fit
    const cine = () => isCine(useStore.getState().phase)
    const interact = () => {
      rig.lastInteract = performance.now()
      useStore.getState().clearView()
    }
    const hitCar = (x: number, y: number) => {
      if (!carRefs.car) return false
      const r = el.getBoundingClientRect()
      ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray.intersectObject(carRefs.car, true).length > 0
    }
    const onTap = (x: number, y: number) => {
      if (cine()) return
      const now = performance.now()
      if (tapTimer && now - lastTap < 320) {
        clearTimeout(tapTimer)
        tapTimer = null
        launch()
        return
      }
      if (!hitCar(x, y)) return
      lastTap = now
      tapTimer = setTimeout(() => {
        tapTimer = null
        useStore.getState().dispatch('tapCar')
      }, 270)
    }
    const panBy = (dx: number, dy: number) => {
      const k = rig.orbit.r * 0.0011
      const th = rig.orbit.theta
      rig.wantPan.x -= Math.sin(th) * dx * k
      rig.wantPan.z += Math.cos(th) * dx * k
      rig.wantPan.y += dy * k
      rig.wantPan.y = clamp(rig.wantPan.y, -0.3, 1.2)
      if (rig.wantPan.length() > ORBIT.panMax) rig.wantPan.setLength(ORBIT.panMax)
    }

    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), pan: e.button === 2 || e.shiftKey })
      if (!cine()) interact()
    }
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (cine()) return
      if (pointers.size === 1) {
        if (p.pan) panBy(dx, dy)
        else {
          rig.want.theta -= dx * 0.006
          rig.want.phi = clamp(rig.want.phi + dy * 0.005, ORBIT.phiMin, ORBIT.phiMax)
        }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch) rig.want.r = clamp((rig.want.r * pinch) / d, minR(), maxR())
        pinch = d
        panBy(dx / 2, dy / 2)
      }
      rig.lastInteract = performance.now()
    }
    const up = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId), n = pointers.size
      pointers.delete(e.pointerId)
      pinch = 0
      if (p && e.type === 'pointerup' && n === 1 && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 7 && performance.now() - p.t < 400) onTap(e.clientX, e.clientY)
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      if (cine()) return
      rig.want.r = clamp(rig.want.r * Math.exp(e.deltaY * 0.0012), minR(), maxR())
      interact()
    }
    const menu = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('contextmenu', menu)
    return () => {
      if (tapTimer) clearTimeout(tapTimer)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('contextmenu', menu)
    }
  }, [gl, camera])

  const look = useRef(new THREE.Vector3()).current
  useFrame((_, rawDt) => {
    const { phase, toggles } = useStore.getState()
    if (isCine(phase)) return
    const dt = Math.min(0.05, rawDt)
    if (toggles.auto && performance.now() - rig.lastInteract > ORBIT.autoDelayMs) rig.want.theta += dt * ORBIT.autoSpeed
    const k = damp(ORBIT.damping, dt)
    const { orbit, want } = rig
    orbit.theta += (want.theta - orbit.theta) * k
    orbit.phi += (want.phi - orbit.phi) * k
    orbit.r += (want.r - orbit.r) * k
    rig.pan.lerp(rig.wantPan, k)
    rig.lookAt(look)
    const cp = Math.cos(orbit.phi)
    camera.position.set(look.x + orbit.r * cp * Math.cos(orbit.theta), look.y + orbit.r * Math.sin(orbit.phi), look.z + orbit.r * cp * Math.sin(orbit.theta))
    camera.lookAt(look)
  }, -1)

  return null
}
