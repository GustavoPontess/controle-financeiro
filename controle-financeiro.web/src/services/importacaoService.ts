import { api } from "../api/cliente"
import type { ImportacaoAnterior, LinhaImportar, MapeamentoCsv, PreviewImportacao, ResultadoImportacao, Pendentes, AjustePendente, PreviewFatura, ResultadoFatura } from "../types/Importacao"

/** As importações que a pessoa já fez, da mais nova pra mais antiga (o servidor manda as últimas 20). */
export const getImportacoesAnteriores = async (): Promise<ImportacaoAnterior[]> => (await api.get("/importacao/anteriores")).data

/** Lê o extrato (nada é salvo). CSV com `mapeamento`: as colunas que a pessoa escolheu. Vários arquivos da mesma
 *  conta viram uma prévia só; quando os CSV têm o mesmo cabeçalho (os meses do mesmo banco), o mapeamento vale pra todos. */
export const previewImportacao = async (
  contaId: string | null, arquivo: File | File[], mapeamento?: MapeamentoCsv,
): Promise<PreviewImportacao> => {
  const form = new FormData()
  const arquivos = Array.isArray(arquivo) ? arquivo : [arquivo]
  if (arquivos.length === 1) form.append("arquivo", arquivos[0])
  else arquivos.forEach((a) => form.append("arquivos", a))
  if (contaId) form.append("contaId", contaId) // sem conta: lê igual, só não marca o que já está no app
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

/** "Qual parte é o nome?": o servidor guarda só a forma do que vem antes e depois do nome (nunca as palavras) e
 *  usa nas próximas leituras. Devolve o nome como ele leu. */
export const ensinarNome = async (descricao: string, nome: string): Promise<{ nome: string }> =>
  (await api.post("/importacao/padroes-nome", { descricao, nome })).data

/** Fila de pendentes: os lançamentos da pessoa que estão na conta sem categoria (os mais recentes) e o total. */
export const getPendentes = async (): Promise<Pendentes> => (await api.get("/importacao/pendentes")).data

/** Quantos pendentes a pessoa tem (o número do menu). */
export const getQuantidadePendentes = async (): Promise<number> => (await api.get("/importacao/pendentes/quantidade")).data

/** Dá a categoria aos lançamentos pendentes de um lugar. `lembrar`: vira a regra do lugar. `ajustes`: o que a pessoa
 *  acertou em cada um ali mesmo (descrição, hora, forma de pagamento). Devolve quantos restam. */
export const categorizarPendentes = async (
  transacaoIds: string[], categoriaId: string, subcategoriaId: string | null, lembrar: boolean, ajustes: AjustePendente[] = [],
): Promise<{ categorizados: number; restam: number }> =>
  (await api.post("/importacao/pendentes/categorizar", { transacaoIds, categoriaId, subcategoriaId, lembrar, ajustes })).data

/** "Foi pagamento de cartão": as saídas pendentes viram registro de pagamento de fatura. Devolve quantos restam. */
export const marcarPagamentoDeCartao = async (transacaoIds: string[]): Promise<{ categorizados: number; restam: number }> =>
  (await api.post("/importacao/pendentes/pagamento-de-cartao", { transacaoIds })).data

const formDaFatura =(cartaoId: string, arquivos: File[]) => {
  const form = new FormData()
  form.append("cartaoId", cartaoId)
  arquivos.forEach((a) => form.append("arquivos", a))
  return form
}

/** Lê a fatura do cartão (um ou vários meses) e diz o que vai entrar; nada é salvo. */
export const previewFatura = async (cartaoId: string, arquivos: File[]): Promise<PreviewFatura> =>
  (await api.post("/importacao/cartao/preview", formDaFatura(cartaoId, arquivos))).data

/** Importa a fatura numa transação só. `chave` (Idempotency-Key) nasce com a leitura: repetir não grava de novo. */
export const confirmarFatura = async (cartaoId: string, arquivos: File[], chave: string): Promise<ResultadoFatura> =>
  (await api.post("/importacao/cartao/confirmar", formDaFatura(cartaoId, arquivos), { headers: { "Idempotency-Key": chave } })).data
