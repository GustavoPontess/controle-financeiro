import { useCallback, useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import { Users, UserPlus, Trash2, Pencil, Wallet, ArrowRight, Heart } from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge, PontesCard,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput, PontesSelect,
  PontesEmptyState, PontesLoadingDots,
} from "@/components/pontes"
import {
  getFamilias, getFamilia, criarFamilia, dissolverFamilia, convidarMembro,
  revogarConvite, removerMembro, getConvitesPendentes, aceitarConvite, recusarConvite,
  getDespesasFamilia, getBalancoFamilia,
  getDependentes, criarDependente, atualizarDependente, inativarDependente,
  definirModoRateio, definirRendaMembro,
  getAcertos, registrarAcerto, cancelarAcerto,
} from "../../services/familiaService"
import type {
  Familia, FamiliaDetalhe, ConviteFamilia, DespesaCompartilhada, BalancoFamilia,
  Dependente, TipoDependente, MembroFamilia, ModoRateio, AcertoContas,
} from "../../types/Familia"
import styles from "./FamiliasPage.module.css"

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

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

type ConfirmState = {
  title: string
  description: string
  onConfirm: () => Promise<void>
  tone?: "danger" | "warning" | "info"
} | null

const formatDate = (s: string) => new Date(s).toLocaleDateString("pt-BR")

