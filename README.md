# 🏎️ Red Bull Racing RB16B — Interactive 3D Web Studio

[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![React Three Fiber](https://img.shields.io/badge/R3F-9.8-orange?style=for-the-badge)](https://docs.pmnd.rs/react-three-fiber)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GSAP](https://img.shields.io/badge/GSAP-3.15-88CE02?style=for-the-badge&logo=greensock&logoColor=white)](https://greensock.com/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Procedural_Sound-red?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

> **A cutting-edge, photorealistic 3D engineering showroom and interactive cinematic experience celebrating the Red Bull Racing RB16B Formula 1 car.** Built entirely for the browser with WebGL2, React Three Fiber, GLSL shaders, procedural audio synthesis, and GSAP choreography.

---

## ✨ Key Highlights & Engineering Features

### 🛠️ 1. Precision 3D Model Segmentation Pipeline
* **Custom Geometric Pipeline:** Processes high-density CAD/STL meshes into discrete car-space aerodynamic and mechanical sub-assemblies (`Chassis`, `EngineCover`, `Sidepods`, `FrontWing`, `RearWing`, `Halo`, `Floor`, `Suspension`, `Wheels`).
* **Optimized GLB Delivery:** Compressed with **Meshoptimizer** and quantized normals while preserving exact unquantized float coordinates for flawless object-space livery shaders and decal raycasting.
* **Axle-True Wheel Geometry:** Calculated per-wheel rotation pivots derived from tyre bounding boxes, eliminating mesh wobble and ensuring rotational symmetry within ±1.5 mm.

### 💥 2. Staged Dismantle & Exploded View
* **Interactive Anatomy:** Click the car to trigger a fluid, physics-damped multi-stage explosion expanding wings, pods, halo, and bodywork outwards.
* **Component Callouts:** Screen-space projected technical badges pinned to 3D sub-assemblies with responsive depth culling and smooth lead lines.
* **DRS Actuation:** Fully articulated rear wing DRS flap controllable manually or via telemetry.

### ⚡ 3. Procedural V6 Turbo-Hybrid Power Unit with Animated Pistons
* **Full Powertrain Reconstruction:** Exposed 90° V6 internal combustion engine, twin overhead cams, plenum chamber, split turbocharger, and MGU-K electric motor generator.
* **Authentic Slider-Crank Kinematics:** 6 individual pistons and connecting rods pumping inside open cylinder liners following the real **1-4-2-5-3-6 V6 firing order** (rod-to-crank ratio 3.3).
* **Thermal Shader FX:** Pulsating energized MGU-K core and Inconel exhaust headers glowing proportionally with engine RPM and load.

### 🔊 4. Real-Time Procedural Web Audio Engine Synthesizer
* **Zero Audio Files Required:** Synthesizes the ferocious acoustics of an F1 power unit entirely in code using native Web Audio API oscillators, wave-shaping distortion, and harmonic filters.
* **Dynamic Acoustic Telemetry:** Pitch, harmonic frequency spectrum, and idle purr dynamically crossfade based on active engine RPM, gear changes, and throttle input.

### 🎬 5. Cinematic Launch & Night Circuit Sequence
* **Choreographed Director:** Triggered by double-click or the Launch button—the camera cuts to an overhead pre-flight, the V6 fires up, and the car accelerates into a high-speed nocturnal track sequence.
* **Procedural Night Sky & Atmosphere:** Custom GLSL sky dome featuring drifting procedural FBM clouds lit from below by city glow, layered parallax skyline cylinders, and passing light streaks.
* **Dynamic Cockpit HUD:** Live digital telemetry display with speed, gear indicator, and RPM tachometer.

### 🏢 6. Photorealistic Virtual Showroom
* **Real-Time Mirror Reflections:** Precision `MeshReflectorMaterial` turntable mirror floor reflecting the underside of the car.
* **Curved Team LED Video Walls:** Dynamic panoramic LED wall backdrops displaying high-resolution team livery graphics and gradients.
* **Physical Lighting & Post-Processing:** ACES Filmic tone mapping, HDR environment reflections, overhead softbox trusses, volumetric spot cones, Bloom on incandescent emissives, and N8AO ambient occlusion.

### 🎯 7. Authentic Livery & Decal Projection
* **Official Team Markings:** Dynamic surface projection mapping for sponsors including Oracle, Bybit, Mobil 1, TAG Heuer, Rauch, Ford, and Pirelli P Zero tyre markings.
* **Livery Switcher:** Live colorway switching between official matte team liveries (Matte Navy Hero, White Tribute, etc.).

### 🚀 8. Zero-Stall Shader Pre-Warming
* Eliminates WebGL shader compilation stutters on Windows/ANGLE by rendering off-screen compile passes during initial asset load, guaranteeing a smooth **144 FPS** runtime experience.

---

## 🕹️ Controls & Navigation

### 🖱️ Mouse / Touch
* **Left Click & Drag:** Orbit camera around the car
* **Right Click & Drag:** Pan camera target
* **Scroll Wheel / Pinch:** Zoom in and out
* **Single Click on Car:** Toggle Exploded / Dismantled Anatomy view
* **Double Click on Car:** Launch Cinematic Racing Sequence

### ⌨️ Keyboard Shortcuts

| Key | Action |
|:---:|:---|
| <kbd>Space</kbd> / <kbd>L</kbd> | Launch cinematic run / Skip active cinematic sequence |
| <kbd>E</kbd> | Toggle Exploded / Dismantled view |
| <kbd>D</kbd> | Toggle DRS rear wing flap |
| <kbd>S</kbd> | Toggle Procedural V6 Engine sound |
| <kbd>T</kbd> | Toggle Turntable Auto-Spin |
| <kbd>1</kbd> | Three-quarter Hero perspective |
| <kbd>2</kbd> | Side Profile view |
| <kbd>3</kbd> | Top-Down Aero view |
| <kbd>4</kbd> | Front Nose / Wing view |
| <kbd>5</kbd> | Cockpit / Driver view |
| <kbd>6</kbd> | Dynamic Trackside view |

---

## 🏗️ Architecture & Tech Stack

