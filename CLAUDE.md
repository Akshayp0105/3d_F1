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
| `npm run build:tyre` | rebuild `public/models/tyre.glb` from `assets-src/pirelli_f1_slick_tire_hub_cover.glb` |
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
   centre put the front wheels 13–15 mm off-axis, so they wobbled like loose wheels. Each tyre is round within ±1.5 mm around its pivot.
   **Front wheels are copies of the rear wheels** (same side, scaled to the front tyre's diameter/width, centred on
   the front tyre). Cutting the fronts out of the fused STL also cut non-round upright/brake-duct pieces that spun with
   the wheel and looked loose. Verify with `node scripts/car/check-wheels.mjs` (fronts must match rears). `RearWing_Flap` gets its hinge pivot (DRS rotates on local Z).
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
- `car/WheelAssembly.tsx`: the STL's tyres and solid wheel discs (`tyre` / `rim` primitives) are hidden but kept as the fit reference.
  Instead each wheel gets the **supplied Pirelli wheel** (`public/models/tyre.glb`, built by `scripts/car/build-tyre.mjs`):
  textured P Zero slick (lettering + red soft-compound band in its texture), forged rim, carbon aero hub cover, inboard brake disc.
  - **Build:** drops the calipers, the inboard hub cover/hub/spokes and the outboard disc; computes crease normals (the source has none);
    simplifies (the tyre alone was ~200k tris) and compresses textures to WebP. Materials are not deduped (the `disc` copy must survive).
  - **Fit:** uniform radial scale to the STL tyre radius, axial scale to its width. +Z is outboard; left wheels turn 180° about Y
    (not mirrored, so the lettering reads correctly). The rubber is darkened at runtime (the source reads dusty grey).
  - The disc uses the car's `disc` material (emissive under braking) and spins with the wheel. A static caliper on the
    upright straddles the disc edge.
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

## Realism pass 3 (pistons, exterior, studio, performance)

- **Pistons** (`car/Pistons.tsx`): `build-engine.mjs` drops the engine model's solid cylinder barrels and records each
  bore's top/axis/length/radius (principal-axis fit, car space) in the `Engine` node extras. At runtime each bore is an
  open liner with a piston on a true slider-crank (rod/crank 3.3) in V6 firing order (1-4-2-5-3-6, 120°). It turns
  slowly once the heads lift in the exploded view and at engine rpm while running.
- **Exterior:** sponsor wordmarks from the supplied Oracle model (`scripts/car/extract-decals.mjs` → `public/brand/*.png`)
  are projected via `config/decals.ts`: Oracle (sidepods, rear-wing top), TAG Heuer (nose), Mobil 1, Bybit (floor edge), Ford
  (rear endplates). Tyre markings come from the Pirelli wheel model's texture. N8AO ambient occlusion.
- **Studio** (`scene/Showroom.tsx`): reflective turntable (drei `MeshReflectorMaterial`), cyclorama gradient wall, two curved
  team LED walls (texture U mirrored, since they're viewed from inside), vertical light strips (also added as environment
  Lightformers, so they reflect on the paint), overhead truss + softboxes, a volumetric spotlight.
  `scene.environmentIntensity` drops to 0.28 at night.
- **Race sky:** fbm night clouds lit by the city, plus a second, nearer skyline ring for depth.
- **Performance rules (measured with `scripts/dev/fps.mjs`, `scripts/dev/stalls.mjs`):**
  - Never add or remove lights at runtime (light count is in the shader key, so every shader recompiles). Fade intensity instead.
  - Toggling `material.transparent` also recompiles (`opaque` is in the key).
  - drei's reflector re-renders the whole scene every frame even when hidden, so it is only mounted outside the launch sequence.
  - `scene/Warmup.tsx`: after load and behind the loader, renders the race state (mix 1, then 0.5) and runs `gl.compile`.
    The loader waits for `transient.ready`. Result: race went from 5 fps (multi-second compile stalls) to 144 fps.
    It also waits until the car and the Pirelli wheels are in the scene: loads can finish before they mount, and compiling
    without them caused an intermittent 6 s stall at the blast.
  - Dev builds expose the renderer as `window.__gl` for these scripts.

