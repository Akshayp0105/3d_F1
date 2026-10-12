// Explosion + landing one-shots (Phase 4B). Layers: boom (sample if public/audio/explosion.ogg exists, else a
// synthesized noise blast with a falling low-pass), sub thump (pitch-dropping sine), crack transient, and a debris
// rattle of filtered noise grains scattered over ~2 s. Everything routes through the engine's slow-motion bus, so
// the tail is muffled and slowed once the jump goes into slow motion.
import { engineAudio } from './engine'
import { EXPLOSION_SAMPLE, LAND_SAMPLE } from '@/config/audio'

const cache = new Map<string, Promise<AudioBuffer | null>>()
function sample(ctx: AudioContext, url: string) {
  if (!cache.has(url))
    cache.set(url, fetch(url).then(r => (r.ok ? r.arrayBuffer() : Promise.reject())).then(b => ctx.decodeAudioData(b)).catch(() => null))
  return cache.get(url)!
}

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate)
  const d = b.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    // slightly brown noise: more low-end weight than white
    last = last * 0.92 + (Math.random() * 2 - 1) * 0.08
    d[i] = last * 6 + (Math.random() * 2 - 1) * 0.25
  }
  return b
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.setTargetAtTime(0, t + attack, decay / 3)
}

/** Preload samples (call from the launch gesture so decoding is done by the time of the blast). */
export function preloadSfx() {
  const ctx = engineAudio.context
  if (!ctx) return
  void sample(ctx, EXPLOSION_SAMPLE)
  void sample(ctx, LAND_SAMPLE)
}

export async function playExplosion() {
  const ctx = engineAudio.context
  const out = engineAudio.bus()
  if (!ctx || !out || !engineAudio.enabled) return
  const t = ctx.currentTime + 0.01
  const master = ctx.createGain()
  master.gain.value = 0.9
  // soft clip for weight
  const sh = ctx.createWaveShaper()
  const cv = new Float32Array(2048)
  for (let i = 0; i < 2048; i++) cv[i] = Math.tanh((i / 1023.5 - 1) * 2.2)
  sh.curve = cv
  master.connect(sh).connect(out)

  const smp = await sample(ctx, EXPLOSION_SAMPLE)
  if (smp) {
    const s = ctx.createBufferSource()
    s.buffer = smp
    s.connect(master)
    s.start(t)
  } else {
    // boom: brown noise through a low-pass falling 6 kHz → 160 Hz
    const n = ctx.createBufferSource()
    n.buffer = noiseBuffer(ctx, 4)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(6000, t)
    lp.frequency.exponentialRampToValueAtTime(160, t + 2.6)
    const g = ctx.createGain()
    env(g, t, 1.0, 0.006, 3.2)
    n.connect(lp).connect(g).connect(master)
    n.start(t)
    n.stop(t + 4)
    // crack: very short bright transient
    const c = ctx.createBufferSource()
    c.buffer = noiseBuffer(ctx, 0.2)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1800
    const cg = ctx.createGain()
    env(cg, t, 0.8, 0.002, 0.12)
    c.connect(hp).connect(cg).connect(master)
    c.start(t)
  }
  // sub thump: 62 → 26 Hz
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(62, t)
  o.frequency.exponentialRampToValueAtTime(26, t + 1.1)
  const og = ctx.createGain()
  env(og, t, 1.3, 0.01, 1.6)
  o.connect(og).connect(master)
  o.start(t)
  o.stop(t + 2.5)
  // debris rattle: grains of band-passed noise scattered over 0.25..2.4 s
  const grainBuf = noiseBuffer(ctx, 0.12)
  for (let i = 0; i < 34; i++) {
    const at = t + 0.25 + Math.pow(Math.random(), 1.6) * 2.2
    const s = ctx.createBufferSource()
    s.buffer = grainBuf
    s.playbackRate.value = 0.6 + Math.random() * 1.2
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1500 + Math.random() * 4500
    bp.Q.value = 3
    const g = ctx.createGain()
    env(g, at, 0.08 + Math.random() * 0.22, 0.002, 0.06 + Math.random() * 0.1)
    s.connect(bp).connect(g).connect(master)
    s.start(at)
  }
}

export async function playLanding() {
  const ctx = engineAudio.context
  const out = engineAudio.bus()
  if (!ctx || !out || !engineAudio.enabled) return
  const t = ctx.currentTime + 0.005
  const master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(out)
  const smp = await sample(ctx, LAND_SAMPLE)
  if (smp) {
    const s = ctx.createBufferSource()
    s.buffer = smp
    s.connect(master)
    s.start(t)
    return
  }
  // thud: sub sine 85 → 38 Hz + short low-passed noise (tyres + suspension) + a carbon "knock"
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(85, t)
  o.frequency.exponentialRampToValueAtTime(38, t + 0.35)
  const og = ctx.createGain()
  env(og, t, 1.1, 0.004, 0.5)
  o.connect(og).connect(master)
  o.start(t)
  o.stop(t + 1)
  const n = ctx.createBufferSource()
  n.buffer = noiseBuffer(ctx, 0.6)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const ng = ctx.createGain()
  env(ng, t, 0.6, 0.003, 0.35)
  n.connect(lp).connect(ng).connect(master)
  n.start(t)
}
