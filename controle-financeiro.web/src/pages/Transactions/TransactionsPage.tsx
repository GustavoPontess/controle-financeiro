import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useNavigate, useOutletContext } from "react-router-dom"
import {
  ChevronLeft, ChevronRight, CalendarDays, Wallet, Search, X, SlidersHorizontal,
} from "lucide-react"
import {
  PontesButton, PontesCard, PontesSelect,
  PontesInput, PontesEmptyState, PontesDrawer, useHideBalance,
} from "@/components/pontes"
import { getCategories } from "../../services/categoryService"
import { listTransactionsPage, getTransactionStats } from "../../services/transactionService"
import { getContas } from "../../services/contaService"
import { getCartoes } from "../../services/cartaoCreditoService"
import type { Category } from "../../types/Category"
import type { Conta } from "../../types/Conta"
import type { CartaoCredito } from "../../types/CartaoCredito"
import type { Transaction } from "../../types/Transaction"
import TransactionTable, { type TransactionRow } from "./components/TransactionTable/TransactionTable"
import styles from "./TransactionsPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }


// Chave de persistência da preferência de linhas-por-página.
const PAGE_SIZE_KEY = "transactions:pageSize"

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

// Filtros avançados (#1.1) — vivem no PontesDrawer. Vazios = inativos.
type AdvFilters = {
  categoriaId: string // "" = todas
  contaId: string; cartaoId: string
  valorMin: string; valorMax: string
  status: string      // "" = qualquer | "1" = efetivado | "0" = previsto
  ordenacao: string   // "" = data desc (default) | data_asc | valor_desc | valor_asc
}
const EMPTY_ADV: AdvFilters = { categoriaId: "", contaId: "", cartaoId: "", valorMin: "", valorMax: "", status: "", ordenacao: "" }
const ORDENACAO_OPTS = [
  { value: "", label: "Mais recentes" },
  { value: "data_asc", label: "Mais antigas" },
  { value: "valor_desc", label: "Maior valor" },
  { value: "valor_asc", label: "Menor valor" },
]
const STATUS_OPTS = [
  { value: "", label: "Qualquer status" },
  { value: "1", label: "Efetivadas" },
  { value: "0", label: "Previstas" },
]

