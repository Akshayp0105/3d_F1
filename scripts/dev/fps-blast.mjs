// Frame rate over the blast / slow-motion jump window (cinematic t 9.8 → 13.8), dev server running.
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/')
await page.waitForSelector('#loader.done', { timeout: 90000, state: 'attached' })
await page.waitForTimeout(1500)
await page.keyboard.press('l')
await page.waitForFunction(() => window.__transient.cineT >= 9.8, null, { timeout: 60000, polling: 100 })
const r = await page.evaluate(() => new Promise(res => {
  const ft = []; let last = performance.now()
  const f = () => { const now = performance.now(); ft.push(now - last); last = now; window.__transient.cineT < 13.8 ? requestAnimationFrame(f) : res(ft) }
  requestAnimationFrame(f)
}))
const avg = r.reduce((a, b) => a + b, 0) / r.length, sorted = [...r].sort((a, b) => a - b)
console.log(`blast window: ${r.length} frames, avg ${(1000 / avg).toFixed(1)} fps, p95 frame ${sorted[Math.floor(r.length * 0.95)].toFixed(1)} ms, worst ${sorted.at(-1).toFixed(1)} ms`)
await browser.close()
