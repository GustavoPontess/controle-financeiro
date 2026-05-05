import { Dialog, DialogTitle, DialogContent, IconButton, Box } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import ContaForm from "../ContaForm/ContaForm"
import type { ContaFormData } from "../ContaForm/ContaForm"
import { createConta, updateConta } from "../../../services/contaService"
import type { Conta } from "../../../types/Conta"
import type { Banco } from "../../../types/Banco"

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
    } catch {
      notify({ open: true, message: "Erro ao salvar conta", severity: "error" })
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2, fontWeight: 600, fontSize: 16 }}>
          {editingConta ? "Editar Conta" : "Adicionar Conta"}
          <IconButton onClick={onClose} sx={{ width: 24, height: 24, color: "#9ca3af", "&:hover": { backgroundColor: "#f3f4f6", color: "#374151" } }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <ContaForm
          bancos={bancos}
          preSelectedBancoId={preSelectedBancoId}
          onSubmit={handleSubmit}
          editingConta={editingConta}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
