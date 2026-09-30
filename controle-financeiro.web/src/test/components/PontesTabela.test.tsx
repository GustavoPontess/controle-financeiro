// Smoke do PontesTabela (DS): colunas ocultas por padrão, padrão salvo do usuário (localStorage por `id`),
// filtro avançado atrelado à coluna, e o `closeOnMouseLeave` do PontesPopover (usado no menu da Sidebar).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { PontesThemeProvider, PontesTabela, PontesPopover, type PontesTabelaColuna, type PontesFiltroAvancado } from "../../components/pontes"

type Linha = { id: string; nome: string; cat: string; pgto: string }
const linhas: Linha[] = [{ id: "1", nome: "Alfa", cat: "Mercado", pgto: "Pix" }]

const colunas: PontesTabelaColuna<Linha>[] = [
  { key: "nome", header: "Nome", render: (l) => l.nome },
  { key: "cat", header: "Categoria", render: (l) => l.cat },
  { key: "pgto", header: "Pagamento", render: (l) => l.pgto },
]

const filtros = (): PontesFiltroAvancado[] => [
  { tipo: "select", id: "conta", label: "Conta", value: "", opcoes: [{ value: "", label: "Todas" }], onChange: vi.fn() },
  { tipo: "select", id: "pgto", label: "Meio de pagamento", value: "", coluna: "pgto", opcoes: [{ value: "", label: "Qualquer" }], onChange: vi.fn() },
]

function tabela(props: Partial<React.ComponentProps<typeof PontesTabela<Linha>>> = {}) {
  return (
    <PontesThemeProvider>
      <PontesTabela<Linha>
        id="teste" colunas={colunas} itens={linhas} chave={(l) => l.id}
        vazio={{ icone: null, titulo: "Vazio" }} {...props}
      />
    </PontesThemeProvider>
  )
}

const cabecalhos = () => screen.getAllByRole("columnheader").map((th) => th.textContent)
const abrirColunas = () => fireEvent.click(screen.getByRole("button", { name: "Mostrar ou ocultar colunas" }))
const painelColunas = () => screen.getByRole("dialog", { name: "Colunas" })

describe("PontesTabela — colunas ocultas por padrão", () => {
  beforeEach(() => localStorage.clear())

  it("sem colunasPadraoOcultas mostra todas as colunas", () => {
    render(tabela())
    expect(cabecalhos()).toEqual(["Nome", "Categoria", "Pagamento"])
  })

  it("colunasPadraoOcultas esconde as colunas (cabeçalho e conteúdo) até o usuário exibir", () => {
    render(tabela({ colunasPadraoOcultas: ["cat", "pgto"] }))
    expect(cabecalhos()).toEqual(["Nome"])
    expect(screen.queryByText("Mercado")).not.toBeInTheDocument()

    abrirColunas()
    fireEvent.click(within(painelColunas()).getByRole("button", { name: "Categoria" }))

    expect(cabecalhos()).toEqual(["Nome", "Categoria"])
    expect(screen.getByText("Mercado")).toBeInTheDocument()
  })

  it("a 1ª coluna é fixa: o botão dela no seletor fica desabilitado", () => {
    render(tabela())
    abrirColunas()
    expect(within(painelColunas()).getByRole("button", { name: "Nome" })).toBeDisabled()
  })
})

