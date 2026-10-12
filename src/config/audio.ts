// Engine sample set. Drop licensed recordings into public/audio/ with these names (see public/audio/README.md).
// `rpm` is the normalised rpm (0..1) each loop was recorded at; layers crossfade between neighbours.
// If any loop is missing, the engine falls back to the procedural synth.
export const ENGINE_SAMPLES = [
  { url: '/audio/engine-idle.ogg', rpm: 0.12 },
  { url: '/audio/engine-low.ogg', rpm: 0.4 },
  { url: '/audio/engine-mid.ogg', rpm: 0.65 },
  { url: '/audio/engine-high.ogg', rpm: 0.92 },
]
export const IGNITION_SAMPLE = '/audio/ignition.ogg'

// Phase 4B one-shots. If present they replace the synthesized boom / thud; the sub thump and debris rattle layers stay.
export const EXPLOSION_SAMPLE = '/audio/explosion.ogg'
export const LAND_SAMPLE = '/audio/land.ogg'
