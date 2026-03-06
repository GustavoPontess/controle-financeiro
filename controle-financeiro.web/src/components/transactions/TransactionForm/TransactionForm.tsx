import { useState } from "react";

import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from "@mui/material";

import type { Category } from "../../../types/Category";
import type { Person } from "../../../types/Person";

type Props = {
  people: Person[];
  categories: Category[];
  onCreate: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
};

export default function TransactionForm({
  people,
  categories,
  onCreate,
  onCancel,
}: Props) {
  const [tipo, setTipo] = useState(1);

  const filteredCategories = categories.filter((c) => {
    if (tipo === 1) {
      return c.finalidade === 1 || c.finalidade === 3;
    }

    if (tipo === 2) {
      return c.finalidade === 2 || c.finalidade === 3;
    }

    return true;
  });

  return (
    <Box
      component="form"
      onSubmit={onCreate}
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

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 2,
        }}
      >
        <TextField
          name="valor"
          label="Valor"
          type="number"
          size="small"
          inputProps={{ step: "0.01", min: "0.01" }}
          required
          helperText="Informe um valor maior que zero"
        />

        <FormControl size="small">
          <InputLabel>Tipo</InputLabel>

          <Select
            name="tipo"
            label="Tipo"
            value={tipo}
            onChange={(e) => setTipo(Number(e.target.value))}
          >
            <MenuItem value={1}>Despesa</MenuItem>
            <MenuItem value={2}>Receita</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 2,
        }}
      >
        <FormControl size="small">
          <InputLabel>Pessoa</InputLabel>

          <Select name="pessoaId" label="Pessoa" required>
            {people.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.nome}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small">
          <InputLabel>Categoria</InputLabel>

          <Select name="categoriaId" label="Categoria" required>
            {filteredCategories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.descricao}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 1,
          pt: 1,
        }}
      >
        <Button
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
          Adicionar
        </Button>
      </Box>
    </Box>
  );
}
