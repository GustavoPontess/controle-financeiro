// Prints das telas internas do app em tamanho de CELULAR, pro site mostrar no celular (os prints do rascunho são de
// computador, 1440px, e ficam ilegíveis numa tela de 390px). Entra com a conta de TESTE do seeder (DEV_EMAIL/DEV_SENHA
// do ambiente; nunca uma conta real) no app rodando em dev e grava public/site/telas/<tela>-<tema>-movel.png.
// O comportamentos.ts escolhe o "-movel" quando a tela tem até 600px. Rodar de novo quando o app mudar de cara:
//   DEV_EMAIL=dev@controle.test DEV_SENHA=... node scripts/printsMoveis.mjs
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'file:///E:/VSCode/pontes/PontesDev/site-pontes-dev/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const BASE = process.env.APP_URL || 'http://localhost:5174'
const OUT = path.resolve(import.meta.dirname, '..', 'public', 'site', 'telas')
const TELAS = ['dashboard', 'transacoes', 'cartoes', 'metas', 'contas-fixas']
if (!process.env.DEV_EMAIL || !process.env.DEV_SENHA) { console.error('Defina DEV_EMAIL e DEV_SENHA (conta de teste do seeder).'); process.exit(1) }

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const p = await b.newPage()
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await p.evaluateOnNewDocument(() => { localStorage.setItem('dev:barraEstados', JSON.stringify({ pos: null, escondida: true })); localStorage.setItem('devPanelRecolhido', '1') })
await p.goto(BASE + '/entrar', { waitUntil: 'networkidle0' })
await p.type('input[name=email]', process.env.DEV_EMAIL)
await p.type('input[name=senha]', process.env.DEV_SENHA)
await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {}), p.click('button[type=submit]')])
if (!/dashboard|proteja/.test(p.url())) { console.error('Não entrou: ' + p.url()); await b.close(); process.exit(1) }
fs.mkdirSync(OUT, { recursive: true })
for (const tema of ['claro', 'escuro']) for (const tela of TELAS) {
  await p.goto(BASE + '/' + tela, { waitUntil: 'networkidle0' }).catch(() => {})
  await p.evaluate((t) => { document.documentElement.setAttribute('data-tema', t); localStorage.setItem('v2:tema', t); document.querySelector('[aria-label^="Painel de dev"], [aria-label="Abrir o painel de dev"]')?.closest('div')?.remove() }, tema)
  await new Promise(r => setTimeout(r, 1200))
  await p.screenshot({ path: path.join(OUT, `${tela}-${tema}-movel.png`) })
  console.log('ok', tela, tema)
}
await b.close()
