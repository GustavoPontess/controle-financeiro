import { useEffect, useMemo, useState } from "react"
import { Box, Typography, Paper, Chip } from "@mui/material"
import { useOutletContext } from "react-router-dom"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet"
import CustomButton from "../../components/CustomButton"
import NewContaDialog from "../../components/Contas/NewContaDialog/NewContaDialog"
import EmptyState from "../../components/EmptyState/EmptyState"
import { getContas, deleteConta } from "../../services/contaService"
import { getBancos } from "../../services/bancoService"
import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"
import type { Dispatch, SetStateAction } from "react"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const tipoContaColor: Record<number, { bg: string; color: string }> = {
  1: { bg: "#dbeafe", color: "#1d4ed8" },
  2: { bg: "#dcfce7", color: "#15803d" },
  3: { bg: "#ede9fe", color: "#7c3aed" },
  5: { bg: "#ffedd5", color: "#c2410c" },
}

type Notification = {
  open: boolean
  message: string
  severity: "success" | "error"
}

type OutletContextType = {
  notify: Dispatch<SetStateAction<Notification>>
}

const getContaBalance = (conta: Conta) => conta.saldoAtual ?? 0

export default function AccountsPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [contas, setContas] = useState<Conta[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])

  const [openContaDialog, setOpenContaDialog] = useState(false)
  const [editingConta, setEditingConta] = useState<Conta | null>(null)

  const loadData = async () => {
    try {
      const [cs, bs] = await Promise.all([getContas(), getBancos()])
      setContas(cs)
      setBancos(bs)
    } catch (error) {
      console.error("Erro ao carregar contas:", error)
      notify({ open: true, message: "Erro ao carregar contas", severity: "error" })
    }
  }

  useEffect(() => {
    (async () => {
      await loadData()
    })()
  }, [])

  const handleDeleteConta = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta conta?")) return
    try {
      await deleteConta(id)
      notify({ open: true, message: "Conta removida com sucesso", severity: "success" })
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao remover conta", severity: "error" })
    }
  }

  const carteira = contas.find(conta => conta.isCarteira)
  const contasBancarias = contas.filter(conta => !conta.isCarteira)

  const totalSaldo = useMemo(() => contas.reduce((sum, conta) => sum + getContaBalance(conta), 0), [contas])
  const totalContas = contasBancarias.length
  const totalCarteira = carteira ? getContaBalance(carteira) : 0

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography fontSize={22} fontWeight={800} color="text.primary">Contas</Typography>
          <Typography fontSize={13} color="text.secondary">Cartões, contas correntes e a carteira automática do sistema.</Typography>
        </Box>
        <CustomButton
          size="small"
          startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={() => { setEditingConta(null); setOpenContaDialog(true) }}
        >
          Nova Conta
        </CustomButton>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2.2, border: 1, borderColor: "divider", borderRadius: "16px" }}>
          <Typography fontSize={12} color="text.secondary" mb={0.5}>Saldo Total</Typography>
          <Typography fontSize={28} fontWeight={800} color="#15803d">{formatMoney(totalSaldo)}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.2, border: 1, borderColor: "divider", borderRadius: "16px" }}>
          <Typography fontSize={12} color="text.secondary" mb={0.5}>Contas Bancárias</Typography>
          <Typography fontSize={28} fontWeight={800} color="text.primary">{totalContas}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.2, border: 1, borderColor: "divider", borderRadius: "16px" }}>
          <Typography fontSize={12} color="text.secondary" mb={0.5}>Carteira Física</Typography>
          <Typography fontSize={28} fontWeight={800} color="text.primary">{formatMoney(totalCarteira)}</Typography>
        </Paper>
      </Box>

      <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #e5e7eb", borderRadius: "18px", background: "linear-gradient(135deg, #0f172a 0%, #111827 55%, #1f2937 100%)", color: "#fff" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 20 }} />
          <Typography fontSize={14} fontWeight={700}>Carteira automática</Typography>
        </Box>
        <Typography fontSize={13} color="#cbd5e1" mb={2}>
          Essa conta é criada automaticamente quando o usuário se cadastra e representa dinheiro em espécie.
        </Typography>
        {carteira ? (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Box>
              <Typography fontSize={18} fontWeight={800}>{carteira.nome}</Typography>
              <Chip
                label="Não aparece como opção de cadastro"
                size="small"
                sx={{ mt: 1, backgroundColor: "rgba(255,255,255,0.12)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.18)" }}
              />
            </Box>
            <Typography fontSize={28} fontWeight={800}>{formatMoney(getContaBalance(carteira))}</Typography>
          </Box>
        ) : (
          <Typography fontSize={13} color="#cbd5e1">Nenhuma carteira encontrada para este usuário.</Typography>
        )}
      </Paper>

      {contasBancarias.length === 0 ? (
        <EmptyState
          title="Nenhuma conta bancária cadastrada"
          description="Crie uma conta corrente, poupança, cartão de crédito ou empréstimo para organizar suas finanças."
          actionLabel="Nova Conta"
          onAction={() => { setEditingConta(null); setOpenContaDialog(true) }}
        />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 2 }}>
          {contasBancarias.map(conta => {
            const banco = bancos.find(b => b.id === conta.bancoId)
            const colors = tipoContaColor[conta.tipo] ?? { bg: "#f3f4f6", color: "#6b7280" }
            return (
              <Box key={conta.id} sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
                <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: "18px", bgcolor: "background.paper" }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box sx={{ width: 42, height: 42, borderRadius: "50%", backgroundColor: banco?.cor || colors.bg, display: "flex", alignItems: "center", justifyContent: "center", color: banco?.cor ? "#fff" : colors.color, fontWeight: 800 }}>
                        {(banco?.nomeFantasia ?? conta.nome).charAt(0).toUpperCase()}
                      </Box>
                      <Box>
                        <Typography fontSize={15} fontWeight={700} color="text.primary">{conta.nome}</Typography>
                        <Typography fontSize={12} color="text.secondary">{banco?.nomeFantasia ?? "Sem banco vinculado"}</Typography>
                      </Box>
                    </Box>
                    <Chip label={conta.tipoDescricao} size="small" sx={{ backgroundColor: colors.bg, color: colors.color, fontWeight: 700 }} />
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
                    <Box>
                      <Typography fontSize={12} color="text.secondary">Saldo atual</Typography>
                      <Typography fontSize={22} fontWeight={800} color="#15803d">{formatMoney(getContaBalance(conta))}</Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography fontSize={12} color="text.secondary">Número</Typography>
                      <Typography fontSize={13} fontWeight={600} color="text.primary">{conta.numeroConta || "—"}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography fontSize={12} color="text.secondary">{conta.isCarteira ? "Carteira física" : "Conta vinculada"}</Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <CustomButton 
                        size="small" 
                        variant="secondary" 
                        disabled={conta.isCarteira}
                        onClick={() => { setEditingConta(conta); setOpenContaDialog(true) }}
                      >
                        Editar
                      </CustomButton>
                      <CustomButton 
                        size="small" 
                        variant="danger" 
                        disabled={conta.isCarteira}
                        onClick={() => handleDeleteConta(conta.id)}
                      >
                        Excluir
                      </CustomButton>
                    </Box>
                  </Box>
                </Paper>
              </Box>
            )
          })}
        </Box>
      )}

      <NewContaDialog
        open={openContaDialog}
        editingConta={editingConta}
        bancos={bancos}
        onClose={() => { setOpenContaDialog(false); setEditingConta(null) }}
        onSaved={loadData}
        notify={notify}
      />
    </Box>
  )
}
