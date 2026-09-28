import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import {
  PontesThemeProvider, PontesListPage, PontesList, PontesListItem,
  type PontesListaEstado, type PontesListPageProps,
} from "../../components/pontes"

type Item = { id: string; nome: string }

function criarLista(overrides: Partial<PontesListaEstado<Item>> = {}): PontesListaEstado<Item> {
  return {
    itens: [],
    total: 0,
    page: 1,
    pageSize: 25,
    carregando: false,
    erro: false,
    busca: "",
    filtros: {},
    filtrosAtivos: false,
    setBusca: vi.fn(),
    setFiltro: vi.fn(),
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    limparFiltros: vi.fn(),
    recarregar: vi.fn(),
    ...overrides,
  }
}

function renderListPage(props: Partial<PontesListPageProps<Item>> & { lista: PontesListaEstado<Item> }) {
  const base: PontesListPageProps<Item> = {
    acao: { label: "Novo item", onClick: vi.fn() },
    chave: (item) => item.id,
    item: (item) => ({ icone: <span />, titulo: item.nome }),
    vazio: { icone: <span />, titulo: "Nenhum item ainda" },
    rotulo: ["item", "itens"],
    ...props,
  }
  return render(<PontesThemeProvider><PontesListPage {...base} /></PontesThemeProvider>)
}

const itens = [{ id: "1", nome: "Netflix" }, { id: "2", nome: "Spotify" }]

describe("PontesListPage", () => {
  it("mostra esqueleto (não erro/vazio/lista) enquanto lista.carregando", () => {
    const lista = criarLista({ carregando: true })
    renderListPage({ lista })
    expect(screen.queryByText("Nenhum item ainda")).not.toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.queryByText("Tentar de novo")).not.toBeInTheDocument()
  })

  it("mostra esqueleto quando a prop `carregando` é true (mesmo com lista.carregando false)", () => {
    const lista = criarLista({ itens, total: itens.length })
    renderListPage({ lista, carregando: true })
    expect(screen.queryByText("Netflix")).not.toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("erro mostra 'Tentar de novo' e chama recarregar", () => {
    const lista = criarLista({ erro: true })
    renderListPage({ lista })
    expect(screen.getByText("Não deu pra carregar itens")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }))
    expect(lista.recarregar).toHaveBeenCalledTimes(1)
  })

  it("vazio sem filtro mostra o título do vazio com o botão da ação", () => {
    const acao = { label: "Novo item", onClick: vi.fn() }
    const lista = criarLista()
    renderListPage({ lista, acao })
    expect(screen.getByText("Nenhum item ainda")).toBeInTheDocument()
    // O botão aparece no cabeçalho E dentro do vazio.
    const botoes = screen.getAllByRole("button", { name: "Novo item" })
    expect(botoes).toHaveLength(2)
    fireEvent.click(botoes[1])
    expect(acao.onClick).toHaveBeenCalledTimes(1)
  })

  it("vazio COM filtro mostra 'Nada encontrado' e 'Limpar filtros' chama limparFiltros", () => {
    const lista = criarLista({ filtrosAtivos: true })
    renderListPage({ lista })
    expect(screen.getByText("Nada encontrado")).toBeInTheDocument()
    expect(screen.queryByText("Nenhum item ainda")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))
    expect(lista.limparFiltros).toHaveBeenCalledTimes(1)
  })

  it("lista com itens mostra as linhas e a paginação", () => {
    const lista = criarLista({ itens, total: itens.length })
    renderListPage({ lista })
    expect(screen.getByText("Netflix")).toBeInTheDocument()
    expect(screen.getByText("Spotify")).toBeInTheDocument()
    expect(screen.getByText("1–2 de 2 itens")).toBeInTheDocument()
  })

  it("busca chama lista.setBusca com o texto digitado", () => {
    const lista = criarLista({ itens, total: itens.length })
    renderListPage({ lista, busca: "Buscar item…" })
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar item" }), { target: { value: "net" } })
    expect(lista.setBusca).toHaveBeenCalledWith("net")
  })

  it("segmented chama lista.setFiltro(campo, valor)", () => {
    const lista = criarLista({ itens, total: itens.length, filtros: { status: "ativas" } })
    renderListPage({
      lista,
      filtros: [{
        campo: "status", ariaLabel: "Status",
        opcoes: [{ value: "ativas", label: "Ativas" }, { value: "encerradas", label: "Encerradas" }],
      }],
    })
    fireEvent.click(screen.getByRole("tab", { name: "Encerradas" }))
    expect(lista.setFiltro).toHaveBeenCalledWith("status", "encerradas")
  })

  it("embutida não mostra o botão do cabeçalho", () => {
    const lista = criarLista({ itens, total: itens.length })
    renderListPage({ lista, embutida: true })
    expect(screen.getByText("Netflix")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Novo item" })).not.toBeInTheDocument()
  })
})

