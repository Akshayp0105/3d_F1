// Canvas textures (ported from the prototype, lines 244–275 and 607–618) + SVG rasterising for brand logos.
import * as THREE from 'three'

const canvas = (w: number, h = w) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

/** 2x2 twill-ish carbon weave, tileable */
export function carbonTex() {
  const [c, g] = canvas(256)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const h = (x + y) % 2 === 0, X = x * 16, Y = y * 16
      const gr = h ? g.createLinearGradient(X, Y, X, Y + 16) : g.createLinearGradient(X, Y, X + 16, Y)
      gr.addColorStop(0, '#0a0b0d')
      gr.addColorStop(0.5, '#2a2e34')
      gr.addColorStop(1, '#0a0b0d')
      g.fillStyle = gr
      g.fillRect(X, Y, 16, 16)
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function finTex() {
  const [c, g] = canvas(64)
  g.fillStyle = '#6d737b'
  g.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 64; i += 4) {
    g.fillStyle = i % 8 ? '#a8aeb6' : '#3b4047'
    g.fillRect(0, i, 64, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 6)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function radialTex() {
  const [c, g] = canvas(256)
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  gr.addColorStop(0, 'rgba(0,0,0,1)')
  gr.addColorStop(0.55, 'rgba(0,0,0,.55)')
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

/** Rasterise an SVG (vector, so crisp at any size) into a square texture. */
export function svgTexture(url: string, size = 2048): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const [c, g] = canvas(size)
      g.drawImage(img, 0, 0, size, size)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      resolve(t)
    }
    img.onerror = reject
    img.src = url
  })
}

