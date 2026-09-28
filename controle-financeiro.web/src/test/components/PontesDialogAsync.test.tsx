import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider, PontesDialog } from "../../components/pontes"

// PontesDialog com onConfirm assíncrono (#122-ish): enquanto a Promise não resolve, o diálogo trava
// (confirmar em loading, os dois botões desabilitados, Esc e clique no fundo ignorados) — sem isso um
// duplo clique ou um Esc distraído durante um "excluir" em voo derrubava o diálogo no meio da chamada.

function deferred<T = void>() {
  let resolve!: (v: T) => void
  let reject!: (e?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function renderDialog(onConfirm: () => unknown, onCancel = vi.fn()) {
  render(
    <PontesThemeProvider>
      <PontesDialog open title="Excluir item?" onConfirm={onConfirm} onCancel={onCancel} />
    </PontesThemeProvider>,
  )
  return {
    confirmar: () => screen.getByRole("button", { name: "Confirmar" }),
    cancelar: () => screen.getByRole("button", { name: "Cancelar" }),
    onCancel,
  }
}

describe("PontesDialog — onConfirm assíncrono", () => {
  it("trava em loading com os dois botões desabilitados enquanto a Promise não resolve, e libera ao resolver", async () => {
    const { promise, resolve } = deferred()
    const onConfirm = vi.fn(() => promise)
    const { confirmar, cancelar } = renderDialog(onConfirm)

    fireEvent.click(confirmar())
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(confirmar()).toBeDisabled()
    expect(cancelar()).toBeDisabled()

    // Clicar de novo em cima do botão desabilitado não dispara outra chamada.
    fireEvent.click(confirmar())
    expect(onConfirm).toHaveBeenCalledTimes(1)

    resolve()
    await waitFor(() => expect(confirmar()).not.toBeDisabled())
    expect(cancelar()).not.toBeDisabled()
  })

  it("ignora Esc enquanto a confirmação está pendente", async () => {
    const { promise, resolve } = deferred()
    const onConfirm = vi.fn(() => promise)
    const { confirmar, onCancel } = renderDialog(onConfirm)

    fireEvent.click(confirmar())
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onCancel).not.toHaveBeenCalled()

    resolve()
    await waitFor(() => expect(confirmar()).not.toBeDisabled())
    // Depois de liberado, Esc volta a funcionar normalmente.
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("ignora clique no fundo (overlay) enquanto pendente", async () => {
    const { promise, resolve } = deferred()
    const onConfirm = vi.fn(() => promise)
    const { confirmar, onCancel } = renderDialog(onConfirm)

    fireEvent.click(confirmar())
    const overlay = screen.getByRole("alertdialog").parentElement!
    fireEvent.click(overlay)
    expect(onCancel).not.toHaveBeenCalled()

    resolve()
    await waitFor(() => expect(confirmar()).not.toBeDisabled())
    fireEvent.click(screen.getByRole("alertdialog").parentElement!)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("libera o diálogo mesmo quando a Promise REJEITA", async () => {
    const { promise, reject } = deferred()
    const onConfirm = vi.fn(() => promise)
    const { confirmar, cancelar, onCancel } = renderDialog(onConfirm)

    fireEvent.click(confirmar())
    expect(confirmar()).toBeDisabled()

    reject(new Error("falhou"))
    await waitFor(() => expect(confirmar()).not.toBeDisabled())
    expect(cancelar()).not.toBeDisabled()
    // Rejeitar não fecha o diálogo sozinho (quem fecha é a tela) nem chama onCancel.
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByText("Excluir item?")).toBeInTheDocument()
  })

  it("onConfirm síncrono segue funcionando como antes (sem loading, sem travar)", () => {
    const onConfirm = vi.fn()
    const { confirmar, cancelar } = renderDialog(onConfirm)

    fireEvent.click(confirmar())
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(confirmar()).not.toBeDisabled()
    expect(cancelar()).not.toBeDisabled()

    // Nada trava: dá pra confirmar de novo (quem decide fechar é a tela, via onConfirm).
    fireEvent.click(confirmar())
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })
})