export default function FamiliasPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [familias, setFamilias] = useState<Familia[]>([])
  const [convitesPendentes, setConvitesPendentes] = useState<ConviteFamilia[]>([])
  const [loading, setLoading] = useState(true)

  const [criarOpen, setCriarOpen] = useState(false)
  const [nomeFamilia, setNomeFamilia] = useState("")
  const [nomeFamiliaErr, setNomeFamiliaErr] = useState("")
  const [savingFamilia, setSavingFamilia] = useState(false)

  const [detalhe, setDetalhe] = useState<FamiliaDetalhe | null>(null)
  const [detalheLoading, setDetalheLoading] = useState(false)
  const [despesas, setDespesas] = useState<DespesaCompartilhada[]>([])
  const [balanco, setBalanco] = useState<BalancoFamilia | null>(null)

  const [convidarOpen, setConvidarOpen] = useState(false)
  const [conviteEmail, setConviteEmail] = useState("")
  const [conviteEmailErr, setConviteEmailErr] = useState("")
  const [convitePapel, setConvitePapel] = useState("")
  const [convitePapelErr, setConvitePapelErr] = useState("")
  const [savingConvite, setSavingConvite] = useState(false)

  const [dependentes, setDependentes] = useState<Dependente[]>([])
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

  const [acertos, setAcertos] = useState<AcertoContas[]>([])
  const [acertoOpen, setAcertoOpen] = useState(false)
  const [acertoDe, setAcertoDe] = useState("")
  const [acertoPara, setAcertoPara] = useState("")
  const [acertoValor, setAcertoValor] = useState("")
  const [acertoObs, setAcertoObs] = useState("")
  const [savingAcerto, setSavingAcerto] = useState(false)

  const [modoRateio, setModoRateio] = useState<string>("1")

  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [fs, cs] = await Promise.all([getFamilias(), getConvitesPendentes()])
      setFamilias(fs)
      setConvitesPendentes(cs)
    } catch {
      notify({ open: true, message: "Erro ao carregar famílias", severity: "error" })
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => { void loadData() }, [loadData])

  const abrirDetalhe = async (familiaId: string) => {
    setDetalheLoading(true)
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
    } finally {
      setDetalheLoading(false)
    }
  }

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
      await abrirDetalhe(detalhe.id)
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

  const handleRevogarConvite = async (conviteId: string) => {
    if (!detalhe) return
    try {
      await revogarConvite(detalhe.id, conviteId)
      await abrirDetalhe(detalhe.id)
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
        if (ehProprio) { setDetalhe(null); await loadData() }
        else await abrirDetalhe(detalhe.id)
      },
    })
  }

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
      await abrirDetalhe(detalhe.id)
    } catch {
      notify({ open: true, message: "Erro ao atualizar renda", severity: "error" })
    } finally {
      setSavingRenda(false)
    }
  }

  const abrirAcertoDialog = () => {
    setAcertoDe("")
    setAcertoPara("")
    setAcertoValor("")
    setAcertoObs("")
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
      })
      notify({ open: true, message: "Acerto registrado", severity: "success" })
      setAcertoOpen(false)
      await abrirDetalhe(detalhe.id)
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
        await abrirDetalhe(detalhe.id)
      },
    })
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
        setDetalhe(null)
        await loadData()
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

  if (loading) {
    return (
      <div className={styles.centered}>
        <PontesLoadingDots />
      </div>
    )
  }

  const membroOptions = (detalhe?.membros ?? []).map(m => ({ value: m.usuarioId, label: m.nomeUsuario }))

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Famílias</h1>
          <div className={styles.subtitle}>Organize as finanças com quem você divide a vida.</div>
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
          {familias.map(f => (
            <div key={f.id} className={styles.famCardWrap} onClick={() => abrirDetalhe(f.id)}>
            <PontesCard padding={20} radius={14} hover>
              <div className={styles.famCardInner}>
                <div className={styles.famAvatar}>
                  <Users size={22} strokeWidth={1.5} />
                </div>
                <div className={styles.famInfo}>
                  <span className={styles.famNome}>{f.nome}</span>
                  <span className={styles.famSub}>
                    {f.totalMembros} {f.totalMembros === 1 ? "membro" : "membros"}
                  </span>
                </div>
              </div>
              {f.ehAdmin && (
                <div className={styles.famBadge}>
                  <PontesBadge tone="primary" size="sm">Administrador</PontesBadge>
                </div>
              )}
            </PontesCard>
            </div>
          ))}
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

      {/* Modal detalhe da família */}
      <PontesModal
        open={detalhe !== null}
        title={detalhe?.nome ?? ""}
        maxWidth={560}
        onClose={() => setDetalhe(null)}
        footer={<>
          <div className={styles.detalheFLeft}>
            {detalhe?.ehAdmin && (
              <PontesButton variant="danger-outline" size="sm" iconStart={<Trash2 size={14} />} onClick={handleDissolver}>
                Dissolver
              </PontesButton>
            )}
          </div>
          <PontesButton variant="outline" onClick={() => setDetalhe(null)}>Fechar</PontesButton>
        </>}
      >
        {detalheLoading || !detalhe ? (
          <div className={styles.centered}><PontesLoadingDots /></div>
        ) : (
          <div className={styles.detalheBody}>

            {/* Membros */}
            <div className={styles.secRow}>
              <span className={styles.secTitle}>Membros</span>
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
                      {m.rendaMensal != null && ` · renda ${formatMoney(m.rendaMensal)}`}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <PontesIconButton size={32} variant="ghost" aria-label="Definir renda" onClick={() => abrirRendaDialog(m)}>
                      <Wallet size={14} strokeWidth={2} />
                    </PontesIconButton>
                    {m.usuarioId !== detalhe.criadoPorUsuarioId && (
                      <PontesIconButton size={32} variant="ghost" aria-label="Remover membro" onClick={() => handleRemoverMembro(m.id, true)}>
                        <Trash2 size={14} strokeWidth={2} />
                      </PontesIconButton>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Convites pendentes na família */}
            {detalhe.convitesPendentes.length > 0 && (
              <>
                <div className={styles.secRow}>
                  <span className={styles.secTitle}>Convites pendentes</span>
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

            {/* Modo de rateio */}
            <div className={styles.secRow}>
              <span className={styles.secTitle}>Modo de rateio</span>
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

            {/* Balanço do mês */}
            {balanco && (
              <>
                <div className={styles.secRow}>
                  <span className={styles.secTitle}>
                    Balanço do mês — {formatMoney(balanco.total)} em despesas
                  </span>
                </div>
                <div className={styles.itemList}>
                  {balanco.saldos.map(s => (
                    <div key={s.usuarioId} className={styles.itemRow}>
                      <span className={styles.itemSub}>
                        {s.nome} — pagou {formatMoney(s.pagou)} · cota {formatMoney(s.cota)}
                      </span>
                      <span className={s.saldo >= 0 ? styles.saldoPos : styles.saldoNeg}>
                        {s.saldo >= 0
                          ? `recebe ${formatMoney(s.saldo)}`
                          : `deve ${formatMoney(-s.saldo)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Dependentes */}
            <div className={styles.secRow}>
              <span className={styles.secTitle}>Dependentes</span>
              <PontesButton size="xs" variant="soft" iconStart={<UserPlus size={13} />} onClick={() => abrirDepDialog(null)}>
                Adicionar
              </PontesButton>
            </div>
            {dependentes.length === 0 ? (
              <span className={styles.emptyHint}>Nenhum dependente cadastrado.</span>
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
            )}

            {/* Despesas compartilhadas */}
            <div className={styles.secRow}>
              <span className={styles.secTitle}>Despesas compartilhadas</span>
            </div>
            {despesas.length === 0 ? (
              <span className={styles.emptyHint}>Nenhuma despesa compartilhada neste mês.</span>
            ) : (
              <div className={styles.itemList}>
                {despesas.map(d => (
                  <div key={d.id} className={styles.itemRow}>
                    <span className={styles.itemSub}>
                      {d.descricao} · {d.pagadorNome} · {formatDate(d.data)}
                    </span>
                    <span className={styles.itemValue}>{formatMoney(d.valor)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Acerto de contas */}
            <div className={styles.secRow}>
              <span className={styles.secTitle}>Acerto de contas</span>
              <PontesButton size="xs" variant="soft" iconStart={<Wallet size={13} />} onClick={abrirAcertoDialog}>
                Registrar acerto
              </PontesButton>
            </div>
            {acertos.length === 0 ? (
              <span className={styles.emptyHint}>Nenhum acerto registrado neste mês.</span>
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
            )}
          </div>
        )}
      </PontesModal>

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
            <PontesInput
              value={depApelido}
              onChange={e => setDepApelido(e.target.value)}
              placeholder="Ex: Lu"
            />
          </PontesField>
          <PontesField label="Data de nascimento (opcional)">
            <PontesDateInput
              value={depNascimento}
              onChange={(v) => setDepNascimento(v)}
            />
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
          <span className={styles.itemSub}>Usada no rateio proporcional. Deixe vazio para não informar.</span>
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
          <span className={styles.itemSub}>
            Registra que um membro pagou a outro o saldo pendente. Não mexe nas contas reais.
          </span>
          <PontesField label="Quem pagou">
            <PontesSelect value={acertoDe} onChange={setAcertoDe} options={membroOptions} placeholder="Selecione" />
          </PontesField>
          <PontesField label="Quem recebeu">
            <PontesSelect value={acertoPara} onChange={setAcertoPara} options={membroOptions} placeholder="Selecione" />
          </PontesField>
          <PontesField label="Valor (R$)">
            <PontesInput
              type="number"
              value={acertoValor}
              onChange={e => setAcertoValor(e.target.value)}
              placeholder="0,00"
            />
          </PontesField>
          <PontesField label="Observação / comprovante (opcional)">
            <PontesInput
              value={acertoObs}
              onChange={e => setAcertoObs(e.target.value)}
              placeholder="Pix, TED, dinheiro..."
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
