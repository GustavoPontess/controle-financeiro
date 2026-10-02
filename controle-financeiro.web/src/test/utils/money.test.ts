import { describe, it, expect } from "vitest"
import { parseMoney, maskMoney, moneyParaCampo } from "../../utils/money"

// Helpers puros de campo monetário pt-BR (extraídos da ReconciliacaoPage; usados também no "Saldo inicial"
// da AccountsPage): texto do campo <-> número.

describe("parseMoney", () => {
  it("lê texto pt-BR com milhar e vírgula decimal", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56)
    expect(parseMoney("2.500,00")).toBe(2500)
    expect(parseMoney("0,05")).toBe(0.05)
  })

  it("aceita vários grupos de milhar", () => {
    expect(parseMoney("1.234.567,89")).toBe(1234567.89)
  })

  it("aceita inteiro sem vírgula e decimal de 1 casa", () => {
    expect(parseMoney("10")).toBe(10)
    expect(parseMoney("10,5")).toBe(10.5)
  })

  it("'0,00' é zero", () => {
    expect(parseMoney("0,00")).toBe(0)
  })

  it("string vazia vira 0", () => {
    expect(parseMoney("")).toBe(0)
  })

  it("só espaços vira 0", () => {
    expect(parseMoney("   ")).toBe(0)
  })

  it("só lixo (sem dígitos) vira 0, nunca NaN", () => {
    expect(parseMoney("abc")).toBe(0)
    expect(parseMoney("---")).toBe(0)
    expect(Number.isNaN(parseMoney("abc"))).toBe(false)
  })

  it("texto misturado com letras/símbolo de moeda é inválido e vira 0", () => {
    expect(parseMoney("R$ 1.234,56")).toBe(0)
    expect(parseMoney("12abc")).toBe(0)
  })

  it("mais de uma vírgula é inválido e vira 0", () => {
    expect(parseMoney("1,2,3")).toBe(0)
  })

  it("o ponto é separador de MILHAR (não decimal) em pt-BR: '1.5' lê como 15", () => {
    expect(parseMoney("1.5")).toBe(15)
  })
})

describe("maskMoney", () => {
  it("lê só dígitos como centavos e formata em pt-BR", () => {
    expect(maskMoney("394420")).toBe("3.944,20")
  })

  it("string vazia continua vazia (campo limpo, não '0,00')", () => {
    expect(maskMoney("")).toBe("")
  })

  it("só lixo (sem dígitos) vira vazio", () => {
    expect(maskMoney("abc")).toBe("")
    expect(maskMoney("R$ ,.-")).toBe("")
  })

  it("1 e 2 dígitos viram centavos com zero à esquerda", () => {
    expect(maskMoney("5")).toBe("0,05")
    expect(maskMoney("50")).toBe("0,50")
  })

  it("zeros: '0' e '000' viram '0,00' (a validação 'maior que zero' é de quem usa)", () => {
    expect(maskMoney("0")).toBe("0,00")
    expect(maskMoney("000")).toBe("0,00")
  })

  it("zeros à esquerda não contam", () => {
    expect(maskMoney("007")).toBe("0,07")
    expect(maskMoney("00150")).toBe("1,50")
  })

  it("milhares e milhões ganham ponto de milhar", () => {
    expect(maskMoney("100000")).toBe("1.000,00")
    expect(maskMoney("100000000")).toBe("1.000.000,00")
    expect(maskMoney("123456789012")).toBe("1.234.567.890,12")
  })

  it("ignora tudo que não é dígito (vírgula, ponto, símbolo e sinal de menos) — nunca produz valor negativo", () => {
    expect(maskMoney("R$ 3.944,20")).toBe("3.944,20")
    expect(maskMoney("1,50")).toBe("1,50")
    expect(maskMoney("-12")).toBe("0,12")
    expect(maskMoney("12abc34")).toBe("12,34")
  })

  it("é idempotente: re-mascarar um valor já mascarado não muda nada (o campo remascara a cada tecla)", () => {
    for (const bruto of ["5", "394420", "100000000", "0"]) {
      const uma = maskMoney(bruto)
      expect(maskMoney(uma)).toBe(uma)
    }
  })
})

describe("moneyParaCampo", () => {
  it("formata sem símbolo, com milhar e 2 casas", () => {
    expect(moneyParaCampo(2500)).toBe("2.500,00")
    expect(moneyParaCampo(1234.5)).toBe("1.234,50")
    expect(moneyParaCampo(1000000)).toBe("1.000.000,00")
  })

  it("zero e centavos", () => {
    expect(moneyParaCampo(0)).toBe("0,00")
    expect(moneyParaCampo(0.1)).toBe("0,10")
    expect(moneyParaCampo(0.05)).toBe("0,05")
  })

  it("arredonda pra 2 casas (nunca mais que centavos no campo)", () => {
    expect(moneyParaCampo(1234.567)).toBe("1.234,57")
    expect(moneyParaCampo(10.004)).toBe("10,00")
  })

  it("não tem prefixo de moeda nem espaço (é pra pré-preencher o input, que já tem o 'R$' do lado)", () => {
    expect(moneyParaCampo(2500)).not.toMatch(/R\$|\s/)
  })

  it("ida e volta com parseMoney devolve o mesmo número", () => {
    for (const v of [0, 0.05, 1234.56, 2500, 999999.99]) {
      expect(parseMoney(moneyParaCampo(v))).toBe(v)
    }
  })

  it("o resultado já é um valor 'mascarado' válido (maskMoney não altera)", () => {
    for (const v of [0.05, 1234.56, 2500]) {
      const campo = moneyParaCampo(v)
      expect(maskMoney(campo)).toBe(campo)
    }
  })
})
