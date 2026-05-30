import { describe, it, expect } from "vitest"
import { dataComHora } from "../../utils/dateTime"

describe("dataComHora", () => {
  it("data passada vira meio-dia UTC (sem horário real a capturar)", () => {
    expect(dataComHora("2020-01-15")).toBe("2020-01-15T12:00:00.000Z")
  })

  it("data futura também vira meio-dia UTC", () => {
    expect(dataComHora("2099-12-31")).toBe("2099-12-31T12:00:00.000Z")
  })

  it("hoje captura a hora atual (não é meio-dia fixo)", () => {
    const n = new Date()
    const hojeLocal = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`
    const iso = dataComHora(hojeLocal)
    // Preserva o dia local escolhido e encoda a hora "de parede" como UTC.
    expect(iso.startsWith(hojeLocal)).toBe(true)
    const horaUtc = new Date(iso).getUTCHours()
    expect(horaUtc).toBe(n.getHours())
  })
})
