// Transações do v2 — extrato de caixa da conta: só o que mexe no saldo (receita/despesa de conta,
// pagamento de fatura e transferências). Compra no crédito vive em Cartões. Busca, filtros e
// paginação rodam no servidor (mesmos endpoints do app atual). Nada de enfeite: cada controle filtra.
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeftRight, ChevronLeft, ChevronRight, CreditCard, Search, SlidersHorizontal, X } from "lucide-react"
import { listTransactionsPage, getTransactionStats } from "../services/transactionService"
import { getContas } from "../services/contaService"
import { getCategories } from "../services/categoryService"
import type { Transaction } from "../types/Transaction"
import type { Conta } from "../types/Conta"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { Dinheiro, type TomDinheiro } from "../componentes/Dinheiro"
import styles from "./Transacoes.module.css"

const POR_PAGINA = 25

type Natureza = "" | "entrada" | "saida" | "transferencia" | "fatura"
const NATUREZAS: { valor: Natureza; rotulo: string }[] = [
  { valor: "", rotulo: "Todas" },
  { valor: "entrada", rotulo: "Entradas" },
  { valor: "saida", rotulo: "Saídas" },
  { valor: "transferencia", rotulo: "Transferências" },
  { valor: "fatura", rotulo: "Fatura" },
]

/** "2026-10-09" + "14:30:00" → "09/10/2026 14:30"; sem hora, só o dia. */
const fmtData = (data: string, hora?: string | null) => {
  const [y, m, d] = data.split("-")
  return hora ? `${d}/${m}/${y} ${hora.slice(0, 5)}` : `${d}/${m}/${y}`
}

const naturezaDe = (t: Transaction): Exclude<Natureza, ""> =>
  t.ehTransferencia ? "transferencia" : t.ehPagamentoFatura ? "fatura" : t.tipo === 2 ? "entrada" : "saida"

/** Espera a pessoa parar de digitar antes de bater no servidor. */
function useAtrasado<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor)
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t) }, [valor, ms])
  return v
}

