import React, { useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import { Upload, FileText } from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesField, PontesSelect,
  PontesCheckbox, PontesLoadingDots,
} from "@/components/pontes"
import { getContas } from "../../services/contaService"
import { getCategories } from "../../services/categoryService"
import { previewImportacao, confirmarImportacao } from "../../services/importacaoService"
import type { Conta } from "../../types/Conta"
import type { Category } from "../../types/Category"
import type { PreviewImportacao } from "../../types/Importacao"
import styles from "./ImportacaoPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

// UTC fixo — data do backend é "dia calendário" (meia-noite UTC), não instante exato; formatar em
// fuso local desloca 1 dia pra trás em fuso negativo (Brasil inteiro).
const formatDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" })

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
      setEstados(result.linhas.map((l) => ({
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
      .filter((x) => x.e.selecionada)
      .map((x) => ({
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
    setEstados((prev) => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  }

  const selecionadas = estados.filter((e) => e.selecionada).length

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>Importar extrato</h1>
      </header>

      {/* Passo 1 — upload */}
      <PontesCard padding={20} radius={14}>
        <div className={styles.uploadRow}>
          <PontesField label="Conta de destino" required>
            <PontesSelect
              value={contaId}
              onChange={(v) => setContaId(v)}
              placeholder="Selecione"
              options={contas.map((c) => ({ value: c.id, label: c.nome }))}
            />
          </PontesField>

          <label className={styles.fileLabel} data-has={arquivo ? "true" : undefined}>
            <FileText size={16} />
            <span>{arquivo ? arquivo.name : "Escolher arquivo (.ofx, .csv)"}</span>
            <input
              type="file" accept=".ofx,.csv" hidden
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </label>

          <PontesButton iconStart={<Upload size={16} strokeWidth={2.5} />} onClick={handleAnalisar} disabled={carregando}>
            Analisar
          </PontesButton>
        </div>
      </PontesCard>

      {carregando && (
        <div className={styles.loading}><PontesLoadingDots /></div>
      )}

      {/* Passo 2 — revisão */}
      {preview && !carregando && (
        <PontesCard padding={0} radius={14}>
          <div className={styles.reviewHead}>
            <div className={styles.reviewMeta}>
              <span className={styles.reviewTitle}>{preview.total} transações lidas</span>
              {preview.duplicadas > 0 && (
                <PontesBadge tone="warning" size="sm">{preview.duplicadas} possíveis duplicatas</PontesBadge>
              )}
            </div>
            <PontesButton size="sm" onClick={handleImportar} disabled={carregando}>
              Importar {selecionadas} selecionada{selecionadas === 1 ? "" : "s"}
            </PontesButton>
          </div>

          {preview.total === 0 ? (
            <div className={styles.emptyReview}>Nenhuma transação encontrada no arquivo.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.checkCell}></th>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th className={styles.alignRight}>Valor</th>
                    <th>Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.linhas.map((l, i) => {
                    const est = estados[i]
                    const isReceita = l.tipo === 2
                    const catsCompat = categorias.filter(
                      (c) => c.finalidade === 3 || c.finalidade === l.tipo)
                    return (
                      <tr key={`${l.fitId ?? ""}-${i}`} data-duplicada={l.duplicada ? "true" : undefined}>
                        <td className={styles.checkCell}>
                          <PontesCheckbox
                            checked={est?.selecionada ?? false}
                            onChange={(v) => setEstado(i, { selecionada: v })}
                          />
                        </td>
                        <td>{formatDate(l.data)}</td>
                        <td>
                          {l.descricao}
                          {l.duplicada && (
                            <PontesBadge tone="warning" size="sm">Duplicada</PontesBadge>
                          )}
                        </td>
                        <td>
                          <PontesBadge tone={isReceita ? "success" : "danger"} size="sm">
                            {isReceita ? "Receita" : "Despesa"}
                          </PontesBadge>
                        </td>
                        <td className={styles.alignRight} data-tone={isReceita ? "success" : "danger"}>
                          <strong>{formatMoney(l.valor)}</strong>
                        </td>
                        <td>
                          <PontesSelect
                            value={est?.categoriaId ?? ""}
                            onChange={(v) => setEstado(i, { categoriaId: v })}
                            placeholder="Sem categoria"
                            options={catsCompat.map((c) => ({ value: c.id, label: c.descricao }))}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PontesCard>
      )}
    </div>
  )
}
