/**
 * ConviteEmprestimoPage — landing pública `/convite/emprestimo/:token`.
 *
 * Deslogado: apresentação curta + CTA criar conta/entrar (canal de aquisição —
 * quem entra por aqui deve virar usuário ativo, não só confirmar 1 empréstimo e sumir).
 * Logado: pré-visualiza o convite (token) e deixa aceitar/recusar.
 *
 * docs/features/emprestimo-compartilhado/spec.md
 */

import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Handshake, ArrowRight, Check, X } from "lucide-react"
import { PontesButton, PontesCard, PontesAlert, PontesLogo } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { useAuth } from "@/hooks/useAuth"
import {
  obterConvitePorToken, aceitarVinculoEmprestimo, recusarVinculoEmprestimo,
} from "@/services/emprestimoService"
import type { EmprestimoConvitePendente } from "@/types/Emprestimo"
import styles from "./ConviteEmprestimoPage.module.css"

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

export default function ConviteEmprestimoPage() {
  const { token } = useParams<{ token: string }>()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [convite, setConvite] = useState<EmprestimoConvitePendente | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [resultado, setResultado] = useState<"aceito" | "recusado" | null>(null)

  useEffect(() => {
    if (!token || authLoading || !isAuthenticated) return
    setLoading(true)
    obterConvitePorToken(token)
      .then(setConvite)
      .catch((err) => setError(errorMessage(err, "Não foi possível abrir este convite")))
      .finally(() => setLoading(false))
  }, [token, authLoading, isAuthenticated])

  const handleAceitar = async () => {
    if (!token) return
    setActing(true)
    try {
      await aceitarVinculoEmprestimo(token)
      setResultado("aceito")
    } catch (err) {
      setError(errorMessage(err, "Erro ao aceitar o convite"))
    } finally {
      setActing(false)
    }
  }

  const handleRecusar = async () => {
    if (!token) return
    setActing(true)
    try {
      await recusarVinculoEmprestimo(token)
      setResultado("recusado")
    } catch (err) {
      setError(errorMessage(err, "Erro ao recusar o convite"))
    } finally {
      setActing(false)
    }
  }

  if (authLoading) {
    return <div className={styles.root} />
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.root}>
        <PontesCard padding={32} radius={20} className={styles.card}>
          <PontesLogo size={32} variant="mark" />
          <div className={styles.iconBadge}><Handshake size={22} /></div>
          <h1 className={styles.title}>Alguém registrou um empréstimo com você</h1>
          <p className={styles.pitch}>
            O Pontes é um app de finanças pessoais e de casal — cada um com sua conta privada,
            compartilhando só o que marcar. Crie sua conta pra ver os detalhes desse empréstimo
            e confirmar (ou recusar) o vínculo.
          </p>
          <div className={styles.ctaRow}>
            <PontesButton onClick={() => navigate("/auth/register")} iconEnd={<ArrowRight size={16} />}>
              Criar conta
            </PontesButton>
            <PontesButton variant="outline" onClick={() => navigate("/auth/login")}>
              Já tenho conta
            </PontesButton>
          </div>
          <p className={styles.hint}>Depois de entrar, o convite aparece automaticamente em Empréstimos.</p>
        </PontesCard>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <PontesCard padding={32} radius={20} className={styles.card}>
        <PontesLogo size={32} variant="mark" />

        {resultado === "aceito" && (
          <>
            <PontesAlert tone="success" title="Vínculo aceito">
              Agora os dois lados enxergam esse empréstimo.
            </PontesAlert>
            <PontesButton onClick={() => navigate("/emprestimos")} iconEnd={<ArrowRight size={16} />}>
              Ir pra Empréstimos
            </PontesButton>
          </>
        )}

        {resultado === "recusado" && (
          <PontesAlert tone="info" title="Convite recusado">
            Nada foi vinculado — o registro continua só de quem criou.
          </PontesAlert>
        )}

        {!resultado && error && (
          <>
            <PontesAlert tone="error" title="Não deu certo">{error}</PontesAlert>
            <PontesButton variant="outline" onClick={() => navigate("/emprestimos")}>
              Ir pra Empréstimos
            </PontesButton>
          </>
        )}

        {!resultado && !error && loading && <p className={styles.hint}>Carregando convite…</p>}

        {!resultado && !error && !loading && convite && (
          <>
            <div className={styles.iconBadge}><Handshake size={22} /></div>
            <h1 className={styles.title}>Convite de empréstimo</h1>
            <p className={styles.pitch}>
              <strong>{convite.credorOuDevedorNome}</strong> registrou "{convite.descricao}" —{" "}
              {convite.tipoDescricao.toLowerCase()}, {formatMoney(convite.valorTotal)}.
            </p>
            <div className={styles.ctaRow}>
              <PontesButton onClick={handleAceitar} loading={acting} disabled={acting} iconStart={<Check size={16} />}>
                Aceitar
              </PontesButton>
              <PontesButton variant="outline" onClick={handleRecusar} disabled={acting} iconStart={<X size={16} />}>
                Recusar
              </PontesButton>
            </div>
          </>
        )}
      </PontesCard>
    </div>
  )
}
