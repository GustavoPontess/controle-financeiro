import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Card, CardContent, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel, Select,
  MenuItem as MuiMenuItem, LinearProgress, Chip,
} from "@mui/material"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import CustomButton from "../../components/CustomButton"
import { ParcelamentoService } from "../../services/ParcelamentoService"
import { getContas } from "../../services/contaService"
import type { ParcelamentoDetalhe } from "../../types/Parcelamento"
import type { Conta } from "../../types/Conta"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—"

const formatarMesAno = (data: string) => {
  const [ano, mes] = data.substring(0, 7).split("-")
  const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
  return `${meses[parseInt(mes) - 1]}/${ano}`
}

const statusLabel: Record<number, string> = {
  0: "Pendente",
  1: "Paga",
  2: "Cancelada",
}

const statusCor: Record<number, string> = {
  0: "#fbbf24",
  1: "#10b981",
  2: "#9ca3af",
}

export default function ParcelamentoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [parcelamento, setParcelamento] = useState<ParcelamentoDetalhe | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState("")

  const [modalPagar, setModalPagar] = useState(false)
  const [parcelaIdSelecionada, setParcelaIdSelecionada] = useState<string>("")
  const [contaSelecionada, setContaSelecionada] = useState<string>("")
  const [loadingPagar, setLoadingPagar] = useState(false)
  const [erroPagar, setErroPagar] = useState("")

  const [modalCancelar, setModalCancelar] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [loadingCancelar, setLoadingCancelar] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      const [p, c] = await Promise.all([
        ParcelamentoService.obterDetalhe(id),
        getContas(),
      ])
      setParcelamento(p)
      setContas(c)
      if (c.length > 0) setContaSelecionada(c[0].id)
    } catch {
      setErro("Erro ao carregar parcelamento")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])

  const handlePagar = async () => {
    setErroPagar("")
    if (!parcelaIdSelecionada || !contaSelecionada) {
      setErroPagar("Selecione parcela e conta")
      return
    }
    setLoadingPagar(true)
    try {
      await ParcelamentoService.pagarParcelaAntecipado(parcelaIdSelecionada, {
        contaPagamentoId: contaSelecionada,
        dataPagamento: new Date().toISOString(),
        idempotencyKey: crypto.randomUUID(),
      })
      setModalPagar(false)
      await loadData()
    } catch {
      setErroPagar("Erro ao pagar parcela")
    } finally {
      setLoadingPagar(false)
    }
  }

  const handleCancelar = async () => {
    if (!id || !motivo.trim()) {
      alert("Preencha o motivo")
      return
    }
    if (!confirm("Confirmou? Esta ação não poderá ser desfeita.")) return
    setLoadingCancelar(true)
    try {
      await ParcelamentoService.cancelar(id, {
        motivo: motivo.trim(),
        idempotencyKey: crypto.randomUUID(),
      })
      navigate("/parcelamentos")
    } catch {
      alert("Erro ao cancelar parcelamento")
    } finally {
      setLoadingCancelar(false)
    }
  }

  if (loading) return <Typography>Carregando...</Typography>
  if (erro || !parcelamento) return <Typography color="#dc2626">{erro || "Parcelamento não encontrado"}</Typography>

  const percentual = (parcelamento.parcelasPagas / parcelamento.quantidadeParcelas) * 100
  const parceLasRestantes = parcelamento.parcelas.filter(p => p.status === 0).length

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/parcelamentos")}
          sx={{ textTransform: "none", color: "#6b7280" }}
        >
          Voltar
        </Button>
      </Box>

      {/* Informações principais */}
      <Paper elevation={0} sx={{ p: 3, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          <Box>
            <Typography fontSize={26} fontWeight={700} color="#111827">{parcelamento.descricao}</Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
              <Chip
                label={parcelamento.tipo === 0 ? "Compra Parcelada" : "PIX Crédito"}
                size="small"
              />
              <Typography fontSize={12} color="#6b7280">
                {parcelamento.quantidadeParcelas} parcelas
              </Typography>
            </Box>
          </Box>
          <Typography fontSize={24} fontWeight={700}>{formatMoney(parcelamento.valorOriginal)}</Typography>
        </Box>

        {/* Progress */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography fontSize={13} color="#6b7280">Progresso</Typography>
            <Typography fontSize={13} fontWeight={600}>{percentual.toFixed(0)}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={percentual} sx={{ height: 8, borderRadius: 1 }} />
        </Box>

        {/* Stats */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 2 }}>
          <Card elevation={0} sx={{ bgcolor: "#f9fafb", border: "1px solid #e5e7eb" }}>
            <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography fontSize={11} color="#6b7280" mb={0.5}>Valor Original</Typography>
              <Typography fontSize={16} fontWeight={700}>{formatMoney(parcelamento.valorOriginal)}</Typography>
            </CardContent>
          </Card>
          <Card elevation={0} sx={{ bgcolor: "#dcfce7", border: "1px solid #86efac" }}>
            <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography fontSize={11} color="#166534" mb={0.5}>Pago</Typography>
              <Typography fontSize={16} fontWeight={700} color="#15803d">{formatMoney(parcelamento.valorPago)}</Typography>
            </CardContent>
          </Card>
          <Card elevation={0} sx={{ bgcolor: "#fee2e2", border: "1px solid #fca5a5" }}>
            <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography fontSize={11} color="#7f1d1d" mb={0.5}>Restante</Typography>
              <Typography fontSize={16} fontWeight={700} color="#dc2626">{formatMoney(parcelamento.valorRestante)}</Typography>
            </CardContent>
          </Card>
        </Box>
      </Paper>

      {/* Próxima parcela */}
      {parcelamento.proximaParcela && (
        <Paper elevation={0} sx={{ p: 2.5, border: "2px solid #dbeafe", bgcolor: "#eff6ff", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#0c4a6e" fontWeight={600} mb={1}>📅 PRÓXIMA PARCELA</Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box>
              <Typography fontSize={14} color="#1e40af" fontWeight={600}>
                Fatura {formatarMesAno(parcelamento.proximaParcela.dataVencimento)}
              </Typography>
              <Typography fontSize={12} color="#0369a1">
                {formatDate(parcelamento.proximaParcela.dataVencimento)}
              </Typography>
            </Box>
            <Typography fontSize={18} fontWeight={700} color="#0c4a6e">
              {formatMoney(parcelamento.proximaParcela.valor)}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Tabela de parcelas */}
      <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: "1px solid #f1f5f9" }}>
          <Typography fontSize={15} fontWeight={600} color="#111827">Parcelas ({parcelamento.parcelas.length})</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f9fafb" }}>
                <TableCell sx={{ fontWeight: 600, fontSize: 12, color: "#6b7280" }}>Nº</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 12, color: "#6b7280" }}>Fatura</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 12, color: "#6b7280" }}>Vencimento</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: 12, color: "#6b7280" }}>Valor</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 12, color: "#6b7280" }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 12, color: "#6b7280" }}>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parcelamento.parcelas.map((parcela, i) => (
                <TableRow key={parcela.id} sx={{ borderBottom: "1px solid #f1f5f9", "&:hover": { bgcolor: "#fafafa" } }}>
                  <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{i + 1}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>
                    {formatarMesAno(parcela.dataVencimento)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>
                    {formatDate(parcela.dataVencimento)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: 13, fontWeight: 600 }}>
                    {formatMoney(parcela.valor)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabel[parcela.status] || parcela.status}
                      size="small"
                      sx={{
                        bgcolor: statusCor[parcela.status] || "#f3f4f6",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {parcela.status === 0 && (
                      <Button
                        size="small"
                        onClick={() => {
                          setParcelaIdSelecionada(parcela.id)
                          setModalPagar(true)
                        }}
                        sx={{ textTransform: "none", color: "#1f2937", "&:hover": { bgcolor: "#f3f4f6" } }}
                      >
                        Pagar
                      </Button>
                    )}
                    {parcela.status === 1 && (
                      <Typography fontSize={12} color="#6b7280">{formatDate(parcela.pagoEm)}</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Ações */}
      <Box sx={{ display: "flex", gap: 2 }}>
        <CustomButton variant="secondary" onClick={() => setModalCancelar(true)}>
          Cancelar Parcelamento
        </CustomButton>
      </Box>

      {/* Modal pagar */}
      <Dialog open={modalPagar} onClose={() => setModalPagar(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Pagar Parcela Antecipado</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {parcelamento.parcelas.find(p => p.id === parcelaIdSelecionada) && (
            <>
              <Box>
                <Typography fontSize={12} color="#6b7280" mb={0.5}>Valor</Typography>
                <Typography fontSize={18} fontWeight={700}>
                  {formatMoney(parcelamento.parcelas.find(p => p.id === parcelaIdSelecionada)?.valor || 0)}
                </Typography>
              </Box>

              <FormControl size="small" fullWidth>
                <InputLabel>Pagar de *</InputLabel>
                <Select
                  value={contaSelecionada}
                  label="Pagar de *"
                  onChange={(e) => setContaSelecionada(e.target.value)}
                >
                  {contas.map(c => (
                    <MuiMenuItem key={c.id} value={c.id}>{c.nome}</MuiMenuItem>
                  ))}
                </Select>
              </FormControl>

              {erroPagar && <Typography fontSize={13} color="#dc2626">{erroPagar}</Typography>}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setModalPagar(false)}>Cancelar</CustomButton>
          <CustomButton variant="primary" size="small" onClick={handlePagar} disabled={loadingPagar}>
            {loadingPagar ? "Pagando..." : "Confirmar"}
          </CustomButton>
        </DialogActions>
      </Dialog>

      {/* Modal cancelar */}
      <Dialog open={modalCancelar} onClose={() => setModalCancelar(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Cancelar Parcelamento</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <Typography fontSize={13}>
            Você cancelará as {parceLasRestantes} parcelas que ainda não foram pagas.
            {parcelamento.parcelasPagas > 0 && (
              <Typography component="div" fontSize={13} color="#dc2626" sx={{ mt: 1 }}>
                As {parcelamento.parcelasPagas} parcelas já pagas NÃO serão reembolsadas automaticamente.
              </Typography>
            )}
          </Typography>
          <TextField
            label="Motivo do cancelamento *"
            multiline
            rows={3}
            size="small"
            fullWidth
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Não preciso mais, descida de preço, etc"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setModalCancelar(false)}>
            Manter Parcelamento
          </CustomButton>
          <CustomButton variant="primary" size="small" onClick={handleCancelar} disabled={loadingCancelar}>
            {loadingCancelar ? "Cancelando..." : "Cancelar Parcelamento"}
          </CustomButton>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
