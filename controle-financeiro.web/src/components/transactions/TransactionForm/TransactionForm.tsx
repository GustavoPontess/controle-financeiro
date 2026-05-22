import { useState } from "react"
import { TrendingDown, TrendingUp, ChevronDown } from "lucide-react"
import {
  PontesButton, PontesButtonGroup, PontesField, PontesInput,
  PontesMoneyInput, PontesSelect,
} from "@/components/pontes"
import type { Category } from "../../../types/Category"
import type { Subcategory } from "../../../types/Subcategory"
import type { Conta } from "../../../types/Conta"
import type { CartaoCredito } from "../../../types/CartaoCredito"
import CategoryPicker from "../CategoryPicker/CategoryPicker"
import styles from "./TransactionForm.module.css"

// Meios de pagamento de CONTA (crédito é definido ao escolher um cartão).
const MEIOS_CONTA = [
  { value: "4", label: "Pix" },
  { value: "2", label: "Débito" },
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
  const [showMore, setShowMore] = useState(false)

  const isCredito = !!form.cartaoCreditoId
  const cartoesDisponiveis = cartoes.filter((c) => c.temCredito)

  const set = (field: keyof TransactionFormData, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }))

  // Seletor unificado conta/cartão.
  const pagamentoValue = form.contaId ? `conta:${form.contaId}` : form.cartaoCreditoId ? `cartao:${form.cartaoCreditoId}` : ""
  const pagamentoOptions = [
    ...contas.map((c) => ({ value: `conta:${c.id}`, label: c.bancoNome ? `${c.nome} — ${c.bancoNome}` : c.nome })),
    ...cartoesDisponiveis.map((c) => ({ value: `cartao:${c.id}`, label: `Cartão · ${c.nome}${c.ultimosDigitos ? ` ****${c.ultimosDigitos}` : ""}` })),
  ]
  const onPagamentoChange = (v: string) => {
    const [kind, id] = v.split(":")
    if (kind === "cartao") setForm((f) => ({ ...f, cartaoCreditoId: id, contaId: "", meioPagamento: 3 }))
    else setForm((f) => ({ ...f, contaId: id, cartaoCreditoId: "", meioPagamento: f.meioPagamento === 3 ? 4 : f.meioPagamento, parcelas: 1 }))
  }

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

      {/* Valor — herói (label + input grande próprios do componente) */}
      <PontesMoneyInput value={form.valor} onChange={(v) => set("valor", v)} suggestions={[]} />

      {/* Descrição */}
      <PontesField label="Descrição" required>
        <PontesInput
          value={form.descricao}
          onChange={(e) => set("descricao", e.target.value)}
          placeholder="Ex: Compra no mercado"
          maxLength={400}
        />
      </PontesField>

      {/* Data + Categoria */}
      <div className={styles.grid2}>
        <PontesField label="Data" required>
          <PontesInput type="date" value={form.data} onChange={(e) => set("data", e.target.value)} required />
        </PontesField>
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
      </div>

      {/* Conta ou cartão (unificado) */}
      <PontesField label="Conta ou cartão" required>
        <PontesSelect
          value={pagamentoValue}
          onChange={onPagamentoChange}
          placeholder="De onde saiu / entrou"
          options={pagamentoOptions}
        />
      </PontesField>

      {/* Parcelas — só quando cartão */}
      {isCredito && (
        <PontesField label="Parcelas">
          <PontesSelect value={String(form.parcelas)} onChange={(v) => set("parcelas", Number(v))} options={PARCELAS_OPTS} />
        </PontesField>
      )}

      {/* Mais opções (por ora: meio de pagamento da conta) */}
      {!isCredito && (
        <>
          <button type="button" className={styles.more} onClick={() => setShowMore((s) => !s)}>
            <span className={styles.moreChev} data-open={showMore}><ChevronDown size={15} /></span>
            {showMore ? "Menos opções" : "Mais opções"}
          </button>
          {showMore && (
            <div className={styles.advanced}>
              <PontesField label="Meio de pagamento">
                <PontesSelect value={String(form.meioPagamento)} onChange={(v) => set("meioPagamento", Number(v))} options={MEIOS_CONTA} />
              </PontesField>
              {/* Futuro: marcar pago/previsto, rateio família */}
            </div>
          )}
        </>
      )}

      <div className={styles.actions}>
        <PontesButton type="button" variant="outline" onClick={onCancel}>Cancelar</PontesButton>
        <PontesButton type="submit" variant="primary" loading={loading} disabled={loading}>Adicionar</PontesButton>
      </div>
    </form>
  )
}
