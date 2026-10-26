import { describe, expect, it } from "vitest"
import { maskMoney, moneyParaCampo, parseMoney } from "../../utils/money"

describe("dinheiro nos campos", () => {
  it("dígitos viram centavos", () => {
    expect(maskMoney("690")).toBe("6,90")
    expect(maskMoney("394420")).toBe("3.944,20")
  })

  it("ignora sinal e letra — valor nunca negativo", () => {
    expect(maskMoney("-150")).toBe("1,50")
    expect(maskMoney("abc")).toBe("")
  })

  it("apagar até zero esvazia o campo", () => {
    expect(maskMoney("0", "0,05")).toBe("")
  })

  it("lê de volta o que o campo mostra", () => {
    expect(parseMoney("3.944,20")).toBe(3944.2)
    expect(parseMoney("")).toBe(0)
    expect(parseMoney(moneyParaCampo(1234.5))).toBe(1234.5)
  })
})
