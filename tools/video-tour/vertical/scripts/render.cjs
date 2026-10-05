// Grava a composição quadro a quadro (cada quadro = renderAt(t), função pura do tempo).
// Uso: node render.cjs stills 1.0,2.6,...   → work/stills/t_X.png
//      node render.cjs frames               → work/frames/f_00000.jpg … (30 fps)
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
const raiz = path.resolve(__dirname, '..')
const url = 'file:///' + path.join(raiz, 'composition', 'index.html').replace(/\\/g, '/')
const FPS = 30
;(async () => {
  const [modo, lista] = process.argv.slice(2)
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage()
  await page.goto(url)
  await page.evaluate(() => window.pronto)
  if (modo === 'stills') {
    const dir = path.join(__dirname, 'stills'); fs.mkdirSync(dir, { recursive: true })
    for (const t of lista.split(',').map(Number)) {
      await page.evaluate((x) => window.renderAt(x), t)
      await page.screenshot({ path: path.join(dir, `t_${t.toFixed(2)}.png`) })
    }
  } else {
    const dir = path.join(__dirname, 'frames'); fs.mkdirSync(dir, { recursive: true })
    const total = Math.round(await page.evaluate(() => window.DURACAO) * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.renderAt(x), f / FPS)
      await page.screenshot({ path: path.join(dir, `f_${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 })
      if (f % 60 === 0) console.log('quadro', f, '/', total)
    }
    console.log('total', total)
  }
  await browser.close()
})().catch((e) => { console.error('ERRO', e.message); process.exit(1) })
