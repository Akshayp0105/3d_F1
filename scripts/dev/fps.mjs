// Measure frame rate in idle, exploded and during the launch sequence (dev server running).
//   node scripts/dev/fps.mjs
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/?off=' + (process.argv[2] ?? ''))
await page.waitForSelector('#loader.done', { timeout: 60000 })
await page.waitForTimeout(2500)
const fps = () => page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(f) : r((n / (performance.now() - t0)) * 1000) }; requestAnimationFrame(f) }))
console.log('idle fps', (await fps()).toFixed(1))
await page.keyboard.press('e'); await page.waitForTimeout(2500)
console.log('exploded fps', (await fps()).toFixed(1))
await page.keyboard.press('e'); await page.waitForTimeout(2000)
await page.keyboard.press('l'); await page.waitForTimeout(Number(process.env.RACE_WAIT ?? 5000))
console.log('race fps', (await fps()).toFixed(1))
await browser.close()
