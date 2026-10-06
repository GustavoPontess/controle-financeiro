import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { formatMoney } from "@/utils/money"
import {
  UserPlus, Trash2, Pencil, Wallet, ArrowRight, Check, X, ArrowLeft,
} from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge, PontesCard, PontesTabs,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput, PontesSelect,
  PontesLoadingDots,
} from "@/components/pontes"
import {
  getFamilia, dissolverFamilia, convidarMembro, revogarConvite, removerMembro,
  getDespesasFamilia, getBalancoFamilia,
  getDependentes, criarDependente, atualizarDependente, inativarDependente,
  definirModoRateio, definirRendaMembro,
  getAcertos, registrarAcerto, cancelarAcerto,
  definirLimiteAprovacao, aprovarDespesa, rejeitarDespesa,
  atribuirResponsavel,
} from "../../services/familiaService"
import type {
  FamiliaDetalhe as FamiliaDetalheType, DespesaCompartilhada, BalancoFamilia,
  Dependente, TipoDependente, MembroFamilia, ModoRateio, AcertoContas,
  StatusAprovacaoDespesa,
} from "../../types/Familia"
import { useAuth } from "../../hooks/useAuth"
import styles from "./FamiliaDetalhe.module.css"

const TIPOS_DEPENDENTE: { value: TipoDependente; label: string }[] = [
  { value: 1, label: "Criança" },
  { value: 2, label: "Idoso" },
  { value: 3, label: "Pet" },
  { value: 4, label: "Outro" },
]
const tipoDependenteLabel = (t: TipoDependente) =>
  TIPOS_DEPENDENTE.find(x => x.value === t)?.label ?? "Outro"

const MODOS_RATEIO: { value: ModoRateio; label: string }[] = [
  { value: 1, label: "Igualitário" },
  { value: 2, label: "Proporcional à renda" },
  { value: 3, label: "Personalizado por despesa" },
]
const modoRateioLabel = (m: ModoRateio) =>
  MODOS_RATEIO.find(x => x.value === m)?.label ?? "Igualitário"

const statusAprovacaoBadge = (s: StatusAprovacaoDespesa) => {
  if (s === 1) return <PontesBadge tone="warning" size="sm">Pendente</PontesBadge>
  if (s === 2) return <PontesBadge tone="success" size="sm">Aprovada</PontesBadge>
  if (s === 3) return <PontesBadge tone="danger" size="sm">Rejeitada</PontesBadge>
  return null
}

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

type ConfirmState = {
  title: string
  description: string
  onConfirm: () => Promise<void>
  tone?: "danger" | "warning" | "info"
} | null

type TabId = "despesas" | "dependentes" | "acertos"

// UTC fixo — data do backend é "dia calendário" (meia-noite UTC), não instante exato; formatar em
// fuso local desloca 1 dia pra trás em fuso negativo (Brasil inteiro).
const formatDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" })

export type FamiliaDetalheProps = {
  familiaId: string
  /** Mostra a seta "Voltar" no topo (uso em rota dedicada). */
  showBack?: boolean
  /** Chamado ao voltar, ou após sair/dissolver a família (o pai recarrega/seleciona). */
  onClose?: () => void
}