export default function Transacoes() {
  const [itens, setItens] = useState<Transaction[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [erro, setErro] = useState(false)
  const [stats, setStats] = useState<{ entradas: number; saidas: number } | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Record<string, string>>({})

  // Filtros — todos vão pro servidor.
  const [busca, setBusca] = useState("")
  const buscaAplicada = useAtrasado(busca.trim())
  const [natureza, setNatureza] = useState<Natureza>("")
  const [contaId, setContaId] = useState("")
  const [status, setStatus] = useState("") // "" qualquer | "1" efetivado | "0" previsto
  const [de, setDe] = useState("")
  const [ate, setAte] = useState("")
  const [painel, setPainel] = useState(false) // filtros avançados abertos?

  useEffect(() => { setPagina(1) }, [buscaAplicada, natureza, contaId, status, de, ate])

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
    listTransactionsPage(pagina, POR_PAGINA, {
      q: buscaAplicada || undefined,
      natureza: natureza || undefined,
      contaId: contaId || undefined,
      status: status !== "" ? Number(status) : undefined,
      from: de || undefined,
      to: ate || undefined,
      apenasCaixa: true,
    })
      .then((r) => { if (vivo) { setItens(r.items); setTotal(r.total) } })
      .catch(() => { if (vivo) { setErro(true); setItens([]) } })
    return () => { vivo = false }
  }, [pagina, buscaAplicada, natureza, contaId, status, de, ate])

  const saldoEmConta = useMemo(() => contas.reduce((s, c) => s + (c.saldoAtual ?? 0), 0), [contas])
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  // Quantos filtros avançados estão ativos (a busca fica fora: ela tem o próprio campo).
  const ativos = [natureza, contaId, status, de || ate].filter(Boolean).length
  const temFiltro = !!busca || ativos > 0
  const limpar = () => { setNatureza(""); setContaId(""); setStatus(""); setDe(""); setAte("") }

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
        {/* Barra: título à esquerda; busca + "Filtros" à direita. Os filtros avançados abrem num painel. */}
        <div className={styles.toolbar}>
          <h2 className={styles.tituloLista}>Todas as transações</h2>
          <div className={styles.controles}>
            <label className={styles.busca}>
              <Search size={16} strokeWidth={2.25} aria-hidden="true" />
              <input type="search" placeholder="Buscar lançamento" aria-label="Buscar lançamento" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
            <button type="button" className={styles.botaoFiltros} data-ativo={painel || ativos > 0 ? "true" : undefined}
              aria-expanded={painel} onClick={() => setPainel((v) => !v)}>
              <SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden="true" /> Filtros
              {ativos > 0 && <span className={styles.contador}>{ativos}</span>}
            </button>
          </div>
        </div>
        {painel && (
        <div className={styles.filtros}>
          <div className={styles.segmentos} role="group" aria-label="Tipo de lançamento">
            {NATUREZAS.map((n) => (
              <button key={n.valor} type="button" className={styles.segmento} data-ativo={natureza === n.valor ? "true" : undefined} onClick={() => setNatureza(n.valor)}>
                {n.rotulo}
              </button>
            ))}
          </div>
          <select className={styles.campo} aria-label="Conta" value={contaId} onChange={(e) => setContaId(e.target.value)}>
            <option value="">Todas as contas</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select className={styles.campo} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Qualquer status</option>
            <option value="1">Efetivado</option>
            <option value="0">Previsto</option>
          </select>
          <div className={styles.periodo}>
            <input type="date" className={styles.campo} aria-label="De" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} />
            <span className={styles.periodoAte}>até</span>
            <input type="date" className={styles.campo} aria-label="Até" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} />
          </div>
          {ativos > 0 && (
            <button type="button" className={styles.limpar} onClick={limpar}><X size={14} strokeWidth={2.5} aria-hidden="true" /> Limpar</button>
          )}
        </div>
        )}

        {itens === null ? (
          <div className={styles.respiro}><Esqueleto linhas={6} altura={16} /></div>
        ) : erro ? (
          <p className={styles.vazio}>Não deu pra carregar as transações.</p>
        ) : itens.length === 0 ? (
          <p className={styles.vazio}>{temFiltro ? "Nada com esses filtros." : "Nenhum lançamento ainda."}</p>
        ) : (
          <ul className={styles.lista}>
            {itens.map((t) => <Linha key={t.id} t={t} categoria={t.categoriaId ? categorias[t.categoriaId] : undefined} />)}
          </ul>
        )}

        {total > 0 && (
          <div className={styles.paginacao}>
            <span className={styles.paginacaoTexto}>
              {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total}
            </span>
            <div className={styles.paginacaoBotoes}>
              <button type="button" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}><ChevronLeft size={16} strokeWidth={2.25} /></button>
              <button type="button" aria-label="Próxima página" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}><ChevronRight size={16} strokeWidth={2.25} /></button>
            </div>
          </div>
        )}
      </Bloco>
    </div>
  )
}

/** Uma linha do extrato. Transferência e pagamento de fatura são neutros (mexem no caixa, não são ganho nem gasto). */
function Linha({ t, categoria }: { t: Transaction; categoria?: string }) {
  const n = naturezaDe(t)
  const tom: TomDinheiro | undefined = n === "entrada" ? "positivo" : n === "saida" || n === "fatura" ? "negativo" : "neutro"
  const icone = n === "transferencia" ? <ArrowLeftRight size={16} strokeWidth={2} aria-hidden="true" />
    : n === "fatura" ? <CreditCard size={16} strokeWidth={2} aria-hidden="true" />
    : t.descricao.trim().charAt(0).toUpperCase() || "•"
  const detalhe = [t.contaNome, categoria, t.meioPagamentoDescricao].filter(Boolean).join(" · ")
  return (
    <li>
      <Link to={`/transacoes/${t.id}`} className={styles.linha}>
        <span className={styles.icone} data-tom={n === "entrada" ? "positivo" : n === "saida" ? undefined : "neutro"}>{icone}</span>
        <span className={styles.texto}>
          <span className={styles.nome}>{t.descricao}</span>
          <span className={styles.sub}>{detalhe || "—"}</span>
        </span>
        <span className={styles.data}>{fmtData(t.data, t.hora)}</span>
        {t.statusTransacao === 0 && <span className={styles.previsto}>Previsto</span>}
        <Dinheiro valor={t.valor} tom={tom} className={styles.valor} />
      </Link>
    </li>
  )
}