describe("PontesTabela — padrão de exibição salvo (localStorage por id)", () => {
  beforeEach(() => localStorage.clear())

  it("'Salvar padrão' persiste a visão atual e a próxima montagem já abre assim", () => {
    const { unmount } = render(tabela({ colunasPadraoOcultas: ["cat", "pgto"] }))
    abrirColunas()
    fireEvent.click(within(painelColunas()).getByRole("button", { name: "Pagamento" })) // exibe Pagamento
    fireEvent.click(within(painelColunas()).getByRole("button", { name: "Salvar padrão" }))
    expect(JSON.parse(localStorage.getItem("pontes:tabela:teste:colunas")!)).toEqual(["cat"])
    unmount()

    render(tabela({ colunasPadraoOcultas: ["cat", "pgto"] }))
    expect(cabecalhos()).toEqual(["Nome", "Pagamento"]) // padrão do usuário vence o original
  })

  it("alternar coluna sem salvar NÃO persiste (só por sessão)", () => {
    const { unmount } = render(tabela({ colunasPadraoOcultas: ["cat", "pgto"] }))
    abrirColunas()
    fireEvent.click(within(painelColunas()).getByRole("button", { name: "Categoria" }))
    expect(localStorage.getItem("pontes:tabela:teste:colunas")).toBeNull()
    unmount()

    render(tabela({ colunasPadraoOcultas: ["cat", "pgto"] }))
    expect(cabecalhos()).toEqual(["Nome"])
  })

  it("'Voltar ao padrão' apaga o salvo e restaura o mínimo original", () => {
    localStorage.setItem("pontes:tabela:teste:colunas", JSON.stringify([])) // usuário salvou "tudo visível"
    render(tabela({ colunasPadraoOcultas: ["cat", "pgto"] }))
    expect(cabecalhos()).toEqual(["Nome", "Categoria", "Pagamento"])

    abrirColunas()
    fireEvent.click(within(painelColunas()).getByRole("button", { name: "Voltar ao padrão" }))

    expect(cabecalhos()).toEqual(["Nome"])
    expect(localStorage.getItem("pontes:tabela:teste:colunas")).toBeNull()
  })

  it("localStorage corrompido cai no padrão original (não quebra a tela)", () => {
    localStorage.setItem("pontes:tabela:teste:colunas", "{nao-e-json")
    render(tabela({ colunasPadraoOcultas: ["pgto"] }))
    expect(cabecalhos()).toEqual(["Nome", "Categoria"])
  })

  it("sem `id` não há botões de padrão (nada pra persistir)", () => {
    render(tabela({ id: undefined }))
    abrirColunas()
    expect(within(painelColunas()).queryByRole("button", { name: "Salvar padrão" })).not.toBeInTheDocument()
    expect(within(painelColunas()).queryByRole("button", { name: "Voltar ao padrão" })).not.toBeInTheDocument()
  })
})

describe("PontesTabela — filtro avançado atrelado à coluna", () => {
  beforeEach(() => localStorage.clear())

  it("filtro com `coluna` some junto com a coluna oculta; filtro sem `coluna` fica sempre", () => {
    render(tabela({ filtrosAvancados: filtros(), colunasPadraoOcultas: ["pgto"] }))
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }))
    const painel = screen.getByRole("dialog", { name: "Filtros" })
    expect(within(painel).getByText("Conta")).toBeInTheDocument()
    expect(within(painel).queryByText("Meio de pagamento")).not.toBeInTheDocument()
  })

  it("ao exibir a coluna, o filtro dela volta", () => {
    render(tabela({ filtrosAvancados: filtros(), colunasPadraoOcultas: ["pgto"] }))
    abrirColunas()
    fireEvent.click(within(painelColunas()).getByRole("button", { name: "Pagamento" }))
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }))
    expect(within(screen.getByRole("dialog", { name: "Filtros" })).getByText("Meio de pagamento")).toBeInTheDocument()
  })

  it("se TODOS os filtros dependem de colunas ocultas, o botão Filtros não aparece", () => {
    const soDependentes: PontesFiltroAvancado[] = [filtros()[1]]
    render(tabela({ filtrosAvancados: soDependentes, colunasPadraoOcultas: ["pgto"] }))
    expect(screen.queryByRole("button", { name: /^Filtros/ })).not.toBeInTheDocument()
  })
})

describe("PontesPopover — closeOnMouseLeave", () => {
  const abrir = (closeOnMouseLeave?: boolean) => {
    render(
      <PontesThemeProvider>
        <PontesPopover
          closeOnMouseLeave={closeOnMouseLeave}
          trigger={<button type="button">Abrir</button>}
          items={[{ key: "a", label: "Item A" }]}
        />
      </PontesThemeProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }))
    return screen.getByRole("menu")
  }

  it("com closeOnMouseLeave, tirar o mouse do menu fecha", () => {
    const menu = abrir(true)
    fireEvent.mouseLeave(menu)
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("por padrão (sem a prop) o menu continua aberto ao tirar o mouse", () => {
    const menu = abrir()
    fireEvent.mouseLeave(menu)
    expect(screen.getByRole("menu")).toBeInTheDocument()
  })
})
