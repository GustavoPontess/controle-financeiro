import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { getCategories } from "../../services/categoryService";
import { getPeople } from "../../services/personService";
import { getTransactions } from "../../services/transactionService";

import type { Category } from "../../types/Category";
import type { Person } from "../../types/Person";
import type { Transaction } from "../../types/Transaction";

import TransactionsTable from "../../components/transactions/TransactionsTable/TransactionsTable";
import EmptyState from "../../components/EmptyState/EmptyState";

export default function TransactionsPage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const cats = await getCategories();
      const persons = await getPeople();
      const trans = await getTransactions();

      setCategories(cats);
      setPeople(persons);
      setTransactions(trans);
    };

    loadData();

    const handleTransactionCreated = () => {
      loadData();
    };

    window.addEventListener("transactionCreated", handleTransactionCreated);

    return () => {
      window.removeEventListener(
        "transactionCreated",
        handleTransactionCreated,
      );
    };
  }, []);

  const hasPeople = people.length > 0;
  const hasCategories = categories.length > 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {!hasPeople && (
        <EmptyState
          title="Nenhuma pessoa cadastrada"
          description="Cadastre uma pessoa antes de registrar transações."
          actionLabel="Adicionar Pessoa"
          onAction={() => navigate("/")}
        />
      )}

      {hasPeople && !hasCategories && (
        <EmptyState
          title="Nenhuma categoria cadastrada"
          description="Crie categorias antes de registrar transações."
          actionLabel="Adicionar Categoria"
          onAction={() => navigate("/categories")}
        />
      )}

      {hasPeople && hasCategories && transactions.length === 0 && (
        <EmptyState
          title="Nenhuma transação registrada"
          description="Adicione sua primeira transação para começar a acompanhar o saldo."
        />
      )}

      {hasPeople && hasCategories && transactions.length > 0 && (
        <TransactionsTable
          transactions={transactions}
          people={people}
          categories={categories}
        />
      )}
    </Box>
  );
}
