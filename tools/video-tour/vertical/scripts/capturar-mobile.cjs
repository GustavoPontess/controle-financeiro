// Telas REAIS no tamanho de celular (390×844, dpr 3), conta de TESTE do seed. Só navega e lê — não grava nada.
const { chromium } = require('playwright')
const out = process.argv[2]
const base = 'http://localhost:5173'
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'pt-BR' })
  const page = await ctx.newPage()
  await page.goto(base + '/auth/login')
  await page.fill('input[type=email]', process.env.BRAG_EMAIL)
  await page.fill('input[type=password]', process.env.BRAG_SENHA)
  await page.locator('button', { hasText: /^Entrar$/ }).first().click()
  await page.waitForURL(/dashboard|onboarding/, { timeout: 60000, waitUntil: 'commit' })
  const telas = [['dashboard', '/dashboard'], ['transacoes', '/transactions'], ['reconciliacao', '/reconciliacao'],
    ['cartoes', '/credit-cards'], ['parcelamentos', '/credit-cards/parcelamentos'], ['contasfixas', '/assinaturas'],
    ['emprestimos', '/emprestimos'], ['relatorios', '/reports'], ['metas', '/metas'], ['limites', '/limites'], ['familias', '/familias']]
  for (const [nome, rota] of telas) {
    await page.goto(base + rota)
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${out}/${nome}.png`, fullPage: true })
    const h = await page.evaluate(() => document.documentElement.scrollHeight)
    const larg = await page.evaluate(() => document.documentElement.scrollWidth)
    console.log(nome, 'altura', h, 'largura', larg)
  }
  await browser.close()
})().catch((e) => { console.error('ERRO', e.message); process.exit(1) })
