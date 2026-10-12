// Raymarched volumetric fireball + smoke (one material per burst, drawn on a box). A few turbulent lobes expand
// fast, rise and cool; temperature drives a blackbody-like HDR emission ramp (Bloom makes the core glow) and cold
// regions become absorbing black smoke that rises into a column and rolls into a mushroom cap (vortex ring).
// Realism pass: the smoke is *lit by the fire* with self-shadowing (two density taps toward the hot core), plus a cool
// night ambient on the tops, so billows read as solid shapes with light and shadow instead of a flat glow.
// Empty space is skipped with the cheap lobe distance, so the expensive fbm only runs near the cloud.
import * as THREE from 'three'

/** main burst box half-size (m); box covers x/z ±HALF, y 0..2·HALF */
export const FB_HALF = 11

const glsl = /* glsl */ `
  uniform float uAge;
  uniform float uSteps;
  uniform float uOpacity;
  uniform vec3 uCamObj;
  uniform float uSeed;
  uniform float uHalf;    // box half-size (m)
  uniform float uScale;   // burst size multiplier
  uniform float uHeat;    // peak temperature multiplier
  varying vec3 vObj;

  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1 + uSeed); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return v; }

  // lobe: centre(age), radius(age); main burst + two secondary lobes slightly delayed and offset
  void lobe(int i, float a, out vec3 c, out float r) {
    float d = i == 0 ? 0.0 : (i == 1 ? 0.08 : 0.16);
    float t = max(a - d, 0.0);
    vec3 dir = i == 0 ? vec3(0.0) : (i == 1 ? vec3(-1.6, 0.0, 1.2) : vec3(1.3, 0.3, -1.4));
    float grow = 1.0 - exp(-t * 3.4);
    r = ((i == 0 ? 5.2 : 3.4) * grow + 0.4 * t) * uScale;
    c = (vec3(0.0, 1.2 + 1.9 * t, 0.0) + dir * grow) * uScale + vec3(0.0, r * 0.55, 0.0);
  }

  // shape only (no detail noise): used for empty-space skipping and the cheap shadow taps
  float coarseDist(vec3 q, float a, out float colMask, out float col, out float cap) {
    float coarse = 1e3;
    for (int i = 0; i < 3; i++) {
      vec3 c; float r; lobe(i, a, c, r);
      coarse = min(coarse, length((q - c) / vec3(1.0, 0.82, 1.0)) - r);
    }
    float s = uScale;
    float colH = (4.0 + a * 3.2) * s;
    float colR = (1.6 + a * 0.5) * s + 0.16 * q.y;
    col = length(q.xz) - colR;
    colMask = smoothstep(0.25, 1.0, a) * step(0.0, q.y) * (1.0 - smoothstep(colH, colH + 3.0 * s, q.y));
    if (colMask > 0.0) coarse = min(coarse, col);
    // mushroom cap: vortex ring rolling at the top of the column
    float capY = colH + 0.6 * s, R = (1.8 + a * 1.4) * s, rr = (1.3 + a * 0.6) * s;
    cap = (length(vec2(length(q.xz) - R, (q.y - capY) * 1.25)) - rr) + (1.0 - smoothstep(0.45, 1.1, a)) * 6.0;
    coarse = min(coarse, cap);
    return coarse;
  }

  // returns density, writes temperature (0 cold smoke .. 1 white-hot)
  float field(vec3 q, float a, out float temp, out float coarse) {
    temp = 0.0;
    float colMask, col, cap;
    coarse = coarseDist(q, a, colMask, col, cap);
    if (coarse > 2.2 * uScale) return 0.0;
    float heat = exp(-a * 0.95) * uHeat;
    float dens = 0.0;

    // domain-warped turbulence, scrolling upward as the cloud rises (billows roll outward and up)
    vec3 qs = q / uScale;
    vec3 wq = qs + (vec3(noise(qs * 0.21 + 3.1), noise(qs * 0.21 + 7.7), noise(qs * 0.21 + 1.3)) - 0.5) * 4.0;
    float n = fbm(wq * 0.42 + vec3(0.0, -a * 1.8, 0.0));
    float n2 = noise(wq * 1.6 + vec3(0.0, -a * 3.4, a)) * 0.6 + noise(wq * 3.4 - vec3(0.0, a * 4.0, 0.0)) * 0.4;
    for (int i = 0; i < 3; i++) {
      vec3 c; float r; lobe(i, a, c, r);
      float dl = length((q - c) / vec3(1.0, 0.82, 1.0));
      float edge = dl - r + (n - 0.5) * r * 1.3 + (n2 - 0.5) * 1.0 * uScale;
      float d = smoothstep(0.3 * uScale, -0.5 * uScale, edge);
      dens = max(dens, d);
      float core = clamp(1.0 - dl / max(r, 0.01), 0.0, 1.0);
      // only the interior burns: the turbulent outer shell is cooler and turns to black smoke as the burst ages
      float interior = smoothstep((0.1 + a * 0.9) * uScale, (-0.9 - a * 0.6) * uScale, edge);
      temp = max(temp, d * interior * (pow(core, 0.55) * 1.2 + (n - 0.45) * 0.7) * heat * (i == 0 ? 1.0 : 0.85));
    }
    if (colMask > 0.0) dens = max(dens, smoothstep(0.4, -0.9, col / uScale + (n - 0.5) * 2.8) * colMask * 0.9);
    // the cap carries some heat early (it's the top of the fireball rolling over)
    float capD = smoothstep(0.4, -0.8, cap / uScale + (n - 0.5) * 2.4);
    dens = max(dens, capD * 0.95);
    temp = max(temp, capD * heat * 0.35 * (1.0 - smoothstep(0.6, 1.4, a)));
    dens *= step(0.0, q.y) * smoothstep(0.0, 0.6, q.y + 0.3);
    return dens;
  }

  vec3 fireColor(float t) {
    vec3 deep = vec3(0.55, 0.05, 0.0) * 1.8;
    vec3 orange = vec3(1.0, 0.32, 0.04) * 4.5;
    vec3 yellow = vec3(1.0, 0.72, 0.28) * 7.0;
    vec3 white = vec3(1.0, 0.93, 0.8) * 11.0;
    vec3 c = mix(deep, orange, smoothstep(0.32, 0.55, t));
    c = mix(c, yellow, smoothstep(0.55, 0.78, t));
    c = mix(c, white, smoothstep(0.8, 1.0, t));
    return c * smoothstep(0.22, 0.36, t);
  }

  void main() {
    vec3 ro = uCamObj;
    vec3 rd = normalize(vObj - uCamObj);
    vec3 inv = 1.0 / rd;
    vec3 t0 = (vec3(-0.5) - ro) * inv, t1 = (vec3(0.5) - ro) * inv;
    vec3 tmin = min(t0, t1), tmax = max(t0, t1);
    float tn = max(max(max(tmin.x, tmin.y), tmin.z), 0.0);
    float tf = min(min(tmax.x, tmax.y), tmax.z);
    if (tf <= tn) discard;

    float S = uHalf * 2.0;            // object unit → metres
    vec3 off = vec3(0.0, uHalf, 0.0); // box sits on the ground
    float len = (tf - tn) * S;
    float steps = uSteps;
    float baseStep = len / steps;
    float T = 1.0;
    vec3 col = vec3(0.0);
    float t = 0.0;
    float a = uAge;
    float heat = exp(-a * 0.95) * uHeat;
    vec3 c0; float r0; lobe(0, a, c0, r0);
    vec3 fireLight = vec3(1.0, 0.36, 0.07) * 2.2 * heat;   // light emitted by the hot core onto the smoke
    vec3 ambient = vec3(0.05, 0.06, 0.08);                  // floodlit night sky, from above
    for (int i = 0; i < 64; i++) {
      if (float(i) >= steps || t >= len || T < 0.02) break;
      vec3 q = (ro + rd * tn) * S + off + rd * t;
      float temp, coarse;
      float dens = field(q, a, temp, coarse);
      if (coarse > 2.2 * uScale) { t += max(baseStep, coarse * 0.6); continue; }
      if (dens < 0.005) { t += baseStep; continue; }
      float sigma = dens * mix(4.2, 2.2, smoothstep(0.3, 0.75, temp)) / uScale;
      float alpha = 1.0 - exp(-sigma * baseStep);
      // self-shadowing: how much smoke lies between this point and the hot core (2 cheap taps)
      vec3 toCore = c0 - q;
      float dc = length(toCore);
      vec3 ld = toCore / max(dc, 0.001);
      float cm, cc, cp, sh = 0.0;
      sh += smoothstep(0.6, -1.2, coarseDist(q + ld * min(dc * 0.33, 2.5 * uScale), a, cm, cc, cp));
      sh += smoothstep(0.6, -1.2, coarseDist(q + ld * min(dc * 0.66, 5.0 * uScale), a, cm, cc, cp));
      float lit = exp(-sh * 1.6) / (1.0 + dc * dc * 0.02 / (uScale * uScale));
      // top-lit by the night ambient (higher = more sky)
      float sky = smoothstep(0.0, 14.0 * uScale, q.y) * 0.7 + 0.3;
      vec3 soot = vec3(0.010, 0.009, 0.008);
      vec3 smoke = soot + fireLight * lit * (1.0 - smoothstep(0.35, 0.7, temp)) + ambient * sky * 0.6;
      vec3 c = fireColor(temp) + smoke;
      col += T * alpha * c;
      T *= 1.0 - alpha;
      t += baseStep;
    }
    float o = (1.0 - T) * uOpacity;
    gl_FragColor = vec4(col * uOpacity, o);
  }
`

export function createFireballMaterial(opts: { half?: number; scale?: number; heat?: number; seed?: number } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAge: { value: 0 },
      uSteps: { value: 44 },
      uOpacity: { value: 0 },
      uCamObj: { value: new THREE.Vector3() },
      uSeed: { value: opts.seed ?? 0.37 },
      uHalf: { value: opts.half ?? FB_HALF },
      uScale: { value: opts.scale ?? 1 },
      uHeat: { value: opts.heat ?? 1 },
    },
    vertexShader: /* glsl */ `varying vec3 vObj; void main(){ vObj = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: glsl,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    // premultiplied "over" compositing
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  })
}
