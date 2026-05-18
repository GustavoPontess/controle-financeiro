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
import CustomButton from "../../components/CustomButton"
import EmptyState from "../../components/EmptyState/EmptyState"
import {
  getFamilias, getFamilia, criarFamilia, dissolverFamilia, convidarMembro,
  revogarConvite, removerMembro, getConvitesPendentes, aceitarConvite, recusarConvite,
  getDespesasFamilia, getBalancoFamilia,
  getDependentes, criarDependente, atualizarDependente, inativarDependente,
} from "../../services/familiaService"
import type {
  Familia, FamiliaDetalhe, ConviteFamilia, DespesaCompartilhada, BalancoFamilia,
  Dependente, TipoDependente,
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
      const [d, desp, bal, deps] = await Promise.all([
        getFamilia(familiaId),
        getDespesasFamilia(familiaId, mes, ano),
        getBalancoFamilia(familiaId, mes, ano),
        getDependentes(familiaId),
      ])
      setDetalhe(d)
      setDespesas(desp)
      setBalanco(bal)
      setDependentes(deps)
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
          <Typography fontSize={22} fontWeight={700} color="#111827">Famílias</Typography>
          <Typography fontSize={13} color="#6b7280">Organize as finanças com quem você divide a vida.</Typography>
        </Box>
        <CustomButton size="small" startIcon={<GroupAddIcon />} onClick={() => setCriarOpen(true)}>
          Nova Família
        </CustomButton>
      </Box>

      {/* Convites pendentes */}
      {convitesPendentes.length > 0 && (
        <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", p: 2.5 }}>
          <Typography fontSize={15} fontWeight={600} mb={1.5}>Convites pendentes</Typography>
          {convitesPendentes.map(c => (
            <Box key={c.id} sx={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              py: 1, borderBottom: "1px solid #f1f5f9",
            }}>
              <Typography fontSize={14}>
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
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 2 }}>
          {familias.map(f => (
            <Paper
              key={f.id}
              elevation={0}
              onClick={() => abrirDetalhe(f.id)}
              sx={{
                border: "1px solid #e5e7eb", borderRadius: "12px", p: 2.5, cursor: "pointer",
                "&:hover": { borderColor: "#9ca3af" }, transition: "border-color 0.15s",
              }}
            >
              <Typography fontSize={16} fontWeight={700} color="#111827">{f.nome}</Typography>
              <Typography fontSize={13} color="#6b7280" mt={0.5}>
                {f.totalMembros} {f.totalMembros === 1 ? "membro" : "membros"}
              </Typography>
              {f.ehAdmin && <Chip label="Administrador" size="small" sx={{ mt: 1 }} />}
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
                  py: 1, borderBottom: "1px solid #f1f5f9",
                }}>
                  <Box>
                    <Typography fontSize={14}>{m.nomeUsuario} <Chip label={m.papel} size="small" /></Typography>
                    <Typography fontSize={12} color="#9ca3af">{m.emailUsuario} · desde {formatDate(m.entrouEm)}</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => handleRemoverMembro(
                    m.id, m.usuarioId === detalhe.criadoPorUsuarioId ? false : true)}>
                    {m.usuarioId === detalhe.criadoPorUsuarioId
                      ? null
                      : <DeleteOutlineIcon fontSize="small" />}
                  </IconButton>
                </Box>
              ))}

              {detalhe.convitesPendentes.length > 0 && (
                <>
                  <Typography fontSize={14} fontWeight={600} mt={2} mb={1}>Convites pendentes</Typography>
                  {detalhe.convitesPendentes.map(c => (
                    <Box key={c.id} sx={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      py: 1, borderBottom: "1px solid #f1f5f9",
                    }}>
                      <Typography fontSize={13} color="#6b7280">{c.emailConvidado} — {c.papel}</Typography>
                      {detalhe.ehAdmin && (
                        <IconButton size="small" onClick={() => handleRevogarConvite(c.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                </>
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
                      py: 0.75, borderBottom: "1px solid #f1f5f9",
                    }}>
                      <Typography fontSize={13}>{s.nome} — pagou {formatMoney(s.pagou)}</Typography>
                      <Typography fontSize={13} fontWeight={600}
                        color={s.saldo >= 0 ? "#15803d" : "#dc2626"}>
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
                <Typography fontSize={13} color="#9ca3af">
                  Nenhum dependente cadastrado.
                </Typography>
              ) : dependentes.map(dep => (
                <Box key={dep.id} sx={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  py: 0.75, borderBottom: "1px solid #f1f5f9",
                }}>
                  <Typography fontSize={13}>
                    {dep.nome}
                    {dep.apelido && <Typography component="span" fontSize={12} color="#9ca3af"> ({dep.apelido})</Typography>}
                    {" "}<Chip label={tipoDependenteLabel(dep.tipo)} size="small" />
                  </Typography>
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
                <Typography fontSize={13} color="#9ca3af">
                  Nenhuma despesa compartilhada neste mês.
                </Typography>
              ) : despesas.map(d => (
                <Box key={d.id} sx={{
                  display: "flex", justifyContent: "space-between",
                  py: 0.75, borderBottom: "1px solid #f1f5f9",
                }}>
                  <Typography fontSize={13}>
                    {d.descricao} <Typography component="span" fontSize={12} color="#9ca3af">
                      · {d.pagadorNome} · {formatDate(d.data)}</Typography>
                  </Typography>
                  <Typography fontSize={13} fontWeight={600}>{formatMoney(d.valor)}</Typography>
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
    </Box>
  )
}
