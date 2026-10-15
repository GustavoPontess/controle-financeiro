// Transações do v2 — extrato de caixa da conta: só o que mexe no saldo (receita/despesa de conta,
// pagamento de fatura e transferências). Compra no crédito vive em Cartões. Busca, filtros e
// paginação rodam no servidor (mesmos endpoints do app atual). Nada de enfeite: cada controle filtra.
import { useEffect, useMemo, useRef, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { useLocation } from "react-router-dom"
import { listTransactionsPage, getTransactionStats } from "../services/transactionService"
import { getContas } from "../services/contaService"
import { getCategories } from "../services/categoryService"
import type { Transaction } from "../types/Transaction"
import type { Conta } from "../types/Conta"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { Dinheiro } from "../componentes/Dinheiro"
import ListaPorDia from "../componentes/ListaPorDia"
import Paginacao, { TAMANHOS } from "../componentes/Paginacao"
import Selecao from "../componentes/Selecao"
import Botao from "../componentes/Botao"
import Busca from "../componentes/Busca"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import SeletorData from "../componentes/SeletorData"
import { maskMoney, parseMoney } from "../utils/money"
import { diaSeguinte } from "../utils/dateTime"
import { useAtrasado } from "../utils/useAtrasado"
import { linhaDoLancamento } from "../dominio/linhaLancamento"
import styles from "./Transacoes.module.css"

// Linhas por página: lembra a escolha neste navegador (conveniência; volta pra 25 se não der pra ler).
const CHAVE_POR_PAGINA = "v2:porPagina:transacoes"
const porPaginaSalvo = (): number => {
  try { const n = Number(localStorage.getItem(CHAVE_POR_PAGINA)); return (TAMANHOS as readonly number[]).includes(n) ? n : 25 } catch { return 25 }
}

type Natureza = "" | "entrada" | "saida" | "transferencia" | "fatura"
const NATUREZAS: { valor: Natureza; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "entrada", rotulo: "Entradas" },
  { valor: "saida", rotulo: "Saídas" },
  { valor: "transferencia", rotulo: "Transferências" },
  { valor: "fatura", rotulo: "Pagamento de fatura" },
]

/** Filtros avançados — vivem num rascunho enquanto o painel está aberto e só valem no "Aplicar". */
type Filtros = { natureza: Natureza; contaId: string; status: string; valorMin: string; valorMax: string; de: string; ate: string }
const SEM_FILTRO: Filtros = { natureza: "", contaId: "", status: "", valorMin: "", valorMax: "", de: "", ate: "" }
const ativosEm = (f: Filtros) => [f.natureza, f.contaId, f.status, f.valorMin || f.valorMax, f.de || f.ate].filter(Boolean).length


