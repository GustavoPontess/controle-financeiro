/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Admin é um mini-app à parte (admin.html): no build, entrada própria, fora do pacote do app. Em produção o Caddy só
// serve a página no endereço secreto do deploy (ADMIN_PATH). No dev, mora em /admin (este endereço não vai pro build).
const adminNoDev = (): Plugin => ({
  name: 'admin-no-dev',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/admin(\/|\?|$)/.test(req.url)) req.url = '/admin.html'
      next()
    })
  },
})

// Site público (2026-10-26, pra abrir rápido no celular): o index.html já pede o pedaço do site e a folha dele junto
// com o resto, em vez de esperar o app descobrir a rota. Quem entra direto no app baixa esses ~30 KB uma vez (cache de
// um ano); o HTML do site continua fora do pacote do app.
const preloadDoSite = (): Plugin => ({
  name: 'preload-do-site',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      if (!ctx.bundle || !ctx.path.endsWith('index.html')) return []
      const tags = []
      for (const nome of Object.keys(ctx.bundle)) {
        if (/^assets\/PaginaSite-[\w-]+\.js$/.test(nome)) tags.push({ tag: 'link', attrs: { rel: 'modulepreload', href: '/' + nome }, injectTo: 'head' as const })
        if (/^assets\/site-[\w-]+\.css$/.test(nome)) tags.push({ tag: 'link', attrs: { rel: 'preload', as: 'style', href: '/' + nome }, injectTo: 'head' as const })
      }
      return tags
    },
  },
})

// Front do Pontes (o v2 de 2026-10, único desde 2026-10-26; o v1 está na tag arquivo/v1-final). Porta 5174.
export default defineConfig({
  plugins: [react(), adminNoDev(), preloadDoSite()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // Duas páginas: o app (index.html) e o admin (admin.html). O pedaço do admin se chama "painel" (sem "admin" no nome).
  build: { rollupOptions: { input: { main: path.resolve(__dirname, 'index.html'), painel: path.resolve(__dirname, 'admin.html') } } },
  server: {
    port: 5174,
    // API por proxy = mesma origem: sem CORS, e os cookies httpOnly do login valem direto.
    proxy: { '/api': { target: 'http://localhost:5293', changeOrigin: true } },
  },
  // Testes (vitest + testing-library): toda tela nova sai com teste — submit vazio bloqueia + fluxo feliz,
  // e os fluxos de dinheiro (pagar, cancelar, idempotência) têm o seu.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 15000,
  },
})
