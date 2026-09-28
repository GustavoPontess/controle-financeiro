import { describe, it, expect } from "vitest"
import {
  cicloDoDia, cicloQueFechaEm, vencimentoDe, montarCiclos, indiceMes, indiceMesDeHoje,
  mesDaFaturaDoDia, rotuloMesFatura,
  type FaturaView,
} from "../../pages/CreditCards/ciclosFatura"
import type { Fatura } from "../../types/Fatura"

const dia = (d: Date) => d.toISOString().slice(0, 10)

const fatura = (id: string, inicio: string, fechamento: string): Fatura => ({
  id, cartaoCreditoId: "c1", cartaoCreditoNome: "Nubank",
  dataInicio: inicio, dataFechamento: fechamento, dataVencimento: fechamento,
  status: 1, statusDescricao: "Aberta", estadoCiclo: 0, estadoPagamento: 0, estaAtrasada: false,
  valorTotal: 100, valorPago: 0, valorRestante: 100, vencida: false,
})

const base = { cartaoId: "c1", cartaoNome: "Nubank", diaFechamento: 20, diaVencimento: 28 }

describe("ciclosFatura — espelho do FaturaService.CalcularPeriodo", () => {
  it("dia antes do fechamento → ciclo que fecha neste mês", () => {
    const c = cicloDoDia(2026, 8, 10, 20) // 10/set
    expect(dia(c.inicio)).toBe("2026-08-20")
    expect(dia(c.fechamento)).toBe("2026-09-20")
  })

  it("no dia do fechamento ou depois → já é o ciclo que fecha no mês seguinte", () => {
    expect(dia(cicloDoDia(2026, 8, 20, 20).fechamento)).toBe("2026-10-20")
    const c = cicloDoDia(2026, 8, 27, 20) // 27/set
    expect(dia(c.inicio)).toBe("2026-09-20")
    expect(dia(c.fechamento)).toBe("2026-10-20")
  })

  it("fechamento dia 31 em fevereiro limita ao último dia do mês", () => {
    const c = cicloQueFechaEm(2026, 1, 31)
    expect(dia(c.fechamento)).toBe("2026-02-28")
    expect(dia(c.inicio)).toBe("2026-01-31")
  })

  it("virada de ano: dezembro depois do fechamento vai pro ciclo de janeiro", () => {
    const c = cicloDoDia(2026, 11, 25, 20)
    expect(dia(c.inicio)).toBe("2026-12-20")
    expect(dia(c.fechamento)).toBe("2027-01-20")
  })

  it("sem dia de fechamento → mês calendário", () => {
    const c = cicloDoDia(2026, 1, 15)
    expect(dia(c.inicio)).toBe("2026-02-01")
    expect(dia(c.fechamento)).toBe("2026-02-28")
  })

  it("vencimento: mesmo mês se cair depois do fechamento, senão no mês seguinte; sem dia → +10", () => {
    const fech = new Date(Date.UTC(2026, 9, 20))
    expect(dia(vencimentoDe(fech, 28))).toBe("2026-10-28")
    expect(dia(vencimentoDe(fech, 5))).toBe("2026-11-05")
    expect(dia(vencimentoDe(fech))).toBe("2026-10-30")
  })
})

describe("montarCiclos", () => {
  it("cartão só com faturas FUTURAS: inclui o mês de hoje e preenche os meses vazios até elas", () => {
    const reais = [
      fatura("dez", "2026-11-20", "2026-12-20"),
      fatura("jan", "2026-12-20", "2027-01-20"),
    ]
    const ciclos = montarCiclos({ ...base, reais, previstas: [], hoje: new Date(2026, 8, 27) })
    expect(ciclos.map((c) => c.dataFechamento.slice(0, 7))).toEqual(["2027-01", "2026-12", "2026-11", "2026-10"])
    expect(ciclos.map((c) => !!c.vazia)).toEqual([false, false, true, true])
    // O mês de hoje (27/set, fecha dia 20) é o ciclo que fecha em outubro — e está na lista.
    const mesHoje = indiceMesDeHoje(new Date(2026, 8, 27), 20)
    expect(ciclos.findIndex((c) => indiceMes(c.dataFechamento) === mesHoje)).toBe(3)
  })

  it("buraco entre faturas passadas vira mês vazio (dá pra navegar por ele)", () => {
    const reais = [
      fatura("jun", "2026-05-20", "2026-06-20"),
      fatura("abr", "2026-03-20", "2026-04-20"),
    ]
    const ciclos = montarCiclos({ ...base, reais, previstas: [], hoje: new Date(2026, 5, 10) })
    expect(ciclos.map((c) => c.id)).toEqual(["jun", "vazia-2026-5", "abr"])
    const maio = ciclos[1]
    expect(maio.dataInicio.slice(0, 10)).toBe("2026-04-20")
    expect(maio.dataFechamento.slice(0, 10)).toBe("2026-05-20")
    expect(maio.valorTotal).toBe(0)
  })

  it("fatura real vence a prevista do mesmo mês", () => {
    const real = fatura("real-jul", "2026-06-20", "2026-07-20")
    const prevista: FaturaView = { ...fatura("prev-jul", "2026-06-20", "2026-07-20"), prevista: true }
    const ciclos = montarCiclos({ ...base, reais: [real], previstas: [prevista], hoje: new Date(2026, 6, 1) })
    expect(ciclos.map((c) => c.id)).toEqual(["real-jul"])
  })

  it("cartão sem fatura nenhuma: só o mês de hoje, vazio", () => {
    const ciclos = montarCiclos({ ...base, reais: [], previstas: [], hoje: new Date(2026, 8, 27) })
    expect(ciclos).toHaveLength(1)
    expect(ciclos[0].vazia).toBe(true)
    expect(ciclos[0].dataFechamento.slice(0, 10)).toBe("2026-10-20")
  })
})

// Primeira parcela do parcelamento = mês em que FECHA a fatura (o rótulo de Cartões). Espelha a
// validação do ParcelamentoService: a sugestão/mínimo do form é a fatura em que a compra cai.
describe("mesDaFaturaDoDia / rotuloMesFatura", () => {
  it("compra antes do fechamento → fatura do mês; no dia ou depois → mês seguinte", () => {
    expect(mesDaFaturaDoDia("2026-09-05", 10)).toBe("2026-09")
    expect(mesDaFaturaDoDia("2026-09-10", 10)).toBe("2026-10")
    expect(mesDaFaturaDoDia("2026-09-28", 10)).toBe("2026-10")
    expect(mesDaFaturaDoDia("2026-12-15", 10)).toBe("2027-01")
  })

  it("sem dia de fechamento → mês calendário; fecha dia 31 em mês curto → último dia", () => {
    expect(mesDaFaturaDoDia("2026-09-28")).toBe("2026-09")
    expect(mesDaFaturaDoDia("2027-02-27", 31)).toBe("2027-02")
    expect(mesDaFaturaDoDia("2027-02-28", 31)).toBe("2027-03")
  })

  it("data inválida → vazio", () => {
    expect(mesDaFaturaDoDia("", 10)).toBe("")
  })

  it("rótulo pelo fechamento, em UTC (meia-noite do backend não volta pro mês anterior)", () => {
    expect(rotuloMesFatura("2026-10-01T00:00:00Z")).toBe("Outubro de 2026")
    expect(rotuloMesFatura("2026-10-10T00:00:00")).toBe("Outubro de 2026")
  })
})
