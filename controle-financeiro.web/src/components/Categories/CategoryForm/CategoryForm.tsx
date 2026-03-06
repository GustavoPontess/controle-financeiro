import {
  Box,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";

import type { Category } from "../../../types/Category";

interface Props {
  onSubmit: (category: Omit<Category, "id">) => void;
  onCancel?: () => void;
}

export default function CategoryForm({ onSubmit, onCancel }: Props) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const descricao = formData.get("descricao") as string;
    const finalidade = Number(formData.get("finalidade"));

    onSubmit({ descricao, finalidade });

    e.currentTarget.reset();
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        pt: 2,
      }}
    >
      <TextField
        name="descricao"
        label="Descrição"
        size="small"
        fullWidth
        required
        inputProps={{ maxLength: 400 }}
        helperText="Máximo de 400 caracteres"
      />

      <FormControl size="small" fullWidth>
        <InputLabel>Finalidade</InputLabel>

        <Select name="finalidade" label="Finalidade" defaultValue={0} required>
          <MenuItem value={1}>Despesa</MenuItem>
          <MenuItem value={2}>Receita</MenuItem>
          <MenuItem value={3}>Ambas</MenuItem>
        </Select>
      </FormControl>

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 1,
          pt: 1,
        }}
      >
        <Button
          type="button"
          variant="outlined"
          
          onClick={onCancel}
          sx={{
            backgroundColor: "#ffffff",
            color: "#111827",
            borderColor: "#e5e7eb",
            borderRadius: "7px",
            "&:hover": {
              backgroundColor: "#f3f4f6",
              borderColor: "#d1d5db",
            },
          }}
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          variant="contained"
          sx={{
            backgroundColor: "#111827",
            "&:hover": {
              backgroundColor: "#1f2937",
            },
            borderRadius: "7px",
          }}
        >
          Criar
        </Button>
      </Box>
    </Box>
  );
}
