import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import { useListaPaginada, type OpcoesListaPaginada, type ConsultaLista } from "../../hooks/useListaPaginada"
import type { PagedResult } from "../../types/Paged"

type Item = { id: string; nome: string }
type Filtros = { status: string }

const paged = (
  items: Item[],
  total = items.length,
  page = 1,
  pageSize = 25,
): PagedResult<Item> => ({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })

const item1 = { id: "1", nome: "Um" }
const item2 = { id: "2", nome: "Dois" }

// Renderiza o hook + useLocation() (mesma árvore) dentro de um MemoryRouter com a URL inicial dada —
// dá pra conferir tanto o estado do hook quanto a URL resultante num só `result.current`.
function montar(opcoes: OpcoesListaPaginada<Item, Filtros>, initialEntries: string[] = ["/"]) {
  return renderHook(
    () => {
      const lista = useListaPaginada(opcoes)
      const location = useLocation()
      return { lista, location }
    },
    { wrapper: ({ children }) => <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter> },
  )
}

type Buscar = (consulta: ConsultaLista<Filtros>) => Promise<PagedResult<Item>>

describe("useListaPaginada", () => {
  let buscar: ReturnType<typeof vi.fn<Buscar>>

  beforeEach(() => {
    buscar = vi.fn<Buscar>().mockResolvedValue(paged([item1]))
  })

  it("lê página/tamanho/filtros da URL inicial e chama buscar com eles", async () => {
    const { result } = montar(
      { buscar, filtrosPadrao: { status: "ativas" } },
      ["/?pagina=2&por=50&status=encerradas"],
    )

    await waitFor(() => expect(result.current.lista.carregando).toBe(false))

    expect(buscar).toHaveBeenCalledWith({ page: 2, pageSize: 50, busca: "", filtros: { status: "encerradas" } })
    expect(result.current.lista.page).toBe(2)
    expect(result.current.lista.pageSize).toBe(50)
    expect(result.current.lista.filtros).toEqual({ status: "encerradas" })
    // Leitura não reescreve a URL.
    expect(result.current.location.search).toBe("?pagina=2&por=50&status=encerradas")
  })

  it("setFiltro grava na URL e volta pra página 1 (remove pagina); valor igual ao padrão some da URL", async () => {
    const { result } = montar(
      { buscar, filtrosPadrao: { status: "ativas" } },
      ["/?pagina=2"],
    )
    await waitFor(() => expect(result.current.lista.carregando).toBe(false))

    act(() => result.current.lista.setFiltro("status", "encerradas"))
    expect(result.current.location.search).toContain("status=encerradas")
    expect(result.current.location.search).not.toContain("pagina=2")
    expect(result.current.lista.page).toBe(1)

    act(() => result.current.lista.setFiltro("status", "ativas")) // valor padrão
    expect(result.current.location.search).not.toContain("status")
  })

  it("setBusca NÃO vai pra URL, aplica com debounce e volta pra página 1", async () => {
    const { result } = montar(
      { buscar, filtrosPadrao: { status: "ativas" } },
      ["/?pagina=2"],
    )
    await waitFor(() => expect(result.current.lista.carregando).toBe(false))

    act(() => result.current.lista.setBusca("reserva"))
    // A página some da URL na hora (não espera o debounce), mas a busca em si nunca vai pra URL.
    expect(result.current.location.search).not.toContain("pagina")
    expect(result.current.location.search).not.toContain("reserva")
    expect(result.current.location.search).not.toContain("busca")

    await waitFor(() => expect(buscar).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, busca: "reserva" }),
    ))
    expect(result.current.location.search).not.toContain("busca")
  })

  it("resposta velha não vence: 1ª chamada resolve DEPOIS da 2ª", async () => {
    let resolve1!: (v: PagedResult<Item>) => void
    let resolve2!: (v: PagedResult<Item>) => void
    const p1 = new Promise<PagedResult<Item>>((res) => { resolve1 = res })
    const p2 = new Promise<PagedResult<Item>>((res) => { resolve2 = res })
    buscar.mockImplementationOnce(() => p1).mockImplementationOnce(() => p2)

    const { result } = montar({ buscar, filtrosPadrao: { status: "ativas" } })
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1))

    act(() => result.current.lista.setPage(2))
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(2))

    // A 2ª chamada (mais nova) resolve primeiro.
    resolve2(paged([item2], 2, 2, 25))
    await waitFor(() => expect(result.current.lista.itens).toEqual([item2]))

    // A 1ª chamada (velha) resolve depois — não pode sobrescrever o resultado da 2ª.
    resolve1(paged([item1], 2, 1, 25))
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.lista.itens).toEqual([item2])
  })

  it("página além do fim: items vazios com total > 0 pedem a última página válida", async () => {
    buscar.mockImplementation(async (consulta: { page: number }) => {
      if (consulta.page === 3) return paged([], 10, 3, 25)
      return paged([item1], 10, 1, 25)
    })

    const { result } = montar({ buscar, filtrosPadrao: { status: "ativas" } }, ["/?pagina=3"])

    await waitFor(() => expect(result.current.lista.page).toBe(1))
    expect(result.current.lista.itens).toEqual([item1])
    expect(result.current.location.search).not.toContain("pagina")
  })

  it("erro: buscar rejeita → erro=true, carregando=false, aoFalhar chamado uma vez; recarregar tenta de novo", async () => {
    const aoFalhar = vi.fn()
    buscar.mockRejectedValueOnce(new Error("falhou"))
    const { result } = montar({ buscar, filtrosPadrao: { status: "ativas" }, aoFalhar })

    await waitFor(() => expect(result.current.lista.erro).toBe(true))
    expect(result.current.lista.carregando).toBe(false)
    expect(aoFalhar).toHaveBeenCalledTimes(1)

    buscar.mockResolvedValueOnce(paged([item1]))
    act(() => result.current.lista.recarregar())
    await waitFor(() => expect(result.current.lista.erro).toBe(false))
    expect(result.current.lista.itens).toEqual([item1])
    expect(buscar).toHaveBeenCalledTimes(2)
  })

  it("recarregar() não volta carregando pra true (troca no lugar)", async () => {
    const { result } = montar({ buscar, filtrosPadrao: { status: "ativas" } })
    await waitFor(() => expect(result.current.lista.carregando).toBe(false))

    let resolveRecarga!: (v: PagedResult<Item>) => void
    buscar.mockImplementationOnce(() => new Promise((res) => { resolveRecarga = res }))
    act(() => result.current.lista.recarregar())

    // A recarga está pendurada, mas carregando nunca voltou a true.
    expect(result.current.lista.carregando).toBe(false)

    resolveRecarga(paged([item2]))
    await waitFor(() => expect(result.current.lista.itens).toEqual([item2]))
    expect(result.current.lista.carregando).toBe(false)
  })

  it("aoCarregar recebe o resultado e a consulta", async () => {
    const aoCarregar = vi.fn()
    const resultado = paged([item1])
    buscar.mockResolvedValue(resultado)
    const { result } = montar({ buscar, filtrosPadrao: { status: "ativas" }, aoCarregar })

    await waitFor(() => expect(result.current.lista.carregando).toBe(false))
    expect(aoCarregar).toHaveBeenCalledWith(
      resultado,
      { page: 1, pageSize: 25, busca: "", filtros: { status: "ativas" } },
    )
  })

  it("ouvirTransacoes: true recarrega ao evento transactionCreated", async () => {
    const { result } = montar({ buscar, filtrosPadrao: { status: "ativas" }, ouvirTransacoes: true })
    await waitFor(() => expect(result.current.lista.carregando).toBe(false))
    expect(buscar).toHaveBeenCalledTimes(1)

    act(() => { window.dispatchEvent(new Event("transactionCreated")) })
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(2))
  })

  it("sem ouvirTransacoes, o evento transactionCreated NÃO recarrega", async () => {
    const { result } = montar({ buscar, filtrosPadrao: { status: "ativas" } })
    await waitFor(() => expect(result.current.lista.carregando).toBe(false))
    expect(buscar).toHaveBeenCalledTimes(1)

    act(() => { window.dispatchEvent(new Event("transactionCreated")) })
    // Sem espera artificial: dá tempo de um efeito indevido rodar antes de garantir que não rodou.
    await new Promise((r) => setTimeout(r, 0))
    expect(buscar).toHaveBeenCalledTimes(1)
  })
})
