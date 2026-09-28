import { useState } from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PontesMonthInput } from "../../components/pontes"

// Substitui o <input type="month"> nativo (seletor do navegador, fora do DS) — o valor continua
// "YYYY-MM", então os forms não mudam de contrato.

function Controlado({ inicial = "", min, max, onChange }: {
  inicial?: string; min?: string; max?: string; onChange?: (v: string) => void
}) {
  const [v, setV] = useState(inicial)
  return (
    <PontesMonthInput
      value={v} min={min} max={max} placeholder="Selecione o mês"
      onChange={(n) => { setV(n); onChange?.(n) }}
    />
  )
}

const trigger = () => screen.getByRole("button", { expanded: false })
const abrir = (nomeAtual: RegExp | string) => fireEvent.click(screen.getByRole("button", { name: nomeAtual }))

describe("PontesMonthInput", () => {
  it("mostra o mês por extenso em pt-BR, ou o placeholder quando vazio", () => {
    const { unmount } = render(<Controlado inicial="2026-10" />)
    expect(screen.getByRole("button", { name: "Outubro de 2026" })).toBeInTheDocument()
    unmount()
    render(<Controlado />)
    expect(screen.getByRole("button", { name: "Selecione o mês" })).toBeInTheDocument()
  })

  it("abre a grade de 12 meses do ano do valor e escolhe um mês (YYYY-MM), fechando o popover", () => {
    const onChange = vi.fn()
    render(<Controlado inicial="2026-10" onChange={onChange} />)
    abrir("Outubro de 2026")

    expect(screen.getByRole("dialog", { name: "Escolher mês" })).toBeInTheDocument()
    expect(screen.getByText("2026")).toBeInTheDocument()
    for (const m of ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"])
      expect(screen.getByText(m)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Outubro de 2026", pressed: true })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Novembro de 2026" }))
    expect(onChange).toHaveBeenCalledWith("2026-11")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger()).toHaveTextContent("Novembro de 2026")
  })

  it("navega de ano pelas setas do cabeçalho", () => {
    const onChange = vi.fn()
    render(<Controlado inicial="2026-10" onChange={onChange} />)
    abrir("Outubro de 2026")

    fireEvent.click(screen.getByRole("button", { name: "Próximo ano" }))
    expect(screen.getByText("2027")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Janeiro de 2027" }))
    expect(onChange).toHaveBeenCalledWith("2027-01")

    abrir("Janeiro de 2027")
    fireEvent.click(screen.getByRole("button", { name: "Ano anterior" }))
    fireEvent.click(screen.getByRole("button", { name: "Março de 2026" }))
    expect(onChange).toHaveBeenLastCalledWith("2026-03")
  })

  it("min/max desabilitam os meses fora da faixa e o ano que fica todo fora", () => {
    const onChange = vi.fn()
    render(<Controlado inicial="2026-10" min="2026-10" max="2027-02" onChange={onChange} />)
    abrir("Outubro de 2026")

    expect(screen.getByRole("button", { name: "Setembro de 2026" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Outubro de 2026", pressed: true })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Ano anterior" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Setembro de 2026" }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Próximo ano" }))
    expect(screen.getByRole("button", { name: "Fevereiro de 2027" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Março de 2027" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Próximo ano" })).toBeDisabled()
  })

  it("teclado: abre com foco no mês escolhido, setas andam (presas no mínimo), Enter escolhe", async () => {
    const onChange = vi.fn()
    render(<Controlado inicial="2026-10" min="2026-09" onChange={onChange} />)
    abrir("Outubro de 2026")

    // `pressed` separa o mês da grade do trigger (que também se chama "Outubro de 2026").
    const outubro = screen.getByRole("button", { name: "Outubro de 2026", pressed: true })
    expect(outubro).toHaveFocus()

    fireEvent.keyDown(outubro, { key: "ArrowDown" }) // uma linha (3 meses) abaixo
    expect(screen.getByRole("button", { name: "Janeiro de 2027" })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: "PageUp" }) // um ano antes, preso no mínimo
    expect(screen.getByRole("button", { name: "Janeiro de 2026" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Setembro de 2026" })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" }) // já no mínimo: fica
    expect(screen.getByRole("button", { name: "Setembro de 2026" })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" })
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" })
    const novembro = screen.getByRole("button", { name: "Novembro de 2026" })
    expect(novembro).toHaveFocus()

    // Enter num <button> dispara click no navegador; no jsdom, o click é o equivalente.
    fireEvent.click(novembro)
    expect(onChange).toHaveBeenCalledWith("2026-11")
    expect(trigger()).toHaveFocus()
  })

  it("Esc fecha e devolve o foco ao campo; clique fora também fecha", () => {
    render(<Controlado inicial="2026-10" />)
    abrir("Outubro de 2026")
    fireEvent.keyDown(screen.getByRole("button", { name: "Outubro de 2026", pressed: true }), { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()

    abrir("Outubro de 2026")
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("disabled não abre", () => {
    render(<PontesMonthInput value="2026-10" onChange={() => {}} disabled />)
    fireEvent.click(screen.getByRole("button", { name: "Outubro de 2026" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
