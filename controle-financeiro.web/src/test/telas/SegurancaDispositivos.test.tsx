import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/sessaoService", () => ({ default: { listar: vi.fn(), revogar: vi.fn(), revogarOutras: vi.fn() } }))
vi.mock("../../services/dispositivoService", () => ({ default: { listar: vi.fn(), esquecer: vi.fn(), esquecerTodos: vi.fn() } }))
import sessaoService from "../../services/sessaoService"
import dispositivoService from "../../services/dispositivoService"
import SegurancaDispositivos from "../../telas/SegurancaDispositivos"
import { quandoLocal, resumirAparelho } from "../../dominio/dispositivo"
import { ehErroDaSenha, requisitosSenha, tamanhoSenha } from "../../dominio/senha"

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"
const SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const ses = vi.mocked(sessaoService)
const dis = vi.mocked(dispositivoService)

describe("dominio/senha", () => {
  it("conta como o servidor: emoji conta 1, acento decomposto conta 1", () => {
    expect(tamanhoSenha("🔒".repeat(14))).toBe(14)
    expect(requisitosSenha("🔒".repeat(14))[0].ok).toBe(false)
    expect(tamanhoSenha("café".normalize("NFD"))).toBe(4)
  })
  it("reconhece recusa do servidor que é sobre a senha", () => {
    expect(ehErroDaSenha("Essa senha já vazou em outro site. Escolha outra.")).toBe(true)
    expect(ehErroDaSenha("Senha muito comum. Escolha outra.")).toBe(true)
    expect(ehErroDaSenha("Não use o seu e-mail como senha.")).toBe(true)
    expect(ehErroDaSenha("Muitas tentativas.")).toBe(false)
  })
})

describe("dominio/dispositivo", () => {
  it("resume o User-Agent em navegador + sistema e diz se é celular", () => {
    expect(resumirAparelho(CHROME_WIN)).toEqual({ nome: "Chrome no Windows", celular: false })
    expect(resumirAparelho(SAFARI_IOS)).toEqual({ nome: "Safari no iOS", celular: true })
    expect(resumirAparelho(null).nome).toBe("Aparelho desconhecido")
  })
  it("data do servidor sem fuso é UTC (não hora local)", () => {
    expect(quandoLocal("2026-10-15T20:35:00")).toBe(quandoLocal("2026-10-15T20:35:00Z"))
  })
})

describe("SegurancaDispositivos", () => {
  beforeEach(() => {
    ses.listar.mockReset().mockResolvedValue([
      { id: "s1", criadoEm: "2026-10-15T10:00:00", ultimoUsoEm: "2026-10-15T20:00:00", dispositivo: CHROME_WIN, ip: "10.0.0.1", atual: true },
      { id: "s2", criadoEm: "2026-10-10T10:00:00", ultimoUsoEm: null, dispositivo: SAFARI_IOS, ip: "10.0.0.2", atual: false },
    ])
    ses.revogar.mockReset().mockResolvedValue({} as never)
    ses.revogarOutras.mockReset().mockResolvedValue({ encerradas: 1 })
    dis.listar.mockReset().mockResolvedValue([
      { id: "d1", criadoEm: "2026-10-15T10:00:00", ultimoUsoEm: null, expiraEm: "2026-11-14T10:00:00", dispositivo: CHROME_WIN, ip: "10.0.0.1", atual: true },
    ])
    dis.esquecer.mockReset().mockResolvedValue({} as never)
    dis.esquecerTodos.mockReset().mockResolvedValue({ esquecidos: 1 })
  })

  it("lista as sessões; a deste navegador não tem 'Encerrar', a outra tem", async () => {
    render(<SegurancaDispositivos />)
    const lista = await screen.findByRole("list", { name: "Sessões ativas" })
    const [deste, outra] = within(lista).getAllByRole("listitem")
    expect(deste).toHaveTextContent("Chrome no Windows")
    expect(deste).toHaveTextContent("Este navegador")
    expect(within(deste).queryByRole("button")).not.toBeInTheDocument()
    expect(outra).toHaveTextContent("Safari no iOS")
    await userEvent.click(within(outra).getByRole("button", { name: "Encerrar" }))
    expect(ses.revogar).toHaveBeenCalledWith("s2")
  })

  it("'Sair dos outros aparelhos' pede confirmação antes", async () => {
    render(<SegurancaDispositivos />)
    await userEvent.click(await screen.findByRole("button", { name: "Sair dos outros aparelhos" }))
    expect(ses.revogarOutras).not.toHaveBeenCalled()
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Sair dos outros" }))
    expect(ses.revogarOutras).toHaveBeenCalled()
  })

  it("dispositivos confiáveis: esquecer um e esquecer todos (com confirmação)", async () => {
    render(<SegurancaDispositivos />)
    const lista = await screen.findByRole("list", { name: "Dispositivos confiáveis" })
    expect(lista).toHaveTextContent("pula o código até")
    await userEvent.click(within(lista).getByRole("button", { name: "Esquecer" }))
    expect(dis.esquecer).toHaveBeenCalledWith("d1")

    await userEvent.click(await screen.findByRole("button", { name: "Esquecer todos" }))
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Esquecer todos" }))
    expect(dis.esquecerTodos).toHaveBeenCalled()
  })

  it("sem dispositivo confiável: avisa e não mostra 'Esquecer todos'", async () => {
    dis.listar.mockResolvedValue([])
    render(<SegurancaDispositivos />)
    expect(await screen.findByText("Nenhum dispositivo confiável.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Esquecer todos" })).not.toBeInTheDocument()
  })
})
