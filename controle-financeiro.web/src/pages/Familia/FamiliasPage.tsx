import { useEffect, useState } from "react"
import {
  Box, Paper, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, IconButton, CircularProgress, MenuItem,
} from "@mui/material"
import { useOutletContext } from "react-router-dom"
import GroupAddIcon from "@mui/icons-material/GroupAdd"
import PersonAddIcon from "@mui/icons-material/PersonAdd"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import EditOutlinedIcon from "@mui/icons-material/EditOutlined"
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined"
import Diversity3Icon from "@mui/icons-material/Diversity3"
import CustomButton from "../../components/CustomButton"
import EmptyState from "../../components/EmptyState/EmptyState"
import { tokens } from "../../theme/tokens"
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

const TIPOS_DEPENDENTE: { value: TipoDependente; label: string }[] = [
  { value: 1, label: "Criança" },
  { value: 2, label: "Idoso" },
  { value: 3, label: "Pet" },
  { value: 4, label: "Outro" },
]
const tipoDependenteLabel = (t: TipoDependente) =>
  TIPOS_DEPENDENTE.find(x => x.value === t)?.label ?? "Outro"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const formatDate = (s: string) => new Date(s).toLocaleDateString("pt-BR")
const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const MODOS_RATEIO: { value: ModoRateio; label: string }[] = [
  { value: 1, label: "Igualitário" },
  { value: 2, label: "Proporcional à renda" },
  { value: 3, label: "Personalizado por despesa" },
]
const modoRateioLabel = (m: ModoRateio) =>
  MODOS_RATEIO.find(x => x.value === m)?.label ?? "Igualitário"

