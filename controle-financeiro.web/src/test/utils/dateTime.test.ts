import { describe, it, expect } from "vitest"
import { dataComHora, combinarDataHora, isoParaHoraHHMM, mascararHora } from "../../utils/dateTime"

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

describe("combinarDataHora", () => {
  it("usa a hora escolhida, encodada como UTC (wall-clock)", () => {
    expect(combinarDataHora("2026-03-10", "13:45")).toBe("2026-03-10T13:45:00.000Z")
    expect(combinarDataHora("2020-01-15", "09:05")).toBe("2020-01-15T09:05:00.000Z")
    expect(combinarDataHora("2026-12-31", "00:00")).toBe("2026-12-31T00:00:00.000Z")
  })

  it("hora vazia/inválida cai no comportamento antigo (data passada = meio-dia)", () => {
    expect(combinarDataHora("2020-01-15", "")).toBe("2020-01-15T12:00:00.000Z")
    expect(combinarDataHora("2020-01-15", "99:99")).toBe("2020-01-15T12:00:00.000Z")
    expect(combinarDataHora("2020-01-15")).toBe("2020-01-15T12:00:00.000Z")
  })
})

describe("isoParaHoraHHMM", () => {
  it("extrai HH:MM em UTC (bate com o que a tabela mostra)", () => {
    expect(isoParaHoraHHMM("2026-03-10T13:45:00.000Z")).toBe("13:45")
    expect(isoParaHoraHHMM("2026-03-10T09:05:00.000Z")).toBe("09:05")
    expect(isoParaHoraHHMM("")).toBe("")
  })

  it("ida e volta com combinarDataHora preserva a hora", () => {
    expect(isoParaHoraHHMM(combinarDataHora("2026-07-01", "07:30"))).toBe("07:30")
  })
})

describe("mascararHora", () => {
  it("formata dígitos em HH:MM e ignora não-dígitos", () => {
    expect(mascararHora("1")).toBe("1")
    expect(mascararHora("13")).toBe("13")
    expect(mascararHora("134")).toBe("13:4")
    expect(mascararHora("1345")).toBe("13:45")
    expect(mascararHora("13:45")).toBe("13:45")
    expect(mascararHora("134599")).toBe("13:45") // corta em 4 dígitos
    expect(mascararHora("ab12cd")).toBe("12")
  })
})
