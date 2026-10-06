import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { emptyCriarForm, faixaInicio, validateCriar, type CriarForm } from "@/pages/Recorrentes/recorrenteForm"

// Faixa da data de início = a do servidor (AgendaRecorrente.ValidarPeriodo, P1-3: início sem faixa = DoS).
describe("recorrenteForm — faixa do período", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0)) // 05/10/2026, hora local
  })
  afterEach(() => vi.useRealTimers())

  const form = (patch: Partial<CriarForm>): CriarForm => ({
    ...emptyCriarForm(), descricao: "Aluguel", valor: "1.500,00", contaId: "c1", ...patch,
  })

  it("faixa vai de 12 meses atrás a 5 anos à frente", () => {
    expect(faixaInicio()).toEqual({ min: "2025-10-05", max: "2031-10-05" })
  })

  it("início nos limites passa", () => {
    expect(validateCriar(form({ dataInicio: "2025-10-05" })).dataInicio).toBeUndefined()
    expect(validateCriar(form({ dataInicio: "2031-10-05" })).dataInicio).toBeUndefined()
  })

  it("início fora da faixa bloqueia com erro no campo", () => {
    expect(validateCriar(form({ dataInicio: "0001-01-01" })).dataInicio).toBe("Início entre 12 meses atrás e 5 anos à frente.")
    expect(validateCriar(form({ dataInicio: "2025-10-04" })).dataInicio).toBeDefined()
    expect(validateCriar(form({ dataInicio: "2031-10-06" })).dataInicio).toBeDefined()
  })

  it("fim antes do início bloqueia; fim igual ao início passa", () => {
    expect(validateCriar(form({ dataInicio: "2026-10-05", dataFim: "2026-10-04" })).dataFim).toBe("O fim não pode ser antes do início.")
    expect(validateCriar(form({ dataInicio: "2026-10-05", dataFim: "2026-10-05" })).dataFim).toBeUndefined()
  })

  it("form válido não tem erro", () => {
    expect(validateCriar(form({}))).toEqual({})
  })
})
