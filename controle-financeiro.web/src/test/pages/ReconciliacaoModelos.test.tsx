// Smoke da galeria DEV (/reconciliacao-modelos): opções de ONDE escolher a conta na reconciliação. Cada
// opção mostra o conjunto (hero + painel + calendário) SEM o bloco antigo "Conta a conferir" no painel.
import { describe, it, expect } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import ReconciliacaoModelos from "../../pages/Reconciliacao/ReconciliacaoModelos"

function renderGaleria() {
  return render(<PontesThemeProvider><ReconciliacaoModelos /></PontesThemeProvider>)
}

describe("ReconciliacaoModelos (galeria DEV — escolha da conta)", () => {
  it("mostra as 4 opções, cada uma com o conjunto (painel de conferir + calendário)", () => {
    renderGaleria()
    for (const id of ["A", "B", "C", "D"]) {
      const opcao = screen.getByRole("region", { name: new RegExp(`^Opção ${id}`) })
      expect(within(opcao).getByText("Calculado (app)")).toBeInTheDocument()
      // o campo do banco JÁ VEM ABERTO na linha "Banco" (sem valor ainda)
      expect(within(opcao).getByRole("textbox", { name: "Saldo que aparece no seu banco" })).toBeInTheDocument()
      expect(within(opcao).getByText("Outubro 2026")).toBeInTheDocument()
      expect(within(opcao).getByRole("button", { name: "Hoje" })).toBeInTheDocument()
      expect(within(opcao).queryByText("Tudo nesta tela é desta conta.")).not.toBeInTheDocument()
    }
  })

  it("a referência 'Atual' traz o seletor 'Conta a conferir' (agora em cima do calendário)", () => {
    renderGaleria()
    const atual = screen.getByRole("region", { name: /^Atual/ })
    expect(within(atual).getByText("Conta a conferir")).toBeInTheDocument()
    expect(within(atual).getByText("Tudo nesta tela é desta conta.")).toBeInTheDocument()
  })

  it("os 4 modelos ANTIGOS do painel voltaram (no topo da página), cada um nos 3 momentos", () => {
    renderGaleria()
    expect(screen.getAllByRole("region")[0]).toHaveAccessibleName(/^Modelo A/)
    for (const id of ["A", "B", "C", "D"]) {
      const secao = screen.getByRole("region", { name: new RegExp(`^Modelo ${id}`) })
      expect(within(secao).getByText(/Antes de salvar/)).toBeInTheDocument()
      expect(within(secao).getByText(/Salvo, com diferença/)).toBeInTheDocument()
      expect(within(secao).getByText(/Conferido \(bate\)/)).toBeInTheDocument()
      expect(within(secao).getByText("Conferido — bate com o banco")).toBeInTheDocument()
    }
  })

  it("saldo do banco na linha 'Banco': já vem aberto; digitar + Enter vira valor com lápis, mostra a diferença e libera 'Salvar'; o lápis reabre", () => {
    renderGaleria()
    const atual = screen.getByRole("region", { name: /^Atual/ })
    expect(within(atual).getByRole("button", { name: /Salvar saldo do banco/ })).toBeDisabled()
    const campo = within(atual).getByRole("textbox", { name: "Saldo que aparece no seu banco" })
    fireEvent.keyDown(campo, { key: "Enter" }) // vazio: continua aberto
    expect(within(atual).getByRole("textbox", { name: "Saldo que aparece no seu banco" })).toBeInTheDocument()
    fireEvent.change(campo, { target: { value: "150000" } })
    fireEvent.keyDown(campo, { key: "Enter" })
    expect(within(atual).getByRole("button", { name: "Editar saldo do banco" })).toHaveTextContent(/R\$\s?1\.500,00/)
    expect(within(atual).getByText(/-R\$\s?23,86/)).toBeInTheDocument()
    expect(within(atual).getByRole("button", { name: /Salvar saldo do banco/ })).toBeEnabled()
    fireEvent.click(within(atual).getByRole("button", { name: "Editar saldo do banco" }))
    expect(within(atual).getByRole("textbox", { name: "Saldo que aparece no seu banco" })).toHaveValue("1.500,00")
  })

  it("abas (A) e cartões (C) listam as 3 contas, com a selecionada marcada", () => {
    renderGaleria()
    for (const id of ["A", "C"]) {
      const opcao = screen.getByRole("region", { name: new RegExp(`^Opção ${id}`) })
      const abas = within(opcao).getAllByRole("tab")
      expect(abas).toHaveLength(3)
      expect(abas[0]).toHaveAttribute("aria-selected", "true")
    }
  })

  it("cartões (C) mostram o status da conferência de cada conta", () => {
    renderGaleria()
    const cartoes = within(screen.getByRole("region", { name: /^Opção C/ })).getByRole("tablist")
    expect(within(cartoes).getByText("A conferir")).toBeInTheDocument()
    expect(within(cartoes).getByText("Com diferença")).toBeInTheDocument()
    expect(within(cartoes).getByText("Conferido 04/10")).toBeInTheDocument()
  })

  it("conta no hero (B) abre a lista de contas; no título (D) a conta é um botão", () => {
    renderGaleria()
    const b = screen.getByRole("region", { name: /^Opção B/ })
    expect(within(b).getAllByRole("option")).toHaveLength(3)
    const d = screen.getByRole("region", { name: /^Opção D/ })
    expect(within(d).getByRole("button", { name: /Carteira/ })).toBeInTheDocument()
  })
})