## Realism pass 4 (body + stadium)

- **Body:** paint is satin (clearcoat 0.5 / roughness 0.42) with procedural **panel seams** and engine-cover fasteners in
  the paint shader (`SEAM(...)` lines in `three/materials.ts`, car-space planes, AA'd with `fwidth`). Carbon is less glossy.
  - **Studio glare:** the bright white patches on up-facing surfaces came from the **rim light's specular** (found by
    toggling lights via `window.__scene` in dev). The rim is now 0.45π, the env top panel is 2.4, and the env strips are 1.1.
  - Don't add `sheen` to the paint: it halved the exploded/race frame rate.
- **Stadium** (`scene/RaceTrack.tsx`):
  - **Crowd:** painted crowd strips per tier (`crowdTexture`: fans, caps, raised arms, flags, empty seats, roof-light
    gradient), merged into one mesh per stand. This replaced ~14k instanced boxes.
  - **Camera flashes:** a `points` shader that twinkles.
  - **Floodlights:** light pools on the asphalt (instanced additive quads) and a glare sprite per lamp.
  - **Asphalt:** roughness map.
  - **Stand LED bands:** on the front and on the roof fascia, facing the track. Mirrored stands use a U-flipped texture.
  - **Catch fence:** at half opacity (`userData.opacityScale`).
- `scripts/dev/zoom.mjs out.png <view> <panX> <panY> <wheelClicks>`: zoomed screenshot for detail checks.
- First load takes about 10 s in headless Edge while the warm-up compiles about 130 shaders. Scripts should wait up to 90 s for `#loader.done`.

## Phase 4B: cinematic blast + jump

The brief referenced `spawnBlast`/`updateBlast`/`updateLand` and `reference/blast_*.png`, but **neither exists** in the repo.
This was built from the written description, on the Red Bull car.

- **Timeline** (`config/timeline.ts`): `top 1.8 · ign 2.0 · launch 3.6 · chase 4.8 · side 7.2 · over 8.8 · blast 10.0 ·
  hero 10.5 · studio 11.6 (crossfade start) · apex 11.9 · land 13.8 · home 15.6 · end 16.0`.
  - `CinematicDirector.tsx` builds **one GSAP master timeline**. Channels: speed, car nudge, track mix, time scale `ts`,
    jump height/pitch, suspension bounce, flash, chromatic aberration spike, FOV punch, shake, haze, DOF/grain/vignette grade.
  - **Phase:** `reachDecel` is dispatched at touchdown, so `returning` is the landing + glide.
  - **Skip:** jumps to `land − 0.45`, so the landing still plays. A second Skip calls `endCine()` directly, because seeking suppresses callbacks.
  - **Dev:** `window.__cineRate` slows the clock for screenshots (`RATE=0.3 node scripts/dev/cine-shots.mjs <dir> 10.1,11.4`).
- **Slow motion:** `transient.ts` (0.25) scales track scroll, wheel spin, the blast clock (`blastAge`) and the flame
  animation. The engine and sfx route through `engineAudio.bus()`, a low-pass that closes while `setSlowmo(k)` pitches the engine down.
- **Blast** (`cinematic/Blast.tsx`, `cinematic/fireball.ts`):
  - **Placement:** anchored to the track 6.5 m behind the car. It recedes at **30 %** of track speed, a cinematic cheat that keeps it framed behind the car.
  - **Fireball:** a raymarched volume in a ground-sitting box (`FB_HALF` = 11 m). Three lobes expand, rise and cool, with a
    domain-warped fbm edge. Temperature drives a blackbody HDR ramp; only the interior burns, so the shell turns to black smoke.
    Empty space is skipped with the lobe distance. Steps = 24 + 22·`quality`.
  - **Particles:** smoke-column and dust sprites (instanced billboards), 64 debris pieces (ballistic arcs, slide-to-stop,
    ember glow), 340 sparks (gravity, HDR, additive points), shockwave ring, 14 procedural ground flames, scorch decal.
  - **Fire light:** a `pointLight` kept **outside** the toggled group (visible light count is in the shader key).
