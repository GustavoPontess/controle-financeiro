import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2, Circle } from "lucide-react"
import { PontesButton, PontesLoadingDots } from "@/components/pontes"
import { getOnboardingStatus, concluirOnboarding } from "../../services/onboardingService"
import type { OnboardingStatus } from "../../types/Onboarding"
import styles from "./OnboardingPage.module.css"

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
    done: (s) => s.temConta,
  },
  {
    titulo: "Adicione um cartão de crédito",
    descricao: "Acompanhe faturas e parcelamentos junto das suas contas.",
    rota: "/credit-cards",
    done: (s) => s.temCartao,
  },
  {
    titulo: "Registre suas transações",
    descricao: "Importe o extrato do banco ou lance as primeiras transações.",
    rota: "/transactions",
    done: (s) => s.temTransacao,
  },
  {
    titulo: "Crie uma família (opcional)",
    descricao: "Divida despesas e organize as finanças com quem você divide a vida.",
    rota: "/familias",
    done: (s) => s.temFamilia,
    opcional: true,
  },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    getOnboardingStatus()
      .then((s) => {
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
    return <div className={styles.loading}><PontesLoadingDots /></div>
  }

  const obrigatoriosFeitos = status
    ? PASSOS.filter((p) => !p.opcional).every((p) => p.done(status))
    : false

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Bem-vindo(a)! Vamos começar</h1>
        <p className={styles.subtitle}>Alguns passos rápidos para o app ficar útil de verdade.</p>

        <ul className={styles.steps}>
          {PASSOS.map((passo) => {
            const feito = status ? passo.done(status) : false
            return (
              <li key={passo.rota} className={styles.step} data-done={feito ? "true" : undefined}>
                <span className={styles.stepIcon} data-done={feito ? "true" : undefined}>
                  {feito ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </span>
                <div className={styles.stepMeta}>
                  <span className={styles.stepTitle}>
                    {passo.titulo}
                    {passo.opcional && <span className={styles.stepOpcional}> · opcional</span>}
                  </span>
                  <span className={styles.stepDesc}>{passo.descricao}</span>
                </div>
                {!feito && (
                  <PontesButton size="sm" variant="outline" onClick={() => navigate(passo.rota)}>
                    Fazer agora
                  </PontesButton>
                )}
              </li>
            )
          })}
        </ul>

        <div className={styles.actions}>
          <PontesButton variant="outline" onClick={finalizar}>Pular por agora</PontesButton>
          <PontesButton onClick={finalizar}>
            {obrigatoriosFeitos ? "Ir para o app" : "Concluir mesmo assim"}
          </PontesButton>
        </div>
      </div>
    </div>
  )
}
