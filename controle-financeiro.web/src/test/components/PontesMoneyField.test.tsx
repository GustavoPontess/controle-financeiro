import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { PontesMoneyField } from "../../components/pontes"
import { formatarCampoDinheiro, lerCampoDinheiro, lerColagemDinheiro } from "../../components/pontes/form/moneyFieldFormat"

function Wrapper({ onChangeSpy }: { onChangeSpy?: (v: number | undefined) => void }) {
  const [v, setV] = useState<number | undefined>(undefined)
  return (
    <PontesMoneyField
      value={v}
      onChange={(novo) => { setV(novo); onChangeSpy?.(novo) }}
    />
  )
}

describe("PontesMoneyField", () => {
  it('"150000" digitado vira 1.500,00 e onChange(1500)', () => {
    const onChangeSpy = vi.fn()
    render(<Wrapper onChangeSpy={onChangeSpy} />)
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement
    fireEvent.change(input, { target: { value: "150000" } })
    expect(input.value).toBe("1.500,00")
    expect(onChangeSpy).toHaveBeenCalledWith(1500)
  })

  it('"-5" vira 0,05 — nunca negativo (o sinal é descartado, não sinaliza valor negativo)', () => {
    const onChangeSpy = vi.fn()
    render(<Wrapper onChangeSpy={onChangeSpy} />)
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement
    fireEvent.change(input, { target: { value: "-5" } })
    expect(input.value).toBe("0,05")
    expect(onChangeSpy).toHaveBeenCalledWith(0.05)
  })

  it("campo vazio vira onChange(undefined)", () => {
    const onChangeSpy = vi.fn()
    render(<Wrapper onChangeSpy={onChangeSpy} />)
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement
    fireEvent.change(input, { target: { value: "150000" } })
    fireEvent.change(input, { target: { value: "" } })
    expect(input.value).toBe("")
    expect(onChangeSpy).toHaveBeenLastCalledWith(undefined)
  })

  it("zeros à esquerda são descartados", () => {
    const onChangeSpy = vi.fn()
    render(<Wrapper onChangeSpy={onChangeSpy} />)
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement
    fireEvent.change(input, { target: { value: "000123" } })
    expect(input.value).toBe("1,23")
    expect(onChangeSpy).toHaveBeenCalledWith(1.23)
  })

  it("limita a 13 dígitos (o resto digitado é ignorado)", () => {
    const onChangeSpy = vi.fn()
    render(<Wrapper onChangeSpy={onChangeSpy} />)
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement
    // 14 dígitos — só os 13 primeiros contam.
    fireEvent.change(input, { target: { value: "12345678901234" } })
    expect(input.value).toBe("12.345.678.901,23")
    expect(onChangeSpy).toHaveBeenCalledWith(12345678901.23)
  })

  it("`invalid` repassa pro PontesInput (data-invalid)", () => {
    render(<PontesMoneyField value={undefined} onChange={() => {}} invalid />)
    expect(screen.getByPlaceholderText("0,00")).toHaveAttribute("data-invalid", "true")
  })

  it("sem `invalid`, não marca data-invalid", () => {
    render(<PontesMoneyField value={undefined} onChange={() => {}} />)
    expect(screen.getByPlaceholderText("0,00")).not.toHaveAttribute("data-invalid")
  })
})

// moneyFieldFormat.ts — funções puras usadas pelo campo (mesmos casos, direto, sem DOM).
describe("moneyFieldFormat", () => {
  it("formatarCampoDinheiro(undefined) é vazio; lerCampoDinheiro('') é undefined", () => {
    expect(formatarCampoDinheiro(undefined)).toBe("")
    expect(lerCampoDinheiro("")).toBeUndefined()
  })

  it("lerCampoDinheiro ignora tudo que não é dígito (inclusive o sinal de menos)", () => {
    expect(lerCampoDinheiro("-5")).toBe(0.05)
    expect(lerCampoDinheiro("R$ 12,34abc")).toBe(1234 / 100)
  })

  it("lerCampoDinheiro corta em 13 dígitos", () => {
    expect(lerCampoDinheiro("1".repeat(20))).toBe(lerCampoDinheiro("1".repeat(13)))
  })

  it("formatarCampoDinheiro usa vírgula decimal e ponto de milhar (pt-BR)", () => {
    expect(formatarCampoDinheiro(1500)).toBe("1.500,00")
    expect(formatarCampoDinheiro(0.05)).toBe("0,05")
  })
})

describe("colar valor no campo de dinheiro (formato brasileiro, em reais)", () => {
  it.each([
    ["1.500", 1500],
    ["1.500,50", 1500.5],
    ["45,9", 45.9],
    ["R$ 1.500,00", 1500],
    ["1500", 1500],
    ["45.90", 45.9],
    ["1.234.567", 1234567],
    ["1.234.567,89", 1234567.89],
    ["12.5", 12.5],
  ])("lerColagemDinheiro(%j) = %d", (texto, esperado) => {
    expect(lerColagemDinheiro(texto)).toBe(esperado)
  })

  it.each(["abc", "0", "", "R$"])("colagem sem valor positivo (%j) é ignorada", (texto) => {
    expect(lerColagemDinheiro(texto)).toBeUndefined()
  })

  it("colar \"1.500\" no campo vira R$ 1.500,00 (não 15,00)", () => {
    const spy = vi.fn()
    render(<Wrapper onChangeSpy={spy} />)
    const campo = screen.getByPlaceholderText("0,00")
    fireEvent.paste(campo, { clipboardData: { getData: () => "1.500" } })
    expect(spy).toHaveBeenLastCalledWith(1500)
    expect(campo).toHaveValue("1.500,00")
  })
})