export default function Transacoes() {
  const [itens, setItens] = useState<Transaction[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(porPaginaSalvo)
  const mudarPorPagina = (n: number) => {
    setPorPagina(n); setPagina(1)
    try { localStorage.setItem(CHAVE_POR_PAGINA, String(n)) } catch { /* sem armazenamento: só não lembra */ }
  }
  const [erro, setErro] = useState(false)
  const [stats, setStats] = useState<{ entradas: number; saidas: number } | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Record<string, string>>({})

  const [busca, setBusca] = useState("")
  const buscaAplicada = useAtrasado(busca.trim())
  // Outra tela pode abrir Transações já filtrada (o extrato da conta em Bancos manda `{ filtros: { contaId } }`).
  const { state } = useLocation()
  const [filtros, setFiltros] = useState<Filtros>(() => ({ ...SEM_FILTRO, ...((state as { filtros?: Partial<Filtros> } | null)?.filtros ?? {}) }))  // o que está valendo
  const [rascunho, setRascunho] = useState<Filtros>(filtros)    // o que está no painel
  const [painel, setPainel] = useState(false)
  const painelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setPagina(1) }, [buscaAplicada, filtros])

  // Painel: abre com o rascunho = o que está valendo; fecha com Esc ou clique fora (sem aplicar).
  const abrirPainel = () => { setRascunho(filtros); setPainel(true) }
  useEffect(() => {
    if (!painel) return
    const fora = (e: MouseEvent) => { if (!painelRef.current?.contains(e.target as Node)) setPainel(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPainel(false) }
    document.addEventListener("mousedown", fora)
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc) }
  }, [painel])
  const aplicar = () => { setFiltros(rascunho); setPainel(false) }
  const limparTudo = () => { setRascunho(SEM_FILTRO); setFiltros(SEM_FILTRO); setPainel(false) }
  const edita = <K extends keyof Filtros>(k: K) => (valor: string) => setRascunho((r) => ({ ...r, [k]: valor }))
  // Valor do filtro com a mesma máscara de dinheiro dos formulários: só dígitos, nunca negativo.
  const editaValor = (k: "valorMin" | "valorMax") => (e: { target: { value: string } }) =>
    setRascunho((r) => ({ ...r, [k]: maskMoney(e.target.value.replace(/\D/g, "").slice(0, 12), r[k]) }))

  useEffect(() => {
    let vivo = true
    getContas().then((cs) => { if (vivo) setContas(cs) }).catch(() => { /* filtro fica sem contas */ })
    getCategories().then((cats) => { if (vivo) setCategorias(Object.fromEntries(cats.map((c) => [c.id, c.descricao]))) }).catch(() => { /* sem nome de categoria */ })
    getTransactionStats({}).then((s) => { if (vivo) setStats({ entradas: s.entradasCaixa, saidas: s.saidasCaixa }) }).catch(() => { /* faixa fica vazia */ })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    let vivo = true
    setErro(false)
    listTransactionsPage(pagina, porPagina, {
      q: buscaAplicada || undefined,
      natureza: filtros.natureza || undefined,
      contaId: filtros.contaId || undefined,
      status: filtros.status !== "" ? Number(filtros.status) : undefined,
      valorMin: filtros.valorMin !== "" ? parseMoney(filtros.valorMin) : undefined,
      valorMax: filtros.valorMax !== "" ? parseMoney(filtros.valorMax) : undefined,
      from: filtros.de || undefined,
      // "Até" inclui o dia escolhido; o back filtra Data < to.
      to: filtros.ate ? diaSeguinte(filtros.ate) : undefined,
      apenasCaixa: true,
    })
      .then((r) => { if (vivo) { setItens(r.items); setTotal(r.total) } })
      .catch(() => { if (vivo) { setErro(true); setItens([]) } })
    return () => { vivo = false }
  }, [pagina, porPagina, buscaAplicada, filtros])

  const saldoEmConta = useMemo(() => contas.reduce((s, c) => s + (c.saldoAtual ?? 0), 0), [contas])
  const ativos = ativosEm(filtros)
  const temFiltro = !!busca || ativos > 0

  return (
    <div className={styles.pagina}>
      {/* Os 3 números: o dinheiro que tem hoje + o que entrou e saiu do caixa no período. */}
      <Bloco className={styles.resumo}>
        <div className={styles.numeros}>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Saldo em conta</span>
            {contas.length ? <Dinheiro valor={saldoEmConta} className={styles.numeroValor} /> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
          </div>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Entrou</span>
            {stats ? <Dinheiro valor={stats.entradas} tom="positivo" className={styles.numeroValor} /> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
          </div>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Saiu</span>
            {stats ? <Dinheiro valor={stats.saidas} className={styles.numeroValor} /> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
          </div>
        </div>
      </Bloco>

      <Bloco semRespiro>
        {/* Barra: busca + "Filtros". Os filtros avançados abrem num painel ancorado no botão e só valem
            no "Aplicar". Sem título — o topo da página já diz que é Transações. */}
        <div className={styles.toolbar}>
          <div className={styles.controles}>
            <Busca valor={busca} onChange={setBusca} placeholder="Buscar lançamento" />
            <div className={styles.filtrosWrap} ref={painelRef}>
              <Botao ativo={painel || ativos > 0} aria-expanded={painel} aria-haspopup="dialog"
                onClick={() => (painel ? setPainel(false) : abrirPainel())}
                icone={<SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden="true" />}>
                Filtros
                {ativos > 0 && <span className={styles.contador}>{ativos}</span>}
              </Botao>
              {painel && (
                <div className={styles.painel} role="dialog" aria-label="Filtros">
                  <Campo rotulo="Tipo de lançamento">
                    <Selecao tamanho="sm" valor={rascunho.natureza}
                      onChange={(v) => setRascunho((r) => ({ ...r, natureza: v as Natureza }))}
                      opcoes={NATUREZAS.map((n) => ({ valor: n.valor, rotulo: n.rotulo }))} />
                  </Campo>
                  <Campo rotulo="Conta">
                    <Selecao tamanho="sm" valor={rascunho.contaId}
                      onChange={(v) => setRascunho((r) => ({ ...r, contaId: v }))}
                      opcoes={[{ valor: "", rotulo: "Todas as contas" }, ...contas.map((c) => ({ valor: c.id, rotulo: c.nome }))]} />
                  </Campo>
                  <Campo rotulo="Status">
                    <Selecao tamanho="sm" valor={rascunho.status}
                      onChange={(v) => setRascunho((r) => ({ ...r, status: v }))}
                      opcoes={[{ valor: "", rotulo: "Qualquer status" }, { valor: "1", rotulo: "Efetivado" }, { valor: "0", rotulo: "Previsto" }]} />
                  </Campo>
                  <Campo rotulo="Valor" grupo>
                    <div className={styles.faixa}>
                      <Entrada tamanho="sm" prefixo="R$" inputMode="numeric" autoComplete="off" placeholder="0,00" aria-label="Valor mínimo" value={rascunho.valorMin} onChange={editaValor("valorMin")} />
                      <span className={styles.ate}>até</span>
                      <Entrada tamanho="sm" prefixo="R$" inputMode="numeric" autoComplete="off" placeholder="0,00" aria-label="Valor máximo" value={rascunho.valorMax} onChange={editaValor("valorMax")} />
                    </div>
                  </Campo>
                  <Campo rotulo="Período" grupo>
                    <div className={styles.faixa}>
                      <SeletorData tamanho="sm" limpavel placeholder="Início" ariaLabel="De" valor={rascunho.de} max={rascunho.ate || undefined} onChange={edita("de")} />
                      <span className={styles.ate}>até</span>
                      <SeletorData tamanho="sm" limpavel placeholder="Fim" ariaLabel="Até" valor={rascunho.ate} min={rascunho.de || undefined} onChange={edita("ate")} />
                    </div>
                  </Campo>
                  <div className={styles.painelRodape}>
                    <Botao variante="texto" className={styles.limparTudo} onClick={limparTudo}>Limpar tudo</Botao>
                    <Botao variante="primario" onClick={aplicar}>Aplicar</Botao>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {itens === null ? (
          <div className={styles.respiro}><Esqueleto linhas={6} altura={16} /></div>
        ) : erro ? (
          <p className={styles.vazio}>Não deu pra carregar as transações.</p>
        ) : itens.length === 0 ? (
          <p className={styles.vazio}>{temFiltro ? "Nada com esses filtros." : "Nenhum lançamento ainda."}</p>
        ) : (
          <ListaPorDia itens={itens.map((t) => linhaDoLancamento(t, categorias[t.categoriaId ?? ""]))} />
        )}

        {total > 0 && (
          <Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={setPagina} onPorPagina={mudarPorPagina}
            rotulo="transações" rotuloSingular="transação" />
        )}
      </Bloco>
    </div>
  )
}
