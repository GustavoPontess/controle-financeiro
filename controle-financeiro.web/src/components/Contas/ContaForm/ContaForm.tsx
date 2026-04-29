import { useState } from "react"
import { Box, Typography, TextField, Select, MenuItem, Alert } from "@mui/material"
import CustomButton from "../../CustomButton"
import type { Conta } from "../../../types/Conta"
import type { Banco } from "../../../types/Banco"

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
  { value: 3, label: "Cartão de Crédito" },
  { value: 4, label: "Dinheiro" },
  { value: 5, label: "Empréstimo" },
]

const TIPOS_CARTAO = [
  { value: 1, label: "Crédito" },
  { value: 2, label: "Débito" },
  { value: 3, label: "Pré-Pago" },
]

interface Props {
  bancos: Banco[]
  preSelectedBancoId?: string
  onSubmit: (conta: Omit<Conta, "id" | "tipoDescricao" | "tipoCartaoDescricao" | "bancoNome">) => void
  editingConta?: Conta | null
  onCancel?: () => void
}

export default function ContaForm({ bancos, preSelectedBancoId, onSubmit, editingConta, onCancel }: Props) {
  const [tipo, setTipo] = useState(editingConta?.tipo ?? 0)
  const [tipoCartao, setTipoCartao] = useState(editingConta?.tipoCartao ?? 0)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const nome = formData.get("nome") as string
    const saldoInicial = Number(formData.get("saldoInicial"))
    const bancoId = formData.get("bancoId") as string || undefined
    const tipoCartaoValue = tipo === 3 && tipoCartao > 0 ? tipoCartao : undefined
    onSubmit({ nome, tipo, tipoCartao: tipoCartaoValue, saldoInicial, bancoId })
    e.currentTarget.reset()
  }

  const isCartaoCreditoType = tipo === 3
  const isCartaoDebitoOuCredito = isCartaoCreditoType && (tipoCartao === 1 || tipoCartao === 2)

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
          placeholder="Ex: NuConta, Cartão Roxinho"
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
        <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>Tipo</Typography>
        <Select name="tipo" value={tipo} onChange={(e) => { setTipo(Number(e.target.value)); setTipoCartao(0) }} size="small" fullWidth required displayEmpty sx={selectSx}>
          <MenuItem value={0} disabled>Selecione o tipo</MenuItem>
          {TIPOS.map(t => (
            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
          ))}
        </Select>
      </Box>

      {isCartaoCreditoType && (
        <Box>
          <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>Tipo de Cartão</Typography>
          <Select name="tipoCartao" value={tipoCartao} onChange={(e) => setTipoCartao(Number(e.target.value))} size="small" fullWidth required displayEmpty sx={selectSx}>
            <MenuItem value={0} disabled>Selecione o tipo de cartão</MenuItem>
            {TIPOS_CARTAO.map(t => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </Select>
        </Box>
      )}

      {isCartaoDebitoOuCredito && (
        <Alert severity="info" sx={{ fontSize: 12 }}>
          Cartões de crédito e débito devem estar vinculados a uma conta bancária
        </Alert>
      )}

      <Box>
        <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>Saldo Inicial</Typography>
        <TextField
          name="saldoInicial"
          placeholder="0,00"
          type="number"
          defaultValue={editingConta?.saldoInicial ?? 0}
          size="small"
          fullWidth
          inputProps={{ step: "0.01" }}
          helperText="Informe 0 se não souber o saldo atual"
          sx={inputSx}
        />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 0.5 }}>
        <CustomButton type="button" variant="secondary" onClick={onCancel}>Cancelar</CustomButton>
        <CustomButton type="submit" variant="primary">{editingConta ? "Atualizar" : "Adicionar"}</CustomButton>
      </Box>
    </Box>
  )
}
