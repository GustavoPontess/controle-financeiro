import { api } from "../api/cliente"
import type { MinhaSolicitacao, NovaSolicitacao } from "../types/Solicitacao"

export const enviarSolicitacao = async (dados: NovaSolicitacao): Promise<MinhaSolicitacao> => {
  const res = await api.post("/solicitacoes", dados)
  return res.data
}
