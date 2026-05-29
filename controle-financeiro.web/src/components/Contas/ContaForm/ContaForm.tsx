import { useState } from "react"
import { PontesButton, PontesField, PontesInput, PontesSelect } from "@/components/pontes"
import type { Conta } from "../../../types/Conta"
import type { Banco } from "../../../types/Banco"
import type { CriarContaPayload } from "../../../services/contaService"
import styles from "./ContaForm.module.css"

type ContaFormData = Omit<Conta, "id" | "tipoDescricao" | "tipoCartaoDescricao" | "bancoNome" | "saldoAtual"> & { saldoInicial?: number }

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
  numeroConta: string
  tipo: string
  saldoInicial?: number
}

type Errors = Partial<Record<"nome" | "tipo", string>>

export default function ContaForm({ bancos, preSelectedBancoId, onSubmit, editingConta, onCancel }: Props) {
  const [form, setForm] = useState<FormState>({
    bancoId: editingConta?.bancoId ?? preSelectedBancoId ?? "",
    nome: editingConta?.nome ?? "",
    numeroConta: editingConta?.numeroConta ?? "",
    tipo: editingConta?.tipo ? String(editingConta.tipo) : "",
    saldoInicial: undefined,
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

    onSubmit({
      nome: form.nome.trim(),
      numeroConta: form.numeroConta.trim() || undefined,
      tipo: Number(form.tipo),
      saldoInicial: !editingConta ? form.saldoInicial ?? 0 : undefined,
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

      <PontesField label="Número da conta" helper="Opcional — usado para exibição">
        <PontesInput
          value={form.numeroConta}
          onChange={(e) => setF("numeroConta", e.target.value)}
          maxLength={50}
          placeholder="Ex: 1234-5"
        />
      </PontesField>

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

      <div className={styles.actions}>
        <PontesButton type="button" variant="outline" onClick={onCancel}>Cancelar</PontesButton>
        <PontesButton type="submit">{editingConta ? "Atualizar" : "Adicionar"}</PontesButton>
      </div>
    </form>
  )
}
