// Blocos do PADRÃO de tela interna (DS): PontesPageHeader, PontesToolbar e PontesRowActions.
import { useState } from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PontesPageHeader, PontesToolbar, PontesRowActions, PontesSegmented } from "../../components/pontes"

describe("PontesRowActions (menu ⋮ da linha)", () => {
  const acoes = (spies: { editar?: () => void; pausar?: () => void; excluir?: () => void } = {}) => [
    // Destrutivo PRIMEIRO de propósito: o componente tem que jogá-lo pro fim.
    { key: "excluir", label: "Excluir", danger: true, onClick: spies.excluir ?? vi.fn() },
    { key: "editar", label: "Editar", onClick: spies.editar ?? vi.fn() },
    { key: "pausar", label: "Pausar", onClick: spies.pausar ?? vi.fn() },
  ]

  it("botão ⋮ tem aria-label 'Ações' e abre o menu (aria-expanded acompanha)", () => {
    render(<PontesRowActions actions={acoes()} />)
    const botao = screen.getByRole("button", { name: "Ações" })
    expect(botao).toHaveAttribute("aria-haspopup", "menu")
    expect(botao).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()

    fireEvent.click(botao)

    expect(screen.getByRole("menu")).toBeInTheDocument()
    expect(botao).toHaveAttribute("aria-expanded", "true")
  })

  it("aceita aria-label customizado", () => {
    render(<PontesRowActions actions={acoes()} ariaLabel="Ações de Netflix" />)
    expect(screen.getByRole("button", { name: "Ações de Netflix" })).toBeInTheDocument()
  })

  it("item chama o callback e fecha o menu", () => {
    const editar = vi.fn()
    render(<PontesRowActions actions={acoes({ editar })} />)
    fireEvent.click(screen.getByRole("button", { name: "Ações" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }))
    expect(editar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("destrutivo vai por último, em tom danger e separado por divisor", () => {
    render(<PontesRowActions actions={acoes()} />)
    fireEvent.click(screen.getByRole("button", { name: "Ações" }))
    const itens = screen.getAllByRole("menuitem")
    expect(itens.map((i) => i.textContent)).toEqual(["Editar", "Pausar", "Excluir"])
    expect(itens[2]).toHaveAttribute("data-danger", "true")
    expect(itens[0]).not.toHaveAttribute("data-danger")
    expect(screen.getByRole("separator")).toBeInTheDocument()
  })

  it("sem ação não-destrutiva, não põe divisor", () => {
    render(<PontesRowActions actions={[{ key: "excluir", label: "Excluir", danger: true, onClick: vi.fn() }]} />)
    fireEvent.click(screen.getByRole("button", { name: "Ações" }))
    expect(screen.queryByRole("separator")).not.toBeInTheDocument()
  })

  it("Esc fecha o menu e devolve o foco ao ⋮", () => {
    render(<PontesRowActions actions={acoes()} />)
    const botao = screen.getByRole("button", { name: "Ações" })
    fireEvent.click(botao)
    // Ao abrir, o foco vai pro 1º item (o menu mora no fim do <body>).
    expect(screen.getByRole("menuitem", { name: "Editar" })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Editar" }), { key: "Escape" })

    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(botao).toHaveFocus()
    expect(botao).toHaveAttribute("aria-expanded", "false")
  })

  it("↓/↑ navegam entre os itens (com volta)", () => {
    render(<PontesRowActions actions={acoes()} />)
    fireEvent.click(screen.getByRole("button", { name: "Ações" }))
    const menu = screen.getByRole("menu")
    fireEvent.keyDown(menu, { key: "ArrowDown" })
    expect(screen.getByRole("menuitem", { name: "Pausar" })).toHaveFocus()
    fireEvent.keyDown(menu, { key: "ArrowUp" })
    fireEvent.keyDown(menu, { key: "ArrowUp" })
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveFocus()
  })

  it("clicar no ⋮ ou num item NÃO dispara o clique da linha", () => {
    const cliqueLinha = vi.fn()
    const excluir = vi.fn()
    render(
      <div onClick={cliqueLinha}>
        <PontesRowActions actions={acoes({ excluir })} />
      </div>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Ações" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }))
    expect(excluir).toHaveBeenCalledTimes(1)
    expect(cliqueLinha).not.toHaveBeenCalled()
  })

  it("lista vazia de ações não renderiza o ⋮", () => {
    render(<PontesRowActions actions={[]} />)
    expect(screen.queryByRole("button", { name: "Ações" })).not.toBeInTheDocument()
  })
})

describe("PontesPageHeader", () => {
  it("mostra UM botão primário e nenhum título (título mora na Navbar)", () => {
    const onAction = vi.fn()
    render(<PontesPageHeader actionLabel="Nova conta fixa" onAction={onAction} />)
    fireEvent.click(screen.getByRole("button", { name: "Nova conta fixa" }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(1)
  })

  it("renderiza o slot à esquerda (abas/período)", () => {
    render(<PontesPageHeader start={<span>Maio 2026</span>} actionLabel="Novo" onAction={vi.fn()} />)
    expect(screen.getByText("Maio 2026")).toBeInTheDocument()
  })

  it("sem actionLabel não mostra botão", () => {
    render(<PontesPageHeader start={<span>abas</span>} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})

describe("PontesToolbar", () => {
  function ToolbarControlada({ onChange }: { onChange?: (v: string) => void }) {
    const [busca, setBusca] = useState("")
    const [status, setStatus] = useState("ativas")
    return (
      <PontesToolbar search={{ value: busca, onChange: (v) => { setBusca(v); onChange?.(v) }, placeholder: "Buscar conta fixa…" }}>
        <PontesSegmented
          ariaLabel="Situação"
          value={status}
          onChange={setStatus}
          options={[{ value: "ativas", label: "Ativas" }, { value: "encerradas", label: "Encerradas" }]}
        />
      </PontesToolbar>
    )
  }

  it("busca vem ANTES dos filtros, com rótulo acessível e limite de 100", () => {
    render(<ToolbarControlada />)
    const busca = screen.getByRole("searchbox", { name: "Buscar conta fixa…" })
    const filtro = screen.getByRole("tablist", { name: "Situação" })
    expect(busca).toHaveAttribute("maxLength", "100")
    // DOCUMENT_POSITION_FOLLOWING: o filtro vem depois da busca na ordem do DOM.
    expect(busca.compareDocumentPosition(filtro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("digitar chama onChange; botão 'Limpar busca' só aparece com texto e limpa", () => {
    const onChange = vi.fn()
    render(<ToolbarControlada onChange={onChange} />)
    expect(screen.queryByRole("button", { name: "Limpar busca" })).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "net" } })
    expect(onChange).toHaveBeenLastCalledWith("net")

    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }))
    expect(onChange).toHaveBeenLastCalledWith("")
    expect(screen.getByRole("searchbox")).toHaveValue("")
  })

  it("sem search, renderiza só os filtros", () => {
    render(<PontesToolbar><span>filtro</span></PontesToolbar>)
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
    expect(screen.getByText("filtro")).toBeInTheDocument()
  })
})
