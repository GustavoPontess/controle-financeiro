import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useDebouncedValue } from "./useDebouncedValue"
import { PONTES_TABLE_PAGE_SIZE_DEFAULT, PONTES_TABLE_PAGE_SIZES } from "@/components/pontes"
import type { PagedResult } from "@/types/Paged"

/**
 * Estado + carga de uma lista paginada NO SERVIDOR — a lógica que cada tela copiava à mão (e cada
 * cópia errava um pedaço). Junto com `PontesListPage` é a receita de lista (skill pontes-telas).
 *
 * - Página, tamanho e filtros moram na URL (`?pagina=2&status=encerradas`), com `replace`: sobrevivem
 *   a F5 e ao voltar de um detalhe, sem encher o histórico. A URL é a ÚNICA fonte desses valores.
 * - O texto da busca NÃO vai pra URL (navegador compartilhado guarda histórico depois do logout).
 * - Busca com debounce; mudar busca/filtro/tamanho volta pra página 1.
 * - Resposta velha nunca vence (troca de página/filtro no meio da carga).
 * - Esqueleto só quando muda O QUE se vê; `recarregar()` troca os dados no lugar (sem piscar, o ⋮
 *   aberto segue montado).
 * - Página além do fim (excluiu o último item da última página) → volta pra última válida.
 * - Falha de carga vira `erro` (a tela mostra "tentar de novo"), nunca uma lista "vazia" falsa.
 */

export type ConsultaLista<F> = { page: number; pageSize: number; busca: string; filtros: F }

export type OpcoesListaPaginada<T, F extends Record<string, string>> = {
  buscar: (consulta: ConsultaLista<F>) => Promise<PagedResult<T>>
  /** Valor de cada filtro quando não está na URL. Ex.: `{ status: "ativas" }`. */
  filtrosPadrao: F
  /** Chamado quando a carga falha (ex.: toast). */
  aoFalhar?: () => void
  /** Chamado a cada carga que deu certo (ex.: guardar a lista sem filtro pra um resumo). */
  aoCarregar?: (resultado: PagedResult<T>, consulta: ConsultaLista<F>) => void
  /** Recarrega quando o app avisa que lançou transação (evento `transactionCreated`). */
  ouvirTransacoes?: boolean
  /** Prefixo dos parâmetros na URL — só se houver 2 listas na mesma tela. */
  prefixoUrl?: string
}

export type ListaPaginada<T, F extends Record<string, string> = Record<string, string>> = {
  itens: T[]
  total: number
  page: number
  pageSize: number
  carregando: boolean
  erro: boolean
  busca: string
  filtros: F
  /** Busca ou filtro fora do padrão (inclui o termo ainda aplicado logo depois de apagar a busca). */
  filtrosAtivos: boolean
  setBusca: (v: string) => void
  setFiltro: (campo: keyof F & string, valor: string) => void
  setPage: (p: number) => void
  setPageSize: (s: number) => void
  limparFiltros: () => void
  recarregar: () => void
  /** Ajuste local imediato (ex.: pausou → muda a linha sem esperar a recarga). */
  setItens: (fn: (itens: T[]) => T[]) => void
}

