// Side-by-side calibration: screenshots the prototype and the app at the default view, light + dark.
//   node scripts/dev/compare.mjs [outDir]
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
const out = process.argv[2] ?? 'shots'
const proto = pathToFileURL(path.resolve('reference/aurora-studio.html')).href
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
for (const scheme of ['light', 'dark']) {
  for (const [name, url, ready] of [['proto', proto, '#loader.done'], ['app', 'http://localhost:5173/', '#loader.done']]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme })
    await page.goto(url)
    await page.waitForSelector(ready, { timeout: 60000 })
    await page.keyboard.press('t') // stop turntable for a stable frame
    await page.waitForTimeout(3500)
    await page.screenshot({ path: path.join(out, `${name}-${scheme}.png`) })
    await page.close()
  }
}
await browser.close()
console.log('done')
