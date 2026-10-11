// Engine audio. Sample mode: rpm-crossfaded loops (+ ignition one-shot) from public/audio/, pitched by
// playbackRate. Synth mode: the prototype's 3-oscillator engine (lines 769–800), used when samples are absent.
import { ENGINE_SAMPLES, IGNITION_SAMPLE } from '@/config/audio'

type Layer = { src: AudioBufferSourceNode; gain: GainNode; rpm: number }

class EngineAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers: AudioBuffer[] | null = null
  private ignition: AudioBuffer | null = null
  private loading: Promise<void> | null = null
  private layers: Layer[] | null = null
  private synth: { lp: BiquadFilterNode; o1: OscillatorNode; o2: OscillatorNode; o3: OscillatorNode } | null = null
  enabled = true

  /** Create/resume the context. Call from a user gesture (launch click / key). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AC) return null
        this.ctx = new AC()
      }
      void this.ctx.resume()
      this.load()
      return this.ctx
    } catch {
      return null
    }
  }

  private load() {
    if (this.loading || !this.ctx) return
    const ctx = this.ctx
    const fetchBuf = (url: string) =>
      fetch(url).then(r => {
        if (!r.ok) throw new Error(url)
        return r.arrayBuffer()
      }).then(b => ctx.decodeAudioData(b))
    this.loading = Promise.all(ENGINE_SAMPLES.map(s => fetchBuf(s.url)))
      .then(bufs => { this.buffers = bufs })
      .catch(() => { this.buffers = null })
      .then(() => fetchBuf(IGNITION_SAMPLE).then(b => { this.ignition = b }).catch(() => {}))
  }

  start() {
    if (!this.enabled) return
    const ctx = this.unlock()
    if (!ctx) return
    this.stop(true)
    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    this.master = master
    if (this.ignition) {
      const s = ctx.createBufferSource()
      s.buffer = this.ignition
      const g = ctx.createGain()
      g.gain.value = 0.9
      s.connect(g).connect(ctx.destination)
      s.start()
    }
    if (this.buffers) {
      this.layers = this.buffers.map((buf, i) => {
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.loop = true
        const gain = ctx.createGain()
        gain.gain.value = 0
        src.connect(gain).connect(master)
        src.start(0, Math.random() * buf.duration)
        return { src, gain, rpm: ENGINE_SAMPLES[i].rpm }
      })
    } else {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.Q.value = 4
      lp.frequency.value = 400
      const sh = ctx.createWaveShaper()
      const cv = new Float32Array(1024)
      for (let i = 0; i < 1024; i++) cv[i] = Math.tanh((i / 511.5 - 1) * 2.4)
      sh.curve = cv
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator()
      o1.type = 'sawtooth'
      o2.type = 'square'
      o3.type = 'sawtooth'
      const g2 = ctx.createGain(); g2.gain.value = 0.5
      const g3 = ctx.createGain(); g3.gain.value = 0.25
      o1.connect(sh); o2.connect(g2).connect(sh); o3.connect(g3).connect(sh)
      sh.connect(lp).connect(master)
      o1.start(); o2.start(); o3.start()
      this.synth = { lp, o1, o2, o3 }
    }
  }

  /** rpm 0..1, vol 0..1 */
  set(rpm: number, vol: number) {
    const ctx = this.ctx, master = this.master
    if (!ctx || !master) return
    const t = ctx.currentTime
    master.gain.setTargetAtTime(this.enabled ? vol * (this.layers ? 0.7 : 0.16) : 0, t, 0.06)
    if (this.layers) {
      // equal-power crossfade between the two layers bracketing rpm; pitch each toward the current rpm
      const L = this.layers
      for (let i = 0; i < L.length; i++) {
        const a = L[i].rpm, prev = L[i - 1]?.rpm ?? -1, next = L[i + 1]?.rpm ?? 2
        let w = 0
        if (rpm <= a && rpm > prev) w = Math.sin(((rpm - prev) / (a - prev)) * Math.PI * 0.5)
        else if (rpm > a && rpm < next) w = Math.cos(((rpm - a) / (next - a)) * Math.PI * 0.5)
        if (i === 0 && rpm <= a) w = 1
        if (i === L.length - 1 && rpm >= a) w = 1
        L[i].gain.gain.setTargetAtTime(w, t, 0.04)
        L[i].src.playbackRate.setTargetAtTime(Math.min(2.2, Math.max(0.5, (0.25 + rpm) / (0.25 + a))), t, 0.03)
      }
    } else if (this.synth) {
      const f = 34 + rpm * 200, n = this.synth
      n.o1.frequency.setTargetAtTime(f, t, 0.03)
      n.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03)
      n.o3.frequency.setTargetAtTime(f * 2.01, t, 0.03)
      n.lp.frequency.setTargetAtTime(260 + rpm * 2800, t, 0.05)
    }
  }

  stop(now = false) {
    const ctx = this.ctx, master = this.master
    if (!ctx || !master) return
    const layers = this.layers, synth = this.synth
    this.master = null
    this.layers = null
    this.synth = null
    try {
      const t = ctx.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setTargetAtTime(0, t, now ? 0.01 : 0.25)
    } catch { /* context closed */ }
    setTimeout(() => {
      try {
        layers?.forEach(l => l.src.stop())
        if (synth) { synth.o1.stop(); synth.o2.stop(); synth.o3.stop() }
        master.disconnect()
      } catch { /* already stopped */ }
    }, now ? 100 : 1500)
  }
}

export const engineAudio = new EngineAudio()
