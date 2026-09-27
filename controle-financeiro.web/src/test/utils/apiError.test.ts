import { describe, it, expect } from "vitest"
import { notificacaoDeErro } from "../../utils/apiError"

const respostaErro = (status: number, message?: string) => ({ response: { status, data: message === undefined ? {} : { message } } })

describe("notificacaoDeErro", () => {
  it("regra de negócio (409 com mensagem) → aviso com a mensagem do servidor", () => {
    expect(notificacaoDeErro(respostaErro(409, "Limite insuficiente."), "Erro ao criar"))
      .toEqual({ severity: "warning", message: "Limite insuficiente." })
  })

  it("validação (400 com mensagem) → aviso", () => {
    expect(notificacaoDeErro(respostaErro(400, "Valor deve ser positivo."), "Erro"))
      .toEqual({ severity: "warning", message: "Valor deve ser positivo." })
  })

  it("erro do servidor (500) → erro com o texto da tela, nunca a mensagem interna", () => {
    expect(notificacaoDeErro(respostaErro(500, "Ocorreu um erro interno."), "Erro ao criar"))
      .toEqual({ severity: "error", message: "Erro ao criar" })
  })

  it("sem resposta (rede caiu) → erro", () => {
    expect(notificacaoDeErro(new Error("Network Error"), "Erro ao criar"))
      .toEqual({ severity: "error", message: "Erro ao criar" })
  })

  it("4xx sem mensagem (ou só espaços) → erro com o texto da tela", () => {
    expect(notificacaoDeErro(respostaErro(409), "Erro ao criar")).toEqual({ severity: "error", message: "Erro ao criar" })
    expect(notificacaoDeErro(respostaErro(409, "   "), "Erro ao criar")).toEqual({ severity: "error", message: "Erro ao criar" })
  })
})
