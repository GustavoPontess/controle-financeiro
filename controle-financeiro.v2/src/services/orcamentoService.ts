import { api } from "../api/cliente"
import type { OrcamentoDoMes } from "../types/Orcamento"

/** O orçamento do mês: renda esperada, planejado das despesas, o que as metas pedem e o "a ser alocado". */
export const getOrcamentoDoMes = (ano: number, mes: number): Promise<OrcamentoDoMes> =>
  api.get<OrcamentoDoMes>("orcamento-do-mes", { params: { ano, mes } }).then((r) => r.data)
