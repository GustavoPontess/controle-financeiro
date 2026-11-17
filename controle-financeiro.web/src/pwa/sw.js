// Service worker do Pontes instalado (PWA, 2026-11-17), escrito à mão, sem pacote (mesmo molde do CRM da Pontes Dev,
// sem os avisos). O build (vite.config.ts) põe na VERSAO uma marca do pacote e publica como /sw.js (no dev, "dev").
// Quem registra: src/pwa/registrar.ts.
//  - /api NUNCA passa por aqui: dado financeiro não fica guardado no aparelho (é app de dinheiro).
//  - Página: sempre da rede; sem internet, abre a casca guardada ("/", o HTML sem dado nenhum).
//  - /assets/* (nome com hash, nunca muda): guarda e serve do aparelho, pra abrir rápido.
//  - O resto (ícones, fotos do site): passa direto, como se o worker não existisse.
const VERSAO = "__VERSAO__"
const CASCA = `casca-${VERSAO}`
const ARQUIVOS = "arquivos"
const MAX_ARQUIVOS = 120

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CASCA).then((c) => c.add(new Request("/", { cache: "reload" }))).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith("casca-") && n !== CASCA).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (e) => {
  const req = e.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api")) return

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.open(CASCA).then((c) => c.match("/")).then((r) => r || Response.error())))
    return
  }
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.open(ARQUIVOS).then((c) => c.match(req).then((guardado) => guardado || fetch(req).then((r) => {
      if (r.ok) e.waitUntil(c.put(req, r.clone()).then(() => aparar(c)))
      return r
    }))))
  }
})

// Arquivos de versões antigas vão ficando: passou do limite, saem os mais antigos (ordem em que entraram).
function aparar(c) {
  return c.keys().then((chaves) => Promise.all(chaves.slice(0, Math.max(0, chaves.length - MAX_ARQUIVOS)).map((k) => c.delete(k))))
}
