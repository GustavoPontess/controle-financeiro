import { describe, it, expect, vi, beforeEach } from "vitest"
import { listTransactionsPage } from "../../services/transactionService"
import { api } from "../../api/axiosConfig"

vi.mock("../../api/axiosConfig", () => ({ api: { get: vi.fn() } }))

const get = vi.mocked(api.get)

describe("listTransactionsPage — filtros ricos (#1.1)", () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 10 } })
  })

  it("encaminha os filtros avançados como query params", async () => {
    await listTransactionsPage(1, 10, {
      contaId: "c1", cartaoId: "k1", valorMin: 100, valorMax: 500, status: 1, ordenacao: "valor_desc",
    })
    const [url, opts] = get.mock.calls[0]
    expect(url).toBe("/transacoes")
    expect(opts.params).toMatchObject({
      page: 1, pageSize: 10, contaId: "c1", cartaoId: "k1",
      valorMin: 100, valorMax: 500, status: 1, ordenacao: "valor_desc",
    })
  })

  it("omite filtros vazios/undefined (só page+pageSize)", async () => {
    await listTransactionsPage(1, 10, {})
    const [, opts] = get.mock.calls[0]
    expect(opts.params).toEqual({ page: 1, pageSize: 10 })
  })

  it("inclui status=0 (previsto) mesmo sendo falsy", async () => {
    await listTransactionsPage(1, 10, { status: 0 })
    const [, opts] = get.mock.calls[0]
    expect(opts.params.status).toBe(0)
  })
})
