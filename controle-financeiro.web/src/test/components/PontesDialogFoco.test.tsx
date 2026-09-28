import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider, PontesDialog, PontesModal, PontesRowActions } from "../../components/pontes"

// Foco dos diálogos (achado da revisão do padrão de telas): o foco ficava ATRÁS do overlay — escolher
// "Excluir" no menu ⋮ devolvia o foco pro ⋮ e um Enter reabria o menu por baixo da confirmação.

function ExcluirPeloMenu({ onConfirm }: { onConfirm: () => void }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <PontesRowActions
        actions={[{ key: "excluir", label: "Excluir", danger: true, onClick: () => setAberto(true) }]}
      />
      <PontesDialog
        open={aberto} title="Excluir?" confirmLabel="Excluir"
        onConfirm={() => { onConfirm(); setAberto(false) }} onCancel={() => setAberto(false)}
      />
    </>
  )
}

describe("Foco dos diálogos do DS", () => {
  it("confirmação aberta pelo menu ⋮ pega o foco no Cancelar (nunca no destrutivo) e devolve ao fechar", async () => {
    const onConfirm = vi.fn()
    render(<PontesThemeProvider><ExcluirPeloMenu onConfirm={onConfirm} /></PontesThemeProvider>)

    const gatilho = screen.getByRole("button", { name: "Ações" })
    fireEvent.click(gatilho)
    fireEvent.click(await screen.findByRole("menuitem", { name: /Excluir/ }))

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancelar" })))
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("Esc numa confirmação aberta em cima de um modal fecha só a confirmação", async () => {
    const fecharModal = vi.fn()
    const cancelar = vi.fn()
    render(
      <PontesThemeProvider>
        <PontesModal open title="Editar" onClose={fecharModal}><p>form</p></PontesModal>
        <PontesDialog open title="Descartar?" onConfirm={vi.fn()} onCancel={cancelar} />
      </PontesThemeProvider>
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(cancelar).toHaveBeenCalledTimes(1)
    expect(fecharModal).not.toHaveBeenCalled()
  })

  it("modal pega o foco ao abrir e devolve a quem abriu ao fechar", async () => {
    function Abre() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir</button>
          <PontesModal open={open} title="Editar" onClose={() => setOpen(false)}><p>form</p></PontesModal>
        </>
      )
    }
    render(<PontesThemeProvider><Abre /></PontesThemeProvider>)
    const abrir = screen.getByRole("button", { name: "Abrir" })
    abrir.focus()
    fireEvent.click(abrir)

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Editar" })))
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(document.activeElement).toBe(abrir))
  })
})
