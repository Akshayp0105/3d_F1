// Launch sequence (Phase 4B): one GSAP master timeline driven by the R3F clock.
//   platform → top view → ignition → launch → chase → low side shot      (prototype timing, lines 802–875)
//   → overhead tracking shot → BLAST on the track behind the car → slow-motion jump (~2.5 m) with a low hero angle
//   → track crossfades back into the studio while airborne → landing on the platform (bounce, dust, shockwave, thud)
//   → camera glides back to the orbit pose.
// The timeline owns every eased channel (speed, car nudge/height/pitch, track mix, time scale, post-fx); procedural
// parts (rpm, shake, camera paths) are evaluated per frame. Skip jumps to just before touchdown.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'
import { T, VMAX, KMH_MAX, ACCEL_TIME, SLOWMO, JUMP_H } from '@/config/timeline'
import { useStore } from '@/state/store'
import { transient } from '@/state/transient'
import { bump, clamp } from '@/lib/math'
import { engineAudio } from '@/audio/engine'
import { playExplosion, playLanding, preloadSfx } from '@/audio/sfx'
import { rig } from '@/scene/CameraRig'
import { shotTop, shotChase, shotSide, shotOver, lookOver, shotHero } from './shots'

const smooth = (x: number) => x * x * (3 - 2 * x) // smoothstep as a GSAP ease
const accel = (x: number) => 1 - Math.pow(1 - x, 2.2) // prototype launch curve

/** Imperative handles for UI (Skip button, keyboard). */
export const cineControls = { skip: () => {} }

const CH0 = { s: 0, cx: 0, m: 0, k: 0, roll: 0, brake: 0, ts: 1, y: 0, pitch: 0, flash: 0, ca: 0, fov: 0, shake: 0, haze: 0, dof: 0, grain: 0, vig: 0 }

