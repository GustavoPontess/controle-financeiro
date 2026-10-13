/**
 * Transações — extrato de caixa da conta (linha do tempo). Mostra só o que mexe
 * no saldo: receita/despesa de conta (pix/débito/boleto), pagamento de fatura e
 * transferências (neutras). Compra no crédito vive na aba Cartão; saldo inicial
 * fica fora da lista. Busca/filtros/paginação rodam no servidor; layout e
 * comportamento vêm do PontesTabela. Criar é o botão global "Nova transação" do
 * layout (evento `transactionCreated` → recarrega). Ver/editar/excluir e as ações de
 * família ficam na tela da transação: aqui a linha (ou o olhinho) só abre ela.
 */

import { useCallback, useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { TrendingUp, TrendingDown, ArrowLeftRight, CreditCard, Eye } from "lucide-react"
import {
  PontesTabela, PontesCelulaIdentidade, PontesBadge, PontesTablePagination, PontesIconButton,
  PONTES_TABLE_PAGE_SIZE_DEFAULT, type PontesTabelaColuna, type PontesTabelaTag,
} from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { listTransactionsPage, getTransactionStats } from "@/services/transactionService"
import { getContas } from "@/services/contaService"
import { getCategories } from "@/services/categoryService"
import type { Transaction } from "@/types/Transaction"
import type { Conta } from "@/types/Conta"
import styles from "./TransactionsPage.module.css"

// Data + hora — só mostra a hora quando o lançamento tem horário real (≠ meia-noite
// UTC). Lançamento manual salvo só com data fica sem hora, então não inventa "00:00".
// Data "YYYY-MM-DD" + hora "HH:MM:SS"|null — campos separados, sem fuso. Mostra a hora só quando existe.
const fmtData = (data?: string, hora?: string | null) => {
  if (!data) return "—"
  const [y, m, d] = data.split("-")
  const dia = `${d}/${m}/${y}`
  return hora ? `${dia} ${hora.slice(0, 5)}` : dia
}

// Meios de pagamento no extrato de caixa (crédito fica na aba Cartão, fora daqui).
const MEIOS_PAGAMENTO = [
  { value: "", label: "Qualquer pagamento" },
  { value: "1", label: "Dinheiro" },
  { value: "2", label: "Débito" },
  { value: "4", label: "Pix" },
  { value: "5", label: "TED" },
  { value: "6", label: "Boleto" },
]

type Notification = { open: boolean; message: string; severity: "success" | "error" | "warning" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }


export default function TransactionsPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [itens, setItens] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<{ entradas: number; saidas: number; saldo: number } | null>(null)
  const [saldoTotal, setSaldoTotal] = useState(0) // soma real das contas — o dinheiro que você tem
  const [contas, setContas] = useState<Conta[]>([]) // pra o filtro por conta
  const [catNome, setCatNome] = useState<Record<string, string>>({}) // id da categoria → nome
  const [carregando, setCarregando] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PONTES_TABLE_PAGE_SIZE_DEFAULT)
  const [busca, setBusca] = useState("")
  const buscaAplicada = useDebouncedValue(busca.trim())
  // Filtros avançados (todos no servidor): tipo de lançamento (natureza), conta, meio de pagamento, status, faixa, período.
  const [natureza, setNatureza] = useState("") // "" = todos | entrada | saida | transferencia | fatura
  const [contaFiltro, setContaFiltro] = useState("") // "" = todas as contas
  const [meioPag, setMeioPag] = useState("")         // "" = qualquer meio
  const [status, setStatus] = useState("")           // "" = qualquer | "1" = efetivado | "0" = previsto
  const [valorMin, setValorMin] = useState<number>()
  const [valorMax, setValorMax] = useState<number>()
  const [de, setDe] = useState<string>()
  const [ate, setAte] = useState<string>()

  const navigate = useNavigate()

  useEffect(() => { setPage(1) }, [buscaAplicada, natureza, contaFiltro, meioPag, status, valorMin, valorMax, de, ate])

  const [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  // Criar transação é o dialog global do layout; ao criar ele emite
  // `transactionCreated` — reagimos recarregando a lista, os stats e o saldo.
  useEffect(() => {
    const handler = () => recarregar()
    window.addEventListener("transactionCreated", handler)
    return () => window.removeEventListener("transactionCreated", handler)
  }, [recarregar])

  // Saldo em conta = soma dos saldos reais das contas (o dinheiro que a pessoa tem).
  // Consolidado, não depende de mês/filtro. Recarrega quando cria/edita/exclui (versao).
  useEffect(() => {
    let vivo = true
    getContas()
      .then((cs) => { if (vivo) { setContas(cs); setSaldoTotal(cs.reduce((s, c) => s + (c.saldoAtual ?? 0), 0)) } })
      .catch(() => {})
    return () => { vivo = false }
  }, [versao])

  // Nome das categorias (a transação só traz o id) — pra coluna Categoria.
  useEffect(() => {
    let vivo = true
    getCategories()
      .then((cats) => { if (vivo) setCatNome(Object.fromEntries(cats.map((c) => [c.id, c.descricao]))) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    Promise.all([
      listTransactionsPage(page, pageSize, {
        q: buscaAplicada || undefined,
        natureza: natureza || undefined,
        contaId: contaFiltro || undefined,
        meioPagamento: meioPag !== "" ? Number(meioPag) : undefined,
        status: status !== "" ? Number(status) : undefined,
        valorMin, valorMax, from: de, to: ate,
        apenasCaixa: true, // extrato da conta: sem compra de crédito, sem saldo inicial
      }),
      getTransactionStats({}).catch(() => null),
    ])
      .then(([lista, s]) => {
        if (!vivo) return
        setItens(lista.items)
        setTotal(lista.total)
        // Caixa: só movimento real da conta (exclui compra no crédito). Bate com o extrato.
        setStats(s ? { entradas: s.entradasCaixa, saidas: s.saidasCaixa, saldo: s.saldoPeriodo } : null)
      })
      .catch(() => { if (vivo) notify({ open: true, message: "Erro ao carregar transações", severity: "error" }) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [page, pageSize, buscaAplicada, natureza, contaFiltro, meioPag, status, valorMin, valorMax, de, ate, versao, notify])

  // Natureza da linha no extrato de caixa. Transferência e pagamento de fatura
  // são neutros — não são gasto/renda, só mexem no caixa.
  const naturezaLinha = (t: Transaction): "transferencia" | "fatura" | "entrada" | "saida" =>
    t.ehTransferencia ? "transferencia" : t.ehPagamentoFatura ? "fatura" : t.tipo === 2 ? "entrada" : "saida"

  const colunas: PontesTabelaColuna<Transaction>[] = [
    {
      key: "descricao", header: "Descrição / Conta",
      render: (t) => {
        const n = naturezaLinha(t)
        const icone = n === "transferencia" ? <ArrowLeftRight size={17} strokeWidth={2.2} />
          : n === "fatura" ? <CreditCard size={17} strokeWidth={2.2} />
          : n === "entrada" ? <TrendingUp size={17} strokeWidth={2.2} />
          : <TrendingDown size={17} strokeWidth={2.2} />
        const tom = n === "entrada" ? "entrada" : n === "saida" ? "saida" : "neutro"
        return <PontesCelulaIdentidade icone={icone} tom={tom} nome={t.descricao} sub={t.contaNome} />
      },
    },
    {
      // Eixo 1: TIPO (natureza) — o que é o lançamento.
      key: "tipo", header: "Tipo",
      render: (t) => {
        const n = naturezaLinha(t)
        const label = n === "entrada" ? "Entrada" : n === "saida" ? "Saída" : n === "transferencia" ? "Transferência" : "Pagto. fatura"
        const tone = n === "entrada" ? "success" : n === "saida" ? "danger" : n === "transferencia" ? "primary" : "neutral"
        return <PontesBadge tone={tone} size="sm">{label}</PontesBadge>
      },
    },
    { key: "categoria", header: "Categoria", render: (t) => (t.categoriaId ? (catNome[t.categoriaId] ?? "—") : "—") },
    { key: "pagamento", header: "Pagamento", render: (t) => t.meioPagamentoDescricao ?? "—" },
    { key: "data", header: "Data/Hora", render: (t) => fmtData(t.data, t.hora) },
    {
      // Eixo 2: STATUS — em que estado está (puro, sem misturar com o tipo).
      key: "status", header: "Status",
      render: (t) => t.statusTransacao === 0
        ? <PontesBadge tone="warning" size="sm">Previsto</PontesBadge>
        : <PontesBadge tone="success" size="sm">Efetivado</PontesBadge>,
    },
    {
      key: "valor", header: "Valor", numerica: true,
      render: (t) => {
        const n = naturezaLinha(t)
        const cls = n === "entrada" ? styles.valEntrada : n === "saida" || n === "fatura" ? styles.valSaida : styles.valNeutro
        return <span className={cls}>{formatMoney(t.valor)}</span>
      },
    },
  ]

  const tags: PontesTabelaTag[] = []
  if (busca) tags.push({ label: `Busca: "${busca}"`, onRemover: () => setBusca("") })

  return (
    <PontesTabela
      id="transacoes"
      titulo="Todas as transações"
      resumo={
        <div className={styles.hero}>
          <div className={styles.heroBlob} />
          <div className={styles.heroMain}>
            <div className={styles.heroLabel}>Saldo em conta</div>
            <div className={styles.heroValue}>{formatMoney(saldoTotal)}</div>
          </div>
          <div className={styles.heroFluxo}>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue} data-tone="up">{formatMoney(stats?.entradas ?? 0)}</span>
                <span className={styles.heroStatLabel}>Entrou</span>
              </div>
              <div className={styles.heroStatDivider} />
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue} data-tone="down">{formatMoney(stats?.saidas ?? 0)}</span>
                <span className={styles.heroStatLabel}>Saiu</span>
              </div>
            </div>
          </div>
        </div>
      }
      busca={{ value: busca, onChange: setBusca, placeholder: "Buscar lançamento…", ariaLabel: "Buscar transação" }}
      filtrosAvancados={[
        {
          tipo: "select", id: "natureza", label: "Tipo de lançamento", value: natureza, coluna: "tipo",
          opcoes: [
            { value: "", label: "Todos" },
            { value: "entrada", label: "Entradas" },
            { value: "saida", label: "Saídas" },
            { value: "transferencia", label: "Transferências" },
            { value: "fatura", label: "Pagamento de fatura" },
          ],
          onChange: setNatureza,
        },
        {
          // Conta não tem coluna própria (vai no sub da Descrição) → aparece sempre.
          tipo: "select", id: "conta", label: "Conta", value: contaFiltro,
          opcoes: [{ value: "", label: "Todas as contas" }, ...contas.map((c) => ({ value: c.id, label: c.nome }))],
          onChange: setContaFiltro,
        },
        {
          tipo: "select", id: "pagamento", label: "Meio de pagamento", value: meioPag, coluna: "pagamento",
          opcoes: MEIOS_PAGAMENTO,
          onChange: setMeioPag,
        },
        {
          tipo: "select", id: "status", label: "Status", value: status, coluna: "status",
          opcoes: [{ value: "", label: "Qualquer status" }, { value: "1", label: "Efetivado" }, { value: "0", label: "Previsto" }],
          onChange: setStatus,
        },
        { tipo: "faixaValor", id: "valor", label: "Valor", coluna: "valor", min: valorMin, max: valorMax, onChange: (mn, mx) => { setValorMin(mn); setValorMax(mx) } },
        { tipo: "faixaData", id: "data", label: "Período", coluna: "data", de, ate, onChange: (d, a) => { setDe(d); setAte(a) } },
      ]}
      tags={tags}
      colunas={colunas}
      colunasPadraoOcultas={["categoria", "pagamento"]}
      itens={itens}
      chave={(t) => t.id}
      // Ações moram na tela da transação (editar, excluir/estornar, família). Aqui só o olhinho que abre
      // ela — o mesmo que clicar na linha.
      renderAcoes={(t) => (
        <PontesIconButton size={32} variant="ghost" title="Ver transação" aria-label={`Ver ${t.descricao}`}
          onClick={() => navigate(`/transactions/${t.id}`)}>
          <Eye size={16} strokeWidth={2.5} />
        </PontesIconButton>
      )}
      onLinhaClick={(t) => navigate(`/transactions/${t.id}`)}
      carregando={carregando}
      vazio={{ icone: <TrendingUp size={28} strokeWidth={2.5} />, titulo: "Nenhuma transação" }}
      paginacao={
        <PontesTablePagination
          total={total} page={page} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          itemLabel="transações" itemLabelSingular="transação"
        />
      }
    />
  )
}
