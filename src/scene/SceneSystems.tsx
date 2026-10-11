// Small non-visual systems: explode progress tween, exploded-view label projection.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'
import { LABELS } from '@/config/parts'
import { useStore } from '@/state/store'
import { isCine } from '@/state/machine'
import { transient } from '@/state/transient'
import { carRefs } from '@/car/refs'

/** Explode progress: linear at 1/1.9 per second toward the phase's target, reversible mid-flight
 *  (prototype line 896, now a GSAP tween whose duration is proportional to the remaining distance). */
export function ExplodeDriver() {
  const phase = useStore(s => s.phase)
  useEffect(() => {
    const target = phase === 'exploded' ? 1 : 0
    const tween = gsap.to(transient, { explode: target, duration: Math.abs(target - transient.explode) * 1.9, ease: 'none', overwrite: true })
    return () => { tween.kill() }
  }, [phase])
  return null
}

/** DOM label elements, registered by ui/Labels.tsx */
export const labelDom = { wrap: null as HTMLDivElement | null, els: [] as (HTMLDivElement | null)[] }

/** Projects label anchors (which ride on their part groups) to screen space (prototype 933–941). */
export function LabelProjector() {
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)
  const pv = useRef(new THREE.Vector3()).current
  const shown = useRef(false)
  useFrame(() => {
    const cine = isCine(useStore.getState().phase)
    const showL = !cine && transient.explode > 0.93
    if (showL !== shown.current && labelDom.wrap) {
      labelDom.wrap.classList.toggle('show', showL)
      shown.current = showL
    }
    if (cine || transient.explode <= 0.5) return
    LABELS.forEach((L, i) => {
      const el = labelDom.els[i], g = carRefs.parts[L.part]
      if (!el || !g) return
      pv.set(...L.anchor)
      g.localToWorld(pv)
      pv.project(camera)
      el.style.visibility = pv.z < 1 ? 'visible' : 'hidden'
      el.style.transform = `translate3d(${((pv.x * 0.5 + 0.5) * size.width).toFixed(1)}px,${((-pv.y * 0.5 + 0.5) * size.height).toFixed(1)}px,0)`
    })
  })
  return null
}
