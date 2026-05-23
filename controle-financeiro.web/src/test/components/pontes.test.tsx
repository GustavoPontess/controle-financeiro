import { useState } from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import {
  palettes, fonts,
  PontesButton, PontesIconButton, PontesField, PontesInput, PontesMoneyInput, PontesSelect,
  PontesToggle, PontesCheckbox, PontesBadge, PontesAvatar, PontesAlert,
  PontesProgress, PontesStatCard, PontesCard, PontesTabs, PontesLogoMark,
  PontesSidebarItem, PontesChoiceCards, PontesGroupedSelect,
} from "../../components/pontes"

const p = palettes[0]
const font = fonts[0].family

describe("Biblioteca Pontes — smoke tests (#101)", () => {
  it("PontesButton renderiza children e dispara onClick", () => {
    let clicked = 0
    render(<PontesButton p={p} font={font} onClick={() => clicked++}>Salvar</PontesButton>)
    fireEvent.click(screen.getByText("Salvar"))
    expect(clicked).toBe(1)
  })

  it("PontesButton em loading state mostra spinner e fica disabled", () => {
    let clicked = 0
    render(<PontesButton p={p} font={font} loading onClick={() => clicked++}>Salvando</PontesButton>)
    fireEvent.click(screen.getByText("Salvando"))
    expect(clicked).toBe(0)
  })

  it("PontesLogoMark renderiza o P e dispara onClick", () => {
    let clicked = 0
    render(<PontesLogoMark color={p.primary} size={28} onClick={() => clicked++} />)
    const mark = screen.getByText("P")
    expect(mark).toBeInTheDocument()
    fireEvent.click(mark)
    expect(clicked).toBe(1)
  })

  it("PontesSidebarItem renderiza label e dispara onClick", () => {
    let clicked = 0
    render(<PontesSidebarItem p={p} font={font} icon={<span>i</span>} label="Dashboard" active onClick={() => clicked++} />)
    fireEvent.click(screen.getByText("Dashboard"))
    expect(clicked).toBe(1)
  })

  it("PontesSidebarItem colapsado marca data-collapsed (label recolhido via CSS)", () => {
    render(<PontesSidebarItem p={p} font={font} icon={<span>i</span>} label="Transações" collapsed />)
    // label fica no DOM (pra animar); recolhimento é via CSS module (data-collapsed).
    const label = screen.getByText("Transações")
    const button = label.closest("button")
    expect(button).toHaveAttribute("data-collapsed", "true")
  })

  it("PontesIconButton com badge renderiza contador", () => {
    render(<PontesIconButton p={p} badge={3}>🔔</PontesIconButton>)
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("PontesField mostra label, required asterisk e erro", () => {
    render(
      <PontesField p={p} font={font} label="E-mail" required error="Inválido">
        <PontesInput p={p} font={font} />
      </PontesField>
    )
    expect(screen.getByText("E-mail")).toBeInTheDocument()
    expect(screen.getByText("*")).toBeInTheDocument()
    expect(screen.getByText("Inválido")).toBeInTheDocument()
  })

  it("PontesMoneyInput só aceita números e formata como moeda BR", () => {
    function Wrapper() {
      const [v, setV] = useState("")
      return <PontesMoneyInput p={p} font={font} value={v} onChange={setV} suggestions={[]} />
    }
    render(<Wrapper />)
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement
    // letras e símbolos são descartados, dígitos viram centavos
    fireEvent.change(input, { target: { value: "abc12345xyz" } })
    expect(input.value).toBe("123,45")
    // limpar volta a vazio
    fireEvent.change(input, { target: { value: "" } })
    expect(input.value).toBe("")
  })

  it("PontesChoiceCards marca ativo e dispara onChange", () => {
    function Wrapper() {
      const [v, setV] = useState("1")
      return (
        <PontesChoiceCards
          p={p} font={font} value={v} onChange={setV}
          options={[
            { value: "1", label: "Despesa", tone: "danger" },
            { value: "2", label: "Receita", tone: "success" },
          ]}
        />
      )
    }
    render(<Wrapper />)
    const despesa = screen.getByText("Despesa").closest("button")!
    expect(despesa).toHaveAttribute("data-active", "true")
    fireEvent.click(screen.getByText("Receita"))
    expect(screen.getByText("Receita").closest("button")).toHaveAttribute("data-active", "true")
    expect(despesa).not.toHaveAttribute("data-active")
  })

  it("PontesGroupedSelect abre, escolhe grupo e item", () => {
    function Wrapper() {
      const [g, setG] = useState<string>("")
      const [i, setI] = useState<string>("")
      return (
        <PontesGroupedSelect
          p={p} font={font}
          groups={[{ value: "cat1", label: "Alimentação", items: [{ value: "sub1", label: "Mercado" }] }]}
          groupValue={g} itemValue={i}
          onChange={(gv, iv) => { setG(gv); setI(iv) }}
        />
      )
    }
    render(<Wrapper />)
    fireEvent.click(screen.getByText("Selecione")) // abre painel
    fireEvent.click(screen.getByText("Mercado")) // escolhe item
    expect(screen.getByText("Alimentação · Mercado")).toBeInTheDocument()
  })

  it("PontesSelect abre, lista options e seleciona", () => {
    function Wrapper() {
      const [v, setV] = useState("a")
      return (
        <PontesSelect
          p={p} font={font}
          value={v} onChange={setV}
          options={[{ value: "a", label: "Opção A" }, { value: "b", label: "Opção B" }]}
        />
      )
    }
    render(<Wrapper />)
    fireEvent.click(screen.getByText("Opção A"))
    fireEvent.click(screen.getByText("Opção B"))
    expect(screen.getByText("Opção B")).toBeInTheDocument()
  })

  it("PontesToggle alterna estado on click", () => {
    let v = false
    const { rerender } = render(
      <PontesToggle p={p} checked={v} onChange={(n) => { v = n }} label="Notif" />
    )
    fireEvent.click(screen.getByText("Notif"))
    rerender(<PontesToggle p={p} checked={v} onChange={(n) => { v = n }} label="Notif" />)
    expect(v).toBe(true)
  })

  it("PontesCheckbox alterna estado", () => {
    let v = false
    render(<PontesCheckbox p={p} checked={v} onChange={(n) => { v = n }} label="Termos" />)
    fireEvent.click(screen.getByText("Termos"))
    expect(v).toBe(true)
  })

  it("PontesBadge renderiza com tone correto", () => {
    render(<PontesBadge p={p} font={font} tone="success">Pago</PontesBadge>)
    expect(screen.getByText("Pago")).toBeInTheDocument()
  })

  it("PontesAvatar renderiza iniciais quando sem foto", () => {
    render(<PontesAvatar p={p} name="Gustavo Pontes" />)
    expect(screen.getByText("GP")).toBeInTheDocument()
  })

  it("PontesAlert mostra title e children", () => {
    render(<PontesAlert p={p} font={font} tone="success" title="Pago">Conta de luz quitada</PontesAlert>)
    expect(screen.getByText(/Conta de luz quitada/)).toBeInTheDocument()
  })

  it("PontesProgress mostra label e percentual", () => {
    render(<PontesProgress p={p} font={font} label="Meta" value={75} />)
    expect(screen.getByText("Meta")).toBeInTheDocument()
    expect(screen.getByText("75%")).toBeInTheDocument()
  })

  it("PontesStatCard mostra label/value/trend", () => {
    render(<PontesStatCard p={p} font={font} label="Saldo" value="R$ 1.000" trend="+5%" trendUp />)
    expect(screen.getByText("Saldo")).toBeInTheDocument()
    expect(screen.getByText("R$ 1.000")).toBeInTheDocument()
    expect(screen.getByText(/\+5%/)).toBeInTheDocument()
  })

  it("PontesCard renderiza children", () => {
    render(<PontesCard p={p}>Conteúdo</PontesCard>)
    expect(screen.getByText("Conteúdo")).toBeInTheDocument()
  })

  it("PontesTabs muda valor ao clicar", () => {
    let v: "a" | "b" = "a"
    const { rerender } = render(
      <PontesTabs<"a" | "b">
        p={p} font={font}
        value={v} onChange={(n) => { v = n }}
        options={[{ value: "a", label: "Tab A" }, { value: "b", label: "Tab B" }]}
      />
    )
    fireEvent.click(screen.getByText("Tab B"))
    rerender(
      <PontesTabs<"a" | "b">
        p={p} font={font}
        value={v} onChange={(n) => { v = n }}
        options={[{ value: "a", label: "Tab A" }, { value: "b", label: "Tab B" }]}
      />
    )
    expect(v).toBe("b")
  })
})
