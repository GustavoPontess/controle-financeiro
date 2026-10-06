// Cria DADOS DE TESTE (fictícios) na conta de TESTE dev@ do seed, pela API do próprio app — só pro vídeo.
// Parcelamentos, empréstimos, metas e limites estavam vazios. Nada fora da conta dev@.
const { chromium } = require('playwright')
const base = 'http://localhost:5173'
;(async () => {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ locale: 'pt-BR' })).newPage()
  await page.goto(base + '/auth/login')
  await page.fill('input[type=email]', process.env.BRAG_EMAIL)
  await page.fill('input[type=password]', process.env.BRAG_SENHA)
  await page.locator('button', { hasText: /^Entrar$/ }).first().click()
  await page.waitForURL(/dashboard|onboarding/, { timeout: 60000, waitUntil: 'commit' })
  await page.waitForTimeout(1500)
  const res = await page.evaluate(async () => {
    const API = 'http://localhost:5293/api/v1'
    const csrf = decodeURIComponent((document.cookie.match(/(?:^|; )X-CSRF-Token=([^;]*)/) || [])[1] || '')
    const call = async (method, path, body) => {
      const key = crypto.randomUUID()
      const r = await fetch(API + path, { method, credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Idempotency-Key': key },
        body: body ? JSON.stringify(typeof body === 'function' ? body(key) : body) : undefined })
      const txt = await r.text()
      return { status: r.status, data: txt ? JSON.parse(txt) : null }
    }
    const out = []
    const cartoes = (await call('GET', '/cartoes')).data
    const cartao = (Array.isArray(cartoes) ? cartoes : cartoes.items)[0]
    const cats = (await call('GET', '/categorias')).data
    const cat = (n) => cats.find((c) => c.descricao === n)?.id
    // Parcelamentos no cartão de teste
    for (const [descricao, valor, parcelas] of [['Notebook', 3000, 10], ['Celular', 1200, 6]]) {
      const r = await call('POST', '/parcelamentos', (k) => ({ descricao, valor, tipo: 0, cartaoCreditoId: cartao.id,
        dataCompra: '2026-10-05', parcelas, primeiraParcelaMes: '2026-10', idempotencyKey: k }))
      out.push(['parcelamento', descricao, r.status, r.status >= 300 ? JSON.stringify(r.data) : ''])
    }
    // Empréstimos (pessoas fictícias, sem vínculo com outra conta)
    let r = await call('POST', '/emprestimos', (k) => ({ descricao: 'Ajuda com o aluguel', pessoa: 'Pedro', valorTotal: 600, tipo: 1,
      dataInicio: '2026-09-20', dataVencimento: '2026-11-20', formaPagamento: 1, idempotencyKey: k }))
    out.push(['emprestimo', 'Pedro', r.status, r.status >= 300 ? JSON.stringify(r.data) : ''])
    r = await call('POST', '/emprestimos', (k) => ({ descricao: 'Conserto do carro', pessoa: 'Tia Rosa', valorTotal: 1200, tipo: 2,
      dataInicio: '2026-09-10', formaPagamento: 2, quantidadeParcelas: 4, primeiroVencimento: '2026-10-10', idempotencyKey: k }))
    out.push(['emprestimo', 'Tia Rosa', r.status, r.status >= 300 ? JSON.stringify(r.data) : ''])
    // Metas
    for (const [nome, alvo, guardado, limite] of [['Viagem de férias', 8000, 3200, '2027-07-01'], ['Reserva de emergência', 15000, 9750, null]]) {
      const m = await call('POST', '/metas', { nome, valorAlvo: alvo, dataLimite: limite })
      out.push(['meta', nome, m.status, m.status >= 300 ? JSON.stringify(m.data) : ''])
      if (m.status < 300) { const c = await call('POST', `/metas/${m.data.id}/contribuir`, { valor: guardado }); out.push(['contribuir', nome, c.status]) }
    }
    // Limites do mês (orçamentos)
    for (const [nome, limite] of [['Alimentação', 500], ['Lazer e entretenimento', 200], ['Moradia', 2500]]) {
      const o = await call('POST', '/orcamentos', { categoriaId: cat(nome), mes: 10, ano: 2026, valorLimite: limite, percentualAlerta: 80 })
      out.push(['limite', nome, o.status, o.status >= 300 ? JSON.stringify(o.data) : ''])
    }
    return out
  })
  for (const l of res) console.log(l.join(' | '))
  await browser.close()
})().catch((e) => { console.error('ERRO', e.message); process.exit(1) })
