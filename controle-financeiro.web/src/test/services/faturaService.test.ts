import { describe, it, expect, vi, beforeEach } from "vitest"
import { pagarFatura } from "../../services/faturaService"
import { api } from "../../api/axiosConfig"

vi.mock("../../api/axiosConfig", () => ({ api: { post: vi.fn(), get: vi.fn() } }))

const post = vi.mocked(api.post)

describe("pagarFatura — idempotência", () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: undefined })
  })

  it("envia a chave no header Idempotency-Key (a API exige; sem ela → 400)", async () => {
    const payload = { contaId: "a1", valor: 150, dataPagamento: "2026-06-10T12:00:00", meioPagamento: 4 }

    await pagarFatura("c1", "f1", payload, "key-123")

    expect(post).toHaveBeenCalledWith(
      "/cartoes/c1/faturas/f1/pagar",
      payload,
      { headers: { "Idempotency-Key": "key-123" } },
    )
  })
})
