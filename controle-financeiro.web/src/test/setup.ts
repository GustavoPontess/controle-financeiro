// Setup dos testes do v2 (vitest + testing-library, jsdom).
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

// Sem `globals`, a testing-library não se registra sozinha pra limpar a tela entre os testes.
afterEach(() => cleanup())

// jsdom não implementa scrollIntoView (Selecao, faixa de meses do cartão).
Element.prototype.scrollIntoView = function scrollIntoView() {}

// jsdom não tem IntersectionObserver nem scrollTo: o site público (comportamentos.ts) usa os dois pra animar blocos
// ao rolar. Nos testes, um substituto que não faz nada basta (vale pra PaginaSite e pras páginas com MolduraSite).
if (!("IntersectionObserver" in globalThis)) {
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } } as unknown as typeof IntersectionObserver
}
window.scrollTo = (() => {}) as typeof window.scrollTo