export default function TransactionsPage() {
  const navigate = useNavigate()
  const { notify } = useOutletContext<OutletContextType>()
  useHideBalance() // assina o olho global → re-render (hero + stats) ao ocultar/mostrar
  const [categories, setCategories] = useState<Category[]>([])
  // Janela visível da página atual (vem do backend já paginado+filtrado).
  const [pageItems, setPageItems] = useState<Transaction[]>([])
  const [totalNoFiltro, setTotalNoFiltro] = useState(0)
  // Stats do mês inteiro são separadas — agregamos uma página grande
  // (max 100) só pros KPIs do topo, sem afetar a tabela.
  const [monthStats, setMonthStats] = useState({ entradas: 0, saidas: 0, saldoMes: 0 })
  const [saldoTotal, setSaldoTotal] = useState(0)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterTipo, setFilterTipo] = useState<0 | 1 | 2>(0) // 0=todos, 1=despesa, 2=receita
  const [searchInput, setSearchInput] = useState("") // valor digitado (imediato)
  const [search, setSearch] = useState("")             // valor com debounce (query)
  const searchRef = useRef<HTMLInputElement>(null)
  // Filtros avançados (#1.1): `adv` = aplicado (entra na query); `draft` = sendo
  // editado no drawer. Aplicar copia draft→adv. Contas/cartões pras opções.
  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [adv, setAdv] = useState<AdvFilters>(EMPTY_ADV)
  const [draft, setDraft] = useState<AdvFilters>(EMPTY_ADV)
  const [page, setPage] = useState(1)
  // Default 10, mas respeita a última escolha do usuário (persistida em
  // localStorage) — sobrevive reload e troca de tela.
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY))
    return Number.isFinite(saved) && saved > 0 ? saved : 10
  })

  // Debounce da busca: 350ms sem digitar → dispara query. Evita request por tecla.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

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
      const lista = await getContas()
      setContas(lista)
      setSaldoTotal(lista.reduce((sum, c) => sum + (c.saldoAtual ?? 0), 0))
    } catch (error) {
      console.error("Erro ao carregar contas:", error)
    }
  }, [])

  const loadCartoes = useCallback(async () => {
    try {
      setCartoes(await getCartoes())
    } catch (error) {
      console.error("Erro ao carregar cartões:", error)
    }
  }, [])

  const loadPage = useCallback(async () => {
    try {
      const { from, to } = monthWindow(currentDate)
      const result = await listTransactionsPage(page, pageSize, {
        from, to,
        categoriaId: adv.categoriaId || undefined,
        q: search || undefined,
        tipo: filterTipo || undefined,
        contaId: adv.contaId || undefined,
        cartaoId: adv.cartaoId || undefined,
        valorMin: adv.valorMin ? Number(adv.valorMin) : undefined,
        valorMax: adv.valorMax ? Number(adv.valorMax) : undefined,
        status: adv.status !== "" ? Number(adv.status) : undefined,
        ordenacao: adv.ordenacao || undefined,
      })
      setPageItems(result.items)
      setTotalNoFiltro(result.total)
    } catch (error) {
      console.error("Erro ao carregar transações:", error)
      notify({ open: true, message: "Erro ao carregar transações", severity: "error" })
    }
  }, [currentDate, page, pageSize, search, filterTipo, adv, notify])

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

  useEffect(() => { void loadCategories(); void loadSaldo(); void loadCartoes() }, [loadCategories, loadSaldo, loadCartoes])
  useEffect(() => { void loadPage() }, [loadPage])
  useEffect(() => { void loadMonthStats() }, [loadMonthStats])

  // Filtro/mês muda → volta pra página 1 (senão usuário fica preso em página 5
  // de um filtro que só tem 2 páginas).
  useEffect(() => { setPage(1) }, [currentDate, filterTipo, search, pageSize, adv])

  // Atalho "/" foca a busca (fora de input). N abre nova transação.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inField = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable
      if (e.key === "/" && !inField) {
        e.preventDefault(); searchRef.current?.focus()
      } else if (e.key.toLowerCase() === "n" && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault(); window.dispatchEvent(new Event("openNewTransaction"))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

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

  // Quantos filtros avançados estão ativos (pro badge no botão Filtros).
  const advCount = useMemo(
    () => Object.values(adv).filter((v) => v !== "").length,
    [adv]
  )
  // Tipo (Tudo/Receitas/Despesas) é toggle de VISÃO, não filtro → não conta pro "Limpar".
  const hasFilters = useMemo(
    () => !!(search || advCount),
    [search, advCount]
  )
  const clearFilters = () => {
    setSearchInput(""); setSearch("")
    setAdv(EMPTY_ADV); setDraft(EMPTY_ADV)
  }

  // Abre o drawer com o estado atual; "Aplicar" copia draft→adv.
  const openFilters = () => { setDraft(adv); setFiltersOpen(true) }
  const aplicarFilters = () => { setAdv(draft); setFiltersOpen(false) }

  const TIPO_CHIPS: { value: 0 | 1 | 2; label: string }[] = [
    { value: 0, label: "Tudo" },
    { value: 2, label: "Receitas" },
    { value: 1, label: "Despesas" },
  ]

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
      {/* Header padrão — título + ações (igual às outras telas) */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Transações</h1>
          <div className={styles.subtitle}>Todos os seus lançamentos, mês a mês</div>
        </div>
      </div>

      {/* Hero composto — saldo total (global) à esquerda; resumo do mês à direita.
          Mesma linguagem hero das outras telas, mas composição própria desta:
          junta "quanto tenho" + "como foi o mês" numa peça só. */}
      <div className={styles.hero}>
        <div className={styles.heroBlob} />
        <div className={styles.heroMain}>
          <div className={styles.heroLabel}>Saldo total</div>
          <div className={styles.heroValue}>{formatMoney(saldoTotal)}</div>
          <div className={styles.heroSub}>Soma de todas as contas</div>
        </div>

        <div className={styles.heroSide}>
          <div className={styles.heroMonthNav}>
            <button type="button" className={styles.heroNavBtn} aria-label="Mês anterior" onClick={prevMonth}>
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <span className={styles.heroMonthLabel}>{monthLabel}</span>
            <button type="button" className={styles.heroNavBtn} aria-label="Próximo mês" onClick={nextMonth}>
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
            <button type="button" className={styles.heroTodayBtn} onClick={() => setCurrentDate(new Date())}>
              <CalendarDays size={14} strokeWidth={2.5} /> Hoje
            </button>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue} data-tone="up">{formatMoney(totalEntradas)}</span>
              <span className={styles.heroStatLabel}>Entrou</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue} data-tone="down">{formatMoney(totalSaidas)}</span>
              <span className={styles.heroStatLabel}>Saiu</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{formatMoney(saldoFinal)}</span>
              <span className={styles.heroStatLabel}>Sobrou</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar — busca + filtro de tipo + categoria */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <PontesInput
            ref={searchRef}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar transação…  (/)"
            iconStart={<Search size={16} />}
            iconEnd={searchInput ? (
              <button type="button" className={styles.searchClear} aria-label="Limpar busca"
                onClick={() => { setSearchInput(""); setSearch(""); searchRef.current?.focus() }}>
                <X size={15} strokeWidth={2.5} />
              </button>
            ) : undefined}
          />
        </div>
        <div className={styles.tipoChips}>
          {TIPO_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={styles.tipoChip}
              data-active={filterTipo === c.value ? "true" : undefined}
              onClick={() => setFilterTipo(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <PontesButton
          size="sm"
          variant={advCount ? "primary" : "outline"}
          iconStart={<SlidersHorizontal size={15} strokeWidth={2.5} />}
          onClick={openFilters}
        >
          Filtros{advCount ? ` (${advCount})` : ""}
        </PontesButton>
        {hasFilters && (
          <PontesButton size="sm" variant="ghost" iconStart={<X size={15} strokeWidth={2.5} />} onClick={clearFilters}>
            Limpar
          </PontesButton>
        )}
      </div>

      {/* Chips dos filtros avançados ativos (#1.1) — clicar remove. */}
      {advCount > 0 && (
        <div className={styles.advChips}>
          {adv.contaId && (
            <FilterChip label={`Conta: ${contas.find((c) => c.id === adv.contaId)?.nome ?? "—"}`}
              onClear={() => setAdv((a) => ({ ...a, contaId: "" }))} />
          )}
          {adv.cartaoId && (
            <FilterChip label={`Cartão: ${cartoes.find((c) => c.id === adv.cartaoId)?.nome ?? "—"}`}
              onClear={() => setAdv((a) => ({ ...a, cartaoId: "" }))} />
          )}
          {adv.valorMin && (
            <FilterChip label={`≥ ${formatMoney(Number(adv.valorMin))}`}
              onClear={() => setAdv((a) => ({ ...a, valorMin: "" }))} />
          )}
          {adv.valorMax && (
            <FilterChip label={`≤ ${formatMoney(Number(adv.valorMax))}`}
              onClear={() => setAdv((a) => ({ ...a, valorMax: "" }))} />
          )}
          {adv.status !== "" && (
            <FilterChip label={STATUS_OPTS.find((o) => o.value === adv.status)?.label ?? ""}
              onClear={() => setAdv((a) => ({ ...a, status: "" }))} />
          )}
          {adv.ordenacao && (
            <FilterChip label={ORDENACAO_OPTS.find((o) => o.value === adv.ordenacao)?.label ?? ""}
              onClear={() => setAdv((a) => ({ ...a, ordenacao: "" }))} />
          )}
        </div>
      )}

      <PontesCard padding={0} radius={14}>
        <div className={styles.tableHead}>
          <span className={styles.tableTitle}>
            {hasFilters ? "Resultado" : "Todas as transações"}
          </span>
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
            recorrenteOrigemId: t.recorrenteOrigemId,
            parcelamentoId: t.parcelamentoId,
            parcelaTransacaoId: t.parcelaTransacaoId,
            ehPagamentoFatura: t.ehPagamentoFatura,
            statusTransacao: t.statusTransacao,
          }))}
          onRefresh={loadData}
          notify={notify}
          emptyMessage={hasFilters ? "Nada encontrado com esses filtros" : "Nenhuma transação neste período"}
          pagination={{
            page, pageSize, total: totalNoFiltro,
            onPageChange: setPage,
            onPageSizeChange: (s) => { setPageSize(s); setPage(1); localStorage.setItem(PAGE_SIZE_KEY, String(s)) },
          }}
        />
      </PontesCard>

      {/* Drawer de filtros avançados (#1.1) — edita `draft`; "Aplicar" copia pra `adv`. */}
      <PontesDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={
          <div className={styles.drawerFooter}>
            <PontesButton variant="ghost" size="sm" onClick={() => setDraft(EMPTY_ADV)}>
              Limpar tudo
            </PontesButton>
            <PontesButton variant="primary" size="sm" onClick={aplicarFilters}>
              Aplicar
            </PontesButton>
          </div>
        }
      >
        {/* Só monta o corpo quando aberto — drawer fechado não deixa inputs vivos
            no DOM (evita colisão de locators e foco em campos invisíveis). */}
        {filtersOpen && (
        <div className={styles.drawerBody}>
          <label className={styles.drawerLabel}>Categoria
            <PontesSelect
              value={draft.categoriaId}
              onChange={(v) => setDraft((d) => ({ ...d, categoriaId: v }))}
              placeholder="Todas as categorias"
              options={[{ value: "", label: "Todas as categorias" }, ...categories.map((c) => ({ value: c.id, label: c.descricao }))]}
            />
          </label>
          <label className={styles.drawerLabel}>Conta
            <PontesSelect
              value={draft.contaId}
              onChange={(v) => setDraft((d) => ({ ...d, contaId: v }))}
              placeholder="Qualquer conta"
              options={[{ value: "", label: "Qualquer conta" }, ...contas.map((c) => ({ value: c.id, label: c.nome }))]}
            />
          </label>
          <label className={styles.drawerLabel}>Cartão
            <PontesSelect
              value={draft.cartaoId}
              onChange={(v) => setDraft((d) => ({ ...d, cartaoId: v }))}
              placeholder="Qualquer cartão"
              options={[{ value: "", label: "Qualquer cartão" }, ...cartoes.map((c) => ({ value: c.id, label: c.nome }))]}
            />
          </label>
          <div className={styles.drawerRow}>
            <label className={styles.drawerLabel}>Valor mín.
              <PontesInput type="number" inputMode="decimal" placeholder="0,00"
                value={draft.valorMin} onChange={(e) => setDraft((d) => ({ ...d, valorMin: e.target.value }))} />
            </label>
            <label className={styles.drawerLabel}>Valor máx.
              <PontesInput type="number" inputMode="decimal" placeholder="—"
                value={draft.valorMax} onChange={(e) => setDraft((d) => ({ ...d, valorMax: e.target.value }))} />
            </label>
          </div>
          <label className={styles.drawerLabel}>Status
            <PontesSelect value={draft.status} onChange={(v) => setDraft((d) => ({ ...d, status: v }))} options={STATUS_OPTS} />
          </label>
          <label className={styles.drawerLabel}>Ordenar por
            <PontesSelect value={draft.ordenacao} onChange={(v) => setDraft((d) => ({ ...d, ordenacao: v }))} options={ORDENACAO_OPTS} />
          </label>
        </div>
        )}
      </PontesDrawer>
    </div>
  )
}

/** Chip de filtro avançado ativo — clicar no × remove só ele. */
function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className={styles.advChip}>
      {label}
      <button type="button" className={styles.advChipX} aria-label={`Remover ${label}`} onClick={onClear}>
        <X size={13} strokeWidth={2.5} />
      </button>
    </span>
  )
}
