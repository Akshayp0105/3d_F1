// Log long frames and shader-program count during the launch sequence (dev build exposes window.__gl).
//   node scripts/dev/stalls.mjs
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/')
await page.waitForSelector('#loader.done', { timeout: 60000 })
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const log = (window.__stalls = []); let last = performance.now(); const t0 = last; let progs = window.__gl.info.programs.length
  const f = () => { const now = performance.now(), n = window.__gl.info.programs.length
    if (now - last > 60 || n !== progs) log.push(`${((now - t0) / 1000).toFixed(2)}s frame ${(now - last).toFixed(0)}ms programs ${progs}→${n}` + (n > progs ? ' | + ' + window.__gl.info.programs.slice(progs).map(p => p.name + ' :: ' + p.cacheKey.split(',').filter((v, i) => i < 3 || /true|SHADOW|Depth|Distance/.test(v)).slice(0, 8).join(',')).join(' | + ') : ''))
    progs = n; last = now; if (now - t0 < 16000) requestAnimationFrame(f) }
  requestAnimationFrame(f)
})
await page.keyboard.press('l')
await page.waitForTimeout(16500)
console.log((await page.evaluate(() => window.__stalls)).join('\n'))
await browser.close()
