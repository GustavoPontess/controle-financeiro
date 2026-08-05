import { PontesModal } from "@/components/pontes"
import ContaForm from "../ContaForm/ContaForm"
import type { ContaFormData } from "../ContaForm/ContaForm"
import { createConta, updateConta } from "../../../services/contaService"
import type { Conta } from "../../../types/Conta"
import type { Banco } from "../../../types/Banco"

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

type Notification = {
  open: boolean
  message: string
  severity: "success" | "error"
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  notify: React.Dispatch<React.SetStateAction<Notification>>
  bancos: Banco[]
  editingConta?: Conta | null
  preSelectedBancoId?: string
}

export default function NewContaDialog({ open, onClose, onSaved, notify, bancos, editingConta, preSelectedBancoId }: Props) {
  const handleSubmit = async (data: ContaFormData) => {
    try {
      const { saldoInicial, ...contaBase } = data
      if (editingConta) {
        await updateConta(editingConta.id, contaBase)
        notify({ open: true, message: "Conta atualizada com sucesso", severity: "success" })
      } else {
        await createConta({ ...contaBase, saldoInicial })
        notify({ open: true, message: "Conta adicionada com sucesso", severity: "success" })
      }
      await onSaved()
      onClose()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao salvar conta"), severity: "error" })
    }
  }

  return (
    <PontesModal
      open={open}
      onClose={onClose}
      title={editingConta ? "Editar conta" : "Adicionar conta"}
    >
      <ContaForm
        key={editingConta?.id ?? "new"}
        bancos={bancos}
        preSelectedBancoId={preSelectedBancoId}
        onSubmit={handleSubmit}
        editingConta={editingConta}
        onCancel={onClose}
      />
    </PontesModal>
  )
}
