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

// Front v2 (bancada): projeto separado do app atual, na porta 5174.
export default defineConfig({
  plugins: [react(), adminNoDev()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // Duas páginas: o app (index.html) e o admin (admin.html). O pedaço do admin se chama "painel" (sem "admin" no nome).
  build: { rollupOptions: { input: { main: path.resolve(__dirname, 'index.html'), painel: path.resolve(__dirname, 'admin.html') } } },
  server: {
    port: 5174,
    // Mesma API do app atual, por proxy = mesma origem: sem CORS (a API só libera :5173) e os cookies
    // httpOnly do login valem aqui (cookie de localhost não separa porta — logou lá, logou aqui).
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