describe("PontesListItem", () => {
  it("meta em texto com ' · ' entre fatos, fatos falsy omitidos", () => {
    const { container } = render(
      <PontesList>
        <PontesListItem icone={<span />} titulo="Netflix" meta={["Nubank", false, null, undefined, "Mensal"]} />
      </PontesList>,
    )
    expect(screen.getByText("Nubank")).toBeInTheDocument()
    expect(screen.getByText("Mensal")).toBeInTheDocument()
    // Visual: " · " entre fatos (aria-hidden); leitor de tela: vírgula escondida — nunca fatos colados.
    const separadores = container.querySelectorAll('[aria-hidden="true"]')
    expect([...separadores].filter((s) => s.textContent?.trim() === "·")).toHaveLength(1)
    expect(container.textContent?.replace(/\s+/g, " ")).toContain("Nubank · , Mensal")
  })

  it("`alerta` marca data-alerta no fato", () => {
    render(
      <PontesList>
        <PontesListItem icone={<span />} titulo="Fatura" meta={[{ texto: "Vence em 3 dias", alerta: true }]} />
      </PontesList>,
    )
    const fato = screen.getByText("Vence em 3 dias")
    expect(fato).toHaveAttribute("data-alerta", "true")
  })

  it("status só aparece quando passado", () => {
    render(
      <PontesList>
        <PontesListItem icone={<span />} titulo="Com status" status={{ label: "Pausada", tone: "warning" }} />
        <PontesListItem icone={<span />} titulo="Sem status" />
      </PontesList>,
    )
    expect(screen.getByText("Pausada")).toBeInTheDocument()
    expect(screen.queryByText("Sem status")?.parentElement?.textContent).not.toContain("Pausada")
  })

  it("onClick vira um <button>; o ⋮ ('Ações') não dispara o onClick da linha", async () => {
    const onClick = vi.fn()
    const onExcluir = vi.fn()
    render(
      <PontesList>
        <PontesListItem
          icone={<span />}
          titulo="Netflix"
          onClick={onClick}
          acoes={[{ key: "excluir", label: "Excluir", onClick: onExcluir }]}
        />
      </PontesList>,
    )
    const rowButton = screen.getByText("Netflix").closest("button")
    expect(rowButton).not.toBeNull()
    expect(rowButton?.tagName).toBe("BUTTON")

    fireEvent.click(screen.getByRole("button", { name: "Ações" }))
    expect(onClick).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole("menuitem", { name: "Excluir" }))
    expect(onExcluir).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it("sem onClick, a linha não vira botão", () => {
    render(
      <PontesList>
        <PontesListItem icone={<span />} titulo="Estático" />
      </PontesList>,
    )
    expect(screen.getByText("Estático").closest("button")).toBeNull()
  })

  it("`inativo` marca data-inativo no <li>", () => {
    const { container } = render(
      <PontesList>
        <PontesListItem icone={<span />} titulo="Cancelada" inativo />
      </PontesList>,
    )
    expect(container.querySelector("li[data-inativo='true']")).toBeInTheDocument()
  })
})
