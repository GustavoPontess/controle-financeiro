import { useState } from "react";
import {
  Box, Typography, TextField, Select, MenuItem, FormControl,
  ToggleButtonGroup, ToggleButton, InputAdornment,
} from "@mui/material";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CustomButton from "../../CustomButton";
import type { Category } from "../../../types/Category";
import type { Conta } from "../../../types/Conta";
import type { CartaoCredito } from "../../../types/CartaoCredito";
import { tokens } from "../../../theme/tokens";

const MEIOS_PAGAMENTO = [
  { value: 4, label: "Pix" },
  { value: 2, label: "Débito" },
  { value: 3, label: "Crédito" },
  { value: 1, label: "Dinheiro" },
  { value: 5, label: "TED / DOC" },
  { value: 6, label: "Boleto" },
];

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: tokens.radius.md,
    fontSize: tokens.typography.fontSize.sm,
    backgroundColor: tokens.color.background.surface,
    "& fieldset": { borderColor: tokens.color.border.default },
    "&:hover fieldset": { borderColor: tokens.color.border.strong },
    "&.Mui-focused fieldset": { borderColor: tokens.color.brand.primary },
  },
};

const selectSx = {
  borderRadius: tokens.radius.md,
  fontSize: tokens.typography.fontSize.sm,
  backgroundColor: tokens.color.background.surface,
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      fontSize={tokens.typography.fontSize.xs}
      fontWeight={tokens.typography.fontWeight.medium}
      color={tokens.color.text.secondary}
      mb={0.5}
      sx={{ textTransform: "uppercase", letterSpacing: "0.04em" }}
    >
      {children}
    </Typography>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </Box>
  );
}

export interface TransactionFormData {
  tipo: number;
  meioPagamento: number;
  categoriaId: string;
  contaId: string;
  cartaoCreditoId: string;
  valor: string;
  data: string;
  descricao: string;
  parcelas: number;
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
  const isDespesa = form.tipo === 1;

  const filteredCategories = categories.filter((c) => {
    if (form.tipo === 1) return c.finalidade === 1 || c.finalidade === 3;
    if (form.tipo === 2) return c.finalidade === 2 || c.finalidade === 3;
    return true;
  });

  const cartoesDisponiveis = cartoes.filter((c) => c.temCredito);

  const set = (field: keyof TransactionFormData, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }));

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
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>

      {/* Tipo — toggle visual */}
      <Box>
        <FieldLabel>Tipo</FieldLabel>
        <ToggleButtonGroup
          value={form.tipo}
          exclusive
          fullWidth
          size="small"
          onChange={(_, val) => {
            if (val !== null) setForm((f) => ({ ...f, tipo: val, categoriaId: "" }));
          }}
          sx={{
            "& .MuiToggleButtonGroup-grouped": {
              border: `1px solid ${tokens.color.border.default} !important`,
              borderRadius: `${tokens.radius.md} !important`,
              mx: 0.25,
              fontWeight: tokens.typography.fontWeight.medium,
              fontSize: tokens.typography.fontSize.sm,
              textTransform: "none",
              transition: tokens.transition.fast,
              color: tokens.color.text.secondary,
            },
            "& .MuiToggleButton-root.Mui-selected": {
              backgroundColor: isDespesa
                ? tokens.color.status.error.light
                : tokens.color.status.success.light,
              color: isDespesa
                ? tokens.color.status.error.dark
                : tokens.color.status.success.dark,
              borderColor: isDespesa
                ? `${tokens.color.status.error.main} !important`
                : `${tokens.color.status.success.main} !important`,
              "&:hover": {
                backgroundColor: isDespesa
                  ? tokens.color.status.error.light
                  : tokens.color.status.success.light,
              },
            },
          }}
        >
          <ToggleButton value={1} sx={{ gap: 0.75, py: 1 }}>
            <TrendingDownIcon sx={{ fontSize: 16 }} />
            Despesa
          </ToggleButton>
          <ToggleButton value={2} sx={{ gap: 0.75, py: 1 }}>
            <TrendingUpIcon sx={{ fontSize: 16 }} />
            Receita
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Valor — destaque */}
      <Field label="Valor">
        <TextField
          placeholder="0,00"
          type="number"
          size="small"
          fullWidth
          required
          value={form.valor}
          onChange={(e) => set("valor", e.target.value)}
          inputProps={{ step: "0.01", min: "0.01" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Typography
                  fontSize={tokens.typography.fontSize.sm}
                  fontWeight={tokens.typography.fontWeight.medium}
                  color={
                    isDespesa
                      ? tokens.color.status.error.main
                      : tokens.color.status.success.main
                  }
                >
                  R$
                </Typography>
              </InputAdornment>
            ),
          }}
          sx={{
            ...fieldSx,
            "& input": {
              fontWeight: tokens.typography.fontWeight.bold,
              fontSize: tokens.typography.fontSize.base,
            },
          }}
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
          sx={fieldSx}
        />
      </Field>

      {/* Meio de pagamento */}
      <Field label="Meio de Pagamento">
        <Select
          value={form.meioPagamento}
          size="small"
          fullWidth
          sx={selectSx}
          onChange={(e) =>
            setForm((f) => ({ ...f, meioPagamento: Number(e.target.value), contaId: "", cartaoCreditoId: "" }))
          }
        >
          {MEIOS_PAGAMENTO.map((m) => (
            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
          ))}
        </Select>
      </Field>

      {/* Conta — oculta para crédito (o cartão já carrega a conta vinculada) */}
      {!isCredito && (
        <Field label="Conta">
          <FormControl size="small" fullWidth>
            <Select
              value={form.contaId}
              displayEmpty
              required
              sx={selectSx}
              onChange={(e) => setForm((f) => ({ ...f, contaId: e.target.value }))}
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
      )}

      {/* Cartão de crédito */}
      {isCredito && (
        <Field label="Cartão de Crédito">
          <FormControl size="small" fullWidth>
            <Select
              value={form.cartaoCreditoId}
              displayEmpty
              required
              sx={selectSx}
              onChange={(e) => set("cartaoCreditoId", e.target.value)}
            >
              <MenuItem value="" disabled>
                {cartoesDisponiveis.length === 0 ? "Nenhum cartão disponível" : "Selecione o cartão"}
              </MenuItem>
              {cartoesDisponiveis.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nome}{c.ultimosDigitos ? ` ****${c.ultimosDigitos}` : ""} ({c.bandeiraDescricao})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Field>
      )}

      {/* Parcelamento */}
      {isCredito && (
        <Field label="Parcelas">
          <Select
            value={form.parcelas}
            size="small"
            fullWidth
            sx={selectSx}
            onChange={(e) => set("parcelas", Number(e.target.value))}
          >
            <MenuItem value={1}>À vista</MenuItem>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
              <MenuItem key={n} value={n}>{n}x</MenuItem>
            ))}
          </Select>
        </Field>
      )}

      {/* Categoria */}
      <Field label="Categoria">
        <FormControl size="small" fullWidth>
          <Select
            value={form.categoriaId}
            displayEmpty
            required
            sx={selectSx}
            onChange={(e) => set("categoriaId", e.target.value)}
          >
            <MenuItem value="" disabled>Selecione a categoria</MenuItem>
            {filteredCategories.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.descricao}</MenuItem>
            ))}
          </Select>
        </FormControl>
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
          sx={fieldSx}
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
