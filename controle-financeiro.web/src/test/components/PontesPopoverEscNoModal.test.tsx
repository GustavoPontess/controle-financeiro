import { useState } from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PontesModal, PontesMonthInput, PontesDateInput } from "../../components/pontes"

// Bug: o PontesModal fecha no Esc (listener no document) e o popover dos campos de data/mês também.
// O mesmo Esc que fechava o popover fechava o modal inteiro — no form de Parcelamentos, sumia tudo o
// que já tinha sido digitado. Esc com o popover aberto tem que fechar SÓ o popover.

function ModalCom({ campo }: { campo: "mes" | "data" }) {
  const [aberto, setAberto] = useState(true)
  const [mes, setMes] = useState("2026-10")
  const [data, setData] = useState("2026-09-28")
  return (
    <>
      <span data-testid="estado">{aberto ? "modal-aberto" : "modal-fechado"}</span>
      <PontesModal open={aberto} title="Novo parcelamento" onClose={() => setAberto(false)}>
        {campo === "mes"
          ? <PontesMonthInput value={mes} onChange={setMes} />
          : <PontesDateInput value={data} onChange={setData} />}
      </PontesModal>
    </>
  )
}

const estado = () => screen.getByTestId("estado")

describe("popover de campo dentro do PontesModal — Esc", () => {
  it("PontesMonthInput: Esc no mês focado fecha só o popover e devolve o foco ao campo", () => {
    render(<ModalCom campo="mes" />)
    fireEvent.click(screen.getByRole("button", { name: "Outubro de 2026" }))
    const mesFocado = screen.getByRole("button", { name: "Outubro de 2026", pressed: true })
    expect(mesFocado).toHaveFocus()

    fireEvent.keyDown(mesFocado, { key: "Escape" })

    expect(screen.queryByRole("dialog", { name: "Escolher mês" })).not.toBeInTheDocument()
    expect(estado()).toHaveTextContent("modal-aberto")
    expect(screen.getByRole("button", { name: "Outubro de 2026", expanded: false })).toHaveFocus()

    // Com o popover fechado, o Esc volta a ser do modal.
    fireEvent.keyDown(document.activeElement!, { key: "Escape" })
    expect(estado()).toHaveTextContent("modal-fechado")
  })

  it("PontesDateInput: Esc com o foco no campo (popover aberto) fecha só o popover", () => {
    render(<ModalCom campo="data" />)
    const campo = screen.getByRole("button", { name: "28/09/2026" })
    campo.focus()
    fireEvent.click(campo)
    expect(screen.getByRole("dialog", { name: "Escolher data" })).toBeInTheDocument()

    fireEvent.keyDown(campo, { key: "Escape" })

    expect(screen.queryByRole("dialog", { name: "Escolher data" })).not.toBeInTheDocument()
    expect(estado()).toHaveTextContent("modal-aberto")
  })

  it("PontesDateInput: Esc com o foco num dia do calendário fecha só o popover e volta o foco ao campo", () => {
    render(<ModalCom campo="data" />)
    fireEvent.click(screen.getByRole("button", { name: "28/09/2026" }))
    const dia = screen.getByRole("button", { name: "15" })
    dia.focus()

    fireEvent.keyDown(dia, { key: "Escape" })

    expect(screen.queryByRole("dialog", { name: "Escolher data" })).not.toBeInTheDocument()
    expect(estado()).toHaveTextContent("modal-aberto")
    expect(screen.getByRole("button", { name: "28/09/2026" })).toHaveFocus()
  })
})
