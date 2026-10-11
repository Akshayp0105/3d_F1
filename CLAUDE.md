# Red Bull Racing — 3D studio (React Three Fiber)

> Codename from the prototype: *Aurora AR-27*. The production site is Red Bull–branded (see *Branding & sponsor assets*).

A premium, interactive 3D showroom for a realistic Red Bull Racing F1 car, built for Red Bull as event sponsor. The car sits on a studio floor in orbit
view. **Click** the car: it dismantles into its parts and the power unit comes alive. **Double-click**: the
camera flies to a top shot, the engine fires, the car launches into a racing sequence, then it comes back to
the same floor.

We are porting a working vanilla Three.js r128 prototype to a component-based R3F app and making it more
premium. **This file is the plan. Phase 0 is scaffold + plan only. No features have been built yet.**

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite 8 + TypeScript 7 (strict) | `npm run dev`, `npm run build`, `npm run typecheck`. Path alias `@/` → `src/`. |
| UI | React 19 | |
| 3D | three 0.186 + @react-three/fiber 9 | |
| Helpers | @react-three/drei 10 | CameraControls, Environment/Lightformer, Html, ContactShadows, MeshReflectorMaterial, useProgress |
| Post FX | @react-three/postprocessing 3 (postprocessing 6) | |
| Timelines | GSAP 3 | Cinematic master timeline only (see *Animation ownership*) |
| State | zustand 5 | Phase machine, livery, toggles. Per-frame values live in a transient store, **not** React state. |

## Reference material (`reference/`)

- `reference/aurora-studio.html` is the **source of truth** for geometry, materials, timings and behaviour.
  Port its numbers exactly first, then improve on them.
- `reference/aurora-studio.md`: the prototype's text and copy.
- `reference/images/` is mood and proportion reference only:
  - `full_view.jpg`, `front_view.webp`, `top_view.jpg`: hero lighting. A dark studio, a big painted emblem disc on the floor, a navy/red/yellow livery.
  - `floor.jpg`: emblem-on-floor treatment (diagonal split, central sun disc).
  - `dismantel_parts.jpg`: **target look for the exploded view**. Parts float apart in place and the PU stays visible in the middle.
  - `car_parts.jpg`: top-down flat-lay of every component. Use it to decide which sub-parts get their own explode offsets.
  - `car_skeleton.jpg`: cutaway (halo, MGU-K, MGU-H, 1.6 L V6, venturi tunnels). Source for label copy and PU detail.
  - `orbit_pose.jpg`: showroom three-quarter pose from above. This is the default camera feel.
  - `car_on_track.jpg`, `orbit_track_view.jpg`, `cabin_view.jpg`: cinematic look (motion blur, night track, kerbs, onboard).
  - `back_view.jpg`: rear wing, crash structure, rain light and exhaust detail.
- **Brand rule (updated 2026-10-11):** this site is built **for Red Bull, our event sponsor, with permission to use
  their brand**. The car carries the full Red Bull Racing livery and sponsor decals, aiming for a realistic match to
  the reference photos. See *Branding & sponsor assets* below. The "Aurora AR-27" naming in the prototype is
  replaced by Red Bull Racing branding throughout (title, copy, decals, floor emblem).

## Branding & sponsor assets

- **Only official vector files.** Logos come from Red Bull's brand team / brand portal as SVG (or ≥ 4K PNG with alpha).
  We never trace, redraw or AI-generate a logo from the reference photos. The result would be off-brand.
- Files go in `public/brand/` and are listed in `public/brand/manifest.json` (see `public/brand/README.md` for the
  required file list). Code reads the manifest, so swapping or adding a sponsor never needs a code change.
- Until the real files arrive, every decal slot renders a neutral placeholder plate with the slot name, so layout
  can be built and reviewed.
- **Livery colors:** take exact values from the Red Bull brand guidelines (matte navy body, red, yellow nose).
  `src/config/liveries.ts` holds the official tokens. Don't eyeball hex values from the photos. Matte navy means low
  clearcoat and a satin finish, unlike the prototype's glossy paint.
- **Decal placement map** (`src/config/decals.ts`), based on `front_view.webp`, `top_view.jpg`, `full_view.jpg`, `back_view.jpg` and `cabin_view.jpg`:
  front-wing upper element, nose tip (yellow) + car number, nose top, cockpit surround / halo, sidepod flanks,
  engine cover (charging-bull artwork), rear-wing main plane + endplates, wheel covers. The floor emblem (sun disc +
  charging bulls, after `floor.jpg`) goes on the studio turntable disc.
