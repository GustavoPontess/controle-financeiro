import { useRef } from "react"
import { Box, Typography, TextField } from "@mui/material"
import CustomButton from "../../CustomButton"
import type { Person } from "../../../types/Person"

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

interface Props {
  onSubmit: (person: Omit<Person, "id" | "idade">) => void
  editingPerson?: Person | null
  onCancelEdit?: () => void
}

export default function PersonForm({ onSubmit, editingPerson, onCancelEdit }: Props) {
  const dateInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const nome = formData.get("nome") as string
    const dataNascimento = formData.get("dataNascimento") as string
    onSubmit({ nome, dataNascimento })
    e.currentTarget.reset()
  }

  const editingBirthDate = editingPerson?.dataNascimento
    ? new Date(editingPerson.dataNascimento).toISOString().split("T")[0]
    : ""

  return (
    <Box
      component="form"
      key={editingPerson?.id ?? "new"}
      onSubmit={handleSubmit}
      sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
    >
      <Box>
        <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>
          Nome
        </Typography>
        <TextField
          name="nome"
          placeholder="Ex: João Silva"
          defaultValue={editingPerson?.nome ?? ""}
          size="small"
          fullWidth
          required
          inputProps={{ maxLength: 200 }}
          helperText="Máximo de 200 caracteres"
          sx={inputSx}
        />
      </Box>

      <Box>
        <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>
          Data de Nascimento
        </Typography>
        <TextField
          name="dataNascimento"
          type="date"
          size="small"
          fullWidth
          required
          defaultValue={editingBirthDate}
          inputRef={dateInputRef}
          onClick={() => dateInputRef.current?.showPicker()}
          sx={{
            ...inputSx,
            "& .MuiOutlinedInput-root": {
              ...inputSx["& .MuiOutlinedInput-root"],
              cursor: "pointer",
              "& input": { cursor: "pointer" },
            },
          }}
        />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 1 }}>
        {editingPerson && (
          <CustomButton type="button" variant="secondary" onClick={onCancelEdit}>
            Cancelar
          </CustomButton>
        )}
        <CustomButton type="submit" variant="primary">
          {editingPerson ? "Atualizar" : "Criar"}
        </CustomButton>
      </Box>
    </Box>
  )
}
