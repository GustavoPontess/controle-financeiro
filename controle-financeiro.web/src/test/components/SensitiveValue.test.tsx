import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import {
  PontesSensitiveValue,
  PontesHideBalanceToggle,
  setHideBalance,
} from "@/components/pontes"

beforeEach(() => setHideBalance(false))

describe("Privacy toggle (ocultar saldo)", () => {
  it("mostra o valor quando visível e a máscara quando oculto", () => {
    render(
      <>
        <PontesSensitiveValue mask="R$ ••••">R$ 1.234,56</PontesSensitiveValue>
        <PontesHideBalanceToggle />
      </>
    )
    expect(screen.getByText("R$ 1.234,56")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ocultar valores" }))

    expect(screen.getByText("R$ ••••")).toBeInTheDocument()
    expect(screen.queryByText("R$ 1.234,56")).not.toBeInTheDocument()
  })

  it("toggle alterna aria-pressed e o label acessível", () => {
    render(<PontesHideBalanceToggle />)
    const btn = screen.getByRole("button")
    expect(btn).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(btn)
    expect(btn).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Mostrar valores" })).toBeInTheDocument()
  })

  it("estado é global: várias instâncias sincronizam", () => {
    render(
      <>
        <PontesSensitiveValue>A</PontesSensitiveValue>
        <PontesSensitiveValue>B</PontesSensitiveValue>
        <PontesHideBalanceToggle />
      </>
    )
    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("B")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button"))

    // ambas mascaradas com o default "••••••"
    expect(screen.getAllByText("••••••")).toHaveLength(2)
  })
})
