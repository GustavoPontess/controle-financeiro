import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import {
  ChevronLeft, ChevronRight, Filter, CalendarDays, Wallet,
} from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesCard, PontesSelect, PontesStatCard,
  PontesEmptyState, PONTES_TABLE_PAGE_SIZE_DEFAULT,
} from "@/components/pontes"
import { getCategories } from "../../services/categoryService"
import { listTransactionsPage, getTransactionStats } from "../../services/transactionService"
import { getContas } from "../../services/contaService"
import type { Category } from "../../types/Category"
import type { Transaction } from "../../types/Transaction"
import TransactionTable, { type TransactionRow } from "./components/TransactionTable/TransactionTable"
import styles from "./TransactionsPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

// Janela ISO do mês [from, to) — usada nos query params do backend.
// Importante usar Date.UTC: transações são salvas em UTC midnight do dia
// escolhido (sem offset de TZ). Se calcular janela em LOCAL e converter pra
// ISO, fica deslocado +3h (BR) e transações do dia 1 às 00:00 UTC ficam
// fora. Mantém alinhado com o filtro de mês do DashboardService
// (t.Data.Year/Month UTC raw).
const monthWindow = (d: Date) => {
  const from = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString()
  const to = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString()
  return { from, to }
}

export default function TransactionsPage() {
  const navigate = useNavigate()
  const { notify } = useOutletContext<OutletContextType>()
  const [categories, setCategories] = useState<Category[]>([])
  // Janela visível da página atual (vem do backend já paginado+filtrado).
  const [pageItems, setPageItems] = useState<Transaction[]>([])
  const [totalNoFiltro, setTotalNoFiltro] = useState(0)
  // Stats do mês inteiro são separadas — agregamos uma página grande
  // (max 100) só pros KPIs do topo, sem afetar a tabela.
  const [monthStats, setMonthStats] = useState({ entradas: 0, saidas: 0, saldoMes: 0 })
  const [saldoTotal, setSaldoTotal] = useState(0)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterCategoryId, setFilterCategoryId] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PONTES_TABLE_PAGE_SIZE_DEFAULT)

  const loadCategories = useCallback(async () => {
    try {
      const cats = await getCategories()
      setCategories(cats)
    } catch (error) {
      console.error("Erro ao carregar categorias:", error)
    }
  }, [])

  const loadSaldo = useCallback(async () => {
    try {
      const contas = await getContas()
      setSaldoTotal(contas.reduce((sum, c) => sum + (c.saldoAtual ?? 0), 0))
    } catch (error) {
      console.error("Erro ao carregar contas:", error)
    }
  }, [])

  const loadPage = useCallback(async () => {
    try {
      const { from, to } = monthWindow(currentDate)
      const result = await listTransactionsPage(page, pageSize, {
        from, to,
        categoriaId: filterCategoryId || undefined,
      })
      setPageItems(result.items)
      setTotalNoFiltro(result.total)
    } catch (error) {
      console.error("Erro ao carregar transações:", error)
      notify({ open: true, message: "Erro ao carregar transações", severity: "error" })
    }
  }, [currentDate, page, pageSize, filterCategoryId, notify])

  // KPIs do topo — endpoint /stats dedicado, calculado no banco. Exato em qualquer
  // volume (#179 — antes agregava 1ª página de 100 e perdia acurácia >100/mês).
  const loadMonthStats = useCallback(async () => {
    try {
      const { from, to } = monthWindow(currentDate)
      const stats = await getTransactionStats({ from, to })
      // Cards mostram CAIXA REAL (exclui crédito não-pago) — alinhado com
      // Dashboard "Entrou/Saiu/Sobrou". `entradas/saidas` totais ficam
      // disponíveis no DTO pra quem precisar (drilldown, P&L).
      setMonthStats({
        entradas: stats.entradasCaixa,
        saidas: stats.saidasCaixa,
        saldoMes: stats.saldoPeriodo,
      })
    } catch (error) {
      console.error("Erro ao calcular stats:", error)
    }
  }, [currentDate])

  useEffect(() => { void loadCategories(); void loadSaldo() }, [loadCategories, loadSaldo])
  useEffect(() => { void loadPage() }, [loadPage])
  useEffect(() => { void loadMonthStats() }, [loadMonthStats])

  // Filtro/mês muda → volta pra página 1 (senão usuário fica preso em página 5
  // de um filtro que só tem 2 páginas).
  useEffect(() => { setPage(1) }, [currentDate, filterCategoryId, pageSize])

  // Refetch da página + stats quando transação é criada por dialog global.
  useEffect(() => {
    const handler = () => {
      void loadPage(); void loadMonthStats(); void loadSaldo()
    }
    window.addEventListener("transactionCreated", handler)
    return () => window.removeEventListener("transactionCreated", handler)
  }, [loadPage, loadMonthStats, loadSaldo])

  const loadData = useCallback(() => {
    void loadPage(); void loadMonthStats(); void loadSaldo()
  }, [loadPage, loadMonthStats, loadSaldo])

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))

  const monthLabel = currentDate
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase())

  const { entradas: totalEntradas, saidas: totalSaidas, saldoMes: saldoFinal } = monthStats

  if (categories.length === 0) {
    return (
      <PontesEmptyState
        icon={<Wallet size={28} />}
        title="Nenhuma categoria cadastrada"
        description="Crie categorias antes de registrar transações."
        actions={<PontesButton onClick={() => navigate("/categories")}>Adicionar Categoria</PontesButton>}
      />
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.monthNav}>
          <PontesIconButton size={32} variant="outline" aria-label="Mês anterior" onClick={prevMonth}>
            <ChevronLeft size={16} />
          </PontesIconButton>
          <span className={styles.monthLabel}>{monthLabel}</span>
          <PontesIconButton size={32} variant="outline" aria-label="Próximo mês" onClick={nextMonth}>
            <ChevronRight size={16} />
          </PontesIconButton>
        </div>
        <div className={styles.headerActions}>
          <PontesButton size="sm" variant="outline" iconStart={<CalendarDays size={16} />}
            onClick={() => setCurrentDate(new Date())}>
            Hoje
          </PontesButton>
          <PontesButton size="sm" variant="outline" iconStart={<Filter size={16} />} disabled>
            Filtros
          </PontesButton>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <PontesStatCard label="Saldo total" value={formatMoney(saldoTotal)} hint="todas as contas" />
        <PontesStatCard label="Entradas no mês" value={formatMoney(totalEntradas)} tone="success" />
        <PontesStatCard label="Saídas no mês" value={formatMoney(totalSaidas)} tone="danger" />
        <PontesStatCard label="Saldo do mês" value={formatMoney(saldoFinal)} tone={saldoFinal < 0 ? "danger" : "default"} />
      </div>

      <div className={styles.filterRow}>
        <div className={styles.filterField}>
          <PontesSelect
            value={filterCategoryId}
            onChange={(v) => setFilterCategoryId(v)}
            placeholder="Categoria"
            options={[
              { value: "", label: "Todas as categorias" },
              ...categories.map((c) => ({ value: c.id, label: c.descricao })),
            ]}
          />
        </div>
      </div>

      <PontesCard padding={0} radius={14}>
        <div className={styles.tableHead}>
          <span className={styles.tableTitle}>Todas as transações</span>
          <span className={styles.tableMeta}>{totalNoFiltro} {totalNoFiltro === 1 ? "lançamento" : "lançamentos"}</span>
        </div>
        <TransactionTable
          rows={pageItems.map((t: Transaction): TransactionRow => ({
            id: t.id,
            descricao: t.descricao,
            valor: t.valor,
            tipo: t.tipo,
            data: t.data,
            categoriaId: t.categoriaId ?? undefined,
            subcategoriaId: t.subcategoriaId ?? undefined,
            categoriaDescricao: categories.find((c) => c.id === t.categoriaId)?.descricao,
            contaId: t.contaId,
            cartaoCreditoId: t.cartaoCreditoId,
            contaNome: t.contaNome ?? t.cartaoCreditoNome,
            meioPagamento: t.meioPagamento,
            meioPagamentoDescricao: t.meioPagamentoDescricao,
          }))}
          onRefresh={loadData}
          notify={notify}
          emptyMessage="Nenhuma transação neste período"
          pagination={{
            page, pageSize, total: totalNoFiltro,
            onPageChange: setPage,
            onPageSizeChange: (s) => { setPageSize(s); setPage(1) },
          }}
        />
      </PontesCard>
    </div>
  )
}
