# Red Bull RB16B — 3D studio (React Three Fiber)

A premium interactive showroom for Red Bull (our event sponsor, with permission to use their brand and sponsor marks).
The car sits on a studio floor in orbit view. **Click** the car: it dismantles and the power unit comes alive.
**Double-click** (or L / Space / Launch button): a cinematic launch sequence. The camera flies to a top shot, the
engine fires, the car launches down a night track (chase → side → front shots), then returns to the same floor.

Behaviour and timing are a faithful port of the vanilla three.js prototype `reference/aurora-studio.html`
(the source of truth for numbers). Improvements on top: GSAP timelines, post-processing, sample-based engine audio,
the licensed RB16B mesh, a Red Bull livery and decals, pan, and a dark studio with a floor emblem.

## Commands

| | |
|---|---|
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm run build` | typecheck + production build |
| `npm run build:car` | rebuild `public/models/rb16b.glb` from `assets-src/RB16B_FIXED!.stl` |
| `npm run build:engine` | rebuild `public/models/engine.glb` from `assets-src/f1_engine_exposed_reconstruction.glb` |
| `node scripts/car/fit-wheels.mjs` | fit true wheel centres from the tyre tread (if wheels ever wobble) |
| `npm run shots` | headless-Edge screenshots of idle / exploded / views / launch frames → `shots/` (dev server must be running) |
| `node scripts/dev/interact.mjs` | real-mouse smoke test: click-explode, double-click launch, skip, drag ≠ click |
| `node scripts/dev/compare.mjs <dir>` | prototype vs app screenshots, light + dark |
| `node scripts/car/probe.mjs` | ray-cast the mesh for surface points + normals (decal/label placement) |
| `node scripts/car/inspect-glb.mjs public/models/rb16b.glb` | list GLB nodes, pivots, materials |

The visual scripts use `playwright-core` with the system Edge (`channel: 'msedge'`), so there's no browser download.
**Verify visual changes with `npm run shots` and look at the images.** A typecheck doesn't show what the user sees.

## Stack

Vite 8 · TypeScript 7 (strict; `paths` must be relative, `baseUrl` is removed) · React 19 · three 0.186 ·
@react-three/fiber 9 · drei 10 · @react-three/postprocessing 3 · GSAP 3 · zustand 5. Path alias `@/` → `src/`.

## World conventions

- Metres. **+X forward** (nose tip x ≈ 2.87), **+Y up**, **+Z = car's right**. Wheelbase 3.6 m (axles at x ≈ ±1.8).
- Orbit target `(0, 0.38, 0)`.
- ColorManagement is on: hex colours are already linear-converted. Never use the prototype's `lin()`.
- Lights are physical units. Prototype intensities are ×π for parity (see `scene/Lighting.tsx`).

## The car asset pipeline (`scripts/car/`)

The licensed model is a 3D-print STL: one fused shell (~111k tris), no parts, no UVs, no interior.
`build-car.mjs` turns it into a dismantle-ready GLB:

1. **Transform** (`segment.mjs → loadSTL`): STL frame (nose at −Y, Z up, right = −X, print units) → world, scale `3.6 / 126.3`.
2. **Smooth normals** over the *whole* welded mesh (crease 40°) before cutting, so there are no seams at part cuts.
3. **Clip** triangles exactly along region-limited cut planes (`CUT_PLANES`), so part edges are clean, not jagged.
   The floor cut is a raked plane (`y = 0.17 − 0.025x`).
4. **Classify** by triangle centroid (`partOf`), then assign a surface material (`materialOf`: paint / carbon / tyre / rim / helmet).
5. **Write** one node per part with one primitive per material. Body parts stay in **car space** (node at origin), exactly
   like the prototype's part groups, so the explode maths and the object-space livery shader work unchanged.
   Wheels get axle pivots (spin on local Z), computed per wheel from the **tyre's own bounding box**. A hand-measured
   centre put the front wheels 13–15 mm off-axis, so they wobbled like loose wheels. Each tyre is round within ±1.5 mm around its pivot. `RearWing_Flap` gets its hinge pivot (DRS rotates on local Z).
6. **Compress**: meshopt + quantized normals. Positions stay **float**, because quantizing them adds node transforms,
   which breaks the car-space shader and decal projection. Don't use gltf-transform's `meshopt()`: it force-quantizes positions.
   Mesh names are `${part}_mesh`, because GLTFLoader uniquifies node/mesh name clashes.

Parts: `Chassis (front monocoque), FrontWing (incl. nose), Halo, Driver, Sidepod_L/R, EngineCover, Floor, Gearbox
(casing + rear suspension, x < −1.3), RearWing (incl. beam wing, diffuser, crash structure), RearWing_Flap, Wheel_FL/FR/RL/RR`.

## Interior (procedural, fills what the STL shell lacks)

Cavity sizes come from `scripts/car/probe-interior.mjs`. The shell is empty between the cockpit bulkhead (x 0.03) and the gearbox (x −1.35).
- `car/PowerUnit.tsx`: the **supplied engine model**, prepared by `scripts/car/build-engine.mjs`:
  - **Dropped:** the display stand (chassis pan, rails, diffuser fins), the ivory front housing, its own gearbox (the STL has one) and its tailpipe.
  - **Normals:** the source has **no normals** (NaN lighting turned the whole frame black through bloom), so crease-angle normals are computed.
  - **Fit:** 180° turn + scale 0.56 + offset (`ENGINE_FIT`) are baked in, so it sits in car space in the bay (x −1.20 … −0.13, y 0.16 … 0.85, |z| ≤ 0.27).
  - **Groups:** parts are split into stage nodes `PU_Block, PU_HeadL/R, PU_ExhaustL/R, PU_Intake, PU_MGUK, PU_Turbo, PU_Ancillaries` and joined per material (275 → 44 draw calls).
  - **Runtime:** each stage has its own explode window (d 0.60–0.76, 0.2 wide), so the engine comes apart after the PU lifts. A tailpipe is routed
    from the turbo outlet to the STL exhaust exit. Bright machined parts are toned down below bloom, and the MGU-K housing glows when energised.
    Stages register in `carRefs.parts` so labels can anchor to them.
- `car/Interior.tsx`: `FuelCell` (bladder, energy store with HV band, rear bulkhead), `Seat`, `DriverBody` (suit, HANS, gloves),
  `SteeringWheel` (live canvas dash: rev LEDs, gear, speed from `transient`).
- `car/WheelAssembly.tsx`: the STL's solid wheel discs (`rim` primitive) are hidden. Instead: spoked 13" rim, hub, centre-lock nut,
  carbon brake disc (emissive under braking) spinning with the wheel, plus a static caliper on the upright.
- Inner faces of cut paint panels render as triplanar carbon (paint shader, `!gl_FrontFacing`).
- Exploded view pulls the camera back/up (`ORBIT.explodedPhi/explodedR`) and restores it on reassembly.

## Race track (`scene/RaceTrack.tsx`)

Night street circuit, faded in by `m`:
- **Static backdrops:** sky dome shader (horizon glow + stars, horizon = `NIGHT.bg` = fog colour) and a skyline cylinder (canvas silhouettes, lit windows, aviation lights).
- **Scrolling on a 300 m loop by `dist`:** asphalt (racing line, kerbs), barriers with LED ad boards (logos, `adBoardTexture`), catch fence,
  instanced floodlight gantries, 6 grandstands with instanced crowd (bodies + heads), an overhead Red Bull bridge, speed streaks.
- Night fog: near 40 / far 210. `Stage.tsx` now only does the studio floor + background/fog mix.

To tune a cut, edit thresholds in `segment.mjs`, run `npm run build:car`, then `npm run shots`.

## Prototype → app system map

| Prototype system (aurora-studio.html) | Lines | Now lives in |
|---|---|---|
| Renderer, ACES, shadows, DPR | 194–206 | `App.tsx` `<Canvas>`. The composer forces NoToneMapping, so ACES is a `<ToneMapping>` effect in `scene/Effects.tsx` |
| `buildEnv` PMREM panels | 211–230 | `scene/Lighting.tsx` `StudioEnvironment` (Lightformers) |
| Lights | 232–242 | `scene/Lighting.tsx` (×π) |
| Canvas textures | 244–275, 607–618 | `three/textures.ts` (+ `svgTexture` for brand logos) |
| Livery shader + materials | 277–311 | `three/materials.ts`. No UVs, so livery zones (yellow nose, dark lower body, dark inner faces) and a **triplanar** carbon weave come from object-space position/normal. Tyres get a red sidewall band in axle space |
| Car part groups `part(off,d,rot)` | 401–592 | GLB nodes + `config/parts.ts` (offsets, delays, rotations, labels) + `car/Car.tsx` `ExplodablePart` |
| Power unit + animation | 489–510, 910–917 | `car/PowerUnit.tsx` (rebuilt as a detailed V6 with staged sub-explode) |
| Decals | 391–398 | `car/Decals.tsx` (drei `<Decal>` projection) + `config/decals.ts` (placements from `probe.mjs`) |
| Studio floor, `applyMix` | 594–604, 656–667 | `scene/Stage.tsx` (+ Red Bull floor emblem) |
| Track, posts, walls, streaks | 606–637, 924–931 | `scene/RaceTrack.tsx` (full night-circuit environment) |
| Orbit camera, fit, views, tap / double-tap, wheel, pinch | 700–750, 885–892 | `scene/CameraRig.tsx` (`rig` shared object; + pan: right-drag / shift-drag / two-finger) |
| Keyboard | 757–767 | `hooks/useKeyboard.ts` |
| Engine synth | 769–800 | `audio/engine.ts` (sample layers when `public/audio/*` exist, synth fallback) |
| Cinematic `updateCine`, `T`, shots, skip | 802–875 | `cinematic/CinematicDirector.tsx` (one GSAP master timeline driven by the R3F clock) + `cinematic/shots.ts` + `config/timeline.ts` |
| Explode easing `exT` | 896 | `scene/SceneSystems.tsx` `ExplodeDriver` (GSAP, duration = remaining × 1.9 s, reversible) |
| Car lift, roll, wheels, brakes, DRS, rain light | 897–922 | `car/Car.tsx` `useFrame` |
| Labels projection | 639–651, 933–941 | `scene/SceneSystems.tsx` `LabelProjector` + `ui/Overlay.tsx` `Labels` |
| DOM UI, letterbox HUD, loader | 137–169 | `ui/Overlay.tsx`, `index.css` |

## State machine (`state/machine.ts`, `state/store.ts`)

```
idle ──click car──▶ exploded ──click car──▶ idle          (explode reverses mid-flight)
idle / exploded ──dbl-click · L · Space · Launch──▶ cinematic   (reassembles during the fly-to-top)
cinematic ──t ≥ T.decel  or  Skip──▶ returning ──t ≥ T.end──▶ idle (camera snaps to Three-quarter)
```

- Pure `transition(phase, event)` table. Invalid events are ignored (e.g. clicks during the cinematic).
- Entering `cinematic` forces Spin wheels and DRS off.
- **Per-frame values live in `state/transient.ts`** (explode, s, cx, m, rpm, eng, dist, roll, brake, flap, HUD). They're
  written by GSAP/useFrame and read in useFrame. Never put them in React state.
- useFrame order: CinematicDirector (−2) → CameraRig (−1) → everything else (0).

## Timeline (`config/timeline.ts`, seconds)

`top 1.8 · ign 2.0 · launch 3.6 · chase 4.8 · side 7.2 · front 9.4 · decel 11.2 · home 13.6 · end 14.8`.
GSAP lanes reproduce the prototype curves exactly: camera blends = `power2.inOut` (= prototype `eio`); speed = `1−(1−x)^2.2`
then `power2.inOut` down; car nudge, track mix, roll and brake glow use a smoothstep ease. Skip seeks:
pre-launch → home, mid-run → decel, decel → home. The rpm curve and camera shake stay procedural, as in the prototype.

## Branding (`public/brand/`)

- Supplied so far: `redbull-logo.svg` (bulls, sun, wordmark) and `oracle-mark.svg` (the Oracle ring only; **the ORACLE
  wordmark has not been supplied**). Placements are in `config/decals.ts`. Add sponsors there plus files in `public/brand/`.
- Never trace or redraw logos from photos. Ask for official files (`public/brand/README.md`).
- Livery hex values in `config/liveries.ts` are eyeballed from photos. **TODO:** replace them with official brand values.
- The site defaults to the dark studio (`<html data-theme="dark">`). Remove the attribute to follow the OS scheme like the prototype.

## Audio (`public/audio/`)

`config/audio.ts` lists the expected loops (idle/low/mid/high + optional ignition). They crossfade with equal power by rpm
and are pitched with playbackRate. **No samples are in the repo yet.** Until all four loops exist, the prototype synth plays.
The AudioContext unlocks inside the launch gesture (`state/actions.ts`).

## Gotchas

- StrictMode re-runs memos: `Car.tsx` caches each glTF material name in `mesh.userData.matName` before swapping materials.
- drei `<Decal>` projects in the target mesh's local space. Body meshes are car-space, so decals ride with their part.
- Bloom threshold is 1.6. Only real emissives (exhaust ×2.2, rain/brake ×3) should cross it. Keep floor and decal brightness below it.
- `shadows="percentage"`: PCFSoftShadowMap no longer exists in three r18x.
- Reference images in `reference/images/` are mood/proportion references. `dismantel_parts.jpg` is the exploded-view target.

## Open items

- Official livery colours, the ORACLE wordmark, other approved sponsor files, licensed engine audio samples.
- Perf: the three bundle is ~1.47 MB (code-split later); the GLB is 1.85 MB before HTTP compression.
- Possible next premium steps: reflective floor (MeshReflectorMaterial), staged engine-reveal sub-steps, mobile tuning.
