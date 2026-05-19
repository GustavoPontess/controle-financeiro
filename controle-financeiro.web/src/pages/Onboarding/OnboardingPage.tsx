import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Box, Paper, Typography, CircularProgress,
} from "@mui/material"
import { tokens } from "../../theme/tokens"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked"
import CustomButton from "../../components/CustomButton"
import { getOnboardingStatus, concluirOnboarding } from "../../services/onboardingService"
import type { OnboardingStatus } from "../../types/Onboarding"

type Passo = {
  titulo: string
  descricao: string
  rota: string
  done: (s: OnboardingStatus) => boolean
  opcional?: boolean
}

const PASSOS: Passo[] = [
  {
    titulo: "Cadastre sua primeira conta",
    descricao: "Conta corrente, poupança ou carteira — onde seu dinheiro entra e sai.",
    rota: "/accounts",
    done: s => s.temConta,
  },
  {
    titulo: "Adicione um cartão de crédito",
    descricao: "Acompanhe faturas e parcelamentos junto das suas contas.",
    rota: "/credit-cards",
    done: s => s.temCartao,
  },
  {
    titulo: "Registre suas transações",
    descricao: "Importe o extrato do banco ou lance as primeiras transações.",
    rota: "/transactions",
    done: s => s.temTransacao,
  },
  {
    titulo: "Crie uma família (opcional)",
    descricao: "Divida despesas e organize as finanças com quem você divide a vida.",
    rota: "/familias",
    done: s => s.temFamilia,
    opcional: true,
  },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    getOnboardingStatus()
      .then(s => {
        if (s.concluido) {
          navigate("/dashboard", { replace: true })
          return
        }
        setStatus(s)
      })
      .catch(() => setStatus(null))
      .finally(() => setCarregando(false))
  }, [navigate])

  const finalizar = async () => {
    try {
      await concluirOnboarding()
    } finally {
      navigate("/dashboard", { replace: true })
    }
  }

  if (carregando) {
    return <Box sx={{ display: "flex", justifyContent: "center", p: 10 }}><CircularProgress /></Box>
  }

  const obrigatoriosFeitos = status
    ? PASSOS.filter(p => !p.opcional).every(p => p.done(status))
    : false

  return (
    <Box sx={{
      minHeight: "100vh", bgcolor: tokens.color.background.page,
      display: "flex", alignItems: "center", justifyContent: "center", p: 3,
    }}>
      <Paper elevation={0} sx={{
        width: "100%", maxWidth: 560, p: 4,
        border: `1px solid ${tokens.color.border.default}`, borderRadius: tokens.radius.xl,
      }}>
        <Typography fontSize={tokens.typography.fontSize.xl} fontWeight={tokens.typography.fontWeight.bold} color={tokens.color.text.primary}>
          Bem-vindo(a)! Vamos começar
        </Typography>
        <Typography fontSize={tokens.typography.fontSize.sm} color={tokens.color.text.secondary} mt={0.5} mb={3}>
          Alguns passos rápidos para o app ficar útil de verdade.
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {PASSOS.map(passo => {
            const feito = status ? passo.done(status) : false
            return (
              <Box key={passo.rota} sx={{
                display: "flex", alignItems: "center", gap: 1.5,
                p: 2, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.color.border.default}`,
                bgcolor: feito ? tokens.color.status.success.light : tokens.color.background.surface,
              }}>
                {feito
                  ? <CheckCircleIcon sx={{ color: tokens.color.status.success.main }} />
                  : <RadioButtonUncheckedIcon sx={{ color: tokens.color.text.disabled }} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontSize={tokens.typography.fontSize.sm} fontWeight={tokens.typography.fontWeight.bold} color={tokens.color.text.primary}>
                    {passo.titulo}
                    {passo.opcional && (
                      <Typography component="span" fontSize={tokens.typography.fontSize.xs} color={tokens.color.text.disabled}> · opcional</Typography>
                    )}
                  </Typography>
                  <Typography fontSize={tokens.typography.fontSize.xs} color={tokens.color.text.secondary}>{passo.descricao}</Typography>
                </Box>
                {!feito && (
                  <CustomButton size="small" variant="secondary"
                    onClick={() => navigate(passo.rota)}>
                    Fazer agora
                  </CustomButton>
                )}
              </Box>
            )
          })}
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 3 }}>
          <CustomButton variant="secondary" size="small" onClick={finalizar}>
            Pular por agora
          </CustomButton>
          <CustomButton size="small" onClick={finalizar}>
            {obrigatoriosFeitos ? "Ir para o app" : "Concluir mesmo assim"}
          </CustomButton>
        </Box>
      </Paper>
    </Box>
  )
}
