import { describe, it, expect, vi, beforeEach } from "vitest"
import { listEmprestimosPage } from "../../services/emprestimoService"
import { api } from "../../api/axiosConfig"

vi.mock("../../api/axiosConfig", () => ({ api: { get: vi.fn() } }))

const get = vi.mocked(api.get)

// Params enviados na última chamada de GET /emprestimos.
const ultimosParams = () => {
  const [url, config] = get.mock.calls.at(-1) as [string, { params: Record<string, unknown> }]
  expect(url).toBe("/emprestimos")
  return config.params
}

describe("listEmprestimosPage — filtros server-side (situação/forma/restante/vencimento)", () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 25 } })
  })

  it("encaminha todos os filtros novos como query params", async () => {
    await listEmprestimosPage(1, 25, false, undefined, undefined, {
      situacao: "ativo", forma: "parcelado", valorMin: 100, valorMax: 900,
      vencDe: "2026-01-01", vencAte: "2026-12-31",
    })

    expect(ultimosParams()).toMatchObject({
      page: 1, pageSize: 25, incluirArquivados: false,
      situacao: "ativo", forma: "parcelado", valorMin: 100, valorMax: 900,
      vencDe: "2026-01-01", vencAte: "2026-12-31",
    })
  })

  it("encaminha a variante quitado/avista dos enums", async () => {
    await listEmprestimosPage(1, 25, false, undefined, undefined, { situacao: "quitado", forma: "avista" })

    expect(ultimosParams()).toMatchObject({ situacao: "quitado", forma: "avista" })
  })

  it("direcao continua no 5º argumento posicional (não quebrou) e convive com os filtros", async () => {
    await listEmprestimosPage(2, 10, true, "  aluguel  ", "pagar", { situacao: "ativo" })

    expect(ultimosParams()).toMatchObject({
      page: 2, pageSize: 10, incluirArquivados: true,
      busca: "aluguel", // trim aplicado
      direcao: "pagar",
      situacao: "ativo",
    })
  })

  it("sem o objeto de filtros, nenhum filtro novo vai na query", async () => {
    await listEmprestimosPage(1, 25)

    const p = ultimosParams()
    expect(p).toMatchObject({ page: 1, pageSize: 25, incluirArquivados: false })
    for (const k of ["situacao", "forma", "valorMin", "valorMax", "vencDe", "vencAte", "busca", "direcao"]) {
      expect(p[k]).toBeUndefined()
    }
  })

  it("campos vazios/undefined viram undefined (nunca string vazia)", async () => {
    await listEmprestimosPage(1, 25, false, "   ", undefined, {
      // "" é o estado neutro do select no hook — não pode ir como situacao=/forma= pro servidor.
      situacao: "" as unknown as "ativo", forma: "" as unknown as "avista",
      valorMin: undefined, valorMax: undefined, vencDe: undefined, vencAte: undefined,
    })

    const p = ultimosParams()
    for (const k of ["situacao", "forma", "valorMin", "valorMax", "vencDe", "vencAte", "busca", "direcao"]) {
      expect(p[k]).toBeUndefined()
      expect(p[k]).not.toBe("")
    }
  })

  it("preserva valorMin/valorMax = 0 (faixa 'só quitados' não pode ser descartada como falsy)", async () => {
    await listEmprestimosPage(1, 25, false, undefined, undefined, { valorMin: 0, valorMax: 0 })

    const p = ultimosParams()
    expect(p.valorMin).toBe(0)
    expect(p.valorMax).toBe(0)
  })

  it("filtros parciais: só o que foi setado vai; o resto fica undefined", async () => {
    await listEmprestimosPage(1, 25, false, undefined, undefined, { vencDe: "2026-06-01", valorMax: 500 })

    const p = ultimosParams()
    expect(p).toMatchObject({ vencDe: "2026-06-01", valorMax: 500 })
    for (const k of ["situacao", "forma", "valorMin", "vencAte"]) expect(p[k]).toBeUndefined()
  })

  it("devolve res.data (PagedResult) sem alterar", async () => {
    const payload = { items: [{ id: "e1" }], total: 1, page: 1, pageSize: 25 }
    get.mockResolvedValue({ data: payload })

    const r = await listEmprestimosPage(1, 25, false, undefined, undefined, { situacao: "ativo" })

    expect(r).toBe(payload)
  })
})
