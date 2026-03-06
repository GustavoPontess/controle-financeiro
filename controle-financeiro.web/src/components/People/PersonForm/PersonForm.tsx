import {
  Box,
  TextField,
  Button
} from "@mui/material"

import type { Person } from "../../../types/Person"

interface Props {
  onSubmit: (person: Omit<Person, "id">) => void
  editingPerson?: Person | null
  onCancelEdit?: () => void
}

export default function PersonForm({
  onSubmit,
  editingPerson,
  onCancelEdit
}: Props) {

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {

    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    const nome = formData.get("nome") as string
    const idade = Number(formData.get("idade"))

    onSubmit({ nome, idade })

    e.currentTarget.reset()

  }

  return (

    <Box
      component="form"
      key={editingPerson?.id ?? "new"}
      onSubmit={handleSubmit}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        pt: 2
      }}
    >

      <TextField
        name="nome"
        label="Nome"
        defaultValue={editingPerson?.nome ?? ""}
        size="small"
        fullWidth
        required
        inputProps={{ maxLength: 200 }}
        helperText="Máximo de 200 caracteres"
      />

      <TextField
        name="idade"
        label="Idade"
        type="number"
        defaultValue={editingPerson?.idade ?? ""}
        size="small"
        required
        inputProps={{
          min: 0,
          max: 120
        }}
      />

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 1,
          pt: 1
        }}
      >

        {editingPerson && (

          <Button
            type="button"
            variant="outlined"
            onClick={onCancelEdit}
            sx={{
              backgroundColor: "#ffffff",
              color: "#111827",
              borderColor: "#e5e7eb",
              borderRadius: "7px",
              "&:hover": {
                backgroundColor: "#f3f4f6",
                borderColor: "#d1d5db"
              }
            }}
          >
            Cancelar
          </Button>

        )}

        <Button
          type="submit"
          variant="contained"
          sx={{
            backgroundColor: "#111827",
            "&:hover": {
              backgroundColor: "#1f2937"
            },
            borderRadius: "7px"
          }}
        >
          {editingPerson ? "Atualizar" : "Criar"}
        </Button>

      </Box>

    </Box>

  )

}