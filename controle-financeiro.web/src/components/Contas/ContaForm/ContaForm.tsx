import { useState } from "react"
import { PontesButton, PontesField, PontesInput, PontesSelect, PontesDateInput } from "@/components/pontes"
import type { Conta } from "../../../types/Conta"
import type { Banco } from "../../../types/Banco"
import type { CriarContaPayload } from "../../../services/contaService"
import { dataLocalISO } from "@/utils/dateTime"
import styles from "./ContaForm.module.css"

type ContaFormData = Omit<Conta, "id" | "tipoDescricao" | "tipoCartaoDescricao" | "bancoNome" | "saldoAtual"> & { saldoInicial?: number; dataSaldoInicial?: string }

const TIPOS = [
  { value: "1", label: "Conta Corrente" },
  { value: "2", label: "Conta Poupança" },
  { value: "4", label: "Dinheiro" },
  { value: "5", label: "Empréstimo" },
]

// Máscara monetária — dígitos → centavos formatados pt-BR, e reverso.
const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
const fmtMoney = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""

// Agência — só dígitos, sem dígito verificador na maioria dos bancos BR.
const maskAgencia = (raw: string): string => raw.replace(/\D/g, "").slice(0, 5)

// Número da conta — dígitos com dígito verificador separado por hífen conforme digita (ex: 91205195-5).
const maskNumeroConta = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 21)
  return digits.length > 1 ? `${digits.slice(0, -1)}-${digits.slice(-1)}` : digits
}

interface Props {
  bancos: Banco[]
  preSelectedBancoId?: string
  onSubmit: (data: ContaFormData) => void
  editingConta?: Conta | null
  onCancel?: () => void
}

export type { ContaFormData, CriarContaPayload }

type FormState = {
  bancoId: string
  nome: string
  agencia: string
  numeroConta: string
  tipo: string
  saldoInicial?: number
  dataSaldoInicial: string
}

type Errors = Partial<Record<"nome" | "tipo", string>>

export default function ContaForm({ bancos, preSelectedBancoId, onSubmit, editingConta, onCancel }: Props) {
  const [form, setForm] = useState<FormState>({
    bancoId: editingConta?.bancoId ?? preSelectedBancoId ?? "",
    nome: editingConta?.nome ?? "",
    agencia: editingConta?.agencia ?? "",
    numeroConta: editingConta?.numeroConta ?? "",
    tipo: editingConta?.tipo ? String(editingConta.tipo) : "",
    saldoInicial: undefined,
    dataSaldoInicial: dataLocalISO(),
  })
  const [errors, setErrors] = useState<Errors>({})

  const clearErr = (k: keyof Errors) => setErrors((p) => ({ ...p, [k]: undefined }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: Errors = {}
    if (!form.nome.trim()) next.nome = "Informe o nome da conta"
    if (!form.tipo) next.tipo = "Selecione o tipo"
    setErrors(next)
    if (Object.keys(next).length) return

    const temSaldoInicial = !editingConta && (form.saldoInicial ?? 0) > 0
    onSubmit({
      nome: form.nome.trim(),
      agencia: form.agencia.trim() || undefined,
      numeroConta: form.numeroConta.trim() || undefined,
      tipo: Number(form.tipo),
      saldoInicial: !editingConta ? form.saldoInicial ?? 0 : undefined,
      dataSaldoInicial: temSaldoInicial ? form.dataSaldoInicial : undefined,
      bancoId: form.bancoId || undefined,
      isCarteira: false,
    })
  }

  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form noValidate onSubmit={handleSubmit} className={styles.form}>
      <PontesField label="Banco / Instituição">
        <PontesSelect
          value={form.bancoId}
          onChange={(v) => setF("bancoId", v)}
          placeholder="Sem vínculo"
          options={bancos.map((b) => ({ value: b.id, label: b.nome }))}
        />
      </PontesField>

      <PontesField label="Nome da conta" required error={errors.nome} helper="Máximo 100 caracteres">
        <PontesInput
          value={form.nome}
          onChange={(e) => { setF("nome", e.target.value); clearErr("nome") }}
          invalid={!!errors.nome}
          maxLength={100}
          placeholder="Ex: NuConta, Conta Corrente BB"
          autoFocus
        />
      </PontesField>

      <div className={styles.row2}>
        <PontesField label="Agência" helper="Opcional — só números">
          <PontesInput
            value={form.agencia}
            onChange={(e) => setF("agencia", maskAgencia(e.target.value))}
            inputMode="numeric"
            placeholder="Ex: 0001"
          />
        </PontesField>

        <PontesField label="Número da conta" helper="Opcional — usado para exibição">
          <PontesInput
            value={form.numeroConta}
            onChange={(e) => setF("numeroConta", maskNumeroConta(e.target.value))}
            inputMode="numeric"
            placeholder="Ex: 91205195-5"
          />
        </PontesField>
      </div>

      <PontesField label="Tipo" required error={errors.tipo}>
        <PontesSelect
          value={form.tipo}
          onChange={(v) => { setF("tipo", v); clearErr("tipo") }}
          invalid={!!errors.tipo}
          placeholder="Selecione o tipo"
          options={TIPOS}
        />
      </PontesField>

      {!editingConta && (
        <PontesField label="Saldo inicial" helper="Informe 0 se não souber o saldo atual">
          <PontesInput
            iconStart="R$"
            value={fmtMoney(form.saldoInicial)}
            onChange={(e) => setF("saldoInicial", parseMoney(e.target.value))}
            inputMode="decimal"
            placeholder="0,00"
          />
        </PontesField>
      )}

      {!editingConta && (form.saldoInicial ?? 0) > 0 && (
        <PontesField label="Saldo inicial desde" helper="Ponto de partida da conta — pode ser retroativo. A conferência começa daqui.">
          <PontesDateInput
            value={form.dataSaldoInicial}
            onChange={(v) => setF("dataSaldoInicial", v)}
            max={dataLocalISO()}
          />
        </PontesField>
      )}

      <div className={styles.actions}>
        <PontesButton type="button" variant="outline" onClick={onCancel}>Cancelar</PontesButton>
        <PontesButton type="submit">{editingConta ? "Atualizar" : "Adicionar"}</PontesButton>
      </div>
    </form>
  )
}
