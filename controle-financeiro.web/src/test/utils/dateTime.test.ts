import { describe, expect, it } from "vitest"
import { dataBR, diaDeInstante } from "../../utils/dateTime"

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
