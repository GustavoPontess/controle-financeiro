import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Select,
  MenuItem,
} from "@mui/material";
import { tokens } from "../../theme/tokens";
import CustomButton from "../../components/CustomButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FilterListIcon from "@mui/icons-material/FilterList";
import TodayIcon from "@mui/icons-material/Today";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import { useNavigate, useOutletContext } from "react-router-dom";

import { getCategories } from "../../services/categoryService";
import { getTransactions } from "../../services/transactionService";
import { getContas } from "../../services/contaService";

import type { Category } from "../../types/Category";
import type { Transaction } from "../../types/Transaction";
import EmptyState from "../../components/EmptyState/EmptyState";
import TransactionTable, { type TransactionRow } from "../../components/transactions/TransactionTable/TransactionTable";

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const RECEITA = 2;

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function SummaryCard({
  title,
  value,
  color,
  icon,
  subtitle,
}: {
  title: string;
  value: string;
  color: string;
  icon: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: tokens.color.border.default, borderRadius: tokens.radius.lg, p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
        <Typography fontSize={tokens.typography.fontSize.sm} fontWeight={tokens.typography.fontWeight.bold} color={tokens.color.text.secondary}>
          {title}
        </Typography>
        <Box sx={{
          width: 36, height: 36, borderRadius: tokens.radius.md,
          bgcolor: `${color}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color,
        }}>
          {icon}
        </Box>
      </Box>
      <Typography fontSize={tokens.typography.fontSize.xl} fontWeight={tokens.typography.fontWeight.bold} color={tokens.color.text.primary}>
        {value}
      </Typography>
      {subtitle && (
        <Typography fontSize={tokens.typography.fontSize.xs} color={tokens.color.text.secondary} mt={0.5}>
          {subtitle}
        </Typography>
      )}
    </Paper>
  );
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { notify } = useOutletContext<OutletContextType>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [saldoTotal, setSaldoTotal] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterCategoryId, setFilterCategoryId] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [cats, trans, contas] = await Promise.all([
        getCategories(),
        getTransactions(),
        getContas(),
      ]);
      setCategories(cats);
      setTransactions(trans);
      setSaldoTotal(contas.reduce((sum, c) => sum + (c.saldoAtual ?? 0), 0));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      notify({ open: true, message: "Erro ao carregar transações", severity: "error" });
    }
  }, [notify]);

  useEffect(() => {
    void loadData();
    const handler = () => { void loadData(); };
    window.addEventListener("transactionCreated", handler);
    return () => window.removeEventListener("transactionCreated", handler);
  }, [loadData]);

  const prevMonth = () =>
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  const nextMonth = () =>
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1));

  const monthLabel = currentDate
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(" de ", " De ");

  const filtered = transactions.filter((t) => {
    const tDate = new Date(t.data);
    if (tDate.getFullYear() !== currentDate.getFullYear()) return false;
    if (tDate.getMonth() !== currentDate.getMonth()) return false;
    if (filterCategoryId && t.categoriaId !== filterCategoryId) return false;
    return true;
  });

  const totalEntradas = filtered
    .filter((t) => t.tipo === RECEITA)
    .reduce((sum, t) => sum + t.valor, 0);
  const totalSaidas = filtered
    .filter((t) => t.tipo !== RECEITA)
    .reduce((sum, t) => sum + t.valor, 0);
  const saldoFinal = filtered
    .filter((t) => !t.usadoComoCredito)
    .reduce((sum, t) => sum + (t.tipo === RECEITA ? t.valor : -t.valor), 0);

  const hasCategories = categories.length > 0;

  if (!hasCategories) {
    return (
      <EmptyState
        title="Nenhuma categoria cadastrada"
        description="Crie categorias antes de registrar transações."
        actionLabel="Adicionar Categoria"
        onAction={() => navigate("/categories")}
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Month navigation */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton
            onClick={prevMonth}
            sx={{
              width: 32, height: 32,
              border: 1.5, borderColor: tokens.color.border.default,
              borderRadius: tokens.radius.md,
              color: tokens.color.text.primary,
              "&:hover": { bgcolor: tokens.color.background.hover },
            }}
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography fontWeight={tokens.typography.fontWeight.bold} fontSize={19} letterSpacing="0.04em" sx={{ minWidth: 200, textAlign: "center" }}>
            {monthLabel}
          </Typography>
          <IconButton
            onClick={nextMonth}
            sx={{
              width: 32, height: 32,
              border: 1.5, borderColor: tokens.color.border.default,
              borderRadius: tokens.radius.md,
              color: tokens.color.text.primary,
              "&:hover": { bgcolor: tokens.color.background.hover },
            }}
          >
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <CustomButton
            variant="secondary"
            size="small"
            startIcon={<TodayIcon fontSize="small" />}
            onClick={() => setCurrentDate(new Date())}
          >
            Hoje
          </CustomButton>
          <CustomButton
            variant="secondary"
            size="small"
            startIcon={<FilterListIcon fontSize="small" />}
          >
            Filtros
          </CustomButton>
        </Box>
      </Box>

      {/* Summary cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
        <SummaryCard
          title="Saldo Total"
          value={formatMoney(saldoTotal)}
          color={tokens.color.status.info.main}
          icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 18 }} />}
          subtitle="todas as contas"
        />
        <SummaryCard
          title="Total Entradas"
          value={formatMoney(totalEntradas)}
          color={tokens.color.status.success.main}
          icon={<TrendingUpIcon sx={{ fontSize: 18 }} />}
        />
        <SummaryCard
          title="Total Saídas"
          value={formatMoney(totalSaidas)}
          color={tokens.color.status.error.main}
          icon={<TrendingDownIcon sx={{ fontSize: 18 }} />}
        />
        <SummaryCard
          title="Saldo do Mês"
          value={formatMoney(saldoFinal)}
          color={tokens.color.text.secondary}
          icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 18 }} />}
        />
      </Box>

      {/* Filter dropdowns */}
      <Box sx={{ display: "flex", gap: 2 }}>
        <Select
          displayEmpty
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          size="small"
          sx={{ minWidth: 180, borderRadius: tokens.radius.md, fontSize: tokens.typography.fontSize.sm }}
        >
          <MenuItem value="">Categoria</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.descricao}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Transactions table */}
      <Paper elevation={0} sx={{ border: 1, borderColor: tokens.color.border.default, borderRadius: tokens.radius.lg, overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: tokens.color.border.default }}>
          <Typography fontSize={15} fontWeight={tokens.typography.fontWeight.bold} color={tokens.color.text.primary}>Todas as Transações</Typography>
        </Box>
        <TransactionTable
          rows={filtered.map((t: Transaction): TransactionRow => ({
            id: t.id,
            descricao: t.descricao,
            valor: t.valor,
            tipo: t.tipo,
            data: t.data,
            categoriaId: t.categoriaId ?? undefined,
            subcategoriaId: t.subcategoriaId ?? undefined,
            categoriaDescricao: categories.find(c => c.id === t.categoriaId)?.descricao,
            contaId: t.contaId,
            cartaoCreditoId: t.cartaoCreditoId,
            contaNome: t.contaNome ?? t.cartaoCreditoNome,
            meioPagamento: t.meioPagamento,
            meioPagamentoDescricao: t.meioPagamentoDescricao,
          }))}
          onRefresh={loadData}
          notify={notify}
          emptyMessage="Nenhuma transação neste período"
        />
      </Paper>
    </Box>
  );
}
