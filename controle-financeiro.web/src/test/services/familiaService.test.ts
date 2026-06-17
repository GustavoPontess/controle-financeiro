import { describe, it, expect, vi, beforeEach } from "vitest"
import { registrarAcerto } from "../../services/familiaService"
import { api } from "../../api/axiosConfig"

vi.mock("../../api/axiosConfig", () => ({ api: { post: vi.fn() } }))

const post = vi.mocked(api.post)

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