export default function FamiliasPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [familias, setFamilias] = useState<Familia[]>([])
  const [convitesPendentes, setConvitesPendentes] = useState<ConviteFamilia[]>([])
  const [loading, setLoading] = useState(true)

  const [criarOpen, setCriarOpen] = useState(false)
  const [nomeFamilia, setNomeFamilia] = useState("")

  const [detalhe, setDetalhe] = useState<FamiliaDetalhe | null>(null)
  const [detalheLoading, setDetalheLoading] = useState(false)
  const [despesas, setDespesas] = useState<DespesaCompartilhada[]>([])
  const [balanco, setBalanco] = useState<BalancoFamilia | null>(null)

  const [convidarOpen, setConvidarOpen] = useState(false)
  const [conviteEmail, setConviteEmail] = useState("")
  const [convitePapel, setConvitePapel] = useState("")

  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [depOpen, setDepOpen] = useState(false)
  const [depEditando, setDepEditando] = useState<Dependente | null>(null)
  const [depNome, setDepNome] = useState("")
  const [depApelido, setDepApelido] = useState("")
  const [depNascimento, setDepNascimento] = useState("")
  const [depTipo, setDepTipo] = useState<TipoDependente>(4)

  const [rendaMembro, setRendaMembro] = useState<MembroFamilia | null>(null)
  const [rendaValor, setRendaValor] = useState("")

  const [acertos, setAcertos] = useState<AcertoContas[]>([])
  const [acertoOpen, setAcertoOpen] = useState(false)
  const [acertoDe, setAcertoDe] = useState("")
  const [acertoPara, setAcertoPara] = useState("")
  const [acertoValor, setAcertoValor] = useState("")
  const [acertoObs, setAcertoObs] = useState("")

  const loadData = async () => {
    try {
      const [fs, cs] = await Promise.all([getFamilias(), getConvitesPendentes()])
      setFamilias(fs)
      setConvitesPendentes(cs)
    } catch (error) {
      console.error("Erro ao carregar famílias:", error)
      notify({ open: true, message: "Erro ao carregar famílias", severity: "error" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

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
    } catch {
      notify({ open: true, message: "Erro ao carregar a família", severity: "error" })
    } finally {
      setDetalheLoading(false)
    }
  }

  const handleCriar = async () => {
    if (!nomeFamilia.trim()) return
    try {
      await criarFamilia(nomeFamilia.trim())
      notify({ open: true, message: "Família criada", severity: "success" })
      setCriarOpen(false)
      setNomeFamilia("")
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao criar família", severity: "error" })
    }
  }

  const handleConvidar = async () => {
    if (!detalhe || !conviteEmail.trim() || !convitePapel.trim()) return
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

  const handleRemoverMembro = async (membroId: string, ehProprio: boolean) => {
    if (!detalhe) return
    const msg = ehProprio ? "Sair desta família?" : "Remover este membro?"
    if (!confirm(msg)) return
    try {
      await removerMembro(detalhe.id, membroId)
      notify({ open: true, message: ehProprio ? "Você saiu da família" : "Membro removido", severity: "success" })
      if (ehProprio) { setDetalhe(null); await loadData() }
      else await abrirDetalhe(detalhe.id)
    } catch (error) {
      notify({
        open: true,
        message: (error as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? "Erro ao remover membro",
        severity: "error",
      })
    }
  }

  const abrirDepDialog = (dep: Dependente | null) => {
    setDepEditando(dep)
    setDepNome(dep?.nome ?? "")
    setDepApelido(dep?.apelido ?? "")
    setDepNascimento(dep?.dataNascimento ? dep.dataNascimento.slice(0, 10) : "")
    setDepTipo(dep?.tipo ?? 4)
    setDepOpen(true)
  }

  const handleSalvarDependente = async () => {
    if (!detalhe || !depNome.trim()) return
    const input = {
      nome: depNome.trim(),
      apelido: depApelido.trim() || null,
      dataNascimento: depNascimento || null,
      tipo: depTipo,
    }
    try {
      if (depEditando) await atualizarDependente(detalhe.id, depEditando.id, input)
      else await criarDependente(detalhe.id, input)
      notify({ open: true, message: "Dependente salvo", severity: "success" })
      setDepOpen(false)
      setDependentes(await getDependentes(detalhe.id))
    } catch {
      notify({ open: true, message: "Erro ao salvar dependente", severity: "error" })
    }
  }

  const handleInativarDependente = async (depId: string) => {
    if (!detalhe || !confirm("Inativar este dependente? O histórico é preservado.")) return
    try {
      await inativarDependente(detalhe.id, depId)
      setDependentes(await getDependentes(detalhe.id))
    } catch {
      notify({ open: true, message: "Erro ao inativar dependente", severity: "error" })
    }
  }

  const handleDefinirModo = async (modo: ModoRateio) => {
    if (!detalhe) return
    try {
      await definirModoRateio(detalhe.id, modo)
      notify({ open: true, message: "Modo de rateio atualizado", severity: "success" })
      await abrirDetalhe(detalhe.id)
    } catch {
      notify({ open: true, message: "Erro ao atualizar modo de rateio", severity: "error" })
    }
  }

  const abrirRendaDialog = (m: MembroFamilia) => {
    setRendaMembro(m)
    setRendaValor(m.rendaMensal != null ? String(m.rendaMensal) : "")
  }

  const handleSalvarRenda = async () => {
    if (!detalhe || !rendaMembro) return
    const trimmed = rendaValor.trim()
    const renda = trimmed === "" ? null : Number(trimmed)
    if (renda != null && (Number.isNaN(renda) || renda < 0)) {
      notify({ open: true, message: "Renda inválida", severity: "error" })
      return
    }
    try {
      await definirRendaMembro(detalhe.id, rendaMembro.id, renda)
      notify({ open: true, message: "Renda atualizada", severity: "success" })
      setRendaMembro(null)
      await abrirDetalhe(detalhe.id)
    } catch {
      notify({ open: true, message: "Erro ao atualizar renda", severity: "error" })
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
    }
  }

  const handleCancelarAcerto = async (acertoId: string) => {
    if (!detalhe || !confirm("Cancelar este acerto? O histórico é preservado.")) return
    try {
      await cancelarAcerto(detalhe.id, acertoId)
      await abrirDetalhe(detalhe.id)
    } catch {
      notify({ open: true, message: "Erro ao cancelar acerto", severity: "error" })
    }
  }

  const handleDissolver = async () => {
    if (!detalhe || !confirm("Dissolver a família? Esta ação não pode ser desfeita.")) return
    try {
      await dissolverFamilia(detalhe.id)
      notify({ open: true, message: "Família dissolvida", severity: "success" })
      setDetalhe(null)
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao dissolver família", severity: "error" })
    }
  }

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}><CircularProgress /></Box>
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography fontSize={tokens.typography.fontSize["2xl"]} fontWeight={tokens.typography.fontWeight.bold} color="text.primary" sx={{ letterSpacing: -0.5 }}>
            Famílias
          </Typography>
          <Typography fontSize={tokens.typography.fontSize.sm} color="text.secondary">
            Organize as finanças com quem você divide a vida.
          </Typography>
        </Box>
        <CustomButton size="small" startIcon={<GroupAddIcon />} onClick={() => setCriarOpen(true)}>
          Nova Família
        </CustomButton>
      </Box>

      {/* Convites pendentes */}
      {convitesPendentes.length > 0 && (
        <Paper elevation={0} sx={{ p: 2.5, bgcolor: tokens.color.brand.subtle }}>
          <Typography
            fontSize={tokens.typography.fontSize.base}
            fontWeight={tokens.typography.fontWeight.bold}
            color="text.primary"
            mb={1.5}
          >
            Convites pendentes
          </Typography>
          {convitesPendentes.map((c, i) => (
            <Box key={c.id} sx={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              py: 1.25, borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider",
            }}>
              <Typography fontSize={tokens.typography.fontSize.sm} color="text.primary">
                <strong>{c.nomeFamilia}</strong> — convidou você como {c.papel}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <CustomButton size="small" onClick={() => handleAceitar(c.token)}>Aceitar</CustomButton>
                <CustomButton size="small" variant="secondary" onClick={() => handleRecusar(c.token)}>Recusar</CustomButton>
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {/* Lista de famílias */}
      {familias.length === 0 ? (
        <EmptyState
          title="Nenhuma família ainda"
          description="Crie uma família para compartilhar despesas."
        />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 2 }}>
          {familias.map(f => (
            <Paper
              key={f.id}
              elevation={0}
              onClick={() => abrirDetalhe(f.id)}
              sx={{
                p: 2.5,
                cursor: "pointer",
                transition: "box-shadow .15s ease, transform .15s ease",
                "&:hover": { boxShadow: tokens.shadow.md, transform: "translateY(-2px)" },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: tokens.radius.lg,
                    background: `linear-gradient(135deg, ${tokens.color.brand.primary}, ${tokens.color.brand.hover})`,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Diversity3Icon sx={{ fontSize: 24 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontSize={tokens.typography.fontSize.base} fontWeight={tokens.typography.fontWeight.bold} color="text.primary" noWrap>
                    {f.nome}
                  </Typography>
                  <Typography fontSize={tokens.typography.fontSize.xs} color="text.secondary">
                    {f.totalMembros} {f.totalMembros === 1 ? "membro" : "membros"}
                  </Typography>
                </Box>
              </Box>
              {f.ehAdmin && (
                <Chip
                  label="Administrador"
                  size="small"
                  sx={{
                    fontSize: tokens.typography.fontSize["2xs"],
                    height: 22,
                    borderRadius: tokens.radius.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    bgcolor: tokens.color.brand.subtle,
                    color: tokens.color.brand.hover,
                  }}
                />
              )}
            </Paper>
          ))}
        </Box>
      )}

      {/* Dialog criar família */}
      <Dialog open={criarOpen} onClose={() => setCriarOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nova Família</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Nome da família" margin="dense"
            value={nomeFamilia} onChange={e => setNomeFamilia(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <CustomButton variant="secondary" size="small" onClick={() => setCriarOpen(false)}>Cancelar</CustomButton>
          <CustomButton size="small" onClick={handleCriar}>Criar</CustomButton>
        </DialogActions>
      </Dialog>

      {/* Dialog detalhe da família */}
      <Dialog open={detalhe !== null} onClose={() => setDetalhe(null)} fullWidth maxWidth="sm">
        {detalheLoading || !detalhe ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <DialogTitle>{detalhe.nome}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography fontSize={14} fontWeight={600}>Membros</Typography>
                {detalhe.ehAdmin && (
                  <CustomButton size="small" startIcon={<PersonAddIcon />} onClick={() => setConvidarOpen(true)}>
                    Convidar
                  </CustomButton>
                )}
              </Box>
              {detalhe.membros.map(m => (
                <Box key={m.id} sx={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  py: 1, borderBottom: "1px solid", borderColor: "divider",
                }}>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <Typography fontSize={tokens.typography.fontSize.sm} fontWeight={tokens.typography.fontWeight.medium} color="text.primary">
                        {m.nomeUsuario}
                      </Typography>
                      <Chip
                        label={m.papel}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: tokens.typography.fontSize["2xs"],
                          borderRadius: tokens.radius.sm,
                          bgcolor: tokens.color.brand.subtle,
                          color: tokens.color.brand.hover,
                        }}
                      />
                    </Box>
                    <Typography fontSize={12} color="text.disabled">
                      {m.emailUsuario} · desde {formatDate(m.entrouEm)}
                      {m.rendaMensal != null && ` · renda ${formatMoney(m.rendaMensal)}`}
                    </Typography>
                  </Box>
                  <Box>
                    <IconButton size="small" onClick={() => abrirRendaDialog(m)} title="Definir renda">
                      <PaymentsOutlinedIcon fontSize="small" />
                    </IconButton>
                    {m.usuarioId !== detalhe.criadoPorUsuarioId && (
                      <IconButton size="small" onClick={() => handleRemoverMembro(m.id, true)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              ))}

              {detalhe.convitesPendentes.length > 0 && (
                <>
                  <Typography fontSize={14} fontWeight={600} mt={2} mb={1}>Convites pendentes</Typography>
                  {detalhe.convitesPendentes.map(c => (
                    <Box key={c.id} sx={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      py: 1, borderBottom: "1px solid", borderColor: "divider",
                    }}>
                      <Typography fontSize={13} color="text.secondary">{c.emailConvidado} — {c.papel}</Typography>
                      {detalhe.ehAdmin && (
                        <IconButton size="small" onClick={() => handleRevogarConvite(c.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                </>
              )}

              {/* Modo de rateio */}
              <Typography fontSize={14} fontWeight={600} mt={2} mb={1}>Modo de rateio</Typography>
              {detalhe.ehAdmin ? (
                <TextField
                  select fullWidth size="small" margin="dense"
                  value={detalhe.modoRateioPadrao}
                  onChange={e => handleDefinirModo(Number(e.target.value) as ModoRateio)}
                >
                  {MODOS_RATEIO.map(m => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </TextField>
              ) : (
                <Typography fontSize={13} color="text.secondary">
                  {modoRateioLabel(detalhe.modoRateioPadrao)}
                </Typography>
              )}

              {/* Balanço do mês */}
              {balanco && (
                <>
                  <Typography fontSize={14} fontWeight={600} mt={2} mb={1}>
                    Balanço do mês — {formatMoney(balanco.total)} em despesas
                  </Typography>
                  {balanco.saldos.map(s => (
                    <Box key={s.usuarioId} sx={{
                      display: "flex", justifyContent: "space-between",
                      py: 0.75, borderBottom: "1px solid", borderColor: "divider",
                    }}>
                      <Typography fontSize={13}>
                        {s.nome} — pagou {formatMoney(s.pagou)}
                        <Typography component="span" fontSize={12} color="text.disabled">
                          {" "}· cota {formatMoney(s.cota)}</Typography>
                      </Typography>
                      <Typography fontSize={13} fontWeight={600}
                        color={s.saldo >= 0 ? tokens.color.status.success.main : tokens.color.status.error.main}>
                        {s.saldo >= 0
                          ? `recebe ${formatMoney(s.saldo)}`
                          : `deve ${formatMoney(-s.saldo)}`}
                      </Typography>
                    </Box>
                  ))}
                </>
              )}

              {/* Dependentes */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2, mb: 1 }}>
                <Typography fontSize={14} fontWeight={600}>Dependentes</Typography>
                <CustomButton size="small" startIcon={<PersonAddIcon />} onClick={() => abrirDepDialog(null)}>
                  Adicionar
                </CustomButton>
              </Box>
              {dependentes.length === 0 ? (
                <Typography fontSize={13} color="text.disabled">
                  Nenhum dependente cadastrado.
                </Typography>
              ) : dependentes.map(dep => (
                <Box key={dep.id} sx={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  py: 0.75, borderBottom: "1px solid", borderColor: "divider",
                }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Typography fontSize={tokens.typography.fontSize.sm} color="text.primary">
                      {dep.nome}
                      {dep.apelido && (
                        <Typography component="span" fontSize={12} color="text.disabled">
                          {" "}({dep.apelido})
                        </Typography>
                      )}
                    </Typography>
                    <Chip
                      label={tipoDependenteLabel(dep.tipo)}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: tokens.typography.fontSize["2xs"],
                        borderRadius: tokens.radius.sm,
                        bgcolor: tokens.color.background.tertiary,
                        color: "text.secondary",
                      }}
                    />
                  </Box>
                  <Box>
                    <IconButton size="small" onClick={() => abrirDepDialog(dep)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleInativarDependente(dep.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}

              {/* Despesas compartilhadas do mês */}
              <Typography fontSize={14} fontWeight={600} mt={2} mb={1}>
                Despesas compartilhadas
              </Typography>
              {despesas.length === 0 ? (
                <Typography fontSize={13} color="text.disabled">
                  Nenhuma despesa compartilhada neste mês.
                </Typography>
              ) : despesas.map(d => (
                <Box key={d.id} sx={{
                  display: "flex", justifyContent: "space-between",
                  py: 0.75, borderBottom: "1px solid", borderColor: "divider",
                }}>
                  <Typography fontSize={13}>
                    {d.descricao} <Typography component="span" fontSize={12} color="text.disabled">
                      · {d.pagadorNome} · {formatDate(d.data)}</Typography>
                  </Typography>
                  <Typography fontSize={13} fontWeight={600}>{formatMoney(d.valor)}</Typography>
                </Box>
              ))}

              {/* Acerto de contas */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2, mb: 1 }}>
                <Typography fontSize={14} fontWeight={600}>Acerto de contas</Typography>
                <CustomButton size="small" startIcon={<PaymentsOutlinedIcon />} onClick={abrirAcertoDialog}>
                  Registrar acerto
                </CustomButton>
              </Box>
              {acertos.length === 0 ? (
                <Typography fontSize={13} color="text.disabled">
                  Nenhum acerto registrado neste mês.
                </Typography>
              ) : acertos.map(a => (
                <Box key={a.id} sx={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  py: 0.75, borderBottom: "1px solid", borderColor: "divider",
                }}>
                  <Typography fontSize={13}>
                    {a.deNome} → {a.paraNome}
                    <Typography component="span" fontSize={12} color="text.disabled">
                      {a.observacao ? ` · ${a.observacao}` : ""} · {formatDate(a.criadoEm)}</Typography>
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography fontSize={13} fontWeight={600}>{formatMoney(a.valor)}</Typography>
                    <IconButton size="small" onClick={() => handleCancelarAcerto(a.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </DialogContent>
            <DialogActions sx={{ justifyContent: "space-between" }}>
              <Box>
                {detalhe.ehAdmin && (
                  <CustomButton variant="secondary" size="small" startIcon={<DeleteOutlineIcon />}
                    onClick={handleDissolver}>
                    Dissolver
                  </CustomButton>
                )}
              </Box>
              <CustomButton variant="secondary" size="small" onClick={() => setDetalhe(null)}>Fechar</CustomButton>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialog convidar membro */}
      <Dialog open={convidarOpen} onClose={() => setConvidarOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Convidar membro</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="E-mail do convidado" margin="dense" type="email"
            value={conviteEmail} onChange={e => setConviteEmail(e.target.value)}
          />
          <TextField
            fullWidth label="Papel (ex: Esposa, Filho, Sócio)" margin="dense"
            value={convitePapel} onChange={e => setConvitePapel(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <CustomButton variant="secondary" size="small" onClick={() => setConvidarOpen(false)}>Cancelar</CustomButton>
          <CustomButton size="small" onClick={handleConvidar}>Enviar convite</CustomButton>
        </DialogActions>
      </Dialog>

      {/* Dialog criar/editar dependente */}
      <Dialog open={depOpen} onClose={() => setDepOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{depEditando ? "Editar dependente" : "Novo dependente"}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Nome" margin="dense"
            value={depNome} onChange={e => setDepNome(e.target.value)}
          />
          <TextField
            fullWidth label="Apelido (opcional)" margin="dense"
            value={depApelido} onChange={e => setDepApelido(e.target.value)}
          />
          <TextField
            fullWidth label="Data de nascimento (opcional)" margin="dense" type="date"
            InputLabelProps={{ shrink: true }}
            value={depNascimento} onChange={e => setDepNascimento(e.target.value)}
          />
          <TextField
            select fullWidth label="Tipo" margin="dense"
            value={depTipo} onChange={e => setDepTipo(Number(e.target.value) as TipoDependente)}
          >
            {TIPOS_DEPENDENTE.map(t => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <CustomButton variant="secondary" size="small" onClick={() => setDepOpen(false)}>Cancelar</CustomButton>
          <CustomButton size="small" onClick={handleSalvarDependente}>Salvar</CustomButton>
        </DialogActions>
      </Dialog>

      {/* Dialog definir renda */}
      <Dialog open={rendaMembro !== null} onClose={() => setRendaMembro(null)} fullWidth maxWidth="xs">
        <DialogTitle>Renda mensal — {rendaMembro?.nomeUsuario}</DialogTitle>
        <DialogContent>
          <Typography fontSize={13} color="text.secondary" mb={1}>
            Usada no rateio proporcional. Deixe vazio para não informar.
          </Typography>
          <TextField
            autoFocus fullWidth label="Renda mensal (R$)" margin="dense" type="number"
            value={rendaValor} onChange={e => setRendaValor(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <CustomButton variant="secondary" size="small" onClick={() => setRendaMembro(null)}>Cancelar</CustomButton>
          <CustomButton size="small" onClick={handleSalvarRenda}>Salvar</CustomButton>
        </DialogActions>
      </Dialog>

      {/* Dialog registrar acerto */}
      <Dialog open={acertoOpen} onClose={() => setAcertoOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Registrar acerto</DialogTitle>
        <DialogContent>
          <Typography fontSize={13} color="text.secondary" mb={1}>
            Registra que um membro pagou a outro o saldo pendente. Não mexe nas contas reais.
          </Typography>
          <TextField
            select fullWidth label="Quem pagou" margin="dense"
            value={acertoDe} onChange={e => setAcertoDe(e.target.value)}
          >
            {(detalhe?.membros ?? []).map(m => (
              <MenuItem key={m.usuarioId} value={m.usuarioId}>{m.nomeUsuario}</MenuItem>
            ))}
          </TextField>
          <TextField
            select fullWidth label="Quem recebeu" margin="dense"
            value={acertoPara} onChange={e => setAcertoPara(e.target.value)}
          >
            {(detalhe?.membros ?? []).map(m => (
              <MenuItem key={m.usuarioId} value={m.usuarioId}>{m.nomeUsuario}</MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth label="Valor (R$)" margin="dense" type="number"
            value={acertoValor} onChange={e => setAcertoValor(e.target.value)}
          />
          <TextField
            fullWidth label="Observação / comprovante (opcional)" margin="dense"
            value={acertoObs} onChange={e => setAcertoObs(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <CustomButton variant="secondary" size="small" onClick={() => setAcertoOpen(false)}>Cancelar</CustomButton>
          <CustomButton size="small" onClick={handleRegistrarAcerto}>Registrar</CustomButton>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
