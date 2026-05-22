import { useState } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import {
  PontesButton, PontesButtonGroup, PontesField, PontesInput,
  PontesMoneyInput, PontesSelect, PontesTextarea,
} from "@/components/pontes"
import type { Category } from "../../../types/Category"
import type { Subcategory } from "../../../types/Subcategory"
import type { Conta } from "../../../types/Conta"
import type { CartaoCredito } from "../../../types/CartaoCredito"
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

export interface TransactionFormData {
  tipo: number
  meioPagamento: number
  categoriaId: string
  subcategoriaId: string
  contaId: string
  cartaoCreditoId: string
  valor: string
  data: string
  descricao: string
  parcelas: number
}

type Props = {
  categories: Category[]
  subcategories: Subcategory[]
  contas: Conta[]
  cartoes: CartaoCredito[]
  onSubmit: (data: TransactionFormData) => Promise<void>
  onCancel?: () => void
}

export default function TransactionForm({ categories, subcategories, contas, cartoes, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<TransactionFormData>({
    tipo: 1,
    meioPagamento: 4,
    categoriaId: "",
    subcategoriaId: "",
    contaId: "",
    cartaoCreditoId: "",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    descricao: "",
    parcelas: 1,
  })
  const [loading, setLoading] = useState(false)

  const isCredito = form.meioPagamento === 3

  const filteredCategories = categories.filter((c) => {
    if (form.tipo === 1) return c.finalidade === 1 || c.finalidade === 3
    if (form.tipo === 2) return c.finalidade === 2 || c.finalidade === 3
    return true
  })
  const filteredSubcategories = subcategories.filter((s) => s.categoriaId === form.categoriaId)
  const cartoesDisponiveis = cartoes.filter((c) => c.temCredito)

  const set = (field: keyof TransactionFormData, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(form)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Tipo */}
      <div className={styles.tipoWrap}>
        <span className={styles.tipoLabel}>Tipo</span>
        <PontesButtonGroup
          value={String(form.tipo)}
          onChange={(v) => setForm((f) => ({ ...f, tipo: Number(v), categoriaId: "", subcategoriaId: "" }))}
          options={[
            { value: "1", label: <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><TrendingDown size={15} strokeWidth={2.5} /> Despesa</span> },
            { value: "2", label: <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><TrendingUp size={15} strokeWidth={2.5} /> Receita</span> },
          ]}
        />
      </div>

      <div className={styles.grid2}>
        <PontesField label="Valor" required>
          <PontesMoneyInput value={form.valor} onChange={(v) => set("valor", v)} />
        </PontesField>
        <PontesField label="Data" required>
          <PontesInput type="date" value={form.data} onChange={(e) => set("data", e.target.value)} required />
        </PontesField>
      </div>

      <PontesField label="Meio de pagamento">
        <PontesSelect
          value={String(form.meioPagamento)}
          onChange={(v) => setForm((f) => ({ ...f, meioPagamento: Number(v), contaId: "", cartaoCreditoId: "" }))}
          options={MEIOS_PAGAMENTO}
        />
      </PontesField>

      {!isCredito && (
        <PontesField label="Conta" required>
          <PontesSelect
            value={form.contaId}
            onChange={(v) => set("contaId", v)}
            placeholder="Selecione a conta"
            options={contas.map((c) => ({ value: c.id, label: c.bancoNome ? `${c.nome} — ${c.bancoNome}` : c.nome }))}
          />
        </PontesField>
      )}

      {isCredito && (
        <PontesField label="Cartão de crédito" required>
          <PontesSelect
            value={form.cartaoCreditoId}
            onChange={(v) => set("cartaoCreditoId", v)}
            placeholder={cartoesDisponiveis.length === 0 ? "Nenhum cartão disponível" : "Selecione o cartão"}
            options={cartoesDisponiveis.map((c) => ({
              value: c.id,
              label: `${c.nome}${c.ultimosDigitos ? ` ****${c.ultimosDigitos}` : ""}${c.bandeiraDescricao ? ` (${c.bandeiraDescricao})` : ""}`,
            }))}
          />
        </PontesField>
      )}

      {isCredito && (
        <PontesField label="Parcelas">
          <PontesSelect
            value={String(form.parcelas)}
            onChange={(v) => set("parcelas", Number(v))}
            options={PARCELAS_OPTS}
          />
        </PontesField>
      )}

      <PontesField label="Categoria" required>
        <PontesSelect
          value={form.categoriaId}
          onChange={(v) => setForm((f) => ({ ...f, categoriaId: v, subcategoriaId: "" }))}
          placeholder="Selecione a categoria"
          options={filteredCategories.map((c) => ({ value: c.id, label: c.descricao }))}
        />
      </PontesField>

      {form.categoriaId && filteredSubcategories.length > 0 && (
        <PontesField label="Subcategoria">
          <PontesSelect
            value={form.subcategoriaId}
            onChange={(v) => set("subcategoriaId", v)}
            placeholder="Opcional"
            options={filteredSubcategories.map((s) => ({ value: s.id, label: s.nome }))}
          />
        </PontesField>
      )}

      <PontesField label="Descrição" required>
        <PontesTextarea
          value={form.descricao}
          onChange={(e) => set("descricao", e.target.value)}
          placeholder="Ex: Supermercado, Salário..."
          rows={2}
          maxLength={400}
        />
      </PontesField>

      <div className={styles.actions}>
        <PontesButton type="button" variant="outline" onClick={onCancel}>Cancelar</PontesButton>
        <PontesButton type="submit" variant="primary" loading={loading} disabled={loading}>Adicionar</PontesButton>
      </div>
    </form>
  )
}
