import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import MfaSection from "../../pages/Settings/MfaSection"

const { mockService } = vi.hoisted(() => ({
  mockService: {
    status: vi.fn(),
    iniciarAtivacao: vi.fn(),
    confirmarAtivacao: vi.fn(),
    desativar: vi.fn(),
  },
}))
vi.mock("../../services/mfaService", () => ({ default: mockService }))
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAA") } }))

const CODES = ["AAAA-1111", "BBBB-2222", "CCCC-3333"]

function renderSection() {
  return render(<PontesThemeProvider><MfaSection /></PontesThemeProvider>)
}

async function chegarNoBackup() {
  mockService.status.mockResolvedValue({ ativo: false, ativadoEm: null, backupCodesRestantes: 0 })
  mockService.iniciarAtivacao.mockResolvedValue({ secretBase32: "JBSWY3DPEHPK3PXP", qrCodeUri: "otpauth://x" })
  mockService.confirmarAtivacao.mockResolvedValue(CODES)
  renderSection()
  await waitFor(() => expect(screen.getByRole("button", { name: /ativar mfa/i })).toBeInTheDocument())
  fireEvent.click(screen.getByRole("button", { name: /ativar mfa/i }))
  await waitFor(() => expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument())
  fireEvent.change(screen.getByPlaceholderText("000000"), { target: { value: "123456" } })
  fireEvent.click(screen.getByRole("button", { name: /confirmar/i }))
  await waitFor(() => expect(screen.getByText("AAAA-1111")).toBeInTheDocument())
}

describe("MfaSection — download dos códigos de backup", () => {
  let createURL: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.spyOn>
  let blobs: Blob[]

  beforeEach(() => {
    vi.clearAllMocks()
    blobs = []
    // jsdom não implementa createObjectURL/revokeObjectURL — stub antes de espionar.
    if (typeof URL.createObjectURL !== "function") (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => ""
    if (typeof URL.revokeObjectURL !== "function") (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {}
    createURL = vi.spyOn(URL, "createObjectURL").mockImplementation((b) => { blobs.push(b as Blob); return "blob:mock" })
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    // click do <a> dispararia navegação (não implementada no jsdom) — silenciar.
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
  })

  it("baixa o .txt automaticamente ao gerar os códigos, com o conteúdo correto", async () => {
    await chegarNoBackup()
    await waitFor(() => expect(createURL).toHaveBeenCalled())
    expect(clickSpy).toHaveBeenCalled()

    const blob = blobs.at(-1)!
    expect(blob.type).toContain("text/plain")
    const texto = await blob.text()
    CODES.forEach((c) => expect(texto).toContain(c))
    expect(texto).toContain("Pontes")
    expect(texto).toContain("uma única vez")
  })

  it("mostra a nota de arquivo salvo e o botão de baixar de novo", async () => {
    await chegarNoBackup()
    expect(screen.getByText(/pontes-codigos-recuperacao\.txt/i)).toBeInTheDocument()
    // label alterna "Baixar .txt" ↔ "Baixado" após o download automático.
    expect(screen.getByRole("button", { name: /baixar \.txt|baixado/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /copiar códigos/i })).toBeInTheDocument()
  })

  it("botão de baixar dispara download de novo sob demanda", async () => {
    await chegarNoBackup()
    await waitFor(() => expect(createURL).toHaveBeenCalledTimes(1)) // auto-download
    fireEvent.click(screen.getByRole("button", { name: /baixar \.txt|baixado/i }))
    await waitFor(() => expect(createURL).toHaveBeenCalledTimes(2)) // manual
  })

  it("não baixa nada fora da fase de backup (MFA já ativo)", async () => {
    mockService.status.mockResolvedValue({ ativo: true, ativadoEm: "2026-09-17T00:00:00Z", backupCodesRestantes: 5 })
    renderSection()
    await waitFor(() => expect(screen.getByText(/MFA está ativo/i)).toBeInTheDocument())
    expect(createURL).not.toHaveBeenCalled()
  })
})
