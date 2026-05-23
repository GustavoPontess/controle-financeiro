import { useState } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import {
  PontesButton, PontesButtonGroup, PontesField, PontesInput, PontesMoneyInput, PontesSelect,
} from "@/components/pontes"
import type { Category } from "../../../types/Category"
import type { Subcategory } from "../../../types/Subcategory"
import type { Conta } from "../../../types/Conta"
import type { CartaoCredito } from "../../../types/CartaoCredito"
import CategoryPicker from "../CategoryPicker/CategoryPicker"
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

export interface TransactionFormData {
  modo: TransactionModo
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
  // recorrente
  frequencia: number
  dia: number
  dataFim: string
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
    modo: "unico",
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
    frequencia: 2,
    dia: new Date().getDate(),
    dataFim: "",
  })
  const [loading, setLoading] = useState(false)

  const isCredito = form.meioPagamento === 3
  const isRecorrente = form.modo === "recorrente"
  const cartoesDisponiveis = cartoes.filter((c) => c.temCredito)

  const set = (field: keyof TransactionFormData, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }))

  const setTipo = (tipo: number) => setForm((f) => ({ ...f, tipo, categoriaId: "", subcategoriaId: "" }))

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
      {/* Tipo — 2 botões grandes */}
      <div className={styles.tipoGrid}>
        <button type="button" className={styles.tipoBtn} data-active={form.tipo === 1} data-kind="despesa" onClick={() => setTipo(1)}>
          <TrendingDown size={17} strokeWidth={2.5} /> Despesa
        </button>
        <button type="button" className={styles.tipoBtn} data-active={form.tipo === 2} data-kind="receita" onClick={() => setTipo(2)}>
          <TrendingUp size={17} strokeWidth={2.5} /> Receita
        </button>
      </div>

      {/* Modo — único ou recorrente (assinatura) */}
      <div className={styles.tipoWrap}>
        <span className={styles.tipoLabel}>Lançamento</span>
        <PontesButtonGroup
          value={form.modo}
          onChange={(v) => set("modo", v as TransactionModo)}
          options={[
            { value: "unico", label: "Único" },
            { value: "recorrente", label: "Recorrente (assinatura)" },
          ]}
        />
      </div>

      {/* Valor — destaque (label próprio do componente) */}
      <PontesMoneyInput value={form.valor} onChange={(v) => set("valor", v)} suggestions={[]} />

      {/* Data + Meio de pagamento */}
      <div className={styles.grid2}>
        <PontesField label={isRecorrente ? "Início" : "Data"} required>
          <PontesInput type="date" value={form.data} onChange={(e) => set("data", e.target.value)} required />
        </PontesField>
        <PontesField label="Meio de pagamento">
          <PontesSelect
            value={String(form.meioPagamento)}
            onChange={(v) => setForm((f) => ({ ...f, meioPagamento: Number(v), contaId: "", cartaoCreditoId: "" }))}
            options={MEIOS_PAGAMENTO}
          />
        </PontesField>
      </div>

      {/* Conta (não-crédito) */}
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

      {/* Cartão (crédito) — parcelas só em lançamento único */}
      {isCredito && (
        isRecorrente ? (
          <PontesField label="Cartão de crédito" required>
            <PontesSelect
              value={form.cartaoCreditoId}
              onChange={(v) => set("cartaoCreditoId", v)}
              placeholder={cartoesDisponiveis.length === 0 ? "Nenhum cartão" : "Selecione o cartão"}
              options={cartoesDisponiveis.map((c) => ({ value: c.id, label: `${c.nome}${c.ultimosDigitos ? ` ****${c.ultimosDigitos}` : ""}` }))}
            />
          </PontesField>
        ) : (
          <div className={styles.grid2}>
            <PontesField label="Cartão de crédito" required>
              <PontesSelect
                value={form.cartaoCreditoId}
                onChange={(v) => set("cartaoCreditoId", v)}
                placeholder={cartoesDisponiveis.length === 0 ? "Nenhum cartão" : "Selecione o cartão"}
                options={cartoesDisponiveis.map((c) => ({ value: c.id, label: `${c.nome}${c.ultimosDigitos ? ` ****${c.ultimosDigitos}` : ""}` }))}
              />
            </PontesField>
            <PontesField label="Parcelas">
              <PontesSelect value={String(form.parcelas)} onChange={(v) => set("parcelas", Number(v))} options={PARCELAS_OPTS} />
            </PontesField>
          </div>
        )
      )}

      {/* Recorrente — frequência + dia + fim */}
      {isRecorrente && (
        <>
          <div className={styles.grid2}>
            <PontesField label="Frequência" required>
              <PontesSelect value={String(form.frequencia)} onChange={(v) => set("frequencia", Number(v))} options={FREQ_OPTS} />
            </PontesField>
            <PontesField label="Dia" required>
              <PontesInput type="number" value={String(form.dia)} onChange={(e) => set("dia", Number(e.target.value))} min={1} max={31} />
            </PontesField>
          </div>
          <PontesField label="Repetir até (opcional)">
            <PontesInput type="date" value={form.dataFim} onChange={(e) => set("dataFim", e.target.value)} />
          </PontesField>
        </>
      )}

      {/* Categoria (picker agrupado cat > subcategoria) */}
      <PontesField label="Categoria" required>
        <CategoryPicker
          categories={categories}
          subcategories={subcategories}
          tipo={form.tipo}
          categoriaId={form.categoriaId}
          subcategoriaId={form.subcategoriaId}
          onChange={(catId, subId) => setForm((f) => ({ ...f, categoriaId: catId, subcategoriaId: subId }))}
        />
      </PontesField>

      {/* Descrição */}
      <PontesField label="Descrição" required>
        <PontesInput
          value={form.descricao}
          onChange={(e) => set("descricao", e.target.value)}
          placeholder="Ex: Compra no mercado"
          maxLength={400}
        />
      </PontesField>

      <div className={styles.actions}>
        <PontesButton type="button" variant="outline" onClick={onCancel}>Cancelar</PontesButton>
        <PontesButton type="submit" variant="primary" loading={loading} disabled={loading}>{isRecorrente ? "Criar recorrente" : "Adicionar"}</PontesButton>
      </div>
    </form>
  )
}
