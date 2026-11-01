import { describe, expect, it, vi } from "vitest"
import { agora, dataBR, dataLocalISO, diaDeInstante, mesAtual } from "../../utils/dateTime"
import { idade } from "../../telas/FamiliaPecas"
import { ParcelamentoService } from "../../services/ParcelamentoService"

describe("diaDeInstante", () => {
  it("instante do servidor (UTC) vira o dia de quem vê, com ou sem Z", () => {
    // 23h30 no relógio de quem vê: em Brasília já é o dia seguinte em UTC, e dataBR mostrava o dia seguinte.
    const noite = new Date(2026, 9, 18, 23, 30).toISOString() // "...Z"
    expect(diaDeInstante(noite)).toBe("18/10/2026")
    expect(diaDeInstante(noite.replace("Z", ""))).toBe("18/10/2026") // o Postgres devolve sem fuso
    expect(diaDeInstante("lixo")).toBe("")
  })

  it("dataBR continua lendo o dia escrito (data sem hora: vencimento, data do lançamento)", () => {
    expect(dataBR("2026-10-15T00:00:00")).toBe("15/10/2026")
  })
})

// Relógio único (2026-11-01): o setup.ts congela o dia em 20/10/2026, meio-dia de Brasília.
describe("relógio do app", () => {
  it("agora, mesAtual e dataLocalISO leem o mesmo relógio, no fuso de quem usa", () => {
    expect(agora().toISOString()).toBe("2026-10-20T15:00:00.000Z")
    expect(mesAtual()).toEqual({ ano: 2026, mes: 10 })
    expect(dataLocalISO()).toBe("2026-10-20")
  })

  it("às 22h de 31/10 em Brasília ainda é outubro (em UTC já é novembro)", () => {
    vi.setSystemTime(new Date("2026-11-01T01:00:00Z"))
    expect(mesAtual()).toEqual({ ano: 2026, mes: 10 })
    expect(dataLocalISO()).toBe("2026-10-31")
  })

  it("idade conta o aniversário pelo dia escrito (new Date(\"2000-10-21\") é dia 20 no Brasil)", () => {
    expect(idade("2000-10-20")).toBe(26) // faz aniversário hoje
    expect(idade("2000-10-21T00:00:00")).toBe(25) // amanhã: ainda não fez
  })

  it("próximo mês em 31/01 é fevereiro (somar 1 no mês pulava pra março)", () => {
    vi.setSystemTime(new Date(2027, 0, 31, 12))
    expect(ParcelamentoService.obterMesProximo()).toBe("2027-02")
    vi.setSystemTime(new Date(2026, 11, 15, 12))
    expect(ParcelamentoService.obterMesProximo()).toBe("2027-01")
  })
})
