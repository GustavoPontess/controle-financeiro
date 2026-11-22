// Grava a imagem de prévia de link (Open Graph) em public/compartilhar.jpg, a partir de scripts/compartilhar.html.
// Rodar de novo quando a arte mudar:  node scripts/compartilhar.mjs
// As tags que apontam pra ela moram no index.html (og:image com o endereço completo do app).
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'file:///E:/VSCode/pontes/PontesDev/site-pontes-dev/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

const ARTE = path.resolve(import.meta.dirname, 'compartilhar.html')
const SAIDA = path.resolve(import.meta.dirname, '..', 'public', 'compartilhar.jpg')

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const p = await b.newPage()
await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
await p.goto(pathToFileURL(ARTE).href, { waitUntil: 'networkidle0' })
await p.evaluate(() => document.fonts.ready)
await p.screenshot({ path: SAIDA, type: 'jpeg', quality: 95 })
await b.close()
console.log(`${path.relative(process.cwd(), SAIDA)}: ${Math.round(fs.statSync(SAIDA).size / 1024)} KB`)
