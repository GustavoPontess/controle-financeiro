import { useEffect, useState } from "react"
import {
  Box, Paper, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem as MuiMenuItem, FormControl, InputLabel, Card,
  CardContent, LinearProgress, IconButton, Chip,
} from "@mui/material"
import AddIcon from "@mui/icons-material/Add"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import { useNavigate } from "react-router-dom"
import CustomButton from "../../components/CustomButton"
import { ParcelamentoService } from "../../services/ParcelamentoService"
import { getCartoes } from "../../services/cartaoCreditoService"
import type { Parcelamento, CriarParcelamentoPayload } from "../../types/Parcelamento"
import type { CartaoCredito } from "../../types/CartaoCredito"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatarMesAno = (mesAno: string) => {
  const [ano, mes] = mesAno.split("-")
  const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
  return `${meses[parseInt(mes) - 1]}/${ano}`
}

const tiposParcelamento: Record<number, string> = {
  0: "Compra Parcelada",
  1: "PIX Crédito",
}

export default function ParcelamentosPage() {
  const navigate = useNavigate()
  const [parcelamentos, setParcelamentos] = useState<Parcelamento[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erroGeral, setErroGeral] = useState("")
  const [primeiraParcelaMes, setPrimeiraParcelaMes] = useState("")
  const [form, setForm] = useState<Omit<CriarParcelamentoPayload, "idempotencyKey">>({
    descricao: "",
    valor: 0,
    tipo: 0 as any,
    cartaoCreditoId: "",
    dataCompra: new Date().toISOString().split("T")[0],
    parcelas: 3,
    primeiraParcelaMes: "",
    taxaJuroMensal: 0,
  })

  const loadData = async () => {
    try {
      const [p, c] = await Promise.all([
        ParcelamentoService.listar(),
        getCartoes(),
      ])
      setParcelamentos(p)
      setCartoes(c)
    } catch (e) {
      setErroGeral("Erro ao carregar dados")
    }
  }

  useEffect(() => { loadData() }, [])

  const handleAbrir = () => {
    const proximoMes = new Date()
    proximoMes.setMonth(proximoMes.getMonth() + 1)
    const mesFormatado = proximoMes.toISOString().split("T")[0].substring(0, 7)
    setPrimeiraParcelaMes(mesFormatado)
    setForm({
      descricao: "",
      valor: 0,
      tipo: 0 as any,
      cartaoCreditoId: "",
      dataCompra: new Date().toISOString().split("T")[0],
      parcelas: 3,
      primeiraParcelaMes: mesFormatado,
      taxaJuroMensal: 0,
    })
    setErroGeral("")
    setDialogOpen(true)
  }

  const handleCriar = async () => {
    setErroGeral("")
    if (!form.descricao || !form.valor || !form.cartaoCreditoId) {
      setErroGeral("Preencha descrição, valor e cartão")
      return
    }
    if (form.parcelas < 2 || form.parcelas > 36) {
      setErroGeral("Parcelas: 2 a 36")
      return
    }
    setLoading(true)
    try {
      await ParcelamentoService.criar({
        ...form,
        valor: Number(form.valor),
        parcelas: Number(form.parcelas),
        taxaJuroMensal: Number(form.taxaJuroMensal),
        primeiraParcelaMes,
        idempotencyKey: crypto.randomUUID(),
      })
      setDialogOpen(false)
      await loadData()
    } catch (e) {
      setErroGeral("Erro ao criar parcelamento")
    } finally {
      setLoading(false)
    }
  }

  const handleCancelar = async (id: string) => {
    if (!confirm("Cancelar este parcelamento? Parcelas pendentes serão removidas.")) return
    try {
      await ParcelamentoService.cancelar(id, {
        motivo: "Cancelamento via dashboard",
        idempotencyKey: crypto.randomUUID(),
      })
      await loadData()
    } catch {
      alert("Erro ao cancelar parcelamento")
    }
  }

  const ativos = parcelamentos.filter(p => p.ativo).length
  const totalRestante = parcelamentos
    .filter(p => p.ativo)
    .reduce((sum, p) => sum + p.valorRestante, 0)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography fontSize={22} fontWeight={700} color="#111827">Parcelamentos</Typography>
          <Typography fontSize={13} color="#6b7280">Acompanhe seus parcelamentos</Typography>
        </Box>
        <CustomButton variant="primary" size="small" startIcon={<AddIcon />} onClick={handleAbrir}>
          Novo Parcelamento
        </CustomButton>
      </Box>

      {/* Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" mb={0.5}>Ativos</Typography>
          <Typography fontSize={26} fontWeight={800} color="#111827">{ativos}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" mb={0.5}>A pagar</Typography>
          <Typography fontSize={22} fontWeight={800} color="#dc2626">
            {formatMoney(totalRestante)}
          </Typography>
        </Paper>
      </Box>

      {/* Lista */}
      <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: "1px solid #f1f5f9" }}>
          <Typography fontSize={15} fontWeight={600} color="#111827">Seus Parcelamentos</Typography>
        </Box>

        {parcelamentos.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <InfoOutlinedIcon sx={{ fontSize: 40, color: "#d1d5db", mb: 1 }} />
            <Typography fontSize={14} color="#9ca3af">Nenhum parcelamento cadastrado</Typography>
            <Typography fontSize={13} color="#d1d5db">Crie um novo parcelamento para começar</Typography>
          </Box>
        ) : (
          parcelamentos.map((p, i) => {
            const percentual = (p.parcelasPagas / p.quantidadeParcelas) * 100
            return (
              <Card
                key={p.id}
                elevation={0}
                sx={{
                  borderRadius: 0,
                  borderBottom: i < parcelamentos.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: p.ativo ? 1 : 0.5,
                  "&:hover": { bgcolor: "#fafafa" },
                }}
              >
                <CardContent sx={{ p: 2, pb: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                    <Box>
                      <Typography fontWeight={600} fontSize={15}>{p.descricao}</Typography>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5 }}>
                        <Chip
                          label={tiposParcelamento[p.tipo] || "Desconhecido"}
                          size="small"
                          sx={{ fontSize: 11, height: 20 }}
                        />
                        <Typography fontSize={12} color="#6b7280">
                          {p.quantidadeParcelas} parcelas
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography fontWeight={700} fontSize={16}>{formatMoney(p.valorOriginal)}</Typography>
                      <Typography fontSize={12} color="#6b7280">{p.parcelasPagas}/{p.quantidadeParcelas} pago</Typography>
                    </Box>
                  </Box>

                  {/* Progress */}
                  <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography fontSize={12} color="#6b7280">
                        Progresso
                      </Typography>
                      <Typography fontSize={12} color="#6b7280">
                        {percentual.toFixed(0)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={percentual}
                      sx={{ height: 6, borderRadius: 1 }}
                    />
                  </Box>

                  {/* Próxima parcela */}
                  {p.proximaParcela && (
                    <Box sx={{ p: 1.5, bgcolor: "#f9fafb", borderRadius: 1, mb: 1.5 }}>
                      <Typography fontSize={11} color="#6b7280" mb={0.3}>Próxima parcela</Typography>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography fontSize={12} fontWeight={500}>
                          Fatura {formatarMesAno(p.proximaParcela.dataVencimento.split("T")[0].substring(0, 7))}
                        </Typography>
                        <Typography fontSize={12} fontWeight={600}>{formatMoney(p.proximaParcela.valor)}</Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Restante */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography fontSize={12} color="#6b7280">
                      Restante: <span style={{ fontWeight: 600, color: "#111827" }}>{formatMoney(p.valorRestante)}</span>
                    </Typography>
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: "flex", gap: 1, pt: 1 }}>
                    <CustomButton
                      variant="secondary"
                      size="small"
                      onClick={() => navigate(`/parcelamentos/${p.id}`)}
                      sx={{ flex: 1 }}
                    >
                      Detalhes
                    </CustomButton>
                    <IconButton
                      size="small"
                      onClick={() => handleCancelar(p.id)}
                      sx={{ color: "#9ca3af", "&:hover": { color: "#dc2626" } }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            )
          })
        )}
      </Paper>

      {/* Dialog criar */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Novo Parcelamento</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
          <TextField
            label="Descrição *"
            size="small"
            fullWidth
            value={form.descricao}
            onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
            placeholder="Ex: Notebook, Monitor, etc"
          />

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <TextField
              label="Valor *"
              size="small"
              type="number"
              fullWidth
              value={form.valor || ""}
              onChange={(e) => setForm(f => ({ ...f, valor: Number(e.target.value) }))}
              inputProps={{ min: 0.01, step: "0.01" }}
            />
            <TextField
              label="Parcelas *"
              size="small"
              type="number"
              fullWidth
              value={form.parcelas}
              onChange={(e) => setForm(f => ({ ...f, parcelas: Number(e.target.value) }))}
              inputProps={{ min: 2, max: 36 }}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <TextField
              label="Data da Compra"
              type="date"
              size="small"
              fullWidth
              value={form.dataCompra}
              onChange={(e) => setForm(f => ({ ...f, dataCompra: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Primeira Parcela (Mês)"
              type="month"
              size="small"
              fullWidth
              value={primeiraParcelaMes}
              onChange={(e) => setPrimeiraParcelaMes(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <FormControl size="small" fullWidth>
            <InputLabel>Tipo *</InputLabel>
            <Select
              value={form.tipo}
              label="Tipo *"
              onChange={(e) => setForm(f => ({ ...f, tipo: Number(e.target.value) as any }))}
            >
              <MuiMenuItem value={0}>Compra Parcelada</MuiMenuItem>
              <MuiMenuItem value={1}>PIX Crédito</MuiMenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Cartão *</InputLabel>
            <Select
              value={form.cartaoCreditoId}
              label="Cartão *"
              onChange={(e) => setForm(f => ({ ...f, cartaoCreditoId: e.target.value }))}
            >
              {cartoes.map(c => (
                <MuiMenuItem key={c.id} value={c.id}>{c.nome}</MuiMenuItem>
              ))}
            </Select>
          </FormControl>

          {form.tipo === 1 && (
            <TextField
              label="Taxa de Juros Mensal (%)"
              type="number"
              size="small"
              fullWidth
              value={form.taxaJuroMensal || ""}
              onChange={(e) => setForm(f => ({ ...f, taxaJuroMensal: Number(e.target.value) }))}
              inputProps={{ min: 0, max: 12, step: "0.01" }}
              helperText="1.99% a 11.99%"
            />
          )}

          {erroGeral && <Typography fontSize={13} color="#dc2626">{erroGeral}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setDialogOpen(false)}>Cancelar</CustomButton>
          <CustomButton variant="primary" size="small" onClick={handleCriar} disabled={loading}>
            {loading ? "Criando..." : "Criar"}
          </CustomButton>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
