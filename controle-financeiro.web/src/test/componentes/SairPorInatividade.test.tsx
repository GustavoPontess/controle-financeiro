// Sair por inatividade: aviso 1 min antes, saída no limite, mexer adia, só "Continuar conectado" fecha o aviso, e uso
// em outra aba conta. Relógio falso (o componente decide pelo horário, não por contagem).
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import SairPorInatividade, { type CanalDeAtividade } from "../../auth/SairPorInatividade"

const MIN = 60_000
let avisarAbas: Mock<(agora: number) => void>
let canal: CanalDeAtividade

beforeEach(() => {
  vi.useFakeTimers()
  avisarAbas = vi.fn()
  canal = { postMessage: avisarAbas, close: vi.fn(), onmessage: null }
})
afterEach(() => vi.useRealTimers())

const montar = (aoSair = vi.fn()) => {
  render(<SairPorInatividade minutos={15} aoSair={aoSair} criarCanal={() => canal} />)
  return aoSair
}
const passar = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
const aviso = () => screen.queryByRole("dialog", { name: "Você ainda está aí?" })

describe("SairPorInatividade", () => {
  it("parado: avisa aos 14 minutos com a contagem e sai aos 15, uma vez só", () => {
    const aoSair = montar()
    passar(14 * MIN - 1000)
    expect(aviso()).toBeNull()
    passar(1000)
    expect(aviso()).not.toBeNull()
    expect(screen.getByRole("timer")).toHaveTextContent("60 segundos")
    passar(MIN)
    expect(aoSair).toHaveBeenCalledTimes(1)
    passar(5 * MIN)
    expect(aoSair).toHaveBeenCalledTimes(1)
  })

  it("mexer antes do aviso adia a saída e avisa as outras abas", () => {
    const aoSair = montar()
    passar(10 * MIN)
    fireEvent.pointerDown(window)
    expect(avisarAbas).toHaveBeenCalled()
    passar(10 * MIN)
    expect(aviso()).toBeNull()
    passar(4 * MIN) // 14 parado desde o último mexer
    expect(aviso()).not.toBeNull()
    expect(aoSair).not.toHaveBeenCalled()
  })

  it("com o aviso aberto, mexer o mouse não fecha; Continuar conectado fecha e recomeça a contar", () => {
    const aoSair = montar()
    passar(14 * MIN)
    fireEvent.mouseMove(window)
    expect(aviso()).not.toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Continuar conectado" }))
    expect(aviso()).toBeNull()
    passar(13 * MIN)
    expect(aviso()).toBeNull()
    expect(aoSair).not.toHaveBeenCalled()
  })

  it("Sair agora sai na hora", () => {
    const aoSair = montar()
    passar(14 * MIN)
    fireEvent.click(screen.getByRole("button", { name: "Sair agora" }))
    expect(aoSair).toHaveBeenCalledTimes(1)
  })

  it("uso em outra aba conta: fecha o aviso e adia a saída", () => {
    const aoSair = montar()
    passar(14 * MIN)
    expect(aviso()).not.toBeNull()
    act(() => canal.onmessage?.(new MessageEvent("message", { data: Date.now() })))
    expect(aviso()).toBeNull()
    passar(10 * MIN)
    expect(aoSair).not.toHaveBeenCalled()
  })
})
