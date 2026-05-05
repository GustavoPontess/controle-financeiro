import { useState } from "react"
import { Box, Typography, TextField, Select, MenuItem } from "@mui/material"
import CustomButton from "../../CustomButton"
import type { Conta } from "../../../types/Conta"
import type { Banco } from "../../../types/Banco"
import type { CriarContaPayload } from "../../../services/contaService"

type ContaFormData = Omit<Conta, "id" | "tipoDescricao" | "tipoCartaoDescricao" | "bancoNome" | "saldoAtual"> & { saldoInicial?: number }

const inputSx = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    fontSize: "14px",
    "& fieldset": { borderColor: "#e5e7eb" },
    "&:hover fieldset": { borderColor: "#d1d5db" },
    "&.Mui-focused fieldset": { borderColor: "#111827", borderWidth: "1.5px" },
  },
}

const selectSx = {
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  fontSize: "14px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e5e7eb" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#d1d5db" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#111827", borderWidth: "1.5px" },
}

const TIPOS = [
  { value: 1, label: "Conta Corrente" },
  { value: 2, label: "Conta Poupança" },
  { value: 4, label: "Dinheiro" },
  { value: 5, label: "Empréstimo" },
]

interface Props {
  bancos: Banco[]
  preSelectedBancoId?: string
  onSubmit: (data: ContaFormData) => void
  editingConta?: Conta | null
  onCancel?: () => void
}

export type { ContaFormData, CriarContaPayload }

export default function ContaForm({ bancos, preSelectedBancoId, onSubmit, editingConta, onCancel }: Props) {
  const [tipo, setTipo] = useState(editingConta?.tipo ?? 0)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const nome = formData.get("nome") as string
    const numeroConta = (formData.get("numeroConta") as string) || undefined
    const saldoInicial = !editingConta ? Number(formData.get("saldoInicial")) || 0 : undefined
    const bancoId = (formData.get("bancoId") as string) || undefined
    onSubmit({ nome, numeroConta, tipo, saldoInicial, bancoId, isCarteira: false })
    e.currentTarget.reset()
  }

  return (
    <Box component="form" key={editingConta?.id ?? "new"} onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box>
        <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>Banco / Instituição</Typography>
        <Select
          name="bancoId"
          defaultValue={editingConta?.bancoId ?? preSelectedBancoId ?? ""}
          size="small"
          fullWidth
          displayEmpty
          sx={selectSx}
        >
          <MenuItem value="">Sem vínculo</MenuItem>
          {bancos.map(b => (
            <MenuItem key={b.id} value={b.id}>{b.nome}</MenuItem>
          ))}
        </Select>
      </Box>

      <Box>
        <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>Nome da Conta</Typography>
        <TextField
          name="nome"
          placeholder="Ex: NuConta, Conta Corrente BB"
          defaultValue={editingConta?.nome ?? ""}
          size="small"
          fullWidth
          required
          inputProps={{ maxLength: 100 }}
          helperText="Máximo de 100 caracteres"
          sx={inputSx}
        />
      </Box>

      <Box>
        <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>Número da Conta</Typography>
        <TextField
          name="numeroConta"
          placeholder="Ex: 1234-5"
          defaultValue={editingConta?.numeroConta ?? ""}
          size="small"
          fullWidth
          inputProps={{ maxLength: 50 }}
          helperText="Opcional — usado para exibição"
          sx={inputSx}
        />
      </Box>

      <Box>
        <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>Tipo</Typography>
        <Select name="tipo" value={tipo} onChange={(e) => setTipo(Number(e.target.value))} size="small" fullWidth required displayEmpty sx={selectSx}>
          <MenuItem value={0} disabled>Selecione o tipo</MenuItem>
          {TIPOS.map(t => (
            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
          ))}
        </Select>
      </Box>

      {!editingConta && (
        <Box>
          <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>Saldo Inicial</Typography>
          <TextField
            name="saldoInicial"
            placeholder="0,00"
            type="number"
            defaultValue={0}
            size="small"
            fullWidth
            inputProps={{ step: "0.01" }}
            helperText="Informe 0 se não souber o saldo atual"
            sx={inputSx}
          />
        </Box>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 0.5 }}>
        <CustomButton type="button" variant="secondary" onClick={onCancel}>Cancelar</CustomButton>
        <CustomButton type="submit" variant="primary">{editingConta ? "Atualizar" : "Adicionar"}</CustomButton>
      </Box>
    </Box>
  )
}