export function CinematicDirector() {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera
  const phase = useStore(s => s.phase)
  const c = useRef({ active: false, t: 0, from: new THREE.Vector3(), fromLook: new THREE.Vector3(), blastDist: 0, blastX0: 0, landT: -1, heroP: new THREE.Vector3(), heroL: new THREE.Vector3() }).current
  const ch = useRef({ ...CH0 }).current
  const tl = useRef<gsap.core.Timeline | null>(null)
  const v = useRef({ cP: new THREE.Vector3(), cL: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), look: new THREE.Vector3(), bp: new THREE.Vector3() }).current

  useEffect(() => {
    if (phase !== 'cinematic' || c.active) return
    // --- start ---
    Object.assign(c, { active: true, t: 0, landT: -1 })
    Object.assign(ch, CH0)
    Object.assign(transient, { dist: 0, blastAge: -1, landAge: -1, ts: 1 })
    c.from.copy(camera.position)
    c.fromLook.copy(rig.lookAt())
    const st = useStore.getState()
    engineAudio.enabled = st.toggles.sound
    if (st.toggles.sound) { engineAudio.unlock(); preloadSfx() }

    const t = gsap.timeline({ paused: true })
    const to = (vars: gsap.TweenVars, at: number) => t.to(ch, { ...vars, immediateRender: false }, at)
    const blend = (at: number, dur: number) => t.fromTo(ch, { k: 0 }, { k: 1, duration: dur, ease: 'power2.inOut', immediateRender: false }, at)

    // camera blend segments: fly-to-top, top → chase, side → overhead, landing → orbit pose
    blend(0, T.top)
    blend(T.launch, T.chase - T.launch)
    blend(T.land + 0.25, T.home - T.land - 0.25)

    // speed: launch curve to full; the blast knocks it down (the car is airborne), then it coasts to a stop
    to({ s: 1, duration: ACCEL_TIME, ease: accel }, T.launch)
    to({ s: 0.32, duration: 0.8, ease: 'power2.out' }, T.blast)
    to({ s: 0, duration: T.land + 0.6 - (T.blast + 0.8), ease: 'power1.inOut' }, T.blast + 0.8)
    // car nudge forward, then back over the platform centre while airborne
    to({ cx: 1.4, duration: 1.1, ease: smooth }, T.launch)
    to({ cx: 0, duration: T.land - T.blast - 0.4, ease: 'power1.inOut' }, T.blast + 0.3)
    // studio → track → studio (crossfade while airborne)
    to({ m: 1, duration: 1.0, ease: smooth }, T.launch + 0.3)
    to({ m: 0, duration: T.land - 0.5 - T.studio, ease: smooth }, T.studio)
    // launch squat
    to({ roll: 0.016, duration: 0.3, ease: smooth }, T.launch - 0.05)
    to({ roll: 0, duration: 1.3, ease: smooth }, T.launch + 0.5)
    // slow motion: in right after the blast, out just before touchdown
    to({ ts: SLOWMO, duration: 0.3, ease: 'power2.out' }, T.blast + 0.12)
    to({ ts: 1, duration: 0.45, ease: 'power2.in' }, T.land - 0.5)
    // the jump: blast kicks the rear up (nose down), car arcs to the apex and hangs, levels out, lands
    to({ y: JUMP_H, duration: T.apex - T.blast - 0.05, ease: 'power2.out' }, T.blast + 0.05)
    to({ y: 0, duration: T.land - T.apex, ease: 'power2.in' }, T.apex)
    to({ pitch: -0.24, duration: 0.3, ease: 'power3.out' }, T.blast + 0.02)
    to({ pitch: 0.07, duration: T.apex - T.blast - 0.4, ease: 'sine.inOut' }, T.blast + 0.35)
    to({ pitch: 0, duration: T.land - 0.15 - T.apex, ease: 'sine.inOut' }, T.apex)
    // suspension bounce on touchdown
    to({ y: -0.09, duration: 0.11, ease: 'power2.out' }, T.land)
    to({ y: 0.035, duration: 0.22, ease: 'sine.inOut' }, T.land + 0.11)
    to({ y: 0, duration: 0.3, ease: 'sine.inOut' }, T.land + 0.33)
    to({ pitch: -0.018, duration: 0.12, ease: 'power2.out' }, T.land)
    to({ pitch: 0, duration: 0.5, ease: 'sine.inOut' }, T.land + 0.12)
    // blast post fx: flash, chromatic spike, FOV punch, shake, heat haze
    to({ flash: 0.55, duration: 0.03, ease: 'none' }, T.blast)
    to({ flash: 0, duration: 0.42, ease: 'power2.out' }, T.blast + 0.03)
    to({ ca: 1, duration: 0.05, ease: 'none' }, T.blast)
    to({ ca: 0, duration: 1.0, ease: 'power2.out' }, T.blast + 0.05)
    to({ fov: 16, duration: 0.07, ease: 'power2.out' }, T.blast)
    to({ fov: 0, duration: 1.3, ease: 'power3.out' }, T.blast + 0.07)
    to({ shake: 1, duration: 0.03, ease: 'none' }, T.blast)
    to({ shake: 0, duration: 1.6, ease: 'power2.out' }, T.blast + 0.03)
    to({ haze: 1, duration: 0.3, ease: 'power1.out' }, T.blast + 0.08)
    to({ haze: 0, duration: 0.8, ease: 'power1.in' }, T.land - 0.9)
    to({ shake: 0.45, duration: 0.03, ease: 'none' }, T.land)
    to({ shake: 0, duration: 0.6, ease: 'power2.out' }, T.land + 0.03)
    // cinematic grade for the whole sequence: DOF on the car, film grain, stronger vignette
    to({ dof: 1, grain: 1, vig: 1, duration: 1.2, ease: 'power1.inOut' }, 0)
    to({ dof: 0, grain: 0, vig: 0, duration: 1.0, ease: 'power1.inOut' }, T.home - 0.6)
    // keep the explosion readable in the overhead shot: shallow focus would melt it into a blurred disc
    to({ dof: 0.2, duration: 0.4, ease: 'power1.inOut' }, T.over)
    to({ dof: 1, duration: 0.6, ease: 'power1.inOut' }, T.hero)
    // events
    t.call(() => engineAudio.start(), [], T.ign)
    t.call(() => {
      c.blastDist = transient.dist
      c.blastX0 = ch.cx - 6.5 // on the track, behind the car (never on it)
      transient.blastAge = 0
      void playExplosion()
    }, [], T.blast)
    t.call(() => { c.landT = c.t; void playLanding() }, [], T.land)
    t.call(() => useStore.getState().dispatch('reachDecel'), [], T.land)
    t.call(() => engineAudio.stop(), [], T.land + 0.6)
    t.call(() => endCine(), [], T.end)
    tl.current = t

    cineControls.skip = () => {
      if (!c.active) return
      // jump to just before touchdown so the landing still plays; a second skip ends the sequence
      if (c.t >= T.land - 0.45) {
        // already at/after touchdown: finish (seeking with suppressed events would skip the end callback)
        useStore.getState().dispatch('skipToReturn')
        endCine()
        return
      }
      c.t = T.land - 0.45
      tl.current?.time(c.t, true)
    }

    function endCine() {
      c.active = false
      tl.current?.kill()
      tl.current = null
      cineControls.skip = () => {}
      Object.assign(transient, {
        s: 0, cx: 0, m: 0, eng: 0, rpm: 0, roll: 0, brake: 0, cineT: 0, kmh: 0, gear: 'N',
        ts: 1, carY: 0, pitch: 0, blastAge: -1, landAge: -1, flash: 0, ca: 0, haze: 0, dof: 0, grain: 0, vig: 0,
      })
      engineAudio.setSlowmo(1)
      rig.resetToHome(camera)
      engineAudio.stop()
      useStore.getState().dispatch('finish')
    }
  }, [phase, camera, c, ch])

  useEffect(() => () => { tl.current?.kill(); engineAudio.stop(true) }, [])

  useFrame(({ clock }, rawDt) => {
    if (!c.active || !tl.current) return
    // dev-only playback rate (window.__cineRate) so screenshot scripts can catch individual beats
    const rate = import.meta.env.DEV ? ((window as unknown as { __cineRate?: number }).__cineRate ?? 1) : 1
    const dt = Math.min(0.05, rawDt) * rate
    const now = clock.elapsedTime * 1000
    const t = Math.min((c.t += dt), T.end)
    tl.current.time(t)
    if (!c.active) return // endCine ran inside the timeline

    const { s, cx, m, k, ts } = ch
    transient.dist += s * VMAX * dt * ts
    if (transient.blastAge >= 0) {
      transient.blastAge += dt * ts
      // anchored to the track but receding at 30 % of its speed: a cinematic cheat that keeps the fire framed behind
      // the airborne car instead of vanishing down the straight in a fraction of a second
      transient.blastX = c.blastX0 - (transient.dist - c.blastDist) * 0.3
    }
    transient.landAge = c.landT >= 0 ? c.t - c.landT : -1

    // engine: prototype rpm curve until the blast; airborne the engine over-revs (wheels unloaded), then idles down
    const eng = t >= T.ign && t < T.land + 0.6 ? 1 : 0
    const g = s * 7.2
    let rpm = 0
    if (eng) {
      if (t < T.launch) rpm = 0.12 + 0.015 * Math.sin(t * 37) + 0.55 * bump(t, 2.62) + 0.78 * bump(t, 3.08, 0.14) + 0.5 * bump(t, T.launch - 0.08, 0.2)
      else if (t < T.blast) rpm = s < 0.985 ? 0.4 + 0.55 * Math.pow(g % 1, 0.85) : 0.93 + 0.02 * Math.sin(t * 11)
      else if (t < T.land) rpm = 0.97 - 0.3 * clamp((t - T.blast) / (T.land - T.blast), 0, 1)
      else rpm = 0.2 + 0.45 * Math.exp(-(t - T.land) * 3)
    }
    engineAudio.setSlowmo((ts - SLOWMO) / (1 - SLOWMO))
    engineAudio.set(rpm, eng)
    Object.assign(transient, {
      cineT: t, s, cx, m, eng, rpm, roll: ch.roll, brake: 0, ts, carY: ch.y, pitch: ch.pitch,
      flash: ch.flash, ca: ch.ca, haze: ch.haze, dof: ch.dof, grain: ch.grain, vig: ch.vig,
    })

    // --- camera shots ---
    const { cP, cL, a, b, look } = v
    const carY = ch.y
    const lookCar = look.set(cx, 0.32, 0)
    if (t < T.top) { cP.lerpVectors(c.from, shotTop(t, rig.fit, a), k); cL.lerpVectors(c.fromLook, lookCar, k) }
    else if (t < T.launch) { shotTop(t, rig.fit, cP); cL.copy(lookCar) }
    else if (t < T.chase) { cP.lerpVectors(shotTop(T.launch, rig.fit, a), shotChase(t, cx, b), k); cL.lerpVectors(lookCar, b.set(cx + 3, 0.5, 0), k) }
    else if (t < T.side) { shotChase(t, cx, cP); cL.set(cx + 3, 0.5, 0) }
    else if (t < T.over) { shotSide(t, cx, cP); cL.set(cx - 0.1, 0.42, 0) }
    else if (t < T.hero) {
      shotOver(t, cx, cP)
      lookOver(cx, cL)
      // whip the aim back toward the detonation so the overhead shot catches the fireball erupting behind the car
      if (transient.blastAge >= 0) {
        const w = Math.min(1, transient.blastAge * 6)
        cL.x += (transient.blastX - cL.x) * 0.45 * w
        cL.y += 2.2 * w
      }
    }
    else if (t < T.land + 0.25) {
      shotHero(t, cx, cP)
      // look up at the car, leading it slightly as it rises
      cL.set(cx - 0.6, 0.55 + carY * 0.85, 0)
      c.heroP.copy(cP)
      c.heroL.copy(cL)
    } else { cP.lerpVectors(c.heroP, rig.viewPos(0, b), k); cL.lerpVectors(c.heroL, rig.target, k) }

    const reduce = useStore.getState().reduceMotion
    const shake = reduce ? 0 : (eng * (0.006 + 0.016 * rpm) * ts + 0.05 * bump(t, T.ign + 0.05, 0.1) + 0.035 * bump(t, T.launch + 0.1, 0.25) + 0.22 * ch.shake) * (1 + cP.distanceTo(cL) * 0.12)
    cP.x += shake * (Math.sin(now * 0.071) + 0.5 * Math.sin(now * 0.113))
    cP.y += shake * (Math.sin(now * 0.083 + 1) + 0.5 * Math.sin(now * 0.131))
    cP.z += shake * Math.sin(now * 0.097 + 2)
    if (cP.y < 0.12) cP.y = 0.12
    camera.position.copy(cP)
    camera.lookAt(cL)
    // camera roll: rotational shake from the blast/landing, plus a slow dutch tilt in the hero shot (hand-held feel)
    if (!reduce) {
      const dutch = t >= T.hero && t < T.land + 0.25 ? 0.07 * Math.sin(Math.min(1, (t - T.hero) / 1.2) * Math.PI * 0.5) - 0.025 * Math.sin((t - T.hero) * 0.9) : 0
      camera.rotateZ(dutch + ch.shake * 0.05 * Math.sin(now * 0.061) + eng * 0.002 * Math.sin(now * 0.017))
    }
    camera.fov = rig.baseFov + 9 * s * m + ch.fov
    camera.updateProjectionMatrix()

    // blast centre on screen, for the heat-haze pass
    if (transient.blastAge >= 0) {
      v.bp.set(transient.blastX, 3, 0.3).project(camera)
      transient.blastU = v.bp.x * 0.5 + 0.5
      transient.blastV = v.bp.y * 0.5 + 0.5
      if (v.bp.z > 1) transient.haze = 0
    }

    transient.kmh = Math.round(s * KMH_MAX)
    transient.gear = s < 0.005 ? 'N' : String(1 + Math.min(7, Math.floor(clamp(g, 0, 99))))
  }, -2)

  return null
}
