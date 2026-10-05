// Recortes REAIS (desktop 1440×900, dpr 3 pra ficar nítido ampliado no vertical), conta de TESTE dev@.
// Só navega, lê e clica em coisas que não gravam (olho, Ctrl K). Nada é salvo.
const { chromium } = require('playwright')
const out = process.argv[2]
const base = 'http://localhost:5173'

// menor <div> do <main> (ou do body) que contém TODOS os textos
async function caixa(page, textos, escopo = 'main') {
  return page.evaluate(([ts, esc]) => {
    const raiz = document.querySelector(esc) || document.body
    const els = [...raiz.querySelectorAll('div, section')].filter((d) => {
      const r = d.getBoundingClientRect(); return r.width > 0 && r.height > 0 && ts.every((t) => d.innerText.includes(t))
    })
    els.sort((a, b) => { const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return A.width * A.height - B.width * B.height })
    if (!els.length) return null
    const r = els[0].getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }
  }, [textos, escopo])
}
async function recorte(page, nome, textos, { maxH, pad = 0, escopo } = {}) {
  await page.evaluate(() => window.scrollTo(0, 0))
  let b = await caixa(page, textos, escopo)
  if (!b) { console.log('NAO ACHEI', nome, textos); return }
  // traz pra dentro da tela se estiver abaixo
  const main = await page.$('main')
  if (b.y + Math.min(b.height, maxH || b.height) > 900) {
    await page.evaluate(([y]) => { const m = document.querySelector('main'); (m && m.scrollHeight > m.clientHeight ? m : document.scrollingElement).scrollBy(0, y) }, [b.y - 80])
    await page.waitForTimeout(400)
    b = await caixa(page, textos, escopo)
  }
  const clip = { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: Math.min(b.height, maxH || b.height) + pad * 2 }
  await page.screenshot({ path: `${out}/${nome}.png`, clip })
  console.log('ok', nome, Math.round(clip.width), 'x', Math.round(clip.height))
}
async function ir(page, rota) {
  await page.goto(base + rota)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1600)
}
;(async () => {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3, locale: 'pt-BR' })).newPage()
  await page.goto(base + '/auth/login')
  await page.fill('input[type=email]', process.env.BRAG_EMAIL)
  await page.fill('input[type=password]', process.env.BRAG_SENHA)
  await page.locator('button', { hasText: /^Entrar$/ }).first().click()
  await page.waitForURL(/dashboard|onboarding/, { timeout: 60000, waitUntil: 'commit' })

  await ir(page, '/dashboard')
  await page.getByLabel('Ocultar valores').click(); await page.waitForTimeout(600)
  await recorte(page, 'dash-hero-oculto', ['SALDO TOTAL', 'SOBROU'])
  await page.getByLabel('Mostrar valores').click(); await page.waitForTimeout(300)
  await browser.close()
})().catch((e) => { console.error('ERRO', e.message); process.exit(1) })