/** Text texture (prototype textTex), used where no brand artwork exists yet. */
export function textTex(txt: string, { w = 1024, h = 256, color = '#fff', size = 190, italic = true, weight = 800 } = {}) {
  const [c, g] = canvas(w, h)
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px "Barlow Condensed","Arial Narrow",sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = color
  g.fillText(txt, w / 2, h / 2 + size * 0.05)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// --- race-track environment (realism pass) ---

/** Asphalt with aggregate speckle, rubbered racing line, white edge lines, red/white kerbs, run-off. Tile = 8 m. */
export function asphaltTexture(maxAniso: number) {
  const [c, g] = canvas(1024)
  const Z = (z: number) => (z + 8) * 64 // 16 m across → 1024 px
  g.fillStyle = '#1c1e21'
  g.fillRect(0, 0, 1024, 1024)
  // run-off a touch lighter, track surface darker
  g.fillStyle = '#25282c'
  g.fillRect(0, 0, 1024, Z(-5.35))
  g.fillRect(0, Z(5.35), 1024, 1024 - Z(5.35))
  for (let i = 0; i < 90000; i++) {
    const v = (22 + Math.random() * 46) | 0
    g.fillStyle = `rgba(${v},${v + 1},${v + 3},${0.3 + Math.random() * 0.5})`
    const s = Math.random() < 0.9 ? 1 : 2
    g.fillRect(Math.random() * 1024, Math.random() * 1024, s, s)
  }
  // rubbered racing line
  const lg = g.createLinearGradient(0, Z(-1.8), 0, Z(1.8))
  lg.addColorStop(0, 'rgba(0,0,0,0)')
  lg.addColorStop(0.5, 'rgba(0,0,0,.35)')
  lg.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = lg
  g.fillRect(0, Z(-1.8), 1024, Z(1.8) - Z(-1.8))
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`
    g.fillRect(Math.random() * 1024, Z(-1.2 + Math.random() * 2.4), 120 + Math.random() * 300, 3 + Math.random() * 5)
  }
  // edge lines
  g.fillStyle = '#e4e7ea'
  for (const s of [1, -1]) { const a = Z(4.42 * s), b = Z(4.56 * s); g.fillRect(0, Math.min(a, b), 1024, Math.abs(b - a)) }
  // kerbs: 1 m red/white blocks
  for (const s of [1, -1])
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? '#e8eaec' : '#c8102e'
      const a = Z(4.6 * s), b = Z(5.35 * s)
      g.fillRect(k * 128, Math.min(a, b), 128, Math.abs(b - a))
      g.fillStyle = 'rgba(0,0,0,.18)'
      g.fillRect(k * 128, Math.min(a, b), 3, Math.abs(b - a))
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(300 / 8, 1)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = maxAniso
  return t
}

/** LED advertising boards for the barrier faces: 25 m of panels using the supplied brand art. */
export async function adBoardTexture() {
  const [c, g] = canvas(3000, 102) // 25 m × 0.85 m
  const [rb, oracle] = await Promise.all([loadImage('/brand/redbull-logo.svg'), loadImage('/brand/oracle-mark.svg')])
  const panel = (x: number, w: number, bg: string, draw: () => void) => {
    g.save()
    g.beginPath()
    g.rect(x, 0, w, 102)
    g.clip()
    g.fillStyle = bg
    g.fillRect(x, 0, w, 102)
    draw()
    g.restore()
    g.fillStyle = 'rgba(0,0,0,.6)'
    g.fillRect(x + w - 3, 0, 3, 102)
  }
  const text = (s: string, x: number, color: string) => {
    g.font = 'italic 800 64px "Barlow Condensed","Arial Narrow",sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = color
    g.fillText(s, x, 54)
  }
  panel(0, 1000, '#0d1430', () => { if (rb) g.drawImage(rb, 60, -60, 220, 220); text('RED BULL RACING', 640, '#ffffff'); if (rb) g.drawImage(rb, 760 + 120, -60, 220, 220) })
  panel(1000, 1000, '#d9dad8', () => { for (let i = 0; i < 4; i++) if (oracle) g.drawImage(oracle, 1040 + i * 240, -50, 200, 200) })
  panel(2000, 1000, '#c8102e', () => { text('GIVES YOU WINGS', 2500, '#ffffff') })
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(300 / 25, 1)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Overhead bridge banner. */
export async function bannerTexture() {
  const [c, g] = canvas(2048, 192)
  const rb = await loadImage('/brand/redbull-logo.svg')
  g.fillStyle = '#0d1430'
  g.fillRect(0, 0, 2048, 192)
  g.fillStyle = '#c8102e'
  g.fillRect(0, 0, 2048, 10)
  g.fillRect(0, 182, 2048, 10)
  if (rb) g.drawImage(rb, 1024 - 190, -94, 380, 380)
  g.font = 'italic 800 104px "Barlow Condensed","Arial Narrow",sans-serif'
  g.textBaseline = 'middle'
  g.fillStyle = '#ffffff'
  g.textAlign = 'right'
  g.fillText('RED BULL', 790, 100)
  g.textAlign = 'left'
  g.fillText('RACING', 1258, 100)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Catch fence: diamond mesh with a support post per tile (tile = 4 m × 3.3 m). Alpha in the alpha channel. */
export function fenceTexture() {
  const [c, g] = canvas(256, 212)
  g.clearRect(0, 0, 256, 212)
  g.strokeStyle = 'rgba(150,158,166,0.32)'
  g.lineWidth = 1
  for (let i = -212; i < 256 + 212; i += 9) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 212, 212); g.stroke()
    g.beginPath(); g.moveTo(i, 212); g.lineTo(i + 212, 0); g.stroke()
  }
  g.fillStyle = 'rgba(60,66,74,1)'
  g.fillRect(0, 0, 6, 212)
  for (const y of [2, 70, 140, 208]) g.fillRect(0, y, 256, 2)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(300 / 4, 1)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Distant city skyline wrapped on a cylinder: silhouettes, lit windows, aviation lights, horizon haze. */
export function skylineTexture({ near = false } = {}) {
  const W = 4096, H = 512
  const [c, g] = canvas(W, H)
  g.clearRect(0, 0, W, H)
  const haze = g.createLinearGradient(0, H, 0, H - 200)
  haze.addColorStop(0, 'rgba(255,150,80,0.35)')
  haze.addColorStop(1, 'rgba(255,150,80,0)')
  const layer = (count: number, hMin: number, hMax: number, shade: number, windowAlpha: number) => {
    let x = 0
    while (x < W) {
      const w = 18 + Math.random() * 90, h = hMin + Math.random() * (hMax - hMin)
      const v = shade + Math.random() * 8
      g.fillStyle = `rgb(${v},${v + 4},${v + 14})`
      g.fillRect(x, H - h, w, h)
      for (let wy = H - h + 6; wy < H - 6; wy += 9)
        for (let wx = x + 4; wx < x + w - 4; wx += 7)
          if (Math.random() < 0.28) {
            g.fillStyle = Math.random() < 0.7 ? `rgba(255,214,150,${windowAlpha})` : `rgba(180,210,255,${windowAlpha})`
            g.fillRect(wx, wy, 3, 4)
          }
      if (h > hMax * 0.8) { g.fillStyle = '#ff2a2a'; g.fillRect(x + w / 2 - 2, H - h - 5, 4, 4) }
      x += w + Math.random() * count
    }
  }
  if (near) {
    // nearer ring: lower, darker blocks with sparse warm windows (depth layer in front of the far skyline)
    layer(6, 50, 200, 8, 0.6)
  } else {
    layer(40, 60, 220, 14, 0.5)
    layer(10, 40, 420, 20, 0.85)
  }
  g.fillStyle = haze
  g.fillRect(0, H - 200, W, 200)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(3, 1)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// --- stadium realism pass ---

/** One grandstand row of seated fans (35 m of crowd, tileable): shoulders in team/fan colours, skin-tone heads, caps,
 *  some raised arms and flags, empty seats. Lit from the front/roof, darker at the bottom (seat shadow). Alpha = people. */
export function crowdTexture(seed = 1) {
  const W = 2048, H = 96
  const [c, g] = canvas(W, H)
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const shirts = ['#1a2350', '#0d1430', '#1a2350', '#c8102e', '#ff7a1a', '#ff7a1a', '#e9e9e9', '#2b2f36', '#3c4a6b', '#ffc906', '#14161a', '#7a1020']
  const skins = ['#e9c2a0', '#d29b78', '#a5704d', '#f3d6bd', '#8a5636', '#c48a62']
  const step = W / 64 // ~0.55 m per seat at 35 m per tile
  for (let i = 0; i < 64; i++) {
    const x = i * step + (rnd() - 0.5) * 4
    if (rnd() < 0.1) { // empty seat back
      g.fillStyle = '#2a2e35'
      g.fillRect(x + 4, H - 34, step - 8, 30)
      continue
    }
    const shirt = shirts[(rnd() * shirts.length) | 0], skin = skins[(rnd() * skins.length) | 0]
    const lean = (rnd() - 0.5) * 4, hh = 10 + rnd() * 3
    // torso
    g.fillStyle = shirt
    g.beginPath()
    g.roundRect(x + 3 + lean, H - 46, step - 6, 46, [10, 10, 2, 2])
    g.fill()
    // arms up (cheering) or a flag
    const r = rnd()
    if (r < 0.12) {
      g.fillRect(x + 4 + lean, H - 76, 5, 32)
      g.fillRect(x + step - 9 + lean, H - 74, 5, 30)
      g.fillStyle = skin
      g.beginPath(); g.arc(x + 6.5 + lean, H - 78, 3.5, 0, 7); g.arc(x + step - 6.5 + lean, H - 76, 3.5, 0, 7); g.fill()
    } else if (r < 0.17) {
      g.fillStyle = '#d9d9d9'
      g.fillRect(x + step / 2 + lean, H - 92, 2, 50)
      const flag = rnd() < 0.5 ? ['#0d1430', '#c8102e'] : ['#ae1c28', '#ffffff', '#21468b'] // team / Dutch
      flag.forEach((f, k) => { g.fillStyle = f; g.fillRect(x + step / 2 + 2 + lean, H - 92 + k * (22 / flag.length), 26, 22 / flag.length) })
    }
    // head + cap
    g.fillStyle = skin
    g.beginPath(); g.arc(x + step / 2 + lean, H - 46 - hh * 0.6, hh, 0, 7); g.fill()
    if (rnd() < 0.35) {
      g.fillStyle = rnd() < 0.6 ? '#0d1430' : '#ff7a1a'
      g.beginPath(); g.arc(x + step / 2 + lean, H - 46 - hh * 0.75, hh + 0.5, Math.PI, 0); g.fill()
    }
  }
  // lighting: roof light from above → darker toward the seat
  const sh = g.createLinearGradient(0, 0, 0, H)
  sh.addColorStop(0, 'rgba(0,0,0,0)')
  sh.addColorStop(1, 'rgba(0,0,0,0.55)')
  g.globalCompositeOperation = 'source-atop'
  g.fillStyle = sh
  g.fillRect(0, 0, W, H)
  g.globalCompositeOperation = 'source-over'
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Soft radial falloff (white centre → transparent), for light pools and lamp glare. */
export function glowTexture() {
  const [c, g] = canvas(256)
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  gr.addColorStop(0.6, 'rgba(255,255,255,0.12)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Asphalt roughness variation (polished racing line darker = smoother, patches, sealer streaks). Linear data. */
export function asphaltRoughnessTexture() {
  const [c, g] = canvas(512)
  const Z = (z: number) => (z + 8) * 32
  g.fillStyle = 'rgb(220,220,220)'
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 25000; i++) { const v = 170 + Math.random() * 85; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2) }
  const lg = g.createLinearGradient(0, Z(-1.8), 0, Z(1.8))
  lg.addColorStop(0, 'rgba(120,120,120,0)'); lg.addColorStop(0.5, 'rgba(120,120,120,0.6)'); lg.addColorStop(1, 'rgba(120,120,120,0)')
  g.fillStyle = lg
  g.fillRect(0, Z(-1.8), 512, Z(1.8) - Z(-1.8))
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(110,110,110,0.35)'; g.fillRect(Math.random() * 512, Z(-4 + Math.random() * 8), 60 + Math.random() * 160, 2 + Math.random() * 3) }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(300 / 8, 1)
  return t
}
