import { api } from "../api/cliente"
import type { DinheiroDoMes } from "../types/DinheiroDoMes"

/** O dinheiro do mês: renda, o que já saiu, o que ainda vem e a resposta "vai dar?". */
export const getDinheiroDoMes = (ano: number, mes: number): Promise<DinheiroDoMes> =>
  api.get<DinheiroDoMes>("dinheiro-do-mes", { params: { ano, mes } }).then((r) => r.data)