- **Landing** (`Landing` in `Blast.tsx`): dust ring + livery-accent floor shockwave, driven by `transient.landAge`; `playLanding()` thud.
- **Post** (`scene/Effects.tsx`):
  - **Heat haze:** a custom `HeatHazeEffect` (mainUv distortion around `blastU/V`).
  - **DOF:** `focusRange` is **world units** in this postprocessing version, so 4.5 m keeps the car sharp. Outside the
    cinematic its `update()` is skipped and its opacity set to 0, because EffectPass updates every effect every frame.
    It still runs during the warm-up so its shaders compile behind the loader.
  - **Grade:** Noise grain, vignette ramp, chromatic aberration spike.
  - **Flash:** a DOM `.flash` overlay driven from the HUD rAF loop.
- **Quality:** drei `PerformanceMonitor` sets `transient.quality` (0.5/1), which scales raymarch steps, sparks, debris and smoke.
- **Audio** (`audio/sfx.ts`): layered synthesized explosion (boom with falling low-pass, crack, sub thump 62→26 Hz, debris
  rattle grains) and landing thud. `public/audio/explosion.ogg` / `land.ogg` replace the boom/thud if present.
- **Measured** (headless Edge, `scripts/dev/fps-blast.mjs`): blast window avg ~99 fps, p95 13.5 ms. No mid-sequence
  shader compiles except the 30 ms lamp sprite and the reflector remount at the end (`scripts/dev/stalls.mjs`).

### Blast realism pass 2
- **Fireball** (`fireball.ts`): smoke is **lit by the fire with self-shadowing** (two cheap `coarseDist` taps toward the
  hot core), plus a night-sky ambient on the tops. A **mushroom cap** (vortex-ring torus) rolls at the top of the column,
  and there's extra high-frequency billow noise. The material is parameterised (`half`, `scale`, `heat`, `seed`), so the
  same shader renders smaller bursts.
- **Additions** (`Blast.tsx`):
  - **Secondary bursts:** two smaller, delayed, offset bursts (`SECONDARY`), so the explosion propagates instead of being one ball.
  - **Burning "comets":** 9 chunks with fire trails and smoke trails.
  - **Embers:** 180, floating up on the heat.
  - **Dust curtain:** an expanding streaky cylinder driven by the shockwave.
  - **Lens flare:** an anamorphic streak sprite (depthTest off).
  - **Sky glow:** `transient.blastGlow` lights the clouds and horizon toward the blast (RaceTrack sky shader).
  - **Launch tyre smoke** (`LaunchSmoke`): left behind on the track.
  - **Landing:** plank scrape sparks.
- **Camera:** a dutch tilt in the hero shot and rotational shake. The overhead shot whips its aim toward the detonation.
  DOF eases to 0.2 during the overhead shot so the blast isn't a blurred disc.
- **Measured:** blast window avg ~113 fps, p95 12.6 ms (headless Edge).

### Blast realism pass 3 (less "game", more clarity)
- **Fireball** (`fireball.ts`): billow (`1-|2n-1|`) noise carves cauliflower puffs with crisp creases. Density edges are much
  sharper, the burn is higher-contrast (hot pockets, dark folds) and the soot is darker. Steps go up to 32 + 30·quality, and a
  per-pixel jittered ray start hides slicing.
- **Sparks:** velocity-aligned streaks (`lineSegments`, one shutter-time long, `SPARK_SHUTTER`) instead of round dots. There are
  fewer of them (180), they are shorter-lived, and they fade near the lens so close passes don't become defocused bars.
- **Debris:** small, thin, dark charred shards (not orange flakes), slower so they don't fly into the camera.
- **Removed the game look:**
  - Ground flames are domain-warped ragged tongues, not teardrops.
  - The shockwave ring is a faint dust ripple.
  - The lens flare is brief and narrower, with no lingering band.
  - Embers are half as many and smaller.
  - The smoke-puff texture has billowy structure.
- **Post:** chromatic aberration is about a third of what it was, the flash is 0.3, the haze is weaker, and DOF in the hero shot is 0.45.
- **Measured:** blast window ~59 fps vs a 60 fps baseline on the same machine (headless Edge), with no mid-sequence compiles.
