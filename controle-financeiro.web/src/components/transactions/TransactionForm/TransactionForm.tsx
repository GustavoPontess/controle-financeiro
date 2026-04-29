import { useRef, useState } from "react";
import { Box, Typography, TextField, Select, MenuItem } from "@mui/material";
import CustomButton from "../../CustomButton";
import type { Category } from "../../../types/Category";
import type { Person } from "../../../types/Person";
import type { Conta } from "../../../types/Conta";

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

const selectSx = {
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  fontSize: "14px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e5e7eb" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#d1d5db" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#111827", borderWidth: "1.5px" },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography fontSize={13} fontWeight={500} color="#111827" mb={0.75}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

type Props = {
  people: Person[];
  categories: Category[];
  contas: Conta[];
  onCreate: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
};

export default function TransactionForm({ people, categories, contas, onCreate, onCancel }: Props) {
  const [tipo, setTipo] = useState(1);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const openDatePicker = () => {
    dateInputRef.current?.showPicker();
  };

  const filteredCategories = categories.filter((c) => {
    if (tipo === 1) return c.finalidade === 1 || c.finalidade === 3;
    if (tipo === 2) return c.finalidade === 2 || c.finalidade === 3;
    return true;
  });

  return (
    <Box component="form" onSubmit={onCreate} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

      <Field label="Conta">
        <Select
          name="contaId"
          defaultValue=""
          size="small"
          fullWidth
          required
          displayEmpty
          sx={selectSx}
        >
          <MenuItem value="" disabled>Selecione a conta</MenuItem>
          {contas.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.bancoNome ? `${c.bancoNome} — ` : ""}{c.nome} ({c.tipoDescricao})
            </MenuItem>
          ))}
        </Select>
      </Field>

      <Field label="Tipo">
        <Select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(Number(e.target.value))}
          size="small"
          fullWidth
          sx={selectSx}
        >
          <MenuItem value={1}>Despesa</MenuItem>
          <MenuItem value={2}>Receita</MenuItem>
        </Select>
      </Field>

      <Field label="Pessoa">
        <Select
          name="pessoaId"
          defaultValue=""
          size="small"
          fullWidth
          required
          displayEmpty
          sx={selectSx}
        >
          <MenuItem value="" disabled>Selecione a pessoa</MenuItem>
          {people.map((p) => (
            <MenuItem key={p.id} value={p.id}>{p.nome}</MenuItem>
          ))}
        </Select>
      </Field>

      <Field label="Categoria">
        <Select
          name="categoriaId"
          defaultValue=""
          size="small"
          fullWidth
          required
          displayEmpty
          sx={selectSx}
        >
          <MenuItem value="" disabled>Selecione a categoria</MenuItem>
          {filteredCategories.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.descricao}</MenuItem>
          ))}
        </Select>
      </Field>

      <Field label="Valor">
        <TextField
          name="valor"
          placeholder="R$ 0,00"
          type="number"
          size="small"
          fullWidth
          required
          inputProps={{ step: "0.01", min: "0.01" }}
          helperText="Informe um valor maior que zero"
          sx={inputSx}
        />
      </Field>

      <Field label="Data">
        <TextField
          name="data"
          type="date"
          size="small"
          fullWidth
          required
          defaultValue={new Date().toISOString().split("T")[0]}
          inputRef={dateInputRef}
          onClick={openDatePicker}
          sx={{
            ...inputSx,
            "& .MuiOutlinedInput-root": {
              ...inputSx["& .MuiOutlinedInput-root"],
              cursor: "pointer",
              "& input": { cursor: "pointer" },
            },
          }}
        />
      </Field>

      <Field label="Descrição">
        <TextField
          name="descricao"
          placeholder="Ex: Supermercado, Salário..."
          size="small"
          fullWidth
          required
          multiline
          minRows={2}
          inputProps={{ maxLength: 400 }}
          helperText="Máximo de 400 caracteres"
          sx={inputSx}
        />
      </Field>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 0.5 }}>
        <CustomButton variant="secondary" onClick={onCancel}>
          Cancelar
        </CustomButton>
        <CustomButton type="submit" variant="primary">
          Adicionar
        </CustomButton>
      </Box>

    </Box>
  );
}
