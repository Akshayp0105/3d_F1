# 3D car model spec — Red Bull Racing F1 (web, dismantle-ready)

Use this to brief a 3D artist, or to check a model before buying it (Sketchfab / TurboSquid / CGTrader).
**The licence must allow commercial use on a public website.** A personal or editorial licence is not enough.

## Delivery

- Format: **glTF 2.0 binary (`.glb`)**, plus the source file (Blender `.blend` preferred).
- Units: metres, real scale (wheelbase ≈ 3.6 m, length ≈ 5.6 m).
- Axes: **+X forward (nose), +Y up, +Z to the car's right**, origin on the ground plane at the wheelbase centre.
  (If delivered in glTF-standard −Z forward, we rotate once at import. State which one.)
- Budget: **≤ 300k triangles** total for the hero model, **≤ 40 MB** before compression. Wheels ≤ 15k triangles each.
- Materials: PBR metallic/roughness. Separate materials for matte body paint, carbon, tyre rubber, rim metal, chrome,
  titanium, aluminium, glass/visor, emissive (rain light, brake discs). Texture sets up to 4K, power of two.
- **Livery as a separate layer:** either a clean base-paint material with the livery in its own texture we can swap,
  or decals as separate texture sets. No sponsor logos baked into the geometry.
- Clean topology, applied transforms, no hidden/duplicate meshes, no n-gons in deforming parts.

## Required part hierarchy (node names must match exactly)

Each node below is an **empty/group with its pivot at the part's natural centre**, so it can be translated and
rotated as one piece for the exploded view. Child meshes can be named freely.

```
Car
├─ Chassis            monocoque, nose, cockpit rim, steering wheel, mirrors
├─ Suspension_FL / _FR / _RL / _RR   wishbones, push/pull rods, uprights
├─ FrontWing          all elements + endplates
├─ Halo
├─ Driver             helmet + visor (optional, toggleable)
├─ Sidepod_L / Sidepod_R
├─ EngineCover        incl. airbox, shark fin, T-cam
├─ PowerUnit          parent of the engine sub-parts below
│  ├─ PU_Block
│  ├─ PU_Bank_L / PU_Bank_R
│  ├─ PU_Turbo        child PU_TurboImpeller (pivot on the shaft axis, spins on X)
│  ├─ PU_MGUK
│  ├─ PU_MGUH
│  ├─ PU_Exhaust      with an empty PU_ExhaustTip at the outlet
│  ├─ PU_Piston_1 … PU_Piston_6   (pivot at rest position, moves on Y)
│  └─ PU_Battery / PU_Cables     (optional)
├─ Radiator_L / Radiator_R
├─ Floor              floor plate, plank, fences, diffuser
├─ RearWing           main plane, beam wing, endplates, pillar
│  └─ RearWing_Flap   DRS flap. **Pivot on the hinge line, rotates on Z**
├─ CrashStructure     incl. RainLight (separate emissive mesh)
└─ Wheel_FL / Wheel_FR / Wheel_RL / Wheel_RR
   └─ Wheel_XX_Spin   tyre + rim + covers. **Pivot on the axle, spins on Z**
      └─ Brake_XX     brake disc (emissive material, glows under braking)
```

Nice to have, for a richer engine-composition reveal: separate gearbox, fuel tank, ERS battery, cooling ducts,
and a few individual wishbone pieces, after `reference/images/car_parts.jpg`.

## Acceptance check (we run it on delivery)

1. Loads in https://gltf-viewer.donmccurdy.com with no errors; the scale and axes are as above.
2. Every required node name exists, and each pivot is where specified (spin the wheels, open the DRS flap).
3. Triangle and size budgets are met.
4. It compresses with `gltf-transform optimize` (Draco/Meshopt + KTX2) to **≤ 12 MB** without visible artefacts.
