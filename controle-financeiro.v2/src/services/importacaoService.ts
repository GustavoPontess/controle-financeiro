import { api } from "../api/cliente"
import type { LinhaImportar, MapeamentoCsv, PreviewImportacao, ResultadoImportacao } from "../types/Importacao"

/** Lê o extrato (nada é salvo). CSV com `mapeamento`: as colunas que a pessoa escolheu. */
export const previewImportacao = async (
  contaId: string, arquivo: File, mapeamento?: MapeamentoCsv,
): Promise<PreviewImportacao> => {
  const form = new FormData()
  form.append("arquivo", arquivo)
  form.append("contaId", contaId)
  if (mapeamento) form.append("mapeamento", JSON.stringify(mapeamento))
  const res = await api.post("/importacao/preview", form)
  return res.data
}

/**
 * Grava as linhas escolhidas, numa transação só. `chave` (Idempotency-Key) nasce com a prévia e vale pra toda
 * tentativa: repetir não importa de novo. Com `mapeamento` + `assinatura`, o servidor lembra as colunas da conta.
 */
export const confirmarImportacao = async (
  contaId: string, linhas: LinhaImportar[], chave: string,
  mapeamento?: MapeamentoCsv | null, assinatura?: string | null,
): Promise<ResultadoImportacao> => {
  const res = await api.post("/importacao/confirmar",
    { contaId, linhas, mapeamento: mapeamento ?? null, assinatura: assinatura ?? null },
    { headers: { "Idempotency-Key": chave } })
  return res.data
}
