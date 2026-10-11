// DOM overlay, ported from the prototype markup (reference/aurora-studio.html 137–169).
import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { LIVERIES } from '@/config/liveries'
import { VIEWS } from '@/config/views'
import { LABELS } from '@/config/parts'
import { useStore, selectExploded, type ToggleKey } from '@/state/store'
import { isCine } from '@/state/machine'
import { transient } from '@/state/transient'
import { launch } from '@/state/actions'
import { labelDom } from '@/scene/SceneSystems'
import { cineControls } from '@/cinematic/CinematicDirector'

function Brand() {
  return (
    <header className="brand">
      <img className="brand-logo" src="/brand/redbull-logo.svg" alt="Red Bull" />
      <h1>
        Red Bull
        <br />
        RB<span className="num">16B</span>
      </h1>
      <p>Every panel, wing and wheel is live in your browser. Click the car to take it apart, double-click to launch it.</p>
    </header>
  )
}

const TOGGLES: [key: ToggleKey | 'explode', label: string][] = [
  ['explode', 'Exploded view'],
  ['auto', 'Turntable'],
  ['spin', 'Spin wheels'],
  ['drs', 'Open DRS'],
  ['sound', 'Engine sound'],
]

function Panel() {
  const livery = useStore(s => s.livery)
  const toggles = useStore(s => s.toggles)
  const exploded = useStore(selectExploded)
  const { setLivery, setToggle, dispatch } = useStore.getState()
  return (
    <aside className="panel" aria-label="Car options">
      <h2>Livery</h2>
      <div className="swatches">
        {LIVERIES.map((l, i) => (
          <button key={l.name} className="sw" aria-label={`${l.name} livery`} aria-pressed={i === livery} onClick={() => setLivery(i)}>
            <span style={{ background: `linear-gradient(135deg,${l.base} 0 52%,${l.accent} 52% 78%,${l.accent2} 78%)` }} />
          </button>
        ))}
      </div>
      <div className="livname">{LIVERIES[livery].name}</div>
      <h2>Show</h2>
      <div className="toggles">
        {TOGGLES.map(([key, label]) => {
          const on = key === 'explode' ? exploded : toggles[key]
          return (
            <button
              key={key}
              className="tog"
              aria-pressed={on}
              onClick={() => (key === 'explode' ? dispatch('tapCar') : setToggle(key, !on))}
            >
              <span>{label}</span>
              <i />
            </button>
          )
        })}
      </div>
      <button className="launch" onClick={launch}>
        <span>Launch sequence</span>
        <span aria-hidden="true">&#9654;</span>
      </button>
      <div className="specs">
        <div><b>1.6 L V6</b>Turbo hybrid</div>
        <div><b>8-speed</b>Gearbox</div>
        <div><b>13 in</b>Wheels</div>
        <div><b>752 kg</b>Minimum mass</div>
      </div>
    </aside>
  )
}

function ViewBar() {
  const active = useStore(s => s.activeView)
  return (
    <nav className="views" aria-label="Camera views">
      {VIEWS.map((v, i) => (
        <button key={v[0]} aria-pressed={i === active} onClick={() => useStore.getState().setView(i)}>
          {v[0]}
        </button>
      ))}
    </nav>
  )
}

function Labels() {
  return (
    <div id="labels" aria-hidden="true" ref={el => { labelDom.wrap = el }}>
      {LABELS.map((l, i) => (
        <div key={l.title} className="lbl" style={{ transitionDelay: `${i * 70}ms` }} ref={el => { labelDom.els[i] = el }}>
          <div>
            <b>{l.title}</b>
            <span>{l.sub}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Letterbox bars + HUD. Numbers update from the transient store via rAF, not React state. */
function Letterbox() {
  const gear = useRef<HTMLSpanElement>(null)
  const kmh = useRef<HTMLSpanElement>(null)
  const cine = useStore(s => isCine(s.phase))
  useEffect(() => {
    if (!cine) return
    let raf = 0
    const tick = () => {
      if (gear.current) gear.current.textContent = transient.gear
      if (kmh.current) kmh.current.textContent = String(transient.kmh)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [cine])
  return (
    <>
      <div className="bar top">
        <div className="cap">Red Bull Racing <em>/</em> Launch sequence</div>
        <button className="skip" onClick={() => cineControls.skip()}>Skip</button>
      </div>
      <div className="bar bot">
        <div className="hud"><small style={{ marginLeft: 0 }}>GEAR</small><span ref={gear}>N</span></div>
        <div className="hud"><span ref={kmh}>0</span><small>KM/H</small></div>
      </div>
    </>
  )
}

function Loader() {
  const { active, progress } = useProgress()
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    const ready = document.fonts?.load ? Promise.all([document.fonts.load('italic 800 40px "Barlow Condensed"'), document.fonts.ready]) : Promise.resolve()
    Promise.race([ready, new Promise(r => setTimeout(r, 1800))]).then(() => setFontsReady(true), () => setFontsReady(true))
  }, [])
  // wait for the shader warm-up (scene/Warmup.tsx) so the first launch doesn't stall on shader compiles
  const [warmed, setWarmed] = useState(false)
  useEffect(() => {
    if (warmed) return
    const id = setInterval(() => transient.ready && setWarmed(true), 100)
    return () => clearInterval(id)
  }, [warmed])
  const done = fontsReady && !active && progress >= 100 && warmed
  return (
    <div id="loader" className={done ? 'done' : ''}>
      <span>{active ? `Building the chassis… ${Math.round(progress)}%` : 'Building the chassis…'}</span>
    </div>
  )
}

export function Overlay() {
  const phase = useStore(s => s.phase)
  useEffect(() => {
    document.body.classList.toggle('cine', isCine(phase))
  }, [phase])
  return (
    <>
      <Brand />
      <Panel />
      <ViewBar />
      <div className="hint">Click the car to take it apart. Double-click to launch. Drag to orbit, right-drag to pan, scroll to zoom.</div>
      <Labels />
      <Letterbox />
      <Loader />
    </>
  )
}
