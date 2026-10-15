/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Front v2 (bancada): projeto separado do app atual, na porta 5174.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
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