export function useListaPaginada<T, F extends Record<string, string>>(
  opcoes: OpcoesListaPaginada<T, F>,
): ListaPaginada<T, F> {
  const [padrao] = useState(opcoes.filtrosPadrao)
  const pre = opcoes.prefixoUrl ?? ""
  const pPagina = `${pre}pagina`
  const pPor = `${pre}por`

  // ── estado na URL ──────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get(pPagina)) || 1)
  const porUrl = Number(searchParams.get(pPor))
  const pageSize = (PONTES_TABLE_PAGE_SIZES as readonly number[]).includes(porUrl) ? porUrl : PONTES_TABLE_PAGE_SIZE_DEFAULT
  const filtrosKey = JSON.stringify(Object.keys(padrao).map((k) => searchParams.get(pre + k) ?? padrao[k]))
  const filtros = useMemo(() => {
    const valores = JSON.parse(filtrosKey) as string[]
    return Object.fromEntries(Object.keys(padrao).map((k, i) => [k, valores[i]])) as F
  }, [filtrosKey, padrao])

  // Cada ação do usuário = UMA escrita na URL (duas no mesmo instante se sobrescrevem).
  const escreverUrl = useCallback((mudar: (p: URLSearchParams) => void) => {
    setSearchParams((atual) => {
      const p = new URLSearchParams(atual)
      mudar(p)
      return p
    }, { replace: true })
  }, [setSearchParams])

  const setPage = useCallback((n: number) => {
    escreverUrl((p) => { if (n > 1) p.set(pPagina, String(n)); else p.delete(pPagina) })
  }, [escreverUrl, pPagina])

  const setPageSize = useCallback((s: number) => {
    escreverUrl((p) => {
      p.delete(pPagina)
      if (s === PONTES_TABLE_PAGE_SIZE_DEFAULT) p.delete(pPor); else p.set(pPor, String(s))
    })
  }, [escreverUrl, pPagina, pPor])

  const setFiltro = useCallback((campo: keyof F & string, valor: string) => {
    escreverUrl((p) => {
      p.delete(pPagina)
      if (valor === padrao[campo]) p.delete(pre + campo); else p.set(pre + campo, valor)
    })
  }, [escreverUrl, pPagina, padrao, pre])

  // ── busca (fora da URL) ────────────────────────────────────────────────────
  const [busca, setBuscaState] = useState("")
  const buscaAplicada = useDebouncedValue(busca.trim())
  const setBusca = useCallback((v: string) => {
    setBuscaState(v)
    escreverUrl((p) => p.delete(pPagina))
  }, [escreverUrl, pPagina])

  const filtrosForaDoPadrao = Object.keys(padrao).some((k) => filtros[k] !== padrao[k])
  const filtrosAtivos = filtrosForaDoPadrao || busca.trim() !== "" || buscaAplicada !== ""

  const limparFiltros = useCallback(() => {
    setBuscaState("")
    escreverUrl((p) => { p.delete(pPagina); Object.keys(padrao).forEach((k) => p.delete(pre + k)) })
  }, [escreverUrl, pPagina, padrao, pre])

  // ── carga ──────────────────────────────────────────────────────────────────
  const [itens, setItensState] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  const setItens = useCallback((fn: (itens: T[]) => T[]) => setItensState(fn), [])

  // Callbacks da tela mudam a cada render; ficam em ref pra não disparar recarga.
  const callbacks = useRef(opcoes)
  useEffect(() => { callbacks.current = opcoes })

  const chaveRef = useRef<string | null>(null)
  useEffect(() => {
    let vivo = true
    const chave = `${page}|${pageSize}|${buscaAplicada}|${filtrosKey}`
    if (chave !== chaveRef.current) { chaveRef.current = chave; setCarregando(true) }
    const consulta: ConsultaLista<F> = { page, pageSize, busca: buscaAplicada, filtros }
    callbacks.current.buscar(consulta)
      .then((res) => {
        if (!vivo) return
        if (res.items.length === 0 && res.total > 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(res.total / pageSize)))
          return
        }
        setItensState(res.items)
        setTotal(res.total)
        setErro(false)
        setCarregando(false)
        callbacks.current.aoCarregar?.(res, consulta)
      })
      .catch(() => {
        if (!vivo) return
        setErro(true)
        setCarregando(false)
        callbacks.current.aoFalhar?.()
      })
    return () => { vivo = false }
  }, [page, pageSize, buscaAplicada, filtrosKey, filtros, versao, setPage])

  const ouvirTransacoes = opcoes.ouvirTransacoes ?? false
  useEffect(() => {
    if (!ouvirTransacoes) return
    window.addEventListener("transactionCreated", recarregar)
    return () => window.removeEventListener("transactionCreated", recarregar)
  }, [ouvirTransacoes, recarregar])

  return {
    itens, total, page, pageSize, carregando, erro, busca, filtros, filtrosAtivos,
    setBusca, setFiltro, setPage, setPageSize, limparFiltros, recarregar, setItens,
  }
}
