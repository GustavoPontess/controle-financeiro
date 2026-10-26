import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,QR") } }))
vi.mock("../../services/mfaService", () => ({
  default: { status: vi.fn(), iniciarAtivacao: vi.fn(), confirmarAtivacao: vi.fn(), desativar: vi.fn(), responderConvite: vi.fn() },
}))
import mfaService from "../../services/mfaService"
import ProtejaConta from "../../telas/ProtejaConta"

const svc = vi.mocked(mfaService)
const renderizar = () => render(
  <MemoryRouter initialEntries={["/proteja-sua-conta"]}>
    <Routes>
      <Route path="/proteja-sua-conta" element={<ProtejaConta />} />
      <Route path="/dashboard" element={<p>visão geral</p>} />
    </Routes>
  </MemoryRouter>,
)

describe("ProtejaConta (convite pós-login)", () => {
  beforeEach(() => {
    svc.responderConvite.mockReset().mockResolvedValue({} as never)
    svc.iniciarAtivacao.mockReset().mockResolvedValue({ secretBase32: "JBSWY3DPEHPK3PXP", qrCodeUri: "otpauth://totp/x" })
  })

  it("'Agora não' adia (sem 'não perguntar mais') e vai pra Visão geral", async () => {
    renderizar()
    expect(screen.getByRole("checkbox", { name: "Não perguntar mais" })).not.toBeChecked()
    await userEvent.click(screen.getByRole("button", { name: "Agora não" }))
    expect(svc.responderConvite).toHaveBeenCalledWith(false)
    expect(await screen.findByText("visão geral")).toBeInTheDocument()
  })

  it("com 'Não perguntar mais' marcado, dispensa de vez", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("checkbox", { name: "Não perguntar mais" }))
    await userEvent.click(screen.getByRole("button", { name: "Agora não" }))
    expect(svc.responderConvite).toHaveBeenCalledWith(true)
    expect(await screen.findByText("visão geral")).toBeInTheDocument()
  })

  it("se o servidor falhar, não prende a pessoa: segue pra Visão geral", async () => {
    svc.responderConvite.mockRejectedValueOnce(new Error("rede"))
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Agora não" }))
    expect(await screen.findByText("visão geral")).toBeInTheDocument()
  })

  it("'Ativar agora' abre o QR aqui mesmo; 'Cancelar' volta pro convite", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Ativar agora" }))
    expect(await screen.findByRole("img", { name: /QR code/ })).toBeInTheDocument()
    expect(svc.iniciarAtivacao).toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(await screen.findByRole("heading", { name: "Proteja sua conta" })).toBeInTheDocument()
    expect(svc.responderConvite).not.toHaveBeenCalled()
  })
})
