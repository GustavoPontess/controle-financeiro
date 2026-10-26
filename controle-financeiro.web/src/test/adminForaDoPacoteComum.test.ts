// Trava (2026-10-25, Gustavo: "ninguém que usa o app normalmente pode ter ideia de onde fica o admin"): o admin é um
// mini-app à parte (admin.html + src/admin/), com entrada própria no build. Lê o código do v2 e falha se:
//  - algum arquivo fora do admin importar o mini-app, o adminService, os tipos de admin ou citar endpoint /admin/;
//  - o app (rotas, casca, menu, telas, entrada) apontar pro admin: nenhuma rota, item ou link, nem a palavra no App.
// O pacote gerado tem a sua trava (scripts/conferirAdminFora.mjs, roda no build). A barreira de verdade é o servidor
// (IsAdmin + duas etapas ligadas + conta Ativa a cada chamada); o endereço secreto vem do deploy (Caddyfile).
import { describe, expect, it } from "vitest"

const fontes = import.meta.glob(["../**/*.{ts,tsx}", "!../test/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>
const indexHtml = import.meta.glob("../../index.html", { query: "?raw", import: "default", eager: true }) as Record<string, string>

// Só estes podem falar de admin: o mini-app e o que só ele usa.
const doAdmin = (arquivo: string) =>
  arquivo.startsWith("../admin/") || ["../services/adminService.ts", "../types/Admin.ts", "../types/NotificacaoAdmin.ts"].includes(arquivo)

const linhasDeCodigo = (codigo: string) => codigo.split("\n").map((l) => l.trim()).filter((l) => !/^(\/\/|\*|\/\*|\{\/\*)/.test(l))

const doApp = () => Object.entries(fontes).filter(([arquivo]) => !doAdmin(arquivo))

describe("admin fora do app", () => {
  it("fora do mini-app ninguém usa o adminService, os tipos de admin, os endpoints /admin/ nem importa src/admin", () => {
    const achados = doApp().flatMap(([arquivo, codigo]) =>
      linhasDeCodigo(codigo)
        // "import type" some no build (não vira código no navegador): pode.
        .filter((l) => !/^import\s+type\s/.test(l))
        .filter((l) => /adminService|types\/Admin|types\/NotificacaoAdmin|["'`]\/admin\/[a-z]|from\s+["'][^"']*\/admin\/|import\(["'][^"']*\/admin\//.test(l))
        .map((l) => `${arquivo}: ${l}`))
    expect(achados).toEqual([])
  })

  it("o app não aponta pro admin: nenhuma rota, link ou item; App, casca, entrada e index.html nem citam admin", () => {
    const achados = doApp().flatMap(([arquivo, codigo]) =>
      linhasDeCodigo(codigo).filter((l) => /["'`]\/admin/.test(l)).map((l) => `${arquivo}: ${l}`))
    expect(achados).toEqual([])
    for (const arquivo of ["../App.tsx", "../layout/V2Layout.tsx", "../main.tsx"]) expect(fontes[arquivo]).not.toMatch(/admin/i)
    expect(Object.values(indexHtml)[0]).not.toMatch(/admin/i)
  })
})
