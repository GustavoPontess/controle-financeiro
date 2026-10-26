// Setup dos testes do v2 (vitest + testing-library, jsdom).
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

// Sem `globals`, a testing-library não se registra sozinha pra limpar a tela entre os testes.
afterEach(() => cleanup())

// jsdom não implementa scrollIntoView (Selecao, faixa de meses do cartão).
Element.prototype.scrollIntoView = function scrollIntoView() {}
