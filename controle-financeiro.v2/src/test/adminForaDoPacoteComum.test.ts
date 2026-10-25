// Trava (2026-10-25, Gustavo: "no v1 a gente tomou muito cuidado pra não vazar nada de admin no front"): o que é de
// admin mora só nos arquivos carregados à parte (lazy) e só pra quem é admin. Lê o código do v2 e falha se:
//  - algum arquivo fora da lista do admin importar o adminService, os tipos de admin ou citar endpoint /admin/;
//  - a tela de Admin ou o pedaço do menu forem importados direto (sem lazy), o que os traria pro pacote comum.
// A barreira de verdade é o servidor (IsAdmin + conta Ativa a cada chamada); isto é defesa em profundidade.
import { describe, expect, it } from "vitest"

const fontes = import.meta.glob(["../**/*.{ts,tsx}", "!../test/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>

// Só estes podem falar de admin: entram num pacote à parte (ou só são usados por ele).
const DO_ADMIN = ["../telas/Admin.tsx", "../layout/MenuAdmin.tsx", "../services/adminService.ts", "../types/Admin.ts", "../types/NotificacaoAdmin.ts"]

const linhasDeCodigo = (codigo: string) => codigo.split("\n").map((l) => l.trim()).filter((l) => !/^(\/\/|\*|\/\*|\{\/\*)/.test(l))

describe("admin fora do pacote comum", () => {
  it("só os arquivos do admin usam o adminService, os tipos de admin e os endpoints /admin/", () => {
    const achados = Object.entries(fontes).filter(([arquivo]) => !DO_ADMIN.includes(arquivo)).flatMap(([arquivo, codigo]) =>
      linhasDeCodigo(codigo)
        // "import type" some no build (não vira código no navegador): pode.
        .filter((l) => !/^import\s+type\s/.test(l))
        .filter((l) => /adminService|types\/Admin|types\/NotificacaoAdmin|["'`]\/admin\//.test(l))
        .map((l) => `${arquivo}: ${l}`))
    expect(achados).toEqual([])
  })

  it("a tela de Admin e o menu de admin só entram por lazy (import dinâmico)", () => {
    const achados = Object.entries(fontes).flatMap(([arquivo, codigo]) =>
      linhasDeCodigo(codigo)
        .filter((l) => /^import\s.*from\s+["'][^"']*(telas\/Admin|\/MenuAdmin)["']/.test(l))
        .map((l) => `${arquivo}: ${l}`))
    expect(achados).toEqual([])
    expect(fontes["../App.tsx"]).toMatch(/lazy\(\(\) => import\("\.\/telas\/Admin"\)\)/)
    expect(fontes["../layout/V2Layout.tsx"]).toMatch(/lazy\(\(\) => import\("\.\/MenuAdmin"\)\)/)
  })
})
