import { useEffect, useMemo, useState } from "react"
import { TrendingDown, TrendingUp, ArrowLeftRight } from "lucide-react"
import {
  PontesButton, PontesToggle, PontesField, PontesInput, PontesDateInput, PontesMoneyInput, PontesSelect,
  PontesChoiceCards, PontesGroupedSelect,
} from "@/components/pontes"
import type { Category } from "../../../../types/Category"
import type { Subcategory } from "../../../../types/Subcategory"
import type { Conta } from "../../../../types/Conta"
import type { CartaoCredito } from "../../../../types/CartaoCredito"
import styles from "./TransactionForm.module.css"

const MEIOS_PAGAMENTO = [
  { value: "4", label: "Pix" },
  { value: "2", label: "Débito" },
  { value: "3", label: "Crédito" },
  { value: "1", label: "Dinheiro" },
  { value: "5", label: "TED / DOC" },
  { value: "6", label: "Boleto" },
]

const PARCELAS_OPTS = [
  { value: "1", label: "À vista" },
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => ({ value: String(n), label: `${n}x` })),
]

const FREQ_OPTS = [
  { value: "2", label: "Mensal" },
  { value: "1", label: "Semanal" },
  { value: "3", label: "Anual" },
]

export type TransactionModo = "unico" | "recorrente"
export type TransactionNatureza = "despesa" | "receita" | "transferencia"

export interface TransactionFormData {
  natureza: TransactionNatureza
  modo: TransactionModo
  tipo: number // derivado da natureza (despesa=1, receita=2); ignorado em transferência
  meioPagamento: number
  categoriaId: string
  subcategoriaId: string
  contaId: string
  cartaoCreditoId: string
  // transferência
  contaOrigemId: string
  contaDestinoId: string
  valor: string
  data: string
  descricao: string
  parcelas: number
  // recorrente
  frequencia: number
  dataFim: string
}

export type TransactionFormMode = "create" | "edit"

type Props = {
  categories: Category[]
  subcategories: Subcategory[]
  contas: Conta[]
  cartoes: CartaoCredito[]
  onSubmit: (data: TransactionFormData) => Promise<void>
  onCancel?: () => void
  /** Modo do form. "edit" trava natureza em despesa/receita e esconde parcelas/recorrente. */
  mode?: TransactionFormMode
  /** Valores iniciais (edição). Mesclados sobre os defaults. */
  initial?: Partial<TransactionFormData>
}

