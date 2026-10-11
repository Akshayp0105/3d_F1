// Interaction smoke test: real mouse clicks on the canvas, checks state via the DOM.
//   node scripts/dev/interact.mjs [url]
import { chromium } from 'playwright-core'
const url = process.argv[2] ?? 'http://localhost:5173/'
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.goto(url)
await page.waitForSelector('#loader.done', { timeout: 60000 })
await page.keyboard.press('t') // stop the turntable so the car stays under the cursor
await page.waitForTimeout(3000)
const explodeOn = () => page.$eval('.tog', b => b.getAttribute('aria-pressed'))
const cine = () => page.evaluate(() => document.body.classList.contains('cine'))
const check = (name, ok) => { console.log(ok ? 'PASS' : 'FAIL', name); if (!ok) process.exitCode = 1 }
const car = { x: 640, y: 430 } // car body at the default three-quarter view

await page.mouse.click(car.x, car.y)
await page.waitForTimeout(700)
check('single click on car explodes', (await explodeOn()) === 'true')
await page.waitForTimeout(2500)
check('labels shown when exploded', await page.evaluate(() => document.getElementById('labels').classList.contains('show')))
await page.mouse.click(car.x, car.y - 40)
await page.waitForTimeout(2600)
check('second click reassembles', (await explodeOn()) === 'false')
await page.mouse.click(60, 600)
await page.waitForTimeout(700)
check('click on empty floor does nothing', (await explodeOn()) === 'false' && !(await cine()))
await page.mouse.dblclick(car.x, car.y)
await page.waitForTimeout(600)
check('double click launches', await cine())
check('double click did not explode', (await explodeOn()) === 'false')
await page.waitForTimeout(5000)
const kmh = Number(await page.textContent('#root .bar.bot .hud:last-child span'))
check(`HUD speed during run (${kmh} km/h)`, kmh > 100)
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await page.keyboard.press('Escape')
await page.waitForTimeout(2500)
check('skip returns to idle', !(await cine()))
// drag orbit should not count as a click
await page.mouse.move(car.x, car.y); await page.mouse.down(); await page.mouse.move(car.x + 120, car.y, { steps: 8 }); await page.mouse.up()
await page.waitForTimeout(700)
check('drag does not explode', (await explodeOn()) === 'false')
check('no page errors', errors.length === 0)
if (errors.length) console.log(errors.join('\n'))
await browser.close()
