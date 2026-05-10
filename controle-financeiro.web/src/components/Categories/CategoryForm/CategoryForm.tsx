import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Select,
} from "@mui/material";
import CustomButton from "../../CustomButton";
import type { Category } from "../../../types/Category";

const inputSx = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    fontSize: "14px",
    "& fieldset": { borderColor: "#e5e7eb" },
    "&:hover fieldset": { borderColor: "#d1d5db" },
    "&.Mui-focused fieldset": { borderColor: "#111827", borderWidth: "1.5px" },
  },
};

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
    const isPadrao = formData.get("isPadrao") === "on";
    onSubmit({ descricao, finalidade, isPadrao });
    e.currentTarget.reset();
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box>
        <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>
          Descrição
        </Typography>
        <TextField
          name="descricao"
          placeholder="Ex: Alimentação"
          size="small"
          fullWidth
          required
          inputProps={{ maxLength: 400 }}
          helperText="Máximo de 400 caracteres"
          sx={inputSx}
        />
      </Box>

      <Box>
        <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>
          Finalidade
        </Typography>
        <Select
          name="finalidade"
          defaultValue={0}
          required
          size="small"
          fullWidth
          displayEmpty
          sx={{
            ...inputSx["& .MuiOutlinedInput-root"],
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e5e7eb" },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#d1d5db" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#111827", borderWidth: "1.5px" },
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
            fontSize: "14px",
          }}
        >
          <MenuItem value={0} disabled>Selecione a finalidade</MenuItem>
          <MenuItem value={1}>Despesa</MenuItem>
          <MenuItem value={2}>Receita</MenuItem>
          <MenuItem value={3}>Ambas</MenuItem>
        </Select>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <input type="checkbox" name="isPadrao" id="isPadrao" />
        <label htmlFor="isPadrao" style={{ fontSize: "13px", color: "#6b7280", cursor: "pointer" }}>
          Categoria padrão
        </label>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 1 }}>
        <CustomButton type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </CustomButton>
        <CustomButton type="submit" variant="primary">
          Criar
        </CustomButton>
      </Box>
    </Box>
  );
}
