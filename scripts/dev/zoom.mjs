// Zoomed screenshot: view key, pan (dx,dy px right-drag), zoom wheel clicks.  node scripts/dev/zoom.mjs out.png 1 0 0 6
import { chromium } from 'playwright-core'
const [, , out, view = '1', dx = '0', dy = '0', zoom = '5'] = process.argv
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/')
await page.waitForSelector('#loader.done', { timeout: 90000, state: 'attached' })
await page.keyboard.press('t'); await page.keyboard.press(view); await page.waitForTimeout(2500)
await page.mouse.move(720, 450)
if (+dx || +dy) { await page.mouse.down({ button: 'right' }); await page.mouse.move(720 + +dx, 450 + +dy, { steps: 10 }); await page.mouse.up({ button: 'right' }) }
for (let i = 0; i < +zoom; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(40) }
await page.waitForTimeout(2500)
await page.screenshot({ path: out })
await browser.close()
