/**
 * Transações — extrato de caixa da conta (linha do tempo). Mostra só o que mexe
 * no saldo: receita/despesa de conta (pix/débito/boleto), pagamento de fatura e
 * transferências (neutras). Compra no crédito vive na aba Cartão; saldo inicial
 * fica fora da lista. Busca/filtros/paginação rodam no servidor; layout e
 * comportamento vêm do PontesTabela. Criar é o botão global "Nova transação" do
 * layout (evento `transactionCreated` → recarrega). Editar/excluir no ⋮ da linha.
 */

import { useCallback, useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { TrendingUp, TrendingDown, Pencil, Trash2, ArrowLeftRight, CreditCard, Users, User, Split, Undo2 } from "lucide-react"
import {
  PontesTabela, PontesCelulaIdentidade, PontesBadge, PontesTablePagination, PontesDialog,
  PontesModal, PontesButton, PontesField, PontesInput, PontesSelect,
  PONTES_TABLE_PAGE_SIZE_DEFAULT, type PontesTabelaColuna, type PontesTabelaTag,
} from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { listTransactionsPage, getTransactionStats, deleteTransaction } from "@/services/transactionService"
import { getContas } from "@/services/contaService"
import { getCategories } from "@/services/categoryService"
import {
  getFamilias, compartilharTransacao, getDependentes, atribuirDependente,
  getRateioTransacao, definirRateioTransacao, removerRateioTransacao,
} from "@/services/familiaService"
import type { Transaction } from "@/types/Transaction"
import type { Conta } from "@/types/Conta"
import type { Familia, Dependente, ModoRateio, RateioTransacao } from "@/types/Familia"
import EstornarPagamentoDialog from "../CreditCards/EstornarPagamentoDialog"
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

// Modos de rateio da despesa compartilhada (override do padrão da família).
const MODOS_RATEIO = [
  { value: "1", label: "Igualitário" },
  { value: "2", label: "Proporcional à renda" },
  { value: "3", label: "Personalizado" },
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
  const [excluindo, setExcluindo] = useState<Transaction | null>(null)
  const [estornando, setEstornando] = useState<{ id: string; valor: number } | null>(null)

  // Ações de família/rateio (só despesa real de conta) — estado dos 3 modais.
  const [sharing, setSharing] = useState<Transaction | null>(null)
  const [familias, setFamilias] = useState<Familia[]>([])
  const [assigning, setAssigning] = useState<Transaction | null>(null)
  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [ratear, setRatear] = useState<Transaction | null>(null)
  const [rateio, setRateio] = useState<RateioTransacao | null>(null)
  const [rateioModo, setRateioModo] = useState<ModoRateio>(1)
  const [percentuais, setPercentuais] = useState<Record<string, string>>({})
  const [rateioErro, setRateioErro] = useState<string | undefined>()

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

  const handleExcluir = async () => {
    if (!excluindo) return
    try {
      await deleteTransaction(excluindo.id)
      notify({ open: true, message: "Transação excluída", severity: "success" })
      recarregar()
    } catch {
      notify({ open: true, message: "Erro ao excluir transação", severity: "error" })
    } finally {
      setExcluindo(null)
    }
  }

  // ── Compartilhar despesa com a família ──
  const openShare = async (t: Transaction) => {
    setSharing(t)
    try {
      setFamilias(await getFamilias())
    } catch {
      notify({ open: true, message: "Erro ao carregar famílias", severity: "error" })
    }
  }

  const handleShare = async (familiaId: string) => {
    if (!sharing) return
    try {
      await compartilharTransacao(sharing.id, familiaId)
      notify({ open: true, message: "Despesa compartilhada com a família", severity: "success" })
      setSharing(null)
      recarregar()
    } catch {
      notify({ open: true, message: "Erro ao compartilhar despesa", severity: "error" })
    }
  }

  // ── Atribuir despesa a um dependente ──
  const openAssign = async (t: Transaction) => {
    setAssigning(t)
    try {
      const fams = await getFamilias()
      const listas = await Promise.all(fams.map((f) => getDependentes(f.id)))
      setDependentes(listas.flat())
    } catch {
      notify({ open: true, message: "Erro ao carregar dependentes", severity: "error" })
    }
  }

  const handleAssign = async (dependenteId: string | null) => {
    if (!assigning) return
    try {
      await atribuirDependente(assigning.id, dependenteId)
      notify({
        open: true,
        message: dependenteId ? "Despesa atribuída ao dependente" : "Atribuição removida",
        severity: "success",
      })
      setAssigning(null)
      recarregar()
    } catch {
      notify({ open: true, message: "Erro ao atribuir despesa", severity: "error" })
    }
  }

  // ── Rateio específico da despesa (override do padrão da família) ──
  const openRatear = async (t: Transaction) => {
    setRatear(t)
    setRateio(null)
    setRateioErro(undefined)
    try {
      const r = await getRateioTransacao(t.id)
      setRateio(r)
      setRateioModo(r.modo ?? 1)
      setPercentuais(Object.fromEntries(
        r.membros.map((m) => [m.usuarioId, m.percentual ? String(m.percentual) : ""])))
    } catch {
      notify({ open: true, message: "Defina a despesa como compartilhada antes de ratear", severity: "error" })
      setRatear(null)
    }
  }

  const handleSalvarRateio = async () => {
    if (!ratear) return
    let itens = null
    if (rateioModo === 3) {
      itens = (rateio?.membros ?? []).map((m) => ({
        usuarioId: m.usuarioId,
        percentual: Number(percentuais[m.usuarioId] ?? 0),
      }))
      const soma = itens.reduce((s, i) => s + i.percentual, 0)
      // Validação inline (nunca toast pra campo): bloqueia submit e marca os campos.
      if (Math.abs(soma - 100) > 0.01) {
        setRateioErro("Os percentuais devem somar 100%")
        return
      }
    }
    try {
      await definirRateioTransacao(ratear.id, rateioModo, itens)
      notify({ open: true, message: "Rateio definido", severity: "success" })
      setRatear(null)
      recarregar()
    } catch {
      notify({ open: true, message: "Erro ao definir rateio", severity: "error" })
    }
  }

  const handleRemoverRateio = async () => {
    if (!ratear) return
    try {
      await removerRateioTransacao(ratear.id)
      notify({ open: true, message: "Override de rateio removido", severity: "success" })
      setRatear(null)
      recarregar()
    } catch {
      notify({ open: true, message: "Erro ao remover rateio", severity: "error" })
    }
  }

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

  const acoes = (t: Transaction) => {
    // Família/rateio só valem pra DESPESA real de conta (gasto compartilhável).
    // Transferência e pagamento de fatura são neutros — não entram.
    const podeCompartilhar = t.tipo === 1 && !t.ehTransferencia && !t.ehPagamentoFatura
    return [
      ...(podeCompartilhar
        ? [
            { key: "compartilhar", label: "Compartilhar com família", icon: <Users size={16} strokeWidth={2.5} />, onClick: () => openShare(t) },
            { key: "atribuir", label: "Atribuir a dependente", icon: <User size={16} strokeWidth={2.5} />, onClick: () => openAssign(t) },
            { key: "rateio", label: "Definir rateio", icon: <Split size={16} strokeWidth={2.5} />, onClick: () => openRatear(t) },
          ]
        : []),
      // Pagamento de fatura: nem editar nem excluir (está ligado ao que a fatura recebeu — o servidor recusa).
      // Transferência: excluir apaga as DUAS pernas; editar uma só desemparelharia (o servidor recusa).
      ...(!t.ehPagamentoFatura && !t.ehTransferencia
        ? [{ key: "editar", label: "Editar", icon: <Pencil size={16} strokeWidth={2.5} />, onClick: () => navigate(`/transactions/${t.id}/editar`) }]
        : []),
      ...(!t.ehPagamentoFatura
        ? [{ key: "excluir", label: "Excluir", danger: true, icon: <Trash2 size={16} strokeWidth={2.5} />, onClick: () => setExcluindo(t) }]
        // Pagamento de fatura não se exclui, mas tem volta: o estorno devolve à conta e a fatura volta a dever.
        : [{ key: "estornar", label: "Estornar pagamento", icon: <Undo2 size={16} strokeWidth={2.5} />, onClick: () => setEstornando({ id: t.id, valor: t.valor }) }]),
    ]
  }

  const tags: PontesTabelaTag[] = []
  if (busca) tags.push({ label: `Busca: "${busca}"`, onRemover: () => setBusca("") })

  return (
    <>
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
        acoes={acoes}
        // Clicar na linha abre a transação (tela única de ver/editar); o ⋮ segue com as ações rápidas.
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

      <PontesDialog
        open={excluindo !== null}
        title="Excluir transação?"
        description={excluindo ? `${excluindo.descricao} · ${formatMoney(excluindo.valor)}` : undefined}
        tone="danger"
        confirmLabel="Excluir"
        onConfirm={handleExcluir}
        onCancel={() => setExcluindo(null)}
      />
      <EstornarPagamentoDialog
        pagamento={estornando}
        onClose={() => setEstornando(null)}
        onEstornado={recarregar}
        notify={notify}
      />

      {/* Compartilhar com família */}
      <PontesModal
        open={sharing !== null}
        title="Compartilhar com a família"
        onClose={() => setSharing(null)}
        footer={<PontesButton variant="outline" onClick={() => setSharing(null)}>Cancelar</PontesButton>}
      >
        {familias.length === 0 ? (
          <div className={styles.modalMuted}>Você não participa de nenhuma família.</div>
        ) : (
          <>
            <p className={styles.modalIntro}>Em qual família lançar “{sharing?.descricao}”?</p>
            <div className={styles.optionList}>
              {familias.map((f) => (
                <PontesButton key={f.id} variant="outline" fullWidth onClick={() => handleShare(f.id)}>{f.nome}</PontesButton>
              ))}
            </div>
          </>
        )}
      </PontesModal>

      {/* Atribuir a dependente */}
      <PontesModal
        open={assigning !== null}
        title="Atribuir a um dependente"
        onClose={() => setAssigning(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => handleAssign(null)}>Remover atribuição</PontesButton>
          <PontesButton variant="outline" onClick={() => setAssigning(null)}>Cancelar</PontesButton>
        </>}
      >
        {dependentes.length === 0 ? (
          <div className={styles.modalMuted}>Nenhum dependente cadastrado nas suas famílias.</div>
        ) : (
          <>
            <p className={styles.modalIntro}>A quem atribuir “{assigning?.descricao}”?</p>
            <div className={styles.optionList}>
              {dependentes.map((d) => (
                <PontesButton key={d.id} variant="outline" fullWidth onClick={() => handleAssign(d.id)}>
                  {d.nome}{d.apelido ? ` (${d.apelido})` : ""}
                </PontesButton>
              ))}
            </div>
          </>
        )}
      </PontesModal>

      {/* Rateio específico da despesa */}
      <PontesModal
        open={ratear !== null}
        title={`Rateio de “${ratear?.descricao ?? ""}”`}
        onClose={() => setRatear(null)}
        footer={<>
          <PontesButton variant="outline" onClick={handleRemoverRateio}>Remover override</PontesButton>
          <PontesButton variant="outline" onClick={() => setRatear(null)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSalvarRateio}>Salvar</PontesButton>
        </>}
      >
        <p className={styles.modalIntro}>Define o modo de rateio só para esta despesa, sobrepondo o padrão da família.</p>
        <PontesField label="Modo">
          <PontesSelect
            value={String(rateioModo)}
            onChange={(v) => setRateioModo(Number(v) as ModoRateio)}
            options={MODOS_RATEIO}
          />
        </PontesField>
        {rateioModo === 3 && (rateio?.membros ?? []).map((m) => (
          <PontesField key={m.usuarioId} label={`${m.nome} (%)`}>
            <PontesInput
              type="number"
              value={percentuais[m.usuarioId] ?? ""}
              onChange={(e) => { setRateioErro(undefined); setPercentuais((p) => ({ ...p, [m.usuarioId]: e.target.value })) }}
              min={0} max={100} step="0.01"
              invalid={!!rateioErro}
            />
          </PontesField>
        ))}
        {rateioErro && <p className={styles.rateioErro}>{rateioErro}</p>}
      </PontesModal>
    </>
  )
}
