import { describe, expect, it } from "vitest"
import { taxaEfetivaMensal } from "../../dominio/emprestimo"

// Empréstimo de banco (2026-11-01): com o valor recebido, a parcela do contrato e quantas são, a taxa efetiva é a que
// iguala o recebido às parcelas (a mesma conta do servidor). O formulário mostra pra pessoa conferir com o contrato.
describe("taxaEfetivaMensal", () => {
  it("12 parcelas de 100 sobre 1.000 recebidos dão 2,92% ao mês", () => {
    expect(Math.round(taxaEfetivaMensal(1000, 100, 12) * 10000) / 100).toBe(2.92)
  })

  it("sem juros (parcelas somando o recebido) ou com dado faltando dá zero", () => {
    expect(taxaEfetivaMensal(1200, 100, 12)).toBe(0)
    expect(taxaEfetivaMensal(0, 100, 12)).toBe(0)
    expect(taxaEfetivaMensal(1000, 0, 12)).toBe(0)
  })
})
