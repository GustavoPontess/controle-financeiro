import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,QR") } }))
vi.mock("../../services/mfaService", () => ({
  default: { status: vi.fn(), iniciarAtivacao: vi.fn(), confirmarAtivacao: vi.fn(), desativar: vi.fn() },
}))
import mfaService from "../../services/mfaService"
import SegurancaMfa from "../../telas/SegurancaMfa"

const svc = vi.mocked(mfaService)
const CODIGOS = ["AB23CD45", "EF67GH89"]

describe("SegurancaMfa", () => {
  beforeEach(() => {
    svc.status.mockReset().mockResolvedValue({ ativo: false, ativadoEm: null, backupCodesRestantes: 0, mostrarConvite: false })
    svc.iniciarAtivacao.mockReset().mockResolvedValue({ secretBase32: "JBSWY3DPEHPK3PXP", qrCodeUri: "otpauth://totp/x" })
    svc.confirmarAtivacao.mockReset().mockResolvedValue(CODIGOS)
    svc.desativar.mockReset().mockResolvedValue({} as never)
  })

  it("ativar: QR + chave, código obrigatório de 6 números, depois os códigos de recuperação uma vez", async () => {
    render(<SegurancaMfa />)
    await userEvent.click(await screen.findByRole("button", { name: "Ativar" }))
    expect(await screen.findByRole("img", { name: /QR code/ })).toHaveAttribute("src", "data:image/png;base64,QR")
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    expect(screen.getByText("Digite o código do app.")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Código do app"), "123")
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    expect(screen.getByText("São 6 números.")).toBeInTheDocument()
    expect(svc.confirmarAtivacao).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText("Código do app"), "456")
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    expect(svc.confirmarAtivacao).toHaveBeenCalledWith("123456")
    for (const c of CODIGOS) expect(await screen.findByText(c)).toBeInTheDocument()

    svc.status.mockResolvedValue({ ativo: true, ativadoEm: "2026-10-15", backupCodesRestantes: 2, mostrarConvite: false })
    await userEvent.click(screen.getByRole("button", { name: "Guardei, concluir" }))
    expect(await screen.findByText("Ativa")).toBeInTheDocument()
    expect(screen.queryByText(CODIGOS[0])).not.toBeInTheDocument() // não aparecem de novo
  })

  it("código errado no confirmar: erro do servidor no campo", async () => {
    svc.confirmarAtivacao.mockRejectedValueOnce({ response: { status: 400, data: { message: "Código inválido." } } })
    render(<SegurancaMfa />)
    await userEvent.click(await screen.findByRole("button", { name: "Ativar" }))
    await userEvent.type(await screen.findByLabelText("Código do app"), "000000")
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    expect(await screen.findByText("Código inválido.")).toBeInTheDocument()
  })

  it("desativar pede senha e código; manda os dois", async () => {
    svc.status.mockResolvedValue({ ativo: true, ativadoEm: "2026-10-15", backupCodesRestantes: 10, mostrarConvite: false })
    render(<SegurancaMfa />)
    expect(await screen.findByText(/Restam/)).toHaveTextContent("Restam 10 códigos de recuperação")
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }))
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }))
    expect(screen.getByText("Digite sua senha.")).toBeInTheDocument()
    expect(screen.getByText(/Digite um código/)).toBeInTheDocument()
    expect(svc.desativar).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText("Senha atual"), "minha senha")
    await userEvent.type(screen.getByLabelText("Código"), "AB23CD45")
    svc.status.mockResolvedValue({ ativo: false, ativadoEm: null, backupCodesRestantes: 0, mostrarConvite: false })
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }))
    expect(svc.desativar).toHaveBeenCalledWith("minha senha", "AB23CD45")
    expect(await screen.findByText("Desligada")).toBeInTheDocument()
  })
})
