// Visual smoke test: drives the running dev server in headless Edge and saves screenshots + console errors.
//   node scripts/dev/shoot.mjs [outDir] [url]
// Scenes: idle, exploded, each camera view, and frames through the launch sequence.
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const out = process.argv[2] ?? 'shots'
const url = process.argv[3] ?? 'http://localhost:5173/'
const only = process.env.ONLY?.split(',')
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const logs = []
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))

const shot = async name => { await page.screenshot({ path: path.join(out, `${name}.png`) }); console.log('shot', name) }
const wait = ms => page.waitForTimeout(ms)
const want = name => !only || only.includes(name)

await page.goto(url)
await page.waitForSelector('#loader.done', { timeout: 60000 })
await wait(3500)
if (want('idle')) await shot('idle')

if (want('exploded')) {
  await page.keyboard.press('e')
  await wait(3200)
  await shot('exploded')
  await page.keyboard.press('3')
  await wait(2500)
  await shot('exploded-side')
  await page.keyboard.press('e')
  await wait(2500)
}
if (want('engine')) {
  // exploded side view, pan the engine to the centre (right-drag) and zoom in
  await page.keyboard.press('e')
  await page.waitForTimeout(400)
  await page.keyboard.press('3')
  await wait(3200)
  await page.mouse.move(720, 450)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(800, 520, { steps: 10 })
  await page.mouse.up({ button: 'right' })
  for (let i = 0; i < 7; i++) { await page.mouse.wheel(0, -120); await wait(50) }
  await wait(2400)
  await shot('engine-side')
  await page.keyboard.press('1')
  await wait(400)
  await page.mouse.move(720, 450)
  for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -120); await wait(50) }
  await wait(2400)
  await shot('engine-34')
  await page.keyboard.press('e')
  await wait(2500)
}
if (want('pistons')) {
  // exploded, top view, pan to the engine bay and zoom; two frames apart to see the pistons move
  await page.keyboard.press('e')
  await page.waitForTimeout(400)
  await page.keyboard.press('5')
  await wait(3400)
  await page.mouse.move(720, 450)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(795, 450, { steps: 10 })
  await page.mouse.up({ button: 'right' })
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -120); await wait(50) }
  await wait(2600)
  await shot('pistons-a')
  await wait(180)
  await shot('pistons-b')
  await page.keyboard.press('e')
  await page.keyboard.press('1')
  await wait(2500)
}
if (want('views')) {
  for (const [k, n] of [['2', 'front'], ['3', 'side'], ['4', 'rear'], ['5', 'top'], ['6', 'low'], ['1', 'three-quarter']]) {
    await page.keyboard.press(k)
    await wait(2200)
    await shot(`view-${n}`)
  }
}
if (want('cine')) {
  await page.keyboard.press('l')
  const t0 = Date.now()
  for (const t of (process.env.TIMES ?? "1,2.6,4.2,6,8,10,12,15.5").split(",").map(Number)) {
    await wait(Math.max(0, t * 1000 - (Date.now() - t0)))
    await shot(`cine-${String(t).replace('.', '_')}s`)
  }
}
fs.writeFileSync(path.join(out, 'console.txt'), logs.join('\n'))
console.log(`${logs.length} console messages`)
console.log(logs.slice(0, 30).join('\n'))
await browser.close()
