import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import {
  ChevronLeft, ChevronRight, Filter, CalendarDays, Wallet,
} from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesCard, PontesSelect, PontesStatCard,
  PontesEmptyState,
} from "@/components/pontes"
import { getCategories } from "../../services/categoryService"
import { getTransactions } from "../../services/transactionService"
import { getContas } from "../../services/contaService"
import type { Category } from "../../types/Category"
import type { Transaction } from "../../types/Transaction"
import TransactionTable, { type TransactionRow } from "./components/TransactionTable/TransactionTable"
import styles from "./TransactionsPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const RECEITA = 2

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

export default function TransactionsPage() {
  const navigate = useNavigate()
  const { notify } = useOutletContext<OutletContextType>()
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [saldoTotal, setSaldoTotal] = useState(0)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterCategoryId, setFilterCategoryId] = useState("")

  const loadData = useCallback(async () => {
    try {
      const [cats, trans, contas] = await Promise.all([
        getCategories(),
        getTransactions(),
        getContas(),
      ])
      setCategories(cats)
      setTransactions(trans)
      setSaldoTotal(contas.reduce((sum, c) => sum + (c.saldoAtual ?? 0), 0))
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      notify({ open: true, message: "Erro ao carregar transações", severity: "error" })
    }
  }, [notify])

  useEffect(() => {
    void loadData()
    const handler = () => { void loadData() }
    window.addEventListener("transactionCreated", handler)
    return () => window.removeEventListener("transactionCreated", handler)
  }, [loadData])

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))

  const monthLabel = currentDate
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase())

  const filtered = transactions.filter((t) => {
    const tDate = new Date(t.data)
    if (tDate.getFullYear() !== currentDate.getFullYear()) return false
    if (tDate.getMonth() !== currentDate.getMonth()) return false
    if (filterCategoryId && t.categoriaId !== filterCategoryId) return false
    return true
  })

  const totalEntradas = filtered.filter((t) => t.tipo === RECEITA).reduce((s, t) => s + t.valor, 0)
  const totalSaidas = filtered.filter((t) => t.tipo !== RECEITA).reduce((s, t) => s + t.valor, 0)
  const saldoFinal = filtered
    .filter((t) => !t.usadoComoCredito)
    .reduce((s, t) => s + (t.tipo === RECEITA ? t.valor : -t.valor), 0)

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
          <span className={styles.tableMeta}>{filtered.length} {filtered.length === 1 ? "lançamento" : "lançamentos"}</span>
        </div>
        <TransactionTable
          rows={filtered.map((t: Transaction): TransactionRow => ({
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
        />
      </PontesCard>
    </div>
  )
}