export function FamiliaDetalhe({ familiaId, showBack, onClose }: FamiliaDetalheProps) {
  const { notify } = useOutletContext<OutletContextType>()
  const { currentUser } = useAuth()

  const [detalhe, setDetalhe] = useState<FamiliaDetalheType | null>(null)
  const [loading, setLoading] = useState(true)
  const [despesas, setDespesas] = useState<DespesaCompartilhada[]>([])
  const [balanco, setBalanco] = useState<BalancoFamilia | null>(null)
  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [acertos, setAcertos] = useState<AcertoContas[]>([])

  const [tab, setTab] = useState<TabId>("despesas")

  const [convidarOpen, setConvidarOpen] = useState(false)
  const [conviteEmail, setConviteEmail] = useState("")
  const [conviteEmailErr, setConviteEmailErr] = useState("")
  const [convitePapel, setConvitePapel] = useState("")
  const [convitePapelErr, setConvitePapelErr] = useState("")
  const [savingConvite, setSavingConvite] = useState(false)

  const [depOpen, setDepOpen] = useState(false)
  const [depEditando, setDepEditando] = useState<Dependente | null>(null)
  const [depNome, setDepNome] = useState("")
  const [depNomeErr, setDepNomeErr] = useState("")
  const [depApelido, setDepApelido] = useState("")
  const [depNascimento, setDepNascimento] = useState("")
  const [depTipo, setDepTipo] = useState<string>("4")
  const [savingDep, setSavingDep] = useState(false)

  const [rendaMembro, setRendaMembro] = useState<MembroFamilia | null>(null)
  const [rendaValor, setRendaValor] = useState("")
  const [rendaErr, setRendaErr] = useState("")
  const [savingRenda, setSavingRenda] = useState(false)

  const [acertoOpen, setAcertoOpen] = useState(false)
  const [acertoDe, setAcertoDe] = useState("")
  const [acertoPara, setAcertoPara] = useState("")
  const [acertoValor, setAcertoValor] = useState("")
  const [acertoObs, setAcertoObs] = useState("")
  const [acertoIdemKey, setAcertoIdemKey] = useState("")
  const [savingAcerto, setSavingAcerto] = useState(false)

  const [limiteOpen, setLimiteOpen] = useState(false)
  const [limiteValor, setLimiteValor] = useState("")
  const [savingLimite, setSavingLimite] = useState(false)

  const [filtroResponsavel, setFiltroResponsavel] = useState("")
  const [modoRateio, setModoRateio] = useState<string>("1")

  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const agora = new Date()
      const mes = agora.getMonth() + 1
      const ano = agora.getFullYear()
      const [d, desp, bal, deps, acs] = await Promise.all([
        getFamilia(familiaId),
        getDespesasFamilia(familiaId, mes, ano),
        getBalancoFamilia(familiaId, mes, ano),
        getDependentes(familiaId),
        getAcertos(familiaId, mes, ano),
      ])
      setDetalhe(d)
      setDespesas(desp)
      setBalanco(bal)
      setDependentes(deps)
      setAcertos(acs)
      setModoRateio(String(d.modoRateioPadrao))
    } catch {
      notify({ open: true, message: "Erro ao carregar a família", severity: "error" })
      onClose?.()
    } finally {
      setLoading(false)
    }
  }, [familiaId, notify, onClose])

  useEffect(() => { void carregar() }, [carregar])

  // ── Membros / convites ──

  const handleConvidar = async () => {
    let valid = true
    if (!conviteEmail.trim()) { setConviteEmailErr("Informe o e-mail"); valid = false }
    if (!convitePapel.trim()) { setConvitePapelErr("Informe o papel"); valid = false }
    if (!valid || !detalhe) return
    setSavingConvite(true)
    try {
      await convidarMembro(detalhe.id, conviteEmail.trim(), convitePapel.trim())
      notify({ open: true, message: "Convite enviado", severity: "success" })
      setConvidarOpen(false)
      setConviteEmail("")
      setConvitePapel("")
      await carregar()
    } catch (error) {
      notify({
        open: true,
        message: (error as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? "Erro ao enviar convite",
        severity: "error",
      })
    } finally {
      setSavingConvite(false)
    }
  }

  const handleRevogarConvite = async (conviteId: string) => {
    if (!detalhe) return
    try {
      await revogarConvite(detalhe.id, conviteId)
      await carregar()
    } catch {
      notify({ open: true, message: "Erro ao revogar convite", severity: "error" })
    }
  }

  const handleRemoverMembro = (membroId: string, ehProprio: boolean) => {
    if (!detalhe) return
    setConfirmDialog({
      title: ehProprio ? "Sair desta família?" : "Remover membro?",
      description: ehProprio
        ? "Você perderá acesso às finanças compartilhadas desta família."
        : "O membro perderá acesso às finanças desta família.",
      tone: "danger",
      onConfirm: async () => {
        await removerMembro(detalhe.id, membroId)
        notify({ open: true, message: ehProprio ? "Você saiu da família" : "Membro removido", severity: "success" })
        if (ehProprio) onClose?.()
        else await carregar()
      },
    })
  }

  // ── Dependentes ──

  const abrirDepDialog = (dep: Dependente | null) => {
    setDepEditando(dep)
    setDepNome(dep?.nome ?? "")
    setDepNomeErr("")
    setDepApelido(dep?.apelido ?? "")
    setDepNascimento(dep?.dataNascimento ? dep.dataNascimento.slice(0, 10) : "")
    setDepTipo(String(dep?.tipo ?? 4))
    setDepOpen(true)
  }

  const handleSalvarDependente = async () => {
    if (!depNome.trim()) { setDepNomeErr("Informe o nome"); return }
    if (!detalhe) return
    setSavingDep(true)
    const input = {
      nome: depNome.trim(),
      apelido: depApelido.trim() || null,
      dataNascimento: depNascimento || null,
      tipo: Number(depTipo) as TipoDependente,
    }
    try {
      if (depEditando) await atualizarDependente(detalhe.id, depEditando.id, input)
      else await criarDependente(detalhe.id, input)
      notify({ open: true, message: "Dependente salvo", severity: "success" })
      setDepOpen(false)
      setDependentes(await getDependentes(detalhe.id))
    } catch {
      notify({ open: true, message: "Erro ao salvar dependente", severity: "error" })
    } finally {
      setSavingDep(false)
    }
  }

  const handleInativarDependente = (depId: string) => {
    if (!detalhe) return
    setConfirmDialog({
      title: "Inativar dependente?",
      description: "O histórico de transações é preservado.",
      tone: "warning",
      onConfirm: async () => {
        await inativarDependente(detalhe.id, depId)
        setDependentes(await getDependentes(detalhe.id))
      },
    })
  }

  // ── Rateio / renda ──

  const handleDefinirModo = async (modo: string) => {
    if (!detalhe) return
    setModoRateio(modo)
    try {
      await definirModoRateio(detalhe.id, Number(modo) as ModoRateio)
      notify({ open: true, message: "Modo de rateio atualizado", severity: "success" })
    } catch {
      notify({ open: true, message: "Erro ao atualizar modo de rateio", severity: "error" })
      setModoRateio(String(detalhe.modoRateioPadrao))
    }
  }

  const abrirRendaDialog = (m: MembroFamilia) => {
    setRendaMembro(m)
    setRendaValor(m.rendaMensal != null ? String(m.rendaMensal) : "")
    setRendaErr("")
  }

  const handleSalvarRenda = async () => {
    if (!detalhe || !rendaMembro) return
    const trimmed = rendaValor.trim()
    const renda = trimmed === "" ? null : Number(trimmed)
    if (renda != null && (Number.isNaN(renda) || renda < 0)) {
      setRendaErr("Renda inválida")
      return
    }
    setSavingRenda(true)
    try {
      await definirRendaMembro(detalhe.id, rendaMembro.id, renda)
      notify({ open: true, message: "Renda atualizada", severity: "success" })
      setRendaMembro(null)
      await carregar()
    } catch {
      notify({ open: true, message: "Erro ao atualizar renda", severity: "error" })
    } finally {
      setSavingRenda(false)
    }
  }

  // ── Acerto de contas ──

  const abrirAcertoDialog = () => {
    setAcertoDe("")
    setAcertoPara("")
    setAcertoValor("")
    setAcertoObs("")
    setAcertoIdemKey(crypto.randomUUID()) // key estável por tentativa; reusa no retry
    setAcertoOpen(true)
  }

  const handleRegistrarAcerto = async () => {
    if (!detalhe) return
    const valor = Number(acertoValor.trim())
    if (!acertoDe || !acertoPara) {
      notify({ open: true, message: "Selecione quem pagou e quem recebeu", severity: "error" })
      return
    }
    if (acertoDe === acertoPara) {
      notify({ open: true, message: "Pagador e recebedor devem ser diferentes", severity: "error" })
      return
    }
    if (Number.isNaN(valor) || valor <= 0) {
      notify({ open: true, message: "Valor do acerto inválido", severity: "error" })
      return
    }
    setSavingAcerto(true)
    try {
      await registrarAcerto(detalhe.id, {
        deUsuarioId: acertoDe,
        paraUsuarioId: acertoPara,
        valor,
        observacao: acertoObs.trim() || null,
        idempotencyKey: acertoIdemKey,
      })
      notify({ open: true, message: "Acerto registrado", severity: "success" })
      setAcertoOpen(false)
      await carregar()
    } catch {
      notify({ open: true, message: "Erro ao registrar acerto", severity: "error" })
    } finally {
      setSavingAcerto(false)
    }
  }

  const handleCancelarAcerto = (acertoId: string) => {
    if (!detalhe) return
    setConfirmDialog({
      title: "Cancelar acerto?",
      description: "O histórico é preservado. O acerto ficará marcado como cancelado.",
      tone: "warning",
      onConfirm: async () => {
        await cancelarAcerto(detalhe.id, acertoId)
        await carregar()
      },
    })
  }

  // ── Aprovação de despesa (2.4) ──

  const abrirLimiteDialog = () => {
    setLimiteValor(detalhe?.limiteAprovacao != null ? String(detalhe.limiteAprovacao) : "")
    setLimiteOpen(true)
  }

  const handleSalvarLimite = async () => {
    if (!detalhe) return
    const v = limiteValor.trim()
    const limite = v === "" ? null : Number(v)
    if (limite !== null && (Number.isNaN(limite) || limite < 0)) {
      notify({ open: true, message: "Limite inválido", severity: "error" })
      return
    }
    setSavingLimite(true)
    try {
      await definirLimiteAprovacao(detalhe.id, limite)
      notify({
        open: true,
        message: limite === null ? "Aprovação de despesa desativada" : "Limite de aprovação salvo",
        severity: "success",
      })
      setLimiteOpen(false)
      await carregar()
    } catch {
      notify({ open: true, message: "Erro ao salvar o limite", severity: "error" })
    } finally {
      setSavingLimite(false)
    }
  }

  const handleAvaliarDespesa = async (transacaoId: string, aprovar: boolean) => {
    if (!detalhe) return
    try {
      if (aprovar) await aprovarDespesa(detalhe.id, transacaoId)
      else await rejeitarDespesa(detalhe.id, transacaoId)
      notify({
        open: true,
        message: aprovar ? "Despesa aprovada" : "Despesa rejeitada",
        severity: "success",
      })
      await carregar()
    } catch {
      notify({ open: true, message: "Erro ao avaliar a despesa", severity: "error" })
    }
  }

  // ── Responsável da despesa (2.1) ──

  const recarregarDespesas = async (responsavelId: string) => {
    if (!detalhe) return
    const agora = new Date()
    const desp = await getDespesasFamilia(
      detalhe.id, agora.getMonth() + 1, agora.getFullYear(), responsavelId || undefined)
    setDespesas(desp)
  }

  const handleFiltrarResponsavel = async (value: string) => {
    setFiltroResponsavel(value)
    try {
      await recarregarDespesas(value)
    } catch {
      notify({ open: true, message: "Erro ao filtrar despesas", severity: "error" })
    }
  }

  const handleAtribuirResponsavel = async (transacaoId: string, value: string) => {
    if (!detalhe) return
    try {
      await atribuirResponsavel(detalhe.id, transacaoId, value || null)
      await recarregarDespesas(filtroResponsavel)
    } catch {
      notify({ open: true, message: "Erro ao atribuir responsável", severity: "error" })
    }
  }

  const handleDissolver = () => {
    if (!detalhe) return
    setConfirmDialog({
      title: "Dissolver a família?",
      description: `"${detalhe.nome}" será desfeita. Esta ação não pode ser desfeita.`,
      tone: "danger",
      onConfirm: async () => {
        await dissolverFamilia(detalhe.id)
        notify({ open: true, message: "Família dissolvida", severity: "success" })
        onClose?.()
      },
    })
  }

  const runConfirm = async () => {
    if (!confirmDialog) return
    setConfirmLoading(true)
    try {
      await confirmDialog.onConfirm()
    } catch {
      notify({ open: true, message: "Erro ao executar ação", severity: "error" })
    } finally {
      setConfirmLoading(false)
      setConfirmDialog(null)
    }
  }

  // ── Render ──

  if (loading || !detalhe) {
    return <div className={styles.centered}><PontesLoadingDots /></div>
  }

  const membroOptions = detalhe.membros.map(m => ({ value: m.usuarioId, label: m.nomeUsuario }))
  const filtroResponsavelOptions = [{ value: "", label: "Todos" }, ...membroOptions]
  const responsavelOptions = [{ value: "", label: "Sem responsável" }, ...membroOptions]
  const meuPapel = detalhe.membros.find(m => m.usuarioId === currentUser?.id)?.papel

  return (
    <div className={styles.root}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.backRow}>
          {showBack && (
            <PontesIconButton size={40} variant="ghost" aria-label="Voltar" onClick={() => onClose?.()}>
              <ArrowLeft size={18} strokeWidth={2} />
            </PontesIconButton>
          )}
          <div className={styles.titleWrap}>
            <div className={styles.titleLine}>
              <h2 className={styles.title}>{detalhe.nome}</h2>
              {meuPapel && <PontesBadge tone="primary" size="sm">{meuPapel}</PontesBadge>}
            </div>
            <div className={styles.subtitle}>
              {detalhe.membros.length} {detalhe.membros.length === 1 ? "membro" : "membros"}
            </div>
          </div>
        </div>
        {detalhe.ehAdmin && (
          <PontesButton variant="danger-outline" size="sm" iconStart={<Trash2 size={14} />} onClick={handleDissolver}>
            Dissolver
          </PontesButton>
        )}
      </div>

      {/* Resumo: membros (largo) + balanço + rateio */}
      <div className={styles.summaryGrid}>
        {/* Membros */}
        <PontesCard padding={20} radius={14}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Membros</span>
            {detalhe.ehAdmin && (
              <PontesButton size="xs" variant="soft" iconStart={<UserPlus size={13} />} onClick={() => setConvidarOpen(true)}>
                Convidar
              </PontesButton>
            )}
          </div>
          <div className={styles.itemList}>
            {detalhe.membros.map(m => (
              <div key={m.id} className={styles.itemRow}>
                <div className={styles.itemInfo}>
                  <div className={styles.itemPrimary}>
                    <span className={styles.itemName}>{m.nomeUsuario}</span>
                    <PontesBadge tone="soft" size="sm">{m.papel}</PontesBadge>
                  </div>
                  <div className={styles.itemSub}>
                    {m.emailUsuario} · desde {formatDate(m.entrouEm)}
                    {/* Renda: o valor só aparece na própria linha (a API nem manda a dos outros). */}
                    {m.rendaMensal != null ? ` · renda ${formatMoney(m.rendaMensal)}` : m.rendaInformada && " · renda informada"}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <PontesIconButton size={32} variant="ghost" aria-label="Definir renda" onClick={() => abrirRendaDialog(m)}>
                    <Wallet size={14} strokeWidth={2} />
                  </PontesIconButton>
                  {m.usuarioId !== detalhe.criadoPorUsuarioId
                    && (m.usuarioId === currentUser?.id || detalhe.ehAdmin) && (
                    <PontesIconButton
                      size={32}
                      variant="ghost"
                      aria-label={m.usuarioId === currentUser?.id ? "Sair da família" : "Remover membro"}
                      onClick={() => handleRemoverMembro(m.id, m.usuarioId === currentUser?.id)}
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </PontesIconButton>
                  )}
                </div>
              </div>
            ))}
          </div>

          {detalhe.convitesPendentes.length > 0 && (
            <>
              <div className={styles.cardHead} style={{ marginTop: 16 }}>
                <span className={styles.cardTitle}>Convites pendentes</span>
              </div>
              <div className={styles.itemList}>
                {detalhe.convitesPendentes.map(c => (
                  <div key={c.id} className={styles.itemRow}>
                    <span className={styles.itemSub}>{c.emailConvidado} — {c.papel}</span>
                    {detalhe.ehAdmin && (
                      <PontesIconButton size={32} variant="ghost" aria-label="Revogar convite" onClick={() => handleRevogarConvite(c.id)}>
                        <Trash2 size={14} strokeWidth={2} />
                      </PontesIconButton>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </PontesCard>

        {/* Coluna direita: balanço + rateio */}
        <div className={styles.rightCol}>
          {balanco && (
            <PontesCard padding={20} radius={14}>
              <div className={styles.cardHead}>
                <div>
                  <span className={styles.cardTitle}>Balanço do mês</span>
                  <div className={styles.cardHint}>equilíbrio do mês</div>
                </div>
              </div>
              <div className={styles.balTotal}>{formatMoney(balanco.total)}</div>
              <div className={styles.itemList}>
                {balanco.saldos.map(s => (
                  <div key={s.usuarioId} className={styles.itemRow}>
                    <span className={styles.itemSub}>
                      {s.nome} — pagou {formatMoney(s.pagou)} · cota {formatMoney(s.cota)}
                    </span>
                    <span className={s.saldo >= 0 ? styles.saldoPos : styles.saldoNeg}>
                      {s.saldo >= 0 ? `a receber ${formatMoney(s.saldo)}` : `a acertar ${formatMoney(-s.saldo)}`}
                    </span>
                  </div>
                ))}
              </div>
            </PontesCard>
          )}

          <PontesCard padding={20} radius={14}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Modo de rateio</span>
            </div>
            {detalhe.ehAdmin ? (
              <PontesSelect
                value={modoRateio}
                onChange={handleDefinirModo}
                options={MODOS_RATEIO.map(m => ({ value: String(m.value), label: m.label }))}
              />
            ) : (
              <span className={styles.itemSub}>{modoRateioLabel(detalhe.modoRateioPadrao)}</span>
            )}
          </PontesCard>
        </div>
      </div>

      {/* Abas: despesas / dependentes / acertos */}
      <PontesCard padding={20} radius={14}>
        <div className={styles.tabsHead}>
          <PontesTabs<TabId>
            value={tab}
            onChange={setTab}
            options={[
              { value: "despesas", label: "Despesas compartilhadas" },
              { value: "dependentes", label: "Dependentes" },
              { value: "acertos", label: "Acerto de contas" },
            ]}
          />
          <div className={styles.tabActions}>
            {tab === "despesas" && (
              <>
                {membroOptions.length > 0 && (
                  <div className={styles.filtroResp}>
                    <PontesSelect
                      value={filtroResponsavel}
                      onChange={handleFiltrarResponsavel}
                      options={filtroResponsavelOptions}
                      placeholder="Todos"
                    />
                  </div>
                )}
                {detalhe.ehAdmin && (
                  <PontesButton size="xs" variant="soft" onClick={abrirLimiteDialog}>
                    {detalhe.limiteAprovacao != null
                      ? `Aprovação ≥ ${formatMoney(detalhe.limiteAprovacao)}`
                      : "Aprovação: desligada"}
                  </PontesButton>
                )}
              </>
            )}
            {tab === "dependentes" && (
              <PontesButton size="xs" variant="soft" iconStart={<UserPlus size={13} />} onClick={() => abrirDepDialog(null)}>
                Adicionar
              </PontesButton>
            )}
            {tab === "acertos" && (
              <PontesButton size="xs" variant="soft" iconStart={<Wallet size={13} />} onClick={abrirAcertoDialog}>
                Registrar acerto
              </PontesButton>
            )}
          </div>
        </div>

        {/* Despesas */}
        {tab === "despesas" && (
          despesas.length === 0 ? (
            <div className={styles.emptyHint}>
              {filtroResponsavel ? "Nenhuma despesa deste responsável neste mês." : "Nenhuma despesa compartilhada neste mês."}
            </div>
          ) : (
            <div className={styles.itemList}>
              {despesas.map(d => (
                <div key={d.id} className={styles.itemRow}>
                  <span className={styles.itemSub}>
                    {d.descricao} · {d.pagadorNome} · {formatDate(d.data)}
                    {" "}{statusAprovacaoBadge(d.statusAprovacao)}
                    {d.responsavelNome && (
                      <> <PontesBadge tone="soft" size="sm">{d.responsavelNome}</PontesBadge></>
                    )}
                  </span>
                  <div className={styles.rowActions}>
                    <span className={styles.itemValue}>{formatMoney(d.valor)}</span>
                    {d.statusAprovacao === 1 && d.pagadorUsuarioId !== currentUser?.id && (
                      <>
                        <PontesIconButton size={32} variant="ghost" aria-label="Aprovar despesa"
                          onClick={() => handleAvaliarDespesa(d.id, true)}>
                          <Check size={14} strokeWidth={2.5} />
                        </PontesIconButton>
                        <PontesIconButton size={32} variant="ghost" aria-label="Rejeitar despesa"
                          onClick={() => handleAvaliarDespesa(d.id, false)}>
                          <X size={14} strokeWidth={2.5} />
                        </PontesIconButton>
                      </>
                    )}
                    <div className={styles.respPicker}>
                      <PontesSelect
                        value={d.responsavelUsuarioId ?? ""}
                        onChange={(v) => handleAtribuirResponsavel(d.id, v)}
                        options={responsavelOptions}
                        placeholder="Responsável"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Dependentes */}
        {tab === "dependentes" && (
          dependentes.length === 0 ? (
            <div className={styles.emptyHint}>Nenhum dependente cadastrado.</div>
          ) : (
            <div className={styles.itemList}>
              {dependentes.map(dep => (
                <div key={dep.id} className={styles.itemRow}>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemPrimary}>
                      <span className={styles.itemName}>
                        {dep.nome}
                        {dep.apelido && <span className={styles.itemMuted}> ({dep.apelido})</span>}
                      </span>
                      <PontesBadge tone="neutral" size="sm">{tipoDependenteLabel(dep.tipo)}</PontesBadge>
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <PontesIconButton size={32} variant="ghost" aria-label="Editar" onClick={() => abrirDepDialog(dep)}>
                      <Pencil size={13} strokeWidth={2} />
                    </PontesIconButton>
                    <PontesIconButton size={32} variant="ghost" aria-label="Inativar" onClick={() => handleInativarDependente(dep.id)}>
                      <Trash2 size={13} strokeWidth={2} />
                    </PontesIconButton>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Acertos */}
        {tab === "acertos" && (
          acertos.length === 0 ? (
            <div className={styles.emptyHint}>Nenhum acerto registrado neste mês.</div>
          ) : (
            <div className={styles.itemList}>
              {acertos.map(a => (
                <div key={a.id} className={styles.itemRow}>
                  <span className={styles.itemSub}>
                    {a.deNome} <ArrowRight size={12} className={styles.arrowIcon} /> {a.paraNome}
                    {a.observacao && ` · ${a.observacao}`}
                    {" · "}{formatDate(a.criadoEm)}
                  </span>
                  <div className={styles.rowActions}>
                    <span className={styles.itemValue}>{formatMoney(a.valor)}</span>
                    <PontesIconButton size={32} variant="ghost" aria-label="Cancelar acerto" onClick={() => handleCancelarAcerto(a.id)}>
                      <Trash2 size={13} strokeWidth={2} />
                    </PontesIconButton>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </PontesCard>

      {/* Modal convidar membro */}
      <PontesModal
        open={convidarOpen}
        title="Convidar membro"
        onClose={() => setConvidarOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setConvidarOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handleConvidar} loading={savingConvite} disabled={savingConvite}>Enviar convite</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="E-mail do convidado" required error={conviteEmailErr}>
            <PontesInput
              autoFocus
              type="email"
              value={conviteEmail}
              onChange={e => { setConviteEmail(e.target.value); setConviteEmailErr("") }}
              invalid={!!conviteEmailErr}
              placeholder="joao@email.com"
            />
          </PontesField>
          <PontesField label="Papel" required error={convitePapelErr}>
            <PontesInput
              value={convitePapel}
              onChange={e => { setConvitePapel(e.target.value); setConvitePapelErr("") }}
              invalid={!!convitePapelErr}
              placeholder="Ex: Esposa, Filho, Sócio"
            />
          </PontesField>
        </div>
      </PontesModal>

      {/* Modal criar/editar dependente */}
      <PontesModal
        open={depOpen}
        title={depEditando ? "Editar dependente" : "Novo dependente"}
        onClose={() => setDepOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setDepOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSalvarDependente} loading={savingDep} disabled={savingDep}>Salvar</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="Nome" required error={depNomeErr}>
            <PontesInput
              autoFocus
              value={depNome}
              onChange={e => { setDepNome(e.target.value); setDepNomeErr("") }}
              invalid={!!depNomeErr}
              placeholder="Ex: Lúcia"
            />
          </PontesField>
          <PontesField label="Apelido (opcional)">
            <PontesInput value={depApelido} onChange={e => setDepApelido(e.target.value)} placeholder="Ex: Lu" />
          </PontesField>
          <PontesField label="Data de nascimento (opcional)">
            <PontesDateInput value={depNascimento} onChange={(v) => setDepNascimento(v)} />
          </PontesField>
          <PontesField label="Tipo">
            <PontesSelect
              value={depTipo}
              onChange={setDepTipo}
              options={TIPOS_DEPENDENTE.map(t => ({ value: String(t.value), label: t.label }))}
            />
          </PontesField>
        </div>
      </PontesModal>

      {/* Modal definir renda */}
      <PontesModal
        open={rendaMembro !== null}
        title={`Renda mensal — ${rendaMembro?.nomeUsuario ?? ""}`}
        onClose={() => setRendaMembro(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setRendaMembro(null)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSalvarRenda} loading={savingRenda} disabled={savingRenda}>Salvar</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <span className={styles.formHint}>Usada no rateio proporcional. Deixe vazio para não informar.</span>
          <PontesField label="Renda mensal (R$)" error={rendaErr}>
            <PontesInput
              autoFocus
              type="number"
              value={rendaValor}
              onChange={e => { setRendaValor(e.target.value); setRendaErr("") }}
              invalid={!!rendaErr}
              placeholder="0"
            />
          </PontesField>
        </div>
      </PontesModal>

      {/* Modal registrar acerto */}
      <PontesModal
        open={acertoOpen}
        title="Registrar acerto"
        onClose={() => setAcertoOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setAcertoOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handleRegistrarAcerto} loading={savingAcerto} disabled={savingAcerto}>Registrar</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <span className={styles.formHint}>
            Registra que um membro pagou a outro o saldo pendente. Não mexe nas contas reais.
          </span>
          <PontesField label="Quem pagou">
            <PontesSelect value={acertoDe} onChange={setAcertoDe} options={membroOptions} placeholder="Selecione" />
          </PontesField>
          <PontesField label="Quem recebeu">
            <PontesSelect value={acertoPara} onChange={setAcertoPara} options={membroOptions} placeholder="Selecione" />
          </PontesField>
          <PontesField label="Valor (R$)">
            <PontesInput type="number" value={acertoValor} onChange={e => setAcertoValor(e.target.value)} placeholder="0,00" />
          </PontesField>
          <PontesField label="Observação / comprovante (opcional)">
            <PontesInput value={acertoObs} onChange={e => setAcertoObs(e.target.value)} placeholder="Pix, TED, dinheiro..." />
          </PontesField>
        </div>
      </PontesModal>

      {/* Modal limite de aprovação (2.4) */}
      <PontesModal
        open={limiteOpen}
        title="Limite de aprovação"
        onClose={() => setLimiteOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setLimiteOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSalvarLimite} loading={savingLimite} disabled={savingLimite}>Salvar</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <span className={styles.formHint}>
            Despesas compartilhadas com valor igual ou acima deste limite exigem a aprovação de
            outro membro antes de entrar no balanço. Deixe em branco para desligar.
          </span>
          <PontesField label="Valor mínimo (R$)">
            <PontesInput
              type="number"
              value={limiteValor}
              onChange={e => setLimiteValor(e.target.value)}
              placeholder="Ex.: 200,00 — em branco = sem aprovação"
            />
          </PontesField>
        </div>
      </PontesModal>

      {/* Confirmação genérica */}
      <PontesDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description}
        tone={confirmDialog?.tone ?? "danger"}
        confirmLabel={confirmLoading ? "Aguarde..." : "Confirmar"}
        onConfirm={runConfirm}
        onCancel={() => !confirmLoading && setConfirmDialog(null)}
      />
    </div>
  )
}
