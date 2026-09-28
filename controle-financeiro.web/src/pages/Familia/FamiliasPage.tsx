import { useCallback, useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { formatMoney } from "@/utils/money"
import { Users, Heart, ChevronRight } from "lucide-react"
import {
  PontesButton, PontesBadge, PontesCard, PontesModal, PontesField, PontesInput,
  PontesEmptyState, PontesLoadingDots,
} from "@/components/pontes"
import {
  getFamilias, getFamilia, getBalancoFamilia, criarFamilia,
  getConvitesPendentes, aceitarConvite, recusarConvite,
} from "../../services/familiaService"
import type { Familia, ConviteFamilia, MembroFamilia, ModoRateio } from "../../types/Familia"
import { useAuth } from "../../hooks/useAuth"
import styles from "./FamiliasPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

// Card enriquecido com um resumo da família (buscado por cima da lista).
type FamiliaCard = Familia & {
  membros: MembroFamilia[]
  modoRateio: ModoRateio
  papelUsuario: string | null
  meuSaldo: number | null
  totalMes: number
}

const MODO_RATEIO_LABEL: Record<ModoRateio, string> = {
  1: "Igualitário",
  2: "Proporcional à renda",
  3: "Personalizado",
}

const firstName = (nome: string) => nome.trim().split(/\s+/)[0]
const initials = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("")

export default function FamiliasPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [familias, setFamilias] = useState<FamiliaCard[]>([])
  const [convitesPendentes, setConvitesPendentes] = useState<ConviteFamilia[]>([])
  const [loading, setLoading] = useState(true)

  const [criarOpen, setCriarOpen] = useState(false)
  const [nomeFamilia, setNomeFamilia] = useState("")
  const [nomeFamiliaErr, setNomeFamiliaErr] = useState("")
  const [savingFamilia, setSavingFamilia] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [fs, cs] = await Promise.all([getFamilias(), getConvitesPendentes()])
      setConvitesPendentes(cs)
      const agora = new Date()
      const mes = agora.getMonth() + 1
      const ano = agora.getFullYear()
      // Enriquece cada família com membros + modo de rateio + saldo do mês p/ o card.
      const cards = await Promise.all(fs.map(async (f): Promise<FamiliaCard> => {
        try {
          const [d, bal] = await Promise.all([getFamilia(f.id), getBalancoFamilia(f.id, mes, ano)])
          const meu = bal.saldos.find(s => s.usuarioId === currentUser?.id)
          const papel = d.membros.find(m => m.usuarioId === currentUser?.id)?.papel ?? null
          return {
            ...f, membros: d.membros, modoRateio: d.modoRateioPadrao,
            papelUsuario: papel, meuSaldo: meu?.saldo ?? null, totalMes: bal.total,
          }
        } catch {
          return { ...f, membros: [], modoRateio: 1, papelUsuario: null, meuSaldo: null, totalMes: 0 }
        }
      }))
      setFamilias(cards)
    } catch {
      notify({ open: true, message: "Erro ao carregar famílias", severity: "error" })
    } finally {
      setLoading(false)
    }
  }, [notify, currentUser?.id])

  useEffect(() => { void loadData() }, [loadData])

  const handleCriar = async () => {
    if (!nomeFamilia.trim()) { setNomeFamiliaErr("Informe o nome"); return }
    setSavingFamilia(true)
    try {
      await criarFamilia(nomeFamilia.trim())
      notify({ open: true, message: "Família criada", severity: "success" })
      setCriarOpen(false)
      setNomeFamilia("")
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao criar família", severity: "error" })
    } finally {
      setSavingFamilia(false)
    }
  }

  const handleAceitar = async (token: string) => {
    try {
      await aceitarConvite(token)
      notify({ open: true, message: "Convite aceito", severity: "success" })
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao aceitar convite", severity: "error" })
    }
  }

  const handleRecusar = async (token: string) => {
    try {
      await recusarConvite(token)
      notify({ open: true, message: "Convite recusado", severity: "success" })
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao recusar convite", severity: "error" })
    }
  }

  const saldoView = (f: FamiliaCard) => {
    if (f.meuSaldo == null) {
      return { text: f.totalMes > 0 ? `${formatMoney(f.totalMes)} no mês` : "Sem despesas no mês", cls: styles.saldoMuted }
    }
    if (f.meuSaldo > 0.005) return { text: `você tem a receber ${formatMoney(f.meuSaldo)}`, cls: styles.saldoPos }
    if (f.meuSaldo < -0.005) return { text: `você tem a acertar ${formatMoney(-f.meuSaldo)}`, cls: styles.saldoNeg }
    return { text: "Tudo quitado este mês", cls: styles.saldoMuted }
  }

  if (loading) {
    return (
      <div className={styles.centered}>
        <PontesLoadingDots />
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Famílias</h1>
        </div>
        <PontesButton size="sm" iconStart={<Users size={16} strokeWidth={2.5} />} onClick={() => setCriarOpen(true)}>
          Nova Família
        </PontesButton>
      </div>

      {/* Convites pendentes */}
      {convitesPendentes.length > 0 && (
        <PontesCard padding={20} radius={14}>
          <div className={styles.sectionTitle}>Convites pendentes</div>
          <div className={styles.inviteList}>
            {convitesPendentes.map(c => (
              <div key={c.id} className={styles.inviteRow}>
                <span className={styles.inviteText}>
                  <strong>{c.nomeFamilia}</strong> — convidou você como {c.papel}
                </span>
                <div className={styles.rowActions}>
                  <PontesButton size="sm" onClick={() => handleAceitar(c.token)}>Aceitar</PontesButton>
                  <PontesButton size="sm" variant="outline" onClick={() => handleRecusar(c.token)}>Recusar</PontesButton>
                </div>
              </div>
            ))}
          </div>
        </PontesCard>
      )}

      {/* Lista de famílias */}
      {familias.length === 0 ? (
        <PontesEmptyState
          icon={<Heart size={32} strokeWidth={1.5} />}
          title="Nenhuma família ainda"
          description="Crie uma família para compartilhar despesas com quem você convive."
        />
      ) : (
        <div className={styles.famGrid}>
          {familias.map(f => {
            const saldo = saldoView(f)
            return (
              <button key={f.id} type="button" className={styles.card} onClick={() => navigate(`/familias/${f.id}`)}>
                <div className={styles.cardTop}>
                  <div className={styles.famAvatar}>
                    <Users size={20} strokeWidth={1.75} />
                  </div>
                  <div className={styles.cardTitleWrap}>
                    <span className={styles.famNome}>{f.nome}</span>
                    <span className={styles.famSub}>
                      {f.totalMembros} {f.totalMembros === 1 ? "membro" : "membros"}
                      {f.papelUsuario && <> · {f.papelUsuario}</>}
                    </span>
                  </div>
                  {f.ehAdmin && <PontesBadge tone="primary" size="sm">Admin</PontesBadge>}
                  <ChevronRight size={18} className={styles.chev} />
                </div>

                {f.membros.length > 0 && (
                  <div className={styles.membrosRow}>
                    <div className={styles.avatarStack}>
                      {f.membros.slice(0, 4).map(m => (
                        <span key={m.id} className={styles.miniAvatar} title={m.nomeUsuario}>{initials(m.nomeUsuario)}</span>
                      ))}
                    </div>
                    <span className={styles.membrosNames}>
                      {f.membros.map(m => firstName(m.nomeUsuario)).join(", ")}
                    </span>
                  </div>
                )}

                <div className={styles.cardFoot}>
                  <span className={styles.modoChip}>{MODO_RATEIO_LABEL[f.modoRateio]}</span>
                  <span className={saldo.cls}>{saldo.text}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Modal nova família */}
      <PontesModal
        open={criarOpen}
        title="Nova Família"
        onClose={() => setCriarOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setCriarOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handleCriar} loading={savingFamilia} disabled={savingFamilia}>Criar</PontesButton>
        </>}
      >
        <PontesField label="Nome da família" required error={nomeFamiliaErr}>
          <PontesInput
            autoFocus
            value={nomeFamilia}
            onChange={e => { setNomeFamilia(e.target.value); setNomeFamiliaErr("") }}
            invalid={!!nomeFamiliaErr}
            placeholder="Ex: Família Silva"
          />
        </PontesField>
      </PontesModal>
    </div>
  )
}
