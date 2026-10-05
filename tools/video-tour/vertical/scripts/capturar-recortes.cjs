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
  await recorte(page, 'dash-hero', ['SALDO TOTAL', 'SOBROU'])
  await recorte(page, 'dash-gastos', ['Maiores gastos', 'Moradia'])
  await recorte(page, 'dash-recentes', ['Transações recentes', 'Salário'], { maxH: 400 })
  // olho: esconde todos os valores (só muda a tela; volta ao normal no fim)
  await page.getByLabel('Ocultar valores').click(); await page.waitForTimeout(500)
  await recorte(page, 'dash-hero-oculto', ['SALDO TOTAL', 'SOBROU'])
  await page.getByLabel('Mostrar valores').click(); await page.waitForTimeout(300)

  await ir(page, '/transactions')
  await recorte(page, 'transacoes', ['Todas as transações', 'DESCRIÇÃO'], { maxH: 560 })

  await ir(page, '/credit-cards')
  await recorte(page, 'cartao-arte', ['4218', 'fecha dia'])
  await recorte(page, 'fatura', ['atual', 'Pagar', 'Vence'], { maxH: 470 })

  await ir(page, '/credit-cards/parcelamentos')
  await recorte(page, 'parcelamentos', ['Seus parcelamentos', 'Notebook', 'Celular'])

  await ir(page, '/assinaturas')
  await recorte(page, 'fixas-hero', ['CUSTO MENSAL', 'por ano'])
  await recorte(page, 'fixas-proximas', ['Próximas cobranças', 'Spotify', 'Netflix'])

  await ir(page, '/emprestimos')
  await recorte(page, 'emprestimos-hero', ['A RECEBER', 'A PAGAR'])
  await recorte(page, 'emprestimos-lista', ['Empréstimos', 'Pedro', 'Tia Rosa'], { maxH: 420 })

  await ir(page, '/reports')
  await recorte(page, 'relatorios-comparacao', ['vs Set.', 'RECEITAS', 'DESPESAS'])
  await recorte(page, 'relatorios-grafico', ['Evolução do saldo mensal', 'Receitas'])

  await ir(page, '/metas')
  await recorte(page, 'metas', ['Viagem de férias', 'Reserva de emergência'])
  await ir(page, '/limites')
  await recorte(page, 'limites', ['Alimentação', 'Lazer e entretenimento', 'Moradia'])

  await ir(page, '/familias'); await page.getByText('Casa Dev').first().click(); await page.waitForTimeout(2200)
  await recorte(page, 'familia-balanco', ['Balanço do mês', 'a receber'])
  await recorte(page, 'familia-despesas', ['Despesas compartilhadas', 'Supermercado'], { maxH: 420 })

  // Ctrl K: digita "fat" na busca de telas
  await ir(page, '/dashboard')
  await page.keyboard.press('Control+k'); await page.waitForTimeout(500)
  await page.keyboard.type('fat', { delay: 80 }); await page.waitForTimeout(600)
  const dlg = await page.evaluate(() => {
    const i = document.querySelector('input[placeholder="Buscar..."]'); let el = i
    while (el && el.parentElement && el.getBoundingClientRect().height < 200) el = el.parentElement
    const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  await page.screenshot({ path: `${out}/ctrlk.png`, clip: dlg })
  console.log('ok ctrlk', Math.round(dlg.width), 'x', Math.round(dlg.height))
  await browser.close()
})().catch((e) => { console.error('ERRO', e.message); process.exit(1) })
