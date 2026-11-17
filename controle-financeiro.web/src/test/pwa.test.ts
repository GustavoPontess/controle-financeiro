// App instalável (PWA, 2026-11-17): abre como app (sem barra do navegador), cores da barra batendo com o tema, ícones
// que existem, e o worker que nunca guarda a API (dado financeiro não fica no aparelho).
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { COR_DA_BARRA, INICIO_DO_APP, manifesto } from "../pwa/manifesto"
import { ehIphone, propsDeLinkInterno } from "../pwa/instalar"

const tokens = readFileSync("src/estilo/tokens.css", "utf8")
const indexHtml = readFileSync("index.html", "utf8")
const sw = readFileSync("src/pwa/sw.js", "utf8")

describe("manifesto do app", () => {
  it("abre como app, em tela cheia, com tudo do app dentro do escopo", () => {
    const m = manifesto()
    expect(m.name).toBe("Pontes")
    expect(m.display).toBe("standalone")
    expect(m.scope).toBe("/")
    expect(m.start_url).toBe(INICIO_DO_APP)
    expect(m.start_url.startsWith(m.scope)).toBe(true)
    expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(["192x192 any", "512x512 any", "512x512 maskable"])
    for (const i of m.icons) expect(existsSync(`public${i.src}`), i.src).toBe(true)
  })

  it("a barra do celular usa o fundo de cada tema (tokens.css) e o index.html liga o manifesto e o iPhone", () => {
    const fundos = [...tokens.matchAll(/--v2-bg:\s*(#[0-9A-Fa-f]{6})/g)].map((m) => m[1].toUpperCase())
    expect(fundos).toEqual([COR_DA_BARRA.claro, COR_DA_BARRA.escuro])
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(indexHtml).toContain(`<meta name="theme-color" content="${COR_DA_BARRA.claro}" />`)
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />')
    expect(existsSync("public/icones/apple-touch-icon.png")).toBe(true)
  })
})

describe("links internos", () => {
  it("no navegador abrem em aba nova; instalado, abrem ali mesmo (aba nova no app é o navegador, com a barra)", () => {
    expect(propsDeLinkInterno()).toEqual({ target: "_blank", rel: "noreferrer" })
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({ matches: q === "(display-mode: standalone)" })) as never
    try {
      expect(propsDeLinkInterno()).toEqual({})
    } finally {
      window.matchMedia = original
    }
  })

  it("reconhece iPhone e iPad (o iPad novo diz que é Mac, mas tem toque)", () => {
    expect(ehIphone("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", 5)).toBe(true)
    expect(ehIphone("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 5)).toBe(true)
    expect(ehIphone("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 0)).toBe(false)
  })
})

describe("service worker", () => {
  it("nunca guarda a API nem outra origem, e só guarda os arquivos com hash", () => {
    expect(sw).toMatch(/url\.origin !== self\.location\.origin \|\| url\.pathname\.startsWith\("\/api"\)\) return/)
    expect(sw).toContain('if (req.method !== "GET") return')
    // Só duas coisas vão pro cache: a casca "/" (HTML sem dado) e /assets/* (nome com hash).
    expect([...sw.matchAll(/\.put\(/g)].length).toBe(1)
    expect(sw).toContain('url.pathname.startsWith("/assets/")')
    expect(sw).toContain('"__VERSAO__"')
  })
})
