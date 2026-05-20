import { useEffect, useState } from "react"
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Checkbox, Chip, MenuItem, TextField, CircularProgress,
} from "@mui/material"
import { useOutletContext } from "react-router-dom"
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined"
import CustomButton from "../../components/CustomButton"
import { getContas } from "../../services/contaService"
import { getCategories } from "../../services/categoryService"
import { previewImportacao, confirmarImportacao } from "../../services/importacaoService"
import type { Conta } from "../../types/Conta"
import type { Category } from "../../types/Category"
import type { PreviewImportacao } from "../../types/Importacao"
import { tokens } from "../../theme/tokens"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const formatDate = (s: string) => new Date(s).toLocaleDateString("pt-BR")
const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

type LinhaEstado = { selecionada: boolean; categoriaId: string }

export default function ImportacaoPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [contaId, setContaId] = useState("")
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [carregando, setCarregando] = useState(false)

  const [preview, setPreview] = useState<PreviewImportacao | null>(null)
  const [estados, setEstados] = useState<LinhaEstado[]>([])

  useEffect(() => {
    Promise.all([getContas(), getCategories()])
      .then(([cs, cats]) => {
        setContas(cs)
        setCategorias(cats)
      })
      .catch(() => notify({ open: true, message: "Erro ao carregar dados", severity: "error" }))
  }, [notify])

  const handleAnalisar = async () => {
    if (!contaId || !arquivo) {
      notify({ open: true, message: "Escolha a conta e o arquivo", severity: "error" })
      return
    }
    setCarregando(true)
    try {
      const result = await previewImportacao(contaId, arquivo)
      setPreview(result)
      setEstados(result.linhas.map(l => ({
        selecionada: !l.duplicada,
        categoriaId: l.categoriaSugeridaId ?? "",
      })))
    } catch (error) {
      notify({
        open: true,
        message: (error as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? "Erro ao analisar o extrato",
        severity: "error",
      })
    } finally {
      setCarregando(false)
    }
  }

  const handleImportar = async () => {
    if (!preview) return
    const linhas = preview.linhas
      .map((l, i) => ({ l, e: estados[i] }))
      .filter(x => x.e.selecionada)
      .map(x => ({
        data: x.l.data,
        descricao: x.l.descricao,
        valor: x.l.valor,
        tipo: x.l.tipo,
        fitId: x.l.fitId,
        categoriaId: x.e.categoriaId || null,
      }))

    if (linhas.length === 0) {
      notify({ open: true, message: "Selecione ao menos uma transação", severity: "error" })
      return
    }

    setCarregando(true)
    try {
      const res = await confirmarImportacao(contaId, linhas)
      notify({
        open: true,
        message: `${res.importadas} transação(ões) importada(s)`,
        severity: "success",
      })
      setPreview(null)
      setEstados([])
      setArquivo(null)
    } catch {
      notify({ open: true, message: "Erro ao importar transações", severity: "error" })
    } finally {
      setCarregando(false)
    }
  }

  const setEstado = (i: number, patch: Partial<LinhaEstado>) => {
    setEstados(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  }

  const selecionadas = estados.filter(e => e.selecionada).length

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography fontSize={22} fontWeight={700} color={tokens.color.text.primary}>Importar extrato</Typography>
        <Typography fontSize={13} color={tokens.color.text.secondary}>
          Suba o extrato do banco (OFX ou CSV) e revise antes de salvar.
        </Typography>
      </Box>

      {/* Passo 1 — upload */}
      <Paper elevation={0} sx={{ border: `1px solid ${tokens.color.border.default}`, borderRadius: tokens.radius.lg, p: 2.5 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            select size="small" label="Conta de destino" sx={{ minWidth: 220 }}
            value={contaId} onChange={e => setContaId(e.target.value)}
          >
            {contas.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>
            ))}
          </TextField>

          <CustomButton size="small" variant="secondary" startIcon={<UploadFileOutlinedIcon />}>
            <label style={{ cursor: "pointer" }}>
              {arquivo ? arquivo.name : "Escolher arquivo"}
              <input
                type="file" accept=".ofx,.csv" hidden
                onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </CustomButton>

          <CustomButton size="small" onClick={handleAnalisar} disabled={carregando}>
            Analisar
          </CustomButton>
        </Box>
      </Paper>

      {carregando && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>
      )}

      {/* Passo 2 — revisão */}
      {preview && !carregando && (
        <Paper elevation={0} sx={{ border: `1px solid ${tokens.color.border.default}`, borderRadius: tokens.radius.lg, p: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Typography fontSize={15} fontWeight={600}>
              {preview.total} transações lidas · {preview.duplicadas} possíveis duplicatas
            </Typography>
            <CustomButton size="small" onClick={handleImportar} disabled={carregando}>
              Importar {selecionadas} selecionada(s)
            </CustomButton>
          </Box>

          {preview.total === 0 ? (
            <Typography fontSize={13} color={tokens.color.text.disabled}>
              Nenhuma transação encontrada no arquivo.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Data</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Descrição</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Tipo</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>Valor</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Categoria</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.linhas.map((l, i) => {
                    const est = estados[i]
                    const isReceita = l.tipo === 2
                    const catsCompat = categorias.filter(
                      c => c.finalidade === 3 || c.finalidade === l.tipo)
                    return (
                      <TableRow key={`${l.fitId ?? ""}-${i}`} sx={{ bgcolor: l.duplicada ? tokens.color.status.warning.light : undefined }}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small" checked={est?.selecionada ?? false}
                            onChange={e => setEstado(i, { selecionada: e.target.checked })}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: 13 }}>{formatDate(l.data)}</TableCell>
                        <TableCell sx={{ fontSize: 13 }}>
                          {l.descricao}
                          {l.duplicada && (
                            <Chip label="Duplicada" size="small" color="warning"
                              sx={{ ml: 1, height: 18, fontSize: 10 }} />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={isReceita ? "Receita" : "Despesa"} size="small"
                            sx={{
                              fontSize: 11, height: 20,
                              bgcolor: isReceita ? tokens.color.status.success.light : tokens.color.status.error.light,
                              color: isReceita ? tokens.color.status.success.main : tokens.color.status.error.main,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: 13, fontWeight: tokens.typography.fontWeight.bold, textAlign: "right",
                          color: isReceita ? tokens.color.status.success.main : tokens.color.status.error.main }}>
                          {formatMoney(l.valor)}
                        </TableCell>
                        <TableCell>
                          <TextField
                            select size="small" variant="standard" sx={{ minWidth: 140 }}
                            value={est?.categoriaId ?? ""}
                            onChange={e => setEstado(i, { categoriaId: e.target.value })}
                          >
                            <MenuItem value=""><em>Sem categoria</em></MenuItem>
                            {catsCompat.map(c => (
                              <MenuItem key={c.id} value={c.id}>{c.descricao}</MenuItem>
                            ))}
                          </TextField>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}
    </Box>
  )
}
