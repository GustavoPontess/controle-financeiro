import { useState } from "react";
import { Box, Typography, TextField, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import CustomButton from "../../CustomButton";
import type { Category } from "../../../types/Category";
import type { Conta } from "../../../types/Conta";
import type { CartaoCredito } from "../../../types/CartaoCredito";

const MEIOS_PAGAMENTO = [
  { value: 4, label: "Pix" },
  { value: 2, label: "Débito" },
  { value: 3, label: "Crédito" },
  { value: 1, label: "Dinheiro" },
  { value: 5, label: "TED / DOC" },
  { value: 6, label: "Boleto" },
]

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

export interface TransactionFormData {
  tipo: number
  meioPagamento: number
  categoriaId: string
  contaId: string
  cartaoCreditoId: string
  valor: string
  data: string
  descricao: string
  parcelas: number   // 1 = à vista; > 1 = parcelado
}

type Props = {
  categories: Category[];
  contas: Conta[];
  cartoes: CartaoCredito[];
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel?: () => void;
};

export default function TransactionForm({ categories, contas, cartoes, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<TransactionFormData>({
    tipo: 1,
    meioPagamento: 4,
    categoriaId: "",
    contaId: "",
    cartaoCreditoId: "",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    descricao: "",
    parcelas: 1,
  });
  const [loading, setLoading] = useState(false);

  const isCredito = form.meioPagamento === 3;

  const filteredCategories = categories.filter((c) => {
    if (form.tipo === 1) return c.finalidade === 1 || c.finalidade === 3;
    if (form.tipo === 2) return c.finalidade === 2 || c.finalidade === 3;
    return true;
  });

  // Para crédito: filtra cartões pela conta selecionada
  const cartoesDisponiveis = cartoes.filter(c =>
    c.temCredito && (form.contaId ? c.contaId === form.contaId : true)
  );

  const set = (field: keyof TransactionFormData, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(form);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

      {/* Tipo */}
      <Field label="Tipo">
        <Select value={form.tipo} size="small" fullWidth sx={selectSx}
          onChange={(e) => set("tipo", Number(e.target.value))}>
          <MenuItem value={1}>Despesa</MenuItem>
          <MenuItem value={2}>Receita</MenuItem>
        </Select>
      </Field>

      {/* Meio de pagamento */}
      <Field label="Meio de Pagamento">
        <Select value={form.meioPagamento} size="small" fullWidth sx={selectSx}
          onChange={(e) => setForm(f => ({
            ...f,
            meioPagamento: Number(e.target.value),
            contaId: "",
            cartaoCreditoId: "",
          }))}>
          {MEIOS_PAGAMENTO.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
        </Select>
      </Field>

      {/* Conta */}
      <Field label={isCredito ? "Conta que paga a fatura" : "Conta"}>
        <FormControl size="small" fullWidth>
          <Select
            value={form.contaId}
            displayEmpty
            required
            sx={selectSx}
            onChange={(e) => setForm(f => ({
              ...f,
              contaId: e.target.value,
              cartaoCreditoId: "",
            }))}
          >
            <MenuItem value="" disabled>Selecione a conta</MenuItem>
            {contas.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nome}{c.bancoNome ? ` — ${c.bancoNome}` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Field>

      {/* Cartão de crédito — só aparece quando meio de pagamento é crédito */}
      {isCredito && (
        <Field label="Cartão de Crédito">
          <FormControl size="small" fullWidth>
            <Select value={form.cartaoCreditoId} displayEmpty required sx={selectSx}
              onChange={(e) => set("cartaoCreditoId", e.target.value)}>
              <MenuItem value="" disabled>
                {form.contaId
                  ? cartoesDisponiveis.length === 0
                    ? "Nenhum cartão nesta conta"
                    : "Selecione o cartão"
                  : "Selecione a conta primeiro"}
              </MenuItem>
              {cartoesDisponiveis.map(c => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nome}{c.ultimosDigitos ? ` ****${c.ultimosDigitos}` : ""} ({c.bandeiraDescricao})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Field>
      )}

      {/* Parcelamento — só disponível para crédito */}
      {isCredito && (
        <Field label="Parcelas">
          <Select value={form.parcelas} size="small" fullWidth sx={selectSx}
            onChange={(e) => set("parcelas", Number(e.target.value))}>
            <MenuItem value={1}>À vista</MenuItem>
            {[2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => (
              <MenuItem key={n} value={n}>{n}x</MenuItem>
            ))}
          </Select>
        </Field>
      )}

      {/* Categoria */}
      <Field label="Categoria">
        <FormControl size="small" fullWidth>
          <Select value={form.categoriaId} displayEmpty required sx={selectSx}
            onChange={(e) => set("categoriaId", e.target.value)}>
            <MenuItem value="" disabled>Selecione a categoria</MenuItem>
            {filteredCategories.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.descricao}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Field>

      {/* Valor */}
      <Field label="Valor">
        <TextField
          placeholder="R$ 0,00"
          type="number"
          size="small"
          fullWidth
          required
          value={form.valor}
          onChange={(e) => set("valor", e.target.value)}
          inputProps={{ step: "0.01", min: "0.01" }}
          sx={inputSx}
        />
      </Field>

      {/* Data */}
      <Field label="Data">
        <TextField
          type="date"
          size="small"
          fullWidth
          required
          value={form.data}
          onChange={(e) => set("data", e.target.value)}
          sx={inputSx}
        />
      </Field>

      {/* Descrição */}
      <Field label="Descrição">
        <TextField
          placeholder="Ex: Supermercado, Salário..."
          size="small"
          fullWidth
          required
          multiline
          minRows={2}
          value={form.descricao}
          onChange={(e) => set("descricao", e.target.value)}
          inputProps={{ maxLength: 400 }}
          sx={inputSx}
        />
      </Field>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 0.5 }}>
        <CustomButton variant="secondary" onClick={onCancel} type="button">
          Cancelar
        </CustomButton>
        <CustomButton type="submit" variant="primary" disabled={loading}>
          {loading ? "Salvando..." : "Adicionar"}
        </CustomButton>
      </Box>
    </Box>
  );
}