- Decals are rendered as `DecalGeometry`-projected meshes (drei `<Decal>`) on the body, so they wrap the curved surfaces.
  The prototype's flat planes only work on flat panels.
- **Team to confirm** which sponsor marks are approved for this event build, and the car number / driver helmet artwork.

## Car model source (decided 2026-10-11): licensed GLB

- The hero car is a **licensed, high-detail GLB** of the Red Bull Racing car (commercial licence), with named part
  nodes for the dismantle. The full vendor/purchase spec is in **`docs/model-spec.md`**: node names, pivots, axes, budgets, acceptance checks.
- Pipeline: source `.glb` → `npx @gltf-transform/cli optimize` (Meshopt or Draco + KTX2 textures) →
  `public/models/rb-car.glb`. Load it with drei `useGLTF` (+ `useKTX2` / meshopt decoder) and get typed nodes via `npx gltfjsx --types`.
- **The prototype's part groups map to GLB nodes by name** (`Chassis`, `FrontWing`, `Halo`, `Sidepod_L/R`, `EngineCover`,
  `PowerUnit`, `Radiator_L/R`, `Floor`, `RearWing` / `RearWing_Flap`, `CrashStructure`, `Wheel_XX` / `Wheel_XX_Spin`).
  `src/config/parts.ts` keys explode offsets, delays, rotations and labels by node name. `ExplodablePart` attaches to the
  GLB node instead of wrapping procedural JSX.
- **The procedural car stays as a stand-in**, behind the same node names (`src/car/procedural/`). Phases 1–3 can be built
  and tested before the model arrives, and the procedural car remains the low-end/fallback. Swapping is one prop:
  `<Car source="glb" | "procedural">`.
- PU animation targets GLB nodes: `PU_TurboImpeller` (spin), `PU_Piston_1…6` (Y), `PU_ExhaustTip` (glow + light anchor),
  emissive materials on `PU_MGUK` / cables. A missing optional node is skipped and must not crash.
- Realism comes from the asset plus lighting: HDRI studio environment (a Lightformer rig layered over a studio HDR),
  accurate matte-navy paint, tyre sidewall detail, and Phase 4 postprocessing.

## World conventions (taken from the prototype; keep them)

- Units are metres. **+X is forward** (nose tip ≈ x 2.98, rear wing endplates ≈ x −2.8), +Y is up, Z is lateral (right = +Z).
- Wheel centres sit at x ±1.8, y 0.36 (3.6 m wheelbase). Front wheels are 0.30 wide at z ±0.78, rears 0.40 wide at z ±0.76. Tyre R 0.36.
- The orbit target is `(0, 0.38, 0)`.
- Prototype colors go through `lin(hex)` (sRGB→linear). In three ≥ r152, ColorManagement is on, so `new THREE.Color(hex)` and JSX color props are **already** converted. Drop `lin()` and never double-convert.

## Prototype → R3F system map

Each row names a prototype system (with its line range in `aurora-studio.html`) and the future file that owns it.

### Core / scene

| Prototype system | Lines | R3F target | Port notes |
|---|---|---|---|
| Renderer (ACES, exposure 1.08, PCFSoft shadows, DPR ≤ 2) | 194–206 | `src/App.tsx` `<Canvas>` props | `gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.08 }}`, `shadows="soft"`, `dpr={[1, 2]}`. R3F defaults to sRGB output (it replaces `outputEncoding`). |
| `buildEnv()` PMREM scene of emissive panels | 211–230 | `src/scene/StudioEnvironment.tsx` | drei `<Environment resolution={256} frames={1}>` with one `<Lightformer>` per panel (same positions, sizes, intensities). Rebuild it on theme change. |
| Lights: hemi 0.35, key 2.1 (shadow 2048, ±5 frustum), rim 1.3, fill 0.5 | 232–242 | `src/scene/Lighting.tsx` | **r155+ uses physical light units.** The prototype ran in legacy mode, so expect to scale the intensities by ~π. Tune by eye against `full_view.jpg`. |
| Theme tokens (`--scene`, `--floor`, `--disc`, `--shadow`) + `applyTheme` | 11–30, 668–680 | `src/hooks/useTheme.ts` + `src/config/theme.ts` | `matchMedia` listener writes the theme to the store. Scene background and fog read it. The CSS tokens stay in `index.css` for the UI. |
| Fog 14→40, background | 660–674 | `src/scene/Atmosphere.tsx` | `<fog attach>` and `<color attach="background">`, both lerped by `mix` (see track). |
| `.vignette` CSS overlay | 38–39 | `src/scene/Effects.tsx` | Replaced by the postprocessing `<Vignette>`. |

