// Launch sequence. Timing and curves match the prototype's updateCine (reference/aurora-studio.html 802–875)
// exactly; the eased channels (speed, car nudge, track mix, camera blends, body roll, brake glow) are now one
// GSAP master timeline driven by the R3F clock, which also gives labelled seeking for Skip.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'
import { T, VMAX, KMH_MAX, ACCEL_TIME } from '@/config/timeline'
import { useStore } from '@/state/store'
import { transient } from '@/state/transient'
import { bump, clamp } from '@/lib/math'
import { engineAudio } from '@/audio/engine'
import { rig } from '@/scene/CameraRig'
import { shotTop, shotChase, shotSide, shotFront } from './shots'

const smooth = (x: number) => x * x * (3 - 2 * x) // smoothstep as a GSAP ease
const accel = (x: number) => 1 - Math.pow(1 - x, 2.2) // prototype launch curve

/** Imperative handles for UI (Skip button, keyboard). */
export const cineControls = { skip: () => {} }

export function CinematicDirector() {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera
  const phase = useStore(s => s.phase)
  const c = useRef({ active: false, t: 0, ign: false, stopped: false, from: new THREE.Vector3(), fromLook: new THREE.Vector3() }).current
  const ch = useRef({ s: 0, cx: 0, m: 0, k: 0, roll: 0, brake: 0 }).current
  const tl = useRef<gsap.core.Timeline | null>(null)
  const v = useRef({ cP: new THREE.Vector3(), cL: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), look: new THREE.Vector3() }).current

  useEffect(() => {
    if (phase !== 'cinematic' || c.active) return
    // --- startCine ---
    Object.assign(c, { active: true, t: 0, ign: false, stopped: false })
    Object.assign(ch, { s: 0, cx: 0, m: 0, k: 0, roll: 0, brake: 0 })
    transient.dist = 0
    c.from.copy(camera.position)
    c.fromLook.copy(rig.lookAt())
    const st = useStore.getState()
    engineAudio.enabled = st.toggles.sound
    if (st.toggles.sound) engineAudio.unlock()

    const t = gsap.timeline({ paused: true })
    const lane = (vars: gsap.TweenVars, at: number) => t.to(ch, { ...vars, immediateRender: false }, at)
    // camera blend segments: fly-to-top, top→chase, front→home (prototype eio = GSAP power2.inOut)
    t.fromTo(ch, { k: 0 }, { k: 1, duration: T.top, ease: 'power2.inOut', immediateRender: false }, 0)
    t.fromTo(ch, { k: 0 }, { k: 1, duration: T.chase - T.launch, ease: 'power2.inOut', immediateRender: false }, T.launch)
    t.fromTo(ch, { k: 0 }, { k: 1, duration: T.home - T.decel, ease: 'power2.inOut', immediateRender: false }, T.decel)
    // speed: launch curve to full, then cubic in-out back to zero
    lane({ s: 1, duration: ACCEL_TIME, ease: accel }, T.launch)
    lane({ s: 0, duration: T.home - T.decel, ease: 'power2.inOut' }, T.decel)
    // car nudge forward and back
    lane({ cx: 1.4, duration: 1.1, ease: smooth }, T.launch)
    lane({ cx: 0, duration: T.home - T.decel, ease: smooth }, T.decel)
    // studio → track → studio
    lane({ m: 1, duration: 1.0, ease: smooth }, T.launch + 0.3)
    lane({ m: 0, duration: T.home - 0.1 - (T.decel + 0.9), ease: smooth }, T.decel + 0.9)
    // launch squat, brake dive
    lane({ roll: 0.016, duration: 0.3, ease: smooth }, T.launch - 0.05)
    lane({ roll: 0, duration: 1.3, ease: smooth }, T.launch + 0.5)
    lane({ roll: -0.012, duration: 0.4, ease: smooth }, T.decel)
    lane({ roll: 0, duration: T.home - (T.decel + 1.4), ease: smooth }, T.decel + 1.4)
    // brake glow
    lane({ brake: 1.8, duration: 0.3, ease: smooth }, T.decel)
    lane({ brake: 0, duration: 1.4, ease: smooth }, T.home - 0.8)
    // events
    t.call(() => { c.ign = true; engineAudio.start() }, [], T.ign)
    t.call(() => useStore.getState().dispatch('reachDecel'), [], T.decel)
    t.call(() => { c.stopped = true; engineAudio.stop() }, [], T.end - 0.5)
    t.call(() => endCine(), [], T.end)
    tl.current = t

    cineControls.skip = () => {
      if (!c.active) return
      if (c.t < T.launch) c.t = T.home
      else if (c.t < T.decel) c.t = T.decel
      else if (c.t < T.home) c.t = T.home
      tl.current?.time(c.t, true)
      if (c.t >= T.decel) useStore.getState().dispatch('skipToReturn')
    }

    function endCine() {
      c.active = false
      tl.current?.kill()
      tl.current = null
      cineControls.skip = () => {}
      Object.assign(transient, { s: 0, cx: 0, m: 0, eng: 0, rpm: 0, roll: 0, brake: 0, cineT: 0, kmh: 0, gear: 'N' })
      rig.resetToHome(camera)
      engineAudio.stop()
      useStore.getState().dispatch('finish')
    }
  }, [phase, camera, c, ch])

  useEffect(() => () => { tl.current?.kill(); engineAudio.stop(true) }, [])

  useFrame(({ clock }, rawDt) => {
    if (!c.active || !tl.current) return
    const dt = Math.min(0.05, rawDt)
    const now = clock.elapsedTime * 1000
    const t = Math.min((c.t += dt), T.end)
    tl.current.time(t)
    if (!c.active) return // endCine ran inside the timeline

    const { s, cx, m, k } = ch
    transient.dist += s * VMAX * dt
    const eng = t >= T.ign && t < T.end - 0.5 ? 1 : 0
    const g = s * 7.2
    let rpm = 0
    if (eng) {
      if (t < T.launch) rpm = 0.12 + 0.015 * Math.sin(t * 37) + 0.55 * bump(t, 2.62) + 0.78 * bump(t, 3.08, 0.14) + 0.5 * bump(t, T.launch - 0.08, 0.2)
      else if (t < T.decel) rpm = s < 0.985 ? 0.4 + 0.55 * Math.pow(g % 1, 0.85) : 0.93 + 0.02 * Math.sin(t * 11)
      else rpm = 0.14 + 0.7 * s
    }
    engineAudio.set(rpm, eng)
    Object.assign(transient, { cineT: t, s, cx, m, eng, rpm, roll: ch.roll, brake: ch.brake })

    // --- camera shots ---
    const { cP, cL, a, b, look } = v
    const lookCar = look.set(cx, 0.32, 0)
    if (t < T.top) { cP.lerpVectors(c.from, shotTop(t, rig.fit, a), k); cL.lerpVectors(c.fromLook, lookCar, k) }
    else if (t < T.launch) { shotTop(t, rig.fit, cP); cL.copy(lookCar) }
    else if (t < T.chase) { cP.lerpVectors(shotTop(T.launch, rig.fit, a), shotChase(t, cx, b), k); cL.lerpVectors(lookCar, b.set(cx + 3, 0.5, 0), k) }
    else if (t < T.side) { shotChase(t, cx, cP); cL.set(cx + 3, 0.5, 0) }
    else if (t < T.front) { shotSide(t, cx, cP); cL.set(cx - 0.1, 0.42, 0) }
    else if (t < T.decel) { shotFront(t, cx, cP); cL.set(cx, 0.5, 0) }
    else if (t < T.home) { cP.lerpVectors(shotFront(T.decel, cx, a), rig.viewPos(0, b), k); cL.lerpVectors(a.set(cx, 0.5, 0), rig.target, k) }
    else { rig.viewPos(0, cP); cL.copy(rig.target) }

    const reduce = useStore.getState().reduceMotion
    const shake = reduce ? 0 : (eng * (0.006 + 0.016 * rpm) + 0.05 * bump(t, T.ign + 0.05, 0.1) + 0.035 * bump(t, T.launch + 0.1, 0.25)) * (1 + cP.distanceTo(cL) * 0.12)
    cP.x += shake * (Math.sin(now * 0.071) + 0.5 * Math.sin(now * 0.113))
    cP.y += shake * (Math.sin(now * 0.083 + 1) + 0.5 * Math.sin(now * 0.131))
    cP.z += shake * Math.sin(now * 0.097 + 2)
    camera.position.copy(cP)
    camera.lookAt(cL)
    camera.fov = rig.baseFov + 9 * s * m
    camera.updateProjectionMatrix()

    transient.kmh = Math.round(s * KMH_MAX)
    transient.gear = s < 0.005 ? 'N' : String(1 + Math.min(7, Math.floor(clamp(g, 0, 99))))
  }, -2)

  return null
}
