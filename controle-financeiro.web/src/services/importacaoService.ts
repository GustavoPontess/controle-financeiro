import { api } from "../api/axiosConfig"
import type { PreviewImportacao, LinhaImportar, ResultadoImportacao } from "../types/Importacao"

export const previewImportacao = async (
  contaId: string, arquivo: File,
): Promise<PreviewImportacao> => {
  const form = new FormData()
  form.append("arquivo", arquivo)
  form.append("contaId", contaId)
  const res = await api.post("/importacao/preview", form)
  return res.data
}

export const confirmarImportacao = async (
  contaId: string, linhas: LinhaImportar[],
): Promise<ResultadoImportacao> => {
  const res = await api.post("/importacao/confirmar", { contaId, linhas })
  return res.data
}
