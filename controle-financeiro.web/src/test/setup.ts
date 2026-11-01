// Setup dos testes do v2 (vitest + testing-library, jsdom).
import "@testing-library/jest-dom/vitest"
import { afterEach, beforeEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

// Relógio dos testes (regra de hora, 2026-11-01): todo teste roda no fuso de Brasília e com o dia congelado no dia dos
// dados de exemplo. Antes o resultado dependia da máquina e do dia: o CI (UTC) virou o mês às 21h de Brasília e quebrou
// as telas que abrem no mês de hoje. Teste que precisa de outro dia chama vi.setSystemTime; teste com relógio falso
// inteiro (vi.useFakeTimers()) continua podendo. O Node aplica a troca de TZ na hora (também está no vite.config).
process.env.TZ = "America/Sao_Paulo"
export const AGORA_DOS_TESTES = new Date("2026-10-20T12:00:00-03:00")
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA_DOS_TESTES)
})

// Sem `globals`, a testing-library não se registra sozinha pra limpar a tela entre os testes.
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// jsdom não implementa scrollIntoView (Selecao, faixa de meses do cartão).
Element.prototype.scrollIntoView = function scrollIntoView() {}

// jsdom não tem IntersectionObserver nem scrollTo: o site público (comportamentos.ts) usa os dois pra animar blocos
// ao rolar. Nos testes, um substituto que não faz nada basta (vale pra PaginaSite e pras páginas com MolduraSite).
if (!("IntersectionObserver" in globalThis)) {
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } } as unknown as typeof IntersectionObserver
}
window.scrollTo = (() => {}) as typeof window.scrollTo
