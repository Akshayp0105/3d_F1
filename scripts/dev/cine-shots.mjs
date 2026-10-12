// Screenshots at exact cinematic times (waits on window.__transient.cineT in dev builds).
//   node scripts/dev/cine-shots.mjs <outDir> 9.3,10.15,10.6,...
import path from 'node:path'
import { chromium } from 'playwright-core'
const out = process.argv[2] ?? 'shots'
const times = (process.argv[3] ?? '9.3,10.1,10.3,10.8,11.6,12.4,13.3,14.0,15.0').split(',').map(Number)
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push(e.message))
page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)) })
await page.goto('http://localhost:5173/')
await page.waitForSelector('#loader.done', { timeout: 90000, state: 'attached' })
await page.waitForTimeout(1500)
if (process.env.RATE) await page.evaluate(r => { window.__cineRate = r }, Number(process.env.RATE))
await page.keyboard.press('l')
for (const t of times) {
  await page.waitForFunction(tt => window.__transient.cineT >= tt, t, { timeout: 60000, polling: 'raf' })
  await page.screenshot({ path: path.join(out, `c-${String(t).replace('.', '_')}.png`) })
  const s = await page.evaluate(() => { const x = window.__transient; return `t=${x.cineT.toFixed(2)} age=${x.blastAge.toFixed(2)} ts=${x.ts.toFixed(2)} y=${x.carY.toFixed(2)} m=${x.m.toFixed(2)} bx=${x.blastX.toFixed(1)} q=${x.quality}` })
  console.log('shot', t, s)
}
console.log(errs.length ? errs.join('\n') : 'no errors')
await browser.close()
