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

export function trackTexture(maxAniso: number) {
  const [c, g] = canvas(512)
  const Z = (z: number) => (z + 8) * 32
  g.fillStyle = '#121517'
  g.fillRect(0, 0, 512, 512)
  g.fillStyle = '#2a2d31'
  g.fillRect(0, Z(-4.6), 512, Z(4.6) - Z(-4.6))
  for (let i = 0; i < 14000; i++) {
    const v = (30 + Math.random() * 40) | 0
    g.fillStyle = `rgba(${v},${v + 2},${v + 5},${0.25 + Math.random() * 0.5})`
    g.fillRect(Math.random() * 512, Z(-4.6) + Math.random() * (Z(4.6) - Z(-4.6)), 2, 2)
  }
  const lg = g.createLinearGradient(0, Z(-1.4), 0, Z(1.4))
  lg.addColorStop(0, 'rgba(0,0,0,0)')
  lg.addColorStop(0.5, 'rgba(0,0,0,.28)')
  lg.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = lg
  g.fillRect(0, Z(-1.4), 512, Z(1.4) - Z(-1.4))
  g.fillStyle = '#e9ecef'
  for (const s of [1, -1]) {
    const a = Z(4.45 * s), b = Z(4.6 * s)
    g.fillRect(0, Math.min(a, b), 512, Math.abs(b - a))
  }
  for (const s of [1, -1])
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? '#eef0f2' : '#d4142a'
      const a = Z(4.62 * s), b = Z(5.35 * s)
      g.fillRect(k * 64, Math.min(a, b), 64, Math.abs(b - a))
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(300 / 8, 1)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = maxAniso
  return t
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