### Geometry & materials (pure modules, no React)

| Prototype system | Lines | R3F target | Port notes |
|---|---|---|---|
| `smoothNormals`, `shapeFrom`, `body` (extrude + taper), `rrect`, `rbox`, `mirrorZ`, `rod`, `airfoil`, `wing` | 313–390 | `src/three/geometry/*.ts` | Port verbatim as typed pure functions returning `BufferGeometry`. `rod` returns `{ geometry, position, quaternion }` so JSX can place it. |
| Canvas textures: `carbonTex`, `finTex`, `textTex`, `radialTex` | 244–275 | `src/three/textures/*.ts` | `t.encoding = sRGBEncoding` → `t.colorSpace = SRGBColorSpace`. `textTex` must wait for `document.fonts` (the loader gates on it, see Loader). |
| `trackTexture()` | 607–618 | `src/three/textures/track.ts` | Same canvas drawing, plus `colorSpace`. Repeat 300/8. |
| Livery paint shader (`onBeforeCompile` stripe / pinstripe / nose in object space) | 277–294 | `src/three/materials/liveryPaint.ts` | Keep `onBeforeCompile`. Uniforms `uBase/uAccent/uAccent2` are shared objects updated from the store. **Gotcha:** the stripe uses object-space `position`, so every paint mesh must keep geometry in car space (don't bake an offset into the mesh `position`). |
| Material set: carbon, accent, accent2, base, black, tyre, rim, chrome, Ti, alu, hv (emissive), mgukMat (emissive), radMat, plank, visor, rain (emissive), brake (emissive), exhaust glow (additive) | 295–311, 508 | `src/three/materials/useCarMaterials.ts` | One memoised material set per Canvas, exposed through context. Livery changes mutate colors and uniforms and never recreate materials. Emissive values feed Bloom later. |
| `decal()` + `decals[]` regenerated on livery change | 391–398, 688 | `src/car/Decal.tsx` + `src/config/decals.ts` | Sponsor decals load textures from `public/brand/manifest.json` (official files) and are projected with drei `<Decal>`. Canvas text textures remain only for the car number if no artwork is supplied. |

### The car

`car` group → `src/car/Car.tsx`. Every `part(off, d, rot)` group becomes an `<ExplodablePart offset delay rotation>` wrapper
(`src/car/ExplodablePart.tsx`). It reads `explode` from the transient store in `useFrame` and applies
`k = smoothstep(d, d + 0.55, explode)`, `position = off·k`, `rotation = rot·k`. Static definitions live in `src/config/parts.ts`.

> The `Component` column is the **procedural stand-in** (`src/car/procedural/`). The same part, keyed by GLB node name, drives the licensed model.

| Group | Offset (off) | Delay (d) | Rot | Contents | Lines | Component | Label |
|---|---|---|---|---|---|---|---|
| `chassisG` | 0 | 0 | 0 | Monocoque + nose (tapered extrude), cockpit rim, headrest, steering wheel, FW pylons, mirrors, **suspension** (wishbones, push-rods, uprights ×4) | 405, 417–444 | `parts/Chassis.tsx`, `parts/Suspension.tsx` | — |
| `frontWingG` | (0.85, −0.05, 0) | 0.10 | z 0.04 | 4 warped elements (top = accent), 2 endplates | 406, 446–455 | `parts/FrontWing.tsx` | Front wing — 4-element, adjustable flap |
| `haloG` | (0, 0.55, 0) | 0.30 | z −0.12 | Torus arch + centre strut + 2 rear legs | 407, 457–461 | `parts/Halo.tsx` | Halo — Titanium cockpit protection |
| `driverG` | (0, 0.3, 0) | 0.36 | — | Helmet, visor, stripe | 408, 463–466 | `parts/Driver.tsx` | — |
| `sidepodR` / `sidepodL` | (0, 0.06, ±0.62) | 0.18 | x ±0.06 | Sidepod extrude (L = `mirrorZ`), inlet, AURORA decal | 409, 468–477 | `parts/Sidepod.tsx` (`side={1\|-1}`) | Sidepod — Radiator inlets and cooling |
| `coverG` | (0, 0.78, 0) | 0.24 | z 0.05 | Engine cover, airbox intake, shark fin (accent), T-cam, "27" decals | 410, 479–487 | `parts/EngineCover.tsx` | Engine cover — Shark fin and T-cam |
| `puG` | (0, 0.2, 0) | 0.42 | — | Block, 2 cylinder banks, HV cables, turbo, MGU-K, exhaust + tip, impeller (9 blades), 6 pistons, exhaust glow + point light | 411, 489–510 | `parts/PowerUnit.tsx` | Power unit — 1.6 L V6 turbo hybrid |
| `radR` / `radL` | (0, 0.14, ±0.22) | 0.34 | — | Finned radiator, toed ±0.35 | 412, 512–513 | `parts/Radiator.tsx` | — |
| `floorG` | (0, −0.5, 0) | 0.45 | — | Floor plate, plank, fences ×8, edge wings, diffuser ramp, strakes ×4 | 413, 515–536 | `parts/Floor.tsx` | Floor — Ground-effect venturi tunnels |
| `rearWingG` | (−0.75, 0.32, 0) | 0.12 | z −0.05 | Spoon main plane, **DRS flap pivot** (`userData.flap`), beam wing, pillar, endplates + decals | 414, 542–557 | `parts/RearWing.tsx` (forwards a `flapRef`) | Rear wing — DRS upper flap |
| `crashG` | (−0.35, 0, 0) | 0.20 | — | Rear crash structure, rain light | 415, 538–540 | `parts/CrashStructure.tsx` | — |
| 4 × wheel parts | (±0.25, 0, ±0.6) | 0 | — | Lathe tyre, rim, carbon covers, accent ring, nut, accent2 bands + dots, brake disc (emissive) inside a `spin` group | 562–592 | `parts/Wheel.tsx` (forwards a `spinRef`) | — |
| Nose "27" decal | — | — | — | On `chassisG` | 559–560 | inside `Chassis.tsx` | — |

Shadow rule from line 653: transparent meshes don't cast shadows. Apply it in `Decal.tsx` and the glow meshes.

### Studio floor & race track

| Prototype system | Lines | R3F target | Port notes |
|---|---|---|---|
| Ground circle R 70, turntable disc R 3.9, accent ring, inner ring, contact-shadow plane (radial alpha) | 594–604 | `src/scene/StudioFloor.tsx` | Contact plane follows `car.x` (`cx`) and shrinks 25 % while exploded. Premium pass: an original painted emblem on the disc (after `floor.jpg`) and a subtle `MeshReflectorMaterial`. |
| Track plane 300×16 + scrolling texture, posts (60), walls + accent lines, speed streaks (70, additive) | 606–637 | `src/scene/RaceTrack.tsx` | Scrolls by `dist` (offset `dist/8`, posts wrap modulo 300, streaks modulo 120 at 1.25×). Visible only while `mix > 0.001`. |
| `applyMix(m)`: studio ↔ night track crossfade (bg, fog 14/40 → 24/140, floor color, disc/ring opacity, track/posts/walls opacity) | 656–667 | Each component reads `mix` from the transient store in `useFrame` and sets its own opacity / visibility. `Atmosphere.tsx` owns bg + fog. | No central "apply" function. Every consumer lerps its own properties. |

### Camera & input

| Prototype system | Lines | R3F target | Port notes |
|---|---|---|---|
| Custom spherical orbit (`orbit`/`want`, damping `1-exp(-5dt)`, phi 0.02–1.48, r 3.2–15 × fit) | 700–750, 885–892 | `src/scene/CameraRig.tsx` with drei `<CameraControls>` | Map elevation phi → polar angle `π/2 − phi`: `minPolarAngle 0.09`, `maxPolarAngle 1.55`. `minDistance/maxDistance` = 3.2/15 × fit. `smoothTime ≈ 0.2`. **New:** pan/truck (the user asked for "move"), clamped to a box around the car. Disable controls while `phase === 'cinematic' \| 'returning'`. |
| `computeFit()` (portrait → fov 40 + distance scaling) | 706–713 | `src/hooks/useFit.ts` | Reads `size` from `useThree`. Writes fov and the fit factor. |
| Views: Three-quarter, Front, Side, Rear, Top, Low (theta, phi, r) | 702, 715–721 | `src/config/views.ts` + `src/ui/ViewBar.tsx` | `controls.setLookAt(...)` with transition. Any user drag clears the active view. |
| Turntable: +0.2 rad/s after 2.5 s idle | 886 | `CameraRig.tsx` `useFrame` | `controls.azimuthAngle += 0.2·dt` when `toggles.auto` and idle. Off under reduced motion. |
| Tap vs double-tap (7 px / 400 ms tap test, 270 ms single-click delay, 320 ms double window) | 727–748 | `src/car/useCarPointer.ts` on the `<Car>` group | R3F `onClick` / `onDoubleClick`. Ignore clicks with `e.delta > 7` (that was a drag). Delay the single-click action 270 ms and cancel it if `onDoubleClick` fires. Double-click works from idle **and** exploded. |
| Keyboard: 1–6 views, E explode, R/T turntable, W wheels, D DRS, Space/L launch, Esc/Space skip | 757–767 | `src/hooks/useKeyboard.ts` | Ignore when focus is in an input. |

### Animation, cinematic, audio

| Prototype system | Lines | R3F target | Port notes |
|---|---|---|---|
| Explode progress `exT` (eases toward target at 1/1.9 per s, car lifts `0.5·ss(0,0.6,exT)`) | 880, 895–902 | `src/car/useExplodeDriver.ts` (one `useFrame` in `Car.tsx`) | Writes `transient.explode`. Target = 1 when `phase === 'exploded'`, else 0. Can reverse mid-flight. |
| Power-unit life: impeller spin, pistons (phased sine), MGU-K + HV emissive pulse, PU bob, exhaust glow/light | 910–917 | `parts/PowerUnit.tsx` `useFrame` | Driven by `act = max(ss(0.65,1,explode), engineOn)`. **Premium pass:** more PU sub-parts and an "engine composition" sequence that reveals block → banks → turbo → MGU-K/H in order (see `car_skeleton.jpg`). |
| Wheel spin + brake glow | 904–908 | `parts/Wheel.tsx` `useFrame` | Speed = toggle spin (22 rad/s, eased) or `min(40, s·VMAX/0.36)` in cine. Brake glow peaks on decel. |
| DRS flap (−0.55 closed ↔ −0.12 open) | 919–920 | `parts/RearWing.tsx` `useFrame` | Opens on toggle or when `s > 0.9` before decel. |
| Rain light blink | 922 | `parts/CrashStructure.tsx` `useFrame` | Faster blink with the engine on. |
| **Cinematic timeline** `T = {top 1.8, ign 2.0, launch 3.6, chase 4.8, side 7.2, front 9.4, decel 11.2, home 13.6, end 14.8}`, VMAX 82 | 802–875 | `src/cinematic/timeline.ts` (constants), `src/cinematic/shots.ts` (`shotTop/Chase/Side/Front`, `viewPos`), `src/cinematic/useCinematic.ts` | See *Animation ownership*. Computes `s` (speed 0–1), `cx` (car x nudge 1.4), `m` (track mix), `rpm`, `dist`, camera pos/look, shake, fov +9·s·m. |
| Car body roll on launch/decel (`rotation.z`), engine idle shake | 900–901 | `Car.tsx` `useFrame` | Reads transient `t`, `rpm`. |
| HUD (km/h = s·334, gear from s·7.2), letterbox bars, caption, Skip | 105–119, 166–167, 870–871 | `src/ui/Letterbox.tsx` | Updates the numbers **via refs from a transient subscription**, not React state, so it doesn't re-render at 60 fps. |
| Skip logic (pre-launch → home; mid-run → decel; decel → home) | 825–828 | `useCinematic.ts` `skip()` | Uses GSAP `timeline.seek(label)`. |
| Engine synth (3 osc → tanh shaper → LP → gain; f = 34 + rpm·200) | 769–800 | `src/audio/engineSynth.ts` | Plain class, not React. Create the AudioContext lazily on the user gesture. Must be idempotent under StrictMode double-mount. `stop()` on unmount. |

### UI (DOM, outside the Canvas)

| Prototype | Lines | Target |
|---|---|---|
| Brand title + blurb | 41–45, 137–140 | `src/ui/Brand.tsx` |
| Glass panel: livery swatches, toggles, launch button, specs | 47–65, 142–161, 682–698 | `src/ui/Panel.tsx`, `src/config/liveries.ts` |
| View pill bar | 67–73, 163 | `src/ui/ViewBar.tsx` |
| Hint | 74, 164 | `src/ui/Hint.tsx` |
| Part labels (projected DOM, staggered fade, shown at `explode > 0.93`) | 120–128, 639–651, 933–941 | `src/car/PartLabels.tsx`, drei `<Html>` anchored inside each part group (the anchor moves with the part, so no manual projection). Hidden in cinematic. |
| Loader ("Building the chassis…"), WebGL error | 77–80, 168–169, 947–958 | `src/ui/Loader.tsx` (gate on `document.fonts` + first frame), Canvas `fallback` |
| `body.cine` fades the UI out | 103–104 | `App.tsx` sets `data-phase` on the root, and CSS fades the UI |

## State machine

```
            click car                    click car
   ┌──────┐ ─────────▶ ┌──────────┐ ◀─────────────── (reverses mid-flight)
   │ idle │            │ exploded │
   └──────┘ ◀───────── └──────────┘
      ▲  │   click car       │
      │  │ dbl-click / L     │ dbl-click / L  (reassembles during the top-shot fly-in)
      │  ▼                   ▼
      │ ┌────────────────────────┐   t ≥ T.decel  or  skip()   ┌───────────┐
      │ │       cinematic        │ ──────────────────────────▶ │ returning │
      │ │ fly-to-top · ignition  │                             │ decel ·   │
      │ │ launch · chase · side  │                             │ fly home  │
      │ │ · front                │                             └─────┬─────┘
      │ └────────────────────────┘                                   │ t ≥ T.end
      └──────────────────────────────────────────────────────────────┘
                     (camera = Three-quarter view, controls re-enabled)
```

| Phase | Entered by | Explode target | Controls | UI | Exits |
|---|---|---|---|---|---|
| `idle` | boot, click while exploded, `returning` finished | 0 | on, turntable allowed | panel, views, hint | click car → `exploded`; dbl-click / L / Space / Launch → `cinematic` |
| `exploded` | click car while idle | 1 (PU animates past 0.65, labels past 0.93) | on | + labels | click car → `idle`; dbl-click / L → `cinematic` |
| `cinematic` | `launch()` | 0 (forced) | off | letterbox + HUD; panel hidden | `t ≥ T.decel` → `returning`; `skip()` before launch → `returning` (seek to `home`), during the run → `returning` (seek to `decel`) |
| `returning` | timeline reaches `decel`, or skip | 0 | off | letterbox | `t ≥ T.end` → `idle` (snap controls to view 0, restore fov, stop audio) |

- **Store** (`src/state/store.ts`, zustand): `phase`, `livery`, `toggles {auto, spin, drs, sound}`, `theme`, `activeView`, plus
  actions `toggleExplode()`, `launch()`, `skip()`, `setLivery()`, `setView()`, `setToggle()`. Transitions live in
  `src/state/machine.ts` as a pure `transition(phase, event) → phase` table. Actions call it and ignore invalid events
  (for example, clicking during the cinematic does nothing). The `explode` toggle in the panel maps to `toggleExplode()`.
- **Transient store** (`src/state/transient.ts`): a plain mutable object (or zustand `subscribe` without React).
  It holds `explode, cineT, s, cx, m (mix), rpm, eng, dist`. It is written in `useFrame` and read in `useFrame`. **Never `setState` per frame.**
- Starting the cinematic forces `spin=false`, `drs=false` and explode target 0 (prototype line 821).

## Animation ownership (rules)

1. **One master GSAP timeline per launch** (`useCinematic.ts`), built paused, with labels `top ign launch chase side front decel home end`
   at the `T` times. It advances on the R3F clock (`tl.time(t)` inside `useFrame`, not GSAP's ticker), so it stays in sync with rendering and pauses with the tab.
   GSAP owns sequencing, labels and seeking (skip). The camera path formulas from `shots.ts` are still evaluated per frame,
   because they depend on `cx` and the time (the chase shot wobbles).
2. **Continuous, physics-ish motion** (wheels, pistons, impeller, DRS easing, explode easing, turntable) stays in `useFrame` with
   frame-rate-independent damping (`1 - exp(-k·dt)`), exactly like the prototype. Clamp `dt` to 0.05.
3. Respect `prefers-reduced-motion`: no camera shake, no streaks, no idle bob, and the turntable stays off by default.
4. Dispose of imperatively built geometry, materials and canvas textures on unmount. StrictMode double-mounts in dev.

## Target file tree

```
src/
  main.tsx  App.tsx  index.css
  config/      liveries.ts  views.ts  parts.ts  decals.ts  theme.ts
  state/       store.ts  machine.ts  transient.ts
  three/
    geometry/  smoothNormals.ts shape.ts body.ts rbox.ts mirrorZ.ts rod.ts wing.ts
    textures/  carbon.ts fin.ts text.ts radial.ts track.ts
    materials/ liveryPaint.ts useCarMaterials.ts
  scene/       Experience.tsx Lighting.tsx StudioEnvironment.tsx Atmosphere.tsx
               StudioFloor.tsx RaceTrack.tsx CameraRig.tsx Effects.tsx
  car/         Car.tsx ExplodablePart.tsx PartLabels.tsx Decal.tsx
               useExplodeDriver.ts useCarPointer.ts
               GlbCar.tsx  (typed from gltfjsx, used once the model arrives)
               procedural/ Chassis Suspension FrontWing Halo Driver Sidepod EngineCover
                      PowerUnit Radiator Floor RearWing CrashStructure Wheel (.tsx)
public/
  models/      rb-car.glb (optimised)
  brand/       manifest.json + official logo files (see README.md)
docs/          model-spec.md
  cinematic/   timeline.ts shots.ts useCinematic.ts
  audio/       engineSynth.ts
  hooks/       useFit.ts useTheme.ts useKeyboard.ts useReducedMotion.ts
  ui/          Brand.tsx Panel.tsx ViewBar.tsx Hint.tsx Letterbox.tsx Loader.tsx
reference/     aurora-studio.html  aurora-studio.md  images/
```

## Build phases

- **Phase 0 (done):** scaffold, dependency install, reference files moved into `reference/`, this plan. `src/App.tsx` is a placeholder box.
- **Phase 0.5 (parallel, non-code):** source the licensed GLB per `docs/model-spec.md`, and get the official brand files + approved sponsor list (`public/brand/README.md`).
- **Phase 1, static car:** port the procedural stand-in under the GLB node names, the studio floor, lighting, environment, CameraRig with views, and the decal system on placeholders. Acceptance: side by side with the prototype at the Three-quarter view, it is visually equivalent.
- **Phase 1b, GLB swap-in (when the model lands):** optimise, `gltfjsx` types, map nodes in `parts.ts`, real livery + decals, retune lighting for realism.
- **Phase 2, dismantle:** store + machine, ExplodablePart, explode driver, click handling, labels, PU animation.
- **Phase 3, cinematic:** timeline, shots, track/posts/streaks, mix crossfade, HUD/letterbox, skip, engine audio, body roll, DRS/brakes.
- **Phase 4, premium pass:** postprocessing (Bloom on emissives, SMAA, N8AO, Vignette; ChromaticAberration and a radial/motion blur scaled by `s·m` during the run), `MeshReflectorMaterial` floor + original emblem, Lightformer tuning, staged "engine composition" reveal, more PU sub-parts after `car_parts.jpg`, a better loader.
- **Phase 5, polish:** mobile layout + pinch, perf (DPR scaling with `PerformanceMonitor`, merged static geometry per part), a11y (keyboard, `aria` on the canvas, reduced motion), code-splitting the three bundle (currently ~1.1 MB).

## Gotchas found while planning

- TypeScript 7: `baseUrl` was removed, so `paths` entries must be relative (`"./src/*"`).
- r128 → r186: `outputEncoding`/`texture.encoding` → `colorSpace`. `convertSRGBToLinear` is unnecessary. Light units are physical (retune intensities). `onBeforeCompile` and `#include <color_fragment>` still exist.
- `mirrorZ` flips triangle winding by swapping vertex 1↔2. It relies on non-indexed geometry (which `smoothNormals` guarantees).
- Paint and the livery shader depend on object-space coordinates. See the materials table.
- Double-click must not also toggle explode. Use the 270 ms deferred single click.
