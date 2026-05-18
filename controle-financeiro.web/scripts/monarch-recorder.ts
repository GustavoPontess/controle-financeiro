/**
 * monarch-recorder.ts — Monarch Session Recorder (Issue #60, sub-task 1)
 *
 * Script Playwright PASSIVO. Abre um Chromium visível com perfil persistente e
 * captura automaticamente cada tela que o usuário visitar enquanto navega o
 * Monarch (ou qualquer referência). Não automatiza nada — só observa.
 *
 * A cada `load`, grava em docs/features/redesign-ux/monarch-session/step-NNN-<slug>/:
 *   - screenshot.png  — full-page
 *   - page.html       — DOM completo
 *   - styles.css      — CSS consolidado de todas as stylesheets (CORS-safe)
 *   - tokens.json     — CSS custom properties do :root
 * E acrescenta uma entrada em monarch-session/journey.json.
 *
 * Uso:
 *   npm run monarch:record
 *   -> loga no Monarch no browser que abrir, navega à vontade.
 *   -> fecha o browser quando terminar; o script encerra sozinho.
 *
 * Por padrão usa o Chromium embutido do Playwright. Para usar o Google
 * Chrome instalado na máquina (dispensa `npx playwright install chromium`):
 *   MONARCH_CHANNEL=chrome npm run monarch:record
 * Outros valores válidos: msedge, chrome-beta, etc.
 *
 * O login persiste entre runs (perfil em .playwright-monarch-profile/).
 */
import { chromium, type BrowserContext, type Page } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PROFILE_DIR = join(process.cwd(), '.playwright-monarch-profile')
const SESSION_DIR = join(process.cwd(), '..', 'docs', 'features', 'redesign-ux', 'monarch-session')

interface JourneyEntry {
  step: number
  timestamp: string
  url: string
  title: string
  slug: string
}

const journey: JourneyEntry[] = []
let stepCount = 0

/** Deriva um slug curto a partir da URL. */
function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/|\/$/g, '')
    const s = path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
    return s || 'root'
  } catch {
    return 'page'
  }
}

/** CSS consolidado de todas as stylesheets, tratando folhas bloqueadas por CORS. */
const COLLECT_CSS = `(() => {
  let out = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) out += rule.cssText + '\\n';
    } catch {
      out += '/* CORS-blocked stylesheet: ' + (sheet.href || 'inline') + ' */\\n';
    }
  }
  return out;
})()`

/** CSS custom properties publicadas no :root. */
const COLLECT_TOKENS = `(() => {
  const cs = getComputedStyle(document.documentElement);
  const tokens = {};
  for (let i = 0; i < cs.length; i++) {
    const prop = cs[i];
    if (prop.startsWith('--')) tokens[prop] = cs.getPropertyValue(prop).trim();
  }
  return tokens;
})()`

async function captureSnapshot(page: Page): Promise<void> {
  stepCount += 1
  const step = stepCount
  const url = page.url()
  if (url === 'about:blank' || !url.startsWith('http')) {
    stepCount -= 1
    return
  }

  try {
    const title = await page.title()
    const slug = slugFromUrl(url)
    const dirName = `step-${String(step).padStart(3, '0')}-${slug}`
    const dir = join(SESSION_DIR, dirName)
    await mkdir(dir, { recursive: true })

    await page.screenshot({ path: join(dir, 'screenshot.png'), fullPage: true })
    await writeFile(join(dir, 'page.html'), await page.content(), 'utf-8')
    await writeFile(join(dir, 'styles.css'), (await page.evaluate(COLLECT_CSS)) as string, 'utf-8')
    await writeFile(
      join(dir, 'tokens.json'),
      JSON.stringify(await page.evaluate(COLLECT_TOKENS), null, 2),
      'utf-8',
    )

    journey.push({ step, timestamp: new Date().toISOString(), url, title, slug })
    await writeFile(join(SESSION_DIR, 'journey.json'), JSON.stringify(journey, null, 2), 'utf-8')

    console.log(`  step ${String(step).padStart(3, '0')}  ${title || slug}  (${url})`)
  } catch (err) {
    // Browser fechado no meio da captura ou navegação abortada — ignora.
    console.warn(`  step ${step} pulado: ${(err as Error).message}`)
  }
}

function watch(page: Page): void {
  page.on('load', () => {
    void captureSnapshot(page)
  })
}

async function main(): Promise<void> {
  await mkdir(SESSION_DIR, { recursive: true })

  // MONARCH_CHANNEL=chrome usa o Chrome instalado; vazio usa o Chromium do Playwright.
  const channel = process.env.MONARCH_CHANNEL?.trim() || undefined

  const context: BrowserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel,
    viewport: { width: 1920, height: 1080 },
  })

  console.log('Monarch Session Recorder ativo.')
  console.log('Navegue à vontade. Cada tela carregada vira um snapshot.')
  console.log(`Saída: ${SESSION_DIR}`)
  console.log('Feche o browser para encerrar.\n')

  context.pages().forEach(watch)
  context.on('page', watch)

  // Encerra graceful quando o usuário fecha o browser.
  await new Promise<void>((resolve) => {
    context.on('close', () => resolve())
  })

  console.log(`\nSessão encerrada. ${journey.length} telas capturadas em ${SESSION_DIR}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
