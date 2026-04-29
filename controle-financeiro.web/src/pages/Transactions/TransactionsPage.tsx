import { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Select,
  MenuItem,
  Chip,
} from "@mui/material";
import CustomButton from "../../components/CustomButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FilterListIcon from "@mui/icons-material/FilterList";
import TodayIcon from "@mui/icons-material/Today";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import { useNavigate } from "react-router-dom";

import { getCategories } from "../../services/categoryService";
import { getTransactions } from "../../services/transactionService";

import type { Category } from "../../types/Category";
import type { Transaction } from "../../types/Transaction";

import EmptyState from "../../components/EmptyState/EmptyState";

const RECEITA = 2;

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function SummaryCard({
  title,
  value,
  color,
  icon,
}: {
  title: string;
  value: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", p: 3 }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
        <Typography fontSize={14} fontWeight={600} color="#111827">
          {title}
        </Typography>
        <Box sx={{ color }}>{icon}</Box>
      </Box>
      <Typography fontSize={22} fontWeight={700} color={color}>
        {value}
      </Typography>
    </Paper>
  );
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterCategoryId, setFilterCategoryId] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const [cats, trans] = await Promise.all([
        getCategories(),
        getTransactions(),
      ]);
      setCategories(cats);
      setTransactions(trans);
    };

    loadData();

    window.addEventListener("transactionCreated", loadData);
    return () => window.removeEventListener("transactionCreated", loadData);
  }, []);

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
  const saldoFinal = totalEntradas - totalSaidas;

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
              border: "1.5px solid #e5e7eb",
              borderRadius: "8px",
              color: "#374151",
              "&:hover": { backgroundColor: "#f9fafb", borderColor: "#d1d5db" },
            }}
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography fontWeight={700} fontSize={19} letterSpacing="0.04em" sx={{ minWidth: 200, textAlign: "center" }}>
            {monthLabel}
          </Typography>
          <IconButton
            onClick={nextMonth}
            sx={{
              width: 32, height: 32,
              border: "1.5px solid #e5e7eb",
              borderRadius: "8px",
              color: "#374151",
              "&:hover": { backgroundColor: "#f9fafb", borderColor: "#d1d5db" },
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
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
        <SummaryCard
          title="Total Entradas"
          value={formatMoney(totalEntradas)}
          color="#16a34a"
          icon={<TrendingUpIcon />}
        />
        <SummaryCard
          title="Total Saídas"
          value={formatMoney(totalSaidas)}
          color="#dc2626"
          icon={<TrendingDownIcon />}
        />
        <SummaryCard
          title="Saldo Final"
          value={formatMoney(saldoFinal)}
          color="#2563eb"
          icon={<AccountBalanceWalletOutlinedIcon />}
        />
      </Box>

      {/* Filter dropdowns */}
      <Box sx={{ display: "flex", gap: 2 }}>
        <Select
          displayEmpty
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          size="small"
          sx={{ minWidth: 180, borderRadius: "8px", fontSize: 14 }}
        >
          <MenuItem value="">Categoria</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.descricao}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Transactions list */}
      <Paper
        elevation={0}
        sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}
      >
        <Box
          sx={{
            px: 3,
            py: 2,
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          Todas as Transações
        </Box>

        {filtered.length === 0 ? (
          <Box sx={{ px: 3, py: 6, textAlign: "center", color: "#9ca3af" }}>
            <Typography fontSize={14}>Nenhuma transação encontrada</Typography>
          </Box>
        ) : (
          filtered.map((t: Transaction, i: number) => {
            const isReceita = t.tipo === RECEITA;
            const category = categories.find((c) => c.id === t.categoriaId);

            return (
              <Box
                key={t.id}
                sx={{
                  px: 3,
                  py: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none",
                  "&:hover": { background: "#fafafa" },
                  transition: "background 0.15s",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: isReceita ? "#16a34a" : "#dc2626",
                      flexShrink: 0,
                    }}
                  />
                  <Box>
                    <Typography fontWeight={600} fontSize={14}>
                      {t.descricao}
                    </Typography>
                    <Typography color="text.secondary" fontSize={12}>
                      {new Date(t.data).toLocaleDateString("pt-BR")}
                      {t.categoriaId === null
                        ? ""
                        : category
                        ? ` • ${category.descricao}`
                        : ""}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ textAlign: "right" }}>
                  <Typography
                    fontWeight={600}
                    fontSize={14}
                    color={isReceita ? "#16a34a" : "#dc2626"}
                  >
                    {isReceita ? "+" : ""}
                    {formatMoney(t.valor)}
                  </Typography>
                  <Chip
                    label={isReceita ? "Receita" : "Despesa"}
                    size="small"
                    sx={{
                      fontSize: 11,
                      height: 20,
                      borderRadius: "4px",
                      backgroundColor: "#f3f4f6",
                      color: "#374151",
                    }}
                  />
                </Box>
              </Box>
            );
          })
        )}
      </Paper>
    </Box>
  );
}
