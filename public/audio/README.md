# Engine audio samples

Drop **licensed** recordings here (ideally from the team or a licensed SFX library), using these names.
Until all four loops are present, the site uses the built-in procedural engine synth.

| File | What | Notes |
|---|---|---|
| `engine-idle.ogg` | Steady idle loop | ~2–4 s, seamless loop |
| `engine-low.ogg` | Steady low-rpm loop (~4–6k rpm) | seamless loop |
| `engine-mid.ogg` | Steady mid-rpm loop (~8–9k rpm) | seamless loop |
| `engine-high.ogg` | Steady high-rpm loop (~11–12k rpm) | seamless loop |
| `ignition.ogg` | Engine fire-up one-shot (optional) | plays once at ignition |

Format: OGG Vorbis (or MP3: change the extensions in `src/config/audio.ts`), mono or stereo, 44.1/48 kHz.
Loops must be recorded at a **constant** rpm and trimmed at zero crossings so they loop cleanly.
If a loop was recorded at a different rpm, adjust its `rpm` value in `src/config/audio.ts` (0 = idle, 1 = limiter).

## Launch-sequence one-shots (optional)

| File | What | Notes |
|---|---|---|
| `explosion.ogg` | Explosion boom (+ crack) | Replaces the synthesized boom; the sub thump and debris rattle layers still play on top |
| `land.ogg` | Landing thud (tyres + suspension) | Replaces the synthesized thud |

Both route through the slow-motion bus (`engineAudio.bus()`), so they're muffled and lowered during the jump.
