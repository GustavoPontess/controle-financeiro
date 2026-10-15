// Transações do v2 — extrato de caixa da conta: só o que mexe no saldo (receita/despesa de conta,
// pagamento de fatura e transferências). Compra no crédito vive em Cartões. Busca, filtros e
// paginação rodam no servidor (mesmos endpoints do app atual). Nada de enfeite: cada controle filtra.
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeftRight, CreditCard, Search, SlidersHorizontal } from "lucide-react"
import { listTransactionsPage, getTransactionStats } from "../services/transactionService"
import { getContas } from "../services/contaService"
import { getCategories } from "../services/categoryService"
import type { Transaction } from "../types/Transaction"
import type { Conta } from "../types/Conta"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { Dinheiro, type TomDinheiro } from "../componentes/Dinheiro"
import Paginacao, { TAMANHOS } from "../componentes/Paginacao"
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

/** Cabeçalho do dia: "Hoje" / "Ontem" / "quarta-feira, 8 de outubro" (ano só quando não é o atual). */
function rotuloDoDia(iso: string): string {
  const hoje = new Date()
  const dia = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  const diff = Math.round((new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime() - dia.getTime()) / 86400000)
  if (diff === 0) return "Hoje"
  if (diff === 1) return "Ontem"
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", ...(dia.getFullYear() !== hoje.getFullYear() ? { year: "numeric" } : {}) }
  const txt = new Intl.DateTimeFormat("pt-BR", opts).format(dia)
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

/** Agrupa por dia mantendo a ordem que o servidor mandou (data desc; dentro do dia, hora desc). */
function porDia(itens: Transaction[]): { dia: string; itens: Transaction[] }[] {
  const grupos: { dia: string; itens: Transaction[] }[] = []
  for (const t of itens) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === t.data) ultimo.itens.push(t)
    else grupos.push({ dia: t.data, itens: [t] })
  }
  return grupos
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
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTRO)      // o que está valendo
  const [rascunho, setRascunho] = useState<Filtros>(SEM_FILTRO)    // o que está no painel
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
  const edita = <K extends keyof Filtros>(k: K) => (e: { target: { value: string } }) => setRascunho((r) => ({ ...r, [k]: e.target.value }))

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
      valorMin: filtros.valorMin !== "" ? Number(filtros.valorMin) : undefined,
      valorMax: filtros.valorMax !== "" ? Number(filtros.valorMax) : undefined,
      from: filtros.de || undefined,
      to: filtros.ate || undefined,
      apenasCaixa: true,
    })
      .then((r) => { if (vivo) { setItens(r.items); setTotal(r.total) } })
      .catch(() => { if (vivo) { setErro(true); setItens([]) } })
    return () => { vivo = false }
  }, [pagina, porPagina, buscaAplicada, filtros])

  const saldoEmConta = useMemo(() => contas.reduce((s, c) => s + (c.saldoAtual ?? 0), 0), [contas])
  const grupos = useMemo(() => porDia(itens ?? []), [itens])
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
            <label className={styles.busca}>
              <Search size={16} strokeWidth={2.25} aria-hidden="true" />
              <input type="search" placeholder="Buscar lançamento" aria-label="Buscar lançamento" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
            <div className={styles.filtrosWrap} ref={painelRef}>
              <button type="button" className={styles.botaoFiltros} data-ativo={painel || ativos > 0 ? "true" : undefined}
                aria-expanded={painel} aria-haspopup="dialog" onClick={() => (painel ? setPainel(false) : abrirPainel())}>
                <SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden="true" /> Filtros
                {ativos > 0 && <span className={styles.contador}>{ativos}</span>}
              </button>
              {painel && (
                <div className={styles.painel} role="dialog" aria-label="Filtros">
                  <label className={styles.campo}>
                    <span>Tipo de lançamento</span>
                    <select value={rascunho.natureza} onChange={edita("natureza")}>
                      {NATUREZAS.map((n) => <option key={n.valor} value={n.valor}>{n.rotulo}</option>)}
                    </select>
                  </label>
                  <label className={styles.campo}>
                    <span>Conta</span>
                    <select value={rascunho.contaId} onChange={edita("contaId")}>
                      <option value="">Todas as contas</option>
                      {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </label>
                  <label className={styles.campo}>
                    <span>Status</span>
                    <select value={rascunho.status} onChange={edita("status")}>
                      <option value="">Qualquer status</option>
                      <option value="1">Efetivado</option>
                      <option value="0">Previsto</option>
                    </select>
                  </label>
                  <div className={styles.campo}>
                    <span>Valor</span>
                    <div className={styles.faixa}>
                      <span className={styles.prefixado}><em>R$</em><input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0,00" aria-label="Valor mínimo" value={rascunho.valorMin} onChange={edita("valorMin")} /></span>
                      <span className={styles.ate}>até</span>
                      <span className={styles.prefixado}><em>R$</em><input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0,00" aria-label="Valor máximo" value={rascunho.valorMax} onChange={edita("valorMax")} /></span>
                    </div>
                  </div>
                  <div className={styles.campo}>
                    <span>Período</span>
                    <div className={styles.faixa}>
                      <input type="date" aria-label="De" value={rascunho.de} max={rascunho.ate || undefined} onChange={edita("de")} />
                      <span className={styles.ate}>até</span>
                      <input type="date" aria-label="Até" value={rascunho.ate} min={rascunho.de || undefined} onChange={edita("ate")} />
                    </div>
                  </div>
                  <div className={styles.painelRodape}>
                    <button type="button" className={styles.limparTudo} onClick={limparTudo}>Limpar tudo</button>
                    <button type="button" className={styles.aplicar} onClick={aplicar}>Aplicar</button>
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
          <div className={styles.lista}>
            {grupos.map((g) => (
              <section key={g.dia} className={styles.grupo}>
                <h3 className={styles.dia}>{rotuloDoDia(g.dia)}</h3>
                <ul className={styles.linhas}>
                  {g.itens.map((t) => <Linha key={t.id} t={t} categoria={t.categoriaId ? categorias[t.categoriaId] : undefined} />)}
                </ul>
              </section>
            ))}
          </div>
        )}

        {total > 0 && (
          <Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={setPagina} onPorPagina={mudarPorPagina}
            rotulo="transações" rotuloSingular="transação" />
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
        {t.hora && <span className={styles.hora}>{t.hora.slice(0, 5)}</span>}
        {t.statusTransacao === 0 && <span className={styles.previsto}>Previsto</span>}
        <Dinheiro valor={t.valor} tom={tom} className={styles.valor} />
      </Link>
    </li>
  )
}