export default function TransactionForm({
  categories, subcategories, contas, cartoes, onSubmit, onCancel, mode = "create", initial,
}: Props) {
  const isEdit = mode === "edit"
  const [form, setForm] = useState<TransactionFormData>({
    natureza: "despesa",
    modo: "unico",
    tipo: 1,
    meioPagamento: 4,
    categoriaId: "",
    subcategoriaId: "",
    contaId: "",
    cartaoCreditoId: "",
    contaOrigemId: "",
    contaDestinoId: "",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    descricao: "",
    parcelas: 1,
    frequencia: 2,
    dataFim: "",
    ...initial,
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Limpa erros assim que o usuário mexe em qualquer campo.
  useEffect(() => { setErrors((e) => (Object.keys(e).length ? {} : e)) }, [form])

  const isTransferencia = form.natureza === "transferencia"
  // Crédito por meio de pagamento OU por vínculo direto com cartão (edição de
  // transação antiga sem meioPagamento setado mas com cartaoCreditoId).
  const isCredito = !isTransferencia && (form.meioPagamento === 3 || !!form.cartaoCreditoId)
  const isRecorrente = !isTransferencia && form.modo === "recorrente"
  const cartoesDisponiveis = cartoes.filter((c) => c.temCredito)
  const today = new Date().toISOString().split("T")[0]
  // Conta/transferência não aceitam data futura; crédito e recorrente (início) sim.
  const dateMax = isCredito || isRecorrente ? undefined : today

  // Receita não usa cartão de crédito — cai sempre em conta.
  const meiosDisponiveis = form.natureza === "receita"
    ? MEIOS_PAGAMENTO.filter((m) => m.value !== "3")
    : MEIOS_PAGAMENTO

  const contaOptions = contas.map((c) => ({
    value: c.id, label: c.bancoNome ? `${c.nome} — ${c.bancoNome}` : c.nome,
  }))

  // Categorias filtradas por finalidade (tipo) → grupos pro PontesGroupedSelect.
  const categoriaGroups = useMemo(() => {
    const subsByCat: Record<string, Subcategory[]> = {}
    for (const s of subcategories) (subsByCat[s.categoriaId] ??= []).push(s)
    return categories
      .filter((c) =>
        form.tipo === 1 ? c.finalidade === 1 || c.finalidade === 3
        : form.tipo === 2 ? c.finalidade === 2 || c.finalidade === 3
        : true)
      .map((c) => ({
        value: c.id,
        label: c.descricao,
        items: (subsByCat[c.id] ?? []).map((s) => ({ value: s.id, label: s.nome })),
      }))
  }, [categories, subcategories, form.tipo])

  const set = (field: keyof TransactionFormData, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }))

  const setNatureza = (natureza: TransactionNatureza) =>
    setForm((f) => ({
      ...f,
      natureza,
      tipo: natureza === "receita" ? 2 : 1,
      // receita não usa crédito → reseta meio se estava em crédito
      meioPagamento: natureza === "receita" && f.meioPagamento === 3 ? 4 : f.meioPagamento,
      categoriaId: "",
      subcategoriaId: "",
    }))

  // Parcelado e assinatura são mutuamente exclusivos.
  const setParcelas = (parcelas: number) =>
    setForm((f) => ({ ...f, parcelas, modo: parcelas > 1 ? "unico" : f.modo }))

  const setRecorrente = (on: boolean) =>
    setForm((f) => ({ ...f, modo: on ? "recorrente" : "unico", parcelas: on ? 1 : f.parcelas }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    const valorNum = Number(form.valor.replace(/\./g, "").replace(",", "."))
    if (!valorNum || valorNum <= 0) e.valor = "Informe um valor"

    if (isTransferencia) {
      if (!form.contaOrigemId) e.contaOrigem = "Selecione a conta de origem"
      if (!form.contaDestinoId) e.contaDestino = "Selecione a conta de destino"
      else if (form.contaOrigemId === form.contaDestinoId) e.contaDestino = "Origem e destino devem ser diferentes"
    } else {
      if (!form.categoriaId) e.categoria = "Categoria obrigatória"
      if (isCredito && !form.cartaoCreditoId) e.cartao = "Cartão obrigatório"
      if (!isCredito && !form.contaId) e.conta = "Conta obrigatória"
    }
    if (!form.descricao.trim()) e.descricao = "Informe a descrição"

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await onSubmit(form)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Natureza — cards grandes (lib). Edição não troca pra transferência. */}
      <PontesChoiceCards
        value={form.natureza}
        onChange={(v) => setNatureza(v as TransactionNatureza)}
        options={[
          { value: "despesa", label: "Despesa", icon: <TrendingDown size={17} strokeWidth={2.5} />, tone: "danger" },
          { value: "receita", label: "Receita", icon: <TrendingUp size={17} strokeWidth={2.5} />, tone: "success" },
          ...(isEdit ? [] : [{ value: "transferencia", label: "Transferência", icon: <ArrowLeftRight size={17} strokeWidth={2.5} />, tone: "primary" as const }]),
        ]}
      />

      {/* Valor — destaque (label próprio do componente) */}
      <div className={styles.valorWrap}>
        <PontesMoneyInput value={form.valor} onChange={(v) => set("valor", v)} suggestions={[]} invalid={!!errors.valor} />
        {errors.valor && <div className={styles.valorErro}>{errors.valor}</div>}
      </div>

      {/* ── TRANSFERÊNCIA ────────────────────────────────────────────── */}
      {isTransferencia ? (
        <>
          <div className={styles.grid2}>
            <PontesField label="Conta de origem" required error={errors.contaOrigem}>
              <PontesSelect
                value={form.contaOrigemId}
                onChange={(v) => set("contaOrigemId", v)}
                placeholder="De qual conta"
                invalid={!!errors.contaOrigem}
                options={contaOptions.filter((o) => o.value !== form.contaDestinoId)}
              />
            </PontesField>
            <PontesField label="Conta de destino" required error={errors.contaDestino}>
              <PontesSelect
                value={form.contaDestinoId}
                onChange={(v) => set("contaDestinoId", v)}
                placeholder="Para qual conta"
                invalid={!!errors.contaDestino}
                options={contaOptions.filter((o) => o.value !== form.contaOrigemId)}
              />
            </PontesField>
          </div>
          <PontesField label="Data" required>
            <PontesDateInput value={form.data} max={dateMax} onChange={(v) => set("data", v)} />
          </PontesField>
        </>
      ) : (
        /* ── DESPESA / RECEITA ──────────────────────────────────────── */
        <>
          {/* Data + Meio de pagamento */}
          <div className={styles.grid2}>
            <PontesField label={isRecorrente ? "Início" : "Data"} required>
              <PontesDateInput value={form.data} max={dateMax} onChange={(v) => set("data", v)} />
            </PontesField>
            <PontesField label="Meio de pagamento">
              <PontesSelect
                value={String(form.meioPagamento)}
                onChange={(v) => setForm((f) => ({ ...f, meioPagamento: Number(v), contaId: "", cartaoCreditoId: "" }))}
                options={meiosDisponiveis}
              />
            </PontesField>
          </div>

          {/* Conta (não-crédito) */}
          {!isCredito && (
            <PontesField label="Conta" required error={errors.conta}>
              <PontesSelect
                value={form.contaId}
                onChange={(v) => set("contaId", v)}
                placeholder="Selecione a conta"
                invalid={!!errors.conta}
                options={contaOptions}
              />
            </PontesField>
          )}

          {/* Cartão (crédito) — parcelas só em lançamento único de criação */}
          {isCredito && (
            (isRecorrente || isEdit) ? (
              <PontesField label="Cartão de crédito" required error={errors.cartao}>
                <PontesSelect
                  value={form.cartaoCreditoId}
                  onChange={(v) => set("cartaoCreditoId", v)}
                  placeholder={cartoesDisponiveis.length === 0 ? "Nenhum cartão" : "Selecione o cartão"}
                  invalid={!!errors.cartao}
                  options={cartoesDisponiveis.map((c) => ({ value: c.id, label: `${c.nome}${c.ultimosDigitos ? ` ****${c.ultimosDigitos}` : ""}` }))}
                />
              </PontesField>
            ) : (
              <div className={styles.grid2}>
                <PontesField label="Cartão de crédito" required error={errors.cartao}>
                  <PontesSelect
                    value={form.cartaoCreditoId}
                    onChange={(v) => set("cartaoCreditoId", v)}
                    placeholder={cartoesDisponiveis.length === 0 ? "Nenhum cartão" : "Selecione o cartão"}
                    invalid={!!errors.cartao}
                    options={cartoesDisponiveis.map((c) => ({ value: c.id, label: `${c.nome}${c.ultimosDigitos ? ` ****${c.ultimosDigitos}` : ""}` }))}
                  />
                </PontesField>
                <PontesField label="Parcelas">
                  <PontesSelect value={String(form.parcelas)} onChange={(v) => setParcelas(Number(v))} options={PARCELAS_OPTS} />
                </PontesField>
              </div>
            )
          )}

          {/* Recorrente — switch + campos (só na criação) */}
          {!isEdit && (
            <>
              <PontesToggle
                checked={isRecorrente}
                onChange={setRecorrente}
                label="Repetir automaticamente (assinatura)"
              />
              {isRecorrente && (
                <div className={styles.grid2}>
                  <PontesField label="Frequência" required>
                    <PontesSelect value={String(form.frequencia)} onChange={(v) => set("frequencia", Number(v))} options={FREQ_OPTS} />
                  </PontesField>
                  <PontesField label="Repetir até (opcional)">
                    <PontesDateInput value={form.dataFim} min={form.data} onChange={(v) => set("dataFim", v)} />
                  </PontesField>
                </div>
              )}
            </>
          )}

          {/* Categoria (picker agrupado cat > subcategoria — lib) */}
          <PontesField label="Categoria" required error={errors.categoria}>
            <PontesGroupedSelect
              groups={categoriaGroups}
              groupValue={form.categoriaId}
              itemValue={form.subcategoriaId}
              onChange={(catId, subId) => setForm((f) => ({ ...f, categoriaId: catId, subcategoriaId: subId }))}
              placeholder="Selecione a categoria"
              emptyLabel="Nenhuma categoria"
              invalid={!!errors.categoria}
            />
          </PontesField>
        </>
      )}

      {/* Descrição (todas as naturezas) */}
      <PontesField label="Descrição" required error={errors.descricao}>
        <PontesInput
          value={form.descricao}
          onChange={(e) => set("descricao", e.target.value)}
          placeholder={isTransferencia ? "Ex: Reserva de emergência" : "Ex: Compra no mercado"}
          invalid={!!errors.descricao}
          maxLength={400}
        />
      </PontesField>

      <div className={styles.actions}>
        <PontesButton type="button" variant="outline" onClick={onCancel}>Cancelar</PontesButton>
        <PontesButton type="submit" variant="primary" loading={loading} disabled={loading}>
          {isEdit ? "Salvar" : isTransferencia ? "Transferir" : isRecorrente ? "Criar recorrente" : "Adicionar"}
        </PontesButton>
      </div>
    </form>
  )
}
