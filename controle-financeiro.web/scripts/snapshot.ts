/**
 * snapshot.ts — Atlas Playwright das telas atuais (Issue #59)
 *
 * Faz login com um usuário de teste, varre todas as rotas do React Router e
 * tira screenshot full-page em dois viewports (desktop 1440x900, mobile
 * 390x844). Saída em `screenshots/atlas/{desktop,mobile}/<slug>.png`.
 *
 * Uso:
 *   1. Suba o frontend (`npm run dev`) e o backend.
 *   2. Garanta que existe um usuário de teste (ver SNAPSHOT_EMAIL abaixo).
 *   3. `npm run snapshot`
 *
 * Variáveis de ambiente (todas opcionais):
 *   SNAPSHOT_BASE_URL  — URL do frontend        (default http://localhost:5173)
 *   SNAPSHOT_EMAIL     — e-mail do usuário teste (default dev@controle.test)
 *   SNAPSHOT_PASSWORD  — senha do usuário teste  (default Dev@123456)
 */
import { chromium, type Browser, type Page } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const BASE_URL = process.env.SNAPSHOT_BASE_URL ?? 'http://localhost:5173'
const EMAIL = process.env.SNAPSHOT_EMAIL ?? 'dev@controle.test'
const PASSWORD = process.env.SNAPSHOT_PASSWORD ?? 'Dev@123456'

const OUT_DIR = join(process.cwd(), 'screenshots', 'atlas')

/** Rotas que NÃO exigem login — capturadas antes de autenticar. */
const PUBLIC_ROUTES = ['/auth/login', '/auth/register']

/** Rotas protegidas — capturadas após o login. Espelha src/routes/AppRoutes.tsx. */
const PROTECTED_ROUTES = [
  '/',
  '/dashboard',
  '/categories',
  '/transactions',
  '/credit-cards',
  '/reports',
  '/transferencias',
  '/assinaturas',
  '/parcelamentos',
  '/emprestimos',
  '/accounts',
  '/familias',
  '/importacao',
  '/settings',
  '/design-system',
  '/onboarding',
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

/** Converte uma rota em nome de arquivo determinístico. */
function slug(route: string): string {
  if (route === '/') return 'home'
  return route.replace(/^\//, '').replace(/\//g, '_')
}

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Senha').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  // Espera sair da tela de login (redirect para dashboard).
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'), { timeout: 15_000 })
}

async function capture(page: Page, route: string): Promise<void> {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' })
    // Margem extra para animações / gráficos (recharts) estabilizarem.
    await page.waitForTimeout(600)
    const file = join(OUT_DIR, vp.name, `${slug(route)}.png`)
    await page.screenshot({ path: file, fullPage: true })
    console.log(`  [${vp.name}] ${route} -> ${file}`)
  }
}

async function main(): Promise<void> {
  const started = Date.now()
  for (const vp of VIEWPORTS) {
    await mkdir(join(OUT_DIR, vp.name), { recursive: true })
  }

  let browser: Browser | undefined
  try {
    browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    console.log('Capturando rotas públicas...')
    for (const route of PUBLIC_ROUTES) {
      await capture(page, route)
    }

    console.log(`Login como ${EMAIL}...`)
    try {
      await login(page)
    } catch {
      console.error(
        `\nFalha no login. Verifique se o usuário "${EMAIL}" existe e se a senha ` +
          `está correta (ou ajuste SNAPSHOT_EMAIL / SNAPSHOT_PASSWORD).`,
      )
      process.exitCode = 1
      return
    }

    console.log('Capturando rotas protegidas...')
    for (const route of PROTECTED_ROUTES) {
      await capture(page, route)
    }
  } finally {
    await browser?.close()
  }

  const total = PUBLIC_ROUTES.length + PROTECTED_ROUTES.length
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`\nAtlas completo: ${total} rotas x ${VIEWPORTS.length} viewports em ${secs}s.`)
  console.log(`Saída: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
