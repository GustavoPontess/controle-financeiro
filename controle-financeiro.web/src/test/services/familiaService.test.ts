import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  registrarAcerto, definirLimiteAprovacao, aprovarDespesa, rejeitarDespesa,
  atribuirResponsavel, getDespesasFamilia,
} from "../../services/familiaService"
import { api } from "../../api/axiosConfig"

vi.mock("../../api/axiosConfig", () => ({ api: { post: vi.fn(), put: vi.fn(), get: vi.fn() } }))

const post = vi.mocked(api.post)
const put = vi.mocked(api.put)
const get = vi.mocked(api.get)

describe("registrarAcerto — idempotência (#familia-acerto-safety)", () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: { id: "a1" } })
  })

  it("envia idempotencyKey no body e no header Idempotency-Key", async () => {
    await registrarAcerto("f1", {
      deUsuarioId: "u1", paraUsuarioId: "u2", valor: 100,
      observacao: null, idempotencyKey: "key-123",
    })
    expect(post).toHaveBeenCalledWith(
      "/familias/f1/acertos",
      expect.objectContaining({ idempotencyKey: "key-123" }),
      { headers: { "Idempotency-Key": "key-123" } },
    )
  })
})

describe("aprovação de despesa (2.4)", () => {
  beforeEach(() => {
    post.mockReset(); post.mockResolvedValue({ data: undefined })
    put.mockReset(); put.mockResolvedValue({ data: undefined })
  })

  it("definirLimiteAprovacao faz PUT com o limite no body", async () => {
    await definirLimiteAprovacao("f1", 300)
    expect(put).toHaveBeenCalledWith("/familias/f1/limite-aprovacao", { limiteAprovacao: 300 })
  })

  it("definirLimiteAprovacao com null desliga a aprovação", async () => {
    await definirLimiteAprovacao("f1", null)
    expect(put).toHaveBeenCalledWith("/familias/f1/limite-aprovacao", { limiteAprovacao: null })
  })

  it("aprovarDespesa faz POST no endpoint de aprovar", async () => {
    await aprovarDespesa("f1", "tx9")
    expect(post).toHaveBeenCalledWith("/familias/f1/despesas/tx9/aprovar")
  })

  it("rejeitarDespesa faz POST no endpoint de rejeitar", async () => {
    await rejeitarDespesa("f1", "tx9")
    expect(post).toHaveBeenCalledWith("/familias/f1/despesas/tx9/rejeitar")
  })
})

describe("responsável da despesa (2.1)", () => {
  beforeEach(() => {
    put.mockReset(); put.mockResolvedValue({ data: undefined })
    get.mockReset(); get.mockResolvedValue({ data: [] })
  })

  it("atribuirResponsavel faz PUT com o responsável no body", async () => {
    await atribuirResponsavel("f1", "tx9", "u2")
    expect(put).toHaveBeenCalledWith(
      "/familias/f1/despesas/tx9/responsavel", { responsavelUsuarioId: "u2" })
  })

  it("atribuirResponsavel com null limpa o responsável", async () => {
    await atribuirResponsavel("f1", "tx9", null)
    expect(put).toHaveBeenCalledWith(
      "/familias/f1/despesas/tx9/responsavel", { responsavelUsuarioId: null })
  })

  it("getDespesasFamilia encaminha o responsavelId nos params", async () => {
    await getDespesasFamilia("f1", 5, 2026, "u2")
    expect(get).toHaveBeenCalledWith("/familias/f1/despesas", {
      params: { mes: 5, ano: 2026, responsavelId: "u2" },
    })
  })
})
