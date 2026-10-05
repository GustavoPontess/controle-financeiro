// Telas REAIS (desktop 1440×900, dpr 2), conta de TESTE do seed. Só navega e lê — nada é salvo.
const { chromium } = require('playwright')
const out = process.argv[2]
const base = 'http://localhost:5173'
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'pt-BR' })
  const page = await ctx.newPage()
  await page.goto(base + '/auth/login')
  await page.fill('input[type=email]', process.env.BRAG_EMAIL)
  await page.fill('input[type=password]', process.env.BRAG_SENHA)
  await page.locator('button', { hasText: /^Entrar$/ }).first().click()
  await page.waitForURL(/dashboard|onboarding/, { timeout: 60000, waitUntil: 'commit' })
  for (const [nome, rota] of [['parcelamentos', '/credit-cards/parcelamentos'], ['emprestimos', '/emprestimos'], ['relatorios', '/reports'], ['metas', '/metas'], ['limites', '/limites'], ['contasfixas', '/assinaturas'], ['cartoes', '/credit-cards']]) {
    await page.goto(base + rota)
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${out}/${nome}.png` })
    console.log('ok', nome)
  }
  await browser.close()
})().catch((e) => { console.error('ERRO', e.message); process.exit(1) })
