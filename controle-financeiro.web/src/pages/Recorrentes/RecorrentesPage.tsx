import { useEffect, useState } from "react"
import { dataLocalISO } from "@/utils/dateTime"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import {
  TrendingDown, TrendingUp, Repeat, Pencil, Trash2, PauseCircle, PlayCircle, XCircle,
} from "lucide-react"
import {
  PontesButton, PontesModal, PontesDialog,
  PontesField, PontesInput, PontesMoneyField, PontesDateInput, PontesSelect,
  PontesListPage, type PontesRowAction, type PontesListItemMeta, type PontesListItemProps, formatarCampoDinheiro,
} from "@/components/pontes"
import { useListaPaginada } from "@/hooks/useListaPaginada"
import {
  listRecorrentesPage, getRecorrenteStats, createRecorrente, toggleRecorrente, deleteRecorrente,
  cancelarRecorrente, editarProximaOcorrencia,
} from "../../services/recorrenteService"
import type { RecorrenteStats } from "../../services/recorrenteService"
import { getContas } from "../../services/contaService"
import { getCategories } from "../../services/categoryService"
import type {
  Recorrente, CriarRecorrente, EditarProximaDto, FiltroStatusRecorrente, SituacaoRecorrente,
} from "../../types/Recorrente"
import type { Conta } from "../../types/Conta"
import type { Category } from "../../types/Category"
import styles from "./RecorrentesPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

// ── helpers ──────────────────────────────────────────────────────────────────


// UTC fixo — data do backend é "dia calendário" (meia-noite UTC), não instante exato; formatar em
// fuso local desloca 1 dia pra trás em fuso negativo (Brasil inteiro).
const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"

const today = () => dataLocalISO()

// Dias até a data (negativo = passou). null se sem data.
const diasAte = (iso?: string): number | null => {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// Rótulo humano de "quando cobra": hoje / amanhã / em N dias / data.
const cobraLabel = (iso?: string): string => {
  const n = diasAte(iso)
  if (n == null) return "—"
  if (n === 0) return "hoje"
  if (n === 1) return "amanhã"
  // Ficha: relativo só até 7 dias; depois, a data.
  if (n > 0 && n <= 7) return `em ${n} dias`
  return formatDate(iso)
}

// ── tipos de form ─────────────────────────────────────────────────────────────
// Valor em número (PontesMoneyField): o leitor antigo de texto gravava "1.500" como R$ 1,50.

type CriarForm = {
  descricao: string
  valor: number | undefined
  tipo: string
  categoriaId: string
  contaId: string
  frequencia: string
  dia: string
  dataInicio: string
  dataFim: string
}

type CriarErrors = Partial<Record<keyof CriarForm, string>>

const emptyCriarForm = (): CriarForm => ({
  descricao: "",
  valor: undefined,
  tipo: "1",
  categoriaId: "",
  contaId: "",
  frequencia: "2",
  dia: "1",
  dataInicio: today(),
  dataFim: "",
})

function validateCriar(f: CriarForm): CriarErrors {
  const errs: CriarErrors = {}
  if (!f.descricao.trim()) errs.descricao = "Descrição obrigatória."
  if (f.valor == null || f.valor <= 0) errs.valor = "Informe um valor positivo."
  if (!f.contaId) errs.contaId = "Selecione uma conta."
  if (!f.dataInicio) errs.dataInicio = "Data de início obrigatória."
  const dia = parseInt(f.dia)
  if (isNaN(dia) || dia < 1 || dia > 31) errs.dia = "Dia de 1 a 31."
  return errs
}

type EditarProximaForm = {
  valor: number | undefined
  descricao: string
}

type EditarProximaErrors = Partial<Record<keyof EditarProximaForm, string>>

function validateEditarProxima(f: EditarProximaForm): EditarProximaErrors {
  const errs: EditarProximaErrors = {}
  if (f.valor != null && f.valor <= 0) errs.valor = "Valor deve ser positivo."
  return errs
}

type CancelarForm = { motivo: string }
type CancelarErrors = Partial<Record<keyof CancelarForm, string>>

function validateCancelar(f: CancelarForm): CancelarErrors {
  const errs: CancelarErrors = {}
  if (!f.motivo.trim()) errs.motivo = "Motivo é obrigatório."
  return errs
}

// Badge por situação (vem do servidor). "ativa" não tem badge — é o estado normal.
const SITUACAO_BADGE: Record<Exclude<SituacaoRecorrente, "ativa">, { label: string; tone: "warning" | "danger" | "neutral" }> = {
  pausada: { label: "Pausada", tone: "warning" },
  // Cancelada é estado final, não problema: vermelho fica só pra problema (ficha).
  cancelada: { label: "Cancelada", tone: "neutral" },
  encerrada: { label: "Encerrada", tone: "neutral" },
}

const STATUS_OPTS: { value: FiltroStatusRecorrente; label: string }[] = [
  { value: "ativas", label: "Ativas" },
  { value: "encerradas", label: "Encerradas" },
]


// ── componente ────────────────────────────────────────────────────────────────

export default function RecorrentesPage() {
  const { notify } = useOutletContext<OutletContextType>()

  // Base da faixa "Próximas cobranças": a última lista carregada SEM filtro (aba Ativas, sem busca).
  // Filtrar não mexe nela — senão a faixa sumiria/mudaria a cada tecla. Não é uma 2ª consulta de
  // propósito: o GET da lista gera no servidor as ocorrências vencidas (GerarPendentesAsync), e
  // duas chamadas simultâneas podiam lançar a mesma cobrança duas vezes.
  const [baseProximas, setBaseProximas] = useState<Recorrente[]>([])
  // KPIs exatos via /recorrentes/stats — endpoint dedicado (#179).
  const [stats, setStats] = useState<RecorrenteStats>({
    ativas: 0, custoMensalDespesas: 0, proximas30Dias: 0, qtdTotal: 0,
  })
  const [resumoCarregado, setResumoCarregado] = useState(false)
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])

  // Lista NO SERVIDOR (situação + busca + página na URL, resposta velha, esqueleto): hook + molde.
  const lista = useListaPaginada<Recorrente, { status: FiltroStatusRecorrente }>({
    buscar: ({ page, pageSize, busca, filtros }) => listRecorrentesPage(page, pageSize, { status: filtros.status, busca }),
    filtrosPadrao: { status: "ativas" },
    // A faixa usa a última lista SEM filtro (aba Ativas, sem busca) — ver baseProximas.
    aoCarregar: (res, q) => { if (q.filtros.status === "ativas" && !q.busca) setBaseProximas(res.items) },
    aoFalhar: () => notify({ open: true, message: "Erro ao carregar contas fixas.", severity: "error" }),
  })

  // modal criar
  const [criarOpen, setCriarOpen] = useState(false)
  const [criarForm, setCriarForm] = useState<CriarForm>(emptyCriarForm())
  const [criarErrors, setCriarErrors] = useState<CriarErrors>({})
  const [criarSaving, setCriarSaving] = useState(false)

  // modal cancelar
  const [cancelarOpen, setCancelarOpen] = useState(false)
  const [cancelarTarget, setCancelarTarget] = useState<Recorrente | null>(null)
  const [cancelarForm, setCancelarForm] = useState<CancelarForm>({ motivo: "" })
  const [cancelarErrors, setCancelarErrors] = useState<CancelarErrors>({})
  const [cancelarSaving, setCancelarSaving] = useState(false)

  // modal editar próxima
  const [editarOpen, setEditarOpen] = useState(false)
  const [editarTarget, setEditarTarget] = useState<Recorrente | null>(null)
  const [editarForm, setEditarForm] = useState<EditarProximaForm>({ valor: undefined, descricao: "" })
  const [editarErrors, setEditarErrors] = useState<EditarProximaErrors>({})
  const [editarSaving, setEditarSaving] = useState(false)

  // excluir (confirmado via PontesDialog)
  const [excluirAlvo, setExcluirAlvo] = useState<Recorrente | null>(null)

  // ── load ────────────────────────────────────────────────────────────────────

  // Contas/categorias só alimentam o modal de criar — 1x na montagem.
  useEffect(() => {
    Promise.all([getContas(), getCategories()])
      .then(([c, cat]) => { setContas(c); setCategorias(cat) })
      .catch(() => notify({ open: true, message: "Erro ao carregar contas e categorias.", severity: "error" }))
  }, [notify])

  // Depois de qualquer mudança: resumo e lista recarregam juntos (hero e aba batem).
  const [versao, setVersao] = useState(0)
  const recarregar = () => { setVersao((v) => v + 1); lista.recarregar() }

  // KPIs do hero: não dependem da aba nem da busca (endpoint sem efeito colateral).
  useEffect(() => {
    let vivo = true
    getRecorrenteStats()
      .then((statsResult) => { if (vivo) setStats(statsResult) })
      .catch(() => { if (vivo) notify({ open: true, message: "Erro ao carregar o resumo das contas fixas.", severity: "error" }) })
      .finally(() => { if (vivo) setResumoCarregado(true) })
    return () => { vivo = false }
  }, [notify, versao])

  // ── stats ────────────────────────────────────────────────────────────────────

  const totalMensalDespesa = stats.custoMensalDespesas
  const proximas30 = stats.proximas30Dias

  // ── criar ────────────────────────────────────────────────────────────────────

  function openCriar() {
    setCriarForm(emptyCriarForm())
    setCriarErrors({})
    setCriarOpen(true)
  }

  async function handleCriar() {
    const errs = validateCriar(criarForm)
    if (Object.keys(errs).length > 0) { setCriarErrors(errs); return }
    setCriarSaving(true)
    try {
      const dto: CriarRecorrente = {
        descricao: criarForm.descricao,
        valor: criarForm.valor!,
        tipo: parseInt(criarForm.tipo),
        contaId: criarForm.contaId || undefined,
        categoriaId: criarForm.categoriaId || undefined,
        frequencia: parseInt(criarForm.frequencia),
        dia: parseInt(criarForm.dia),
        dataInicio: new Date(criarForm.dataInicio).toISOString(),
        dataFim: criarForm.dataFim ? new Date(criarForm.dataFim).toISOString() : undefined,
      }
      await createRecorrente(dto)
      setCriarOpen(false)
      recarregar()
      window.dispatchEvent(new Event("transactionCreated"))
      notify({ open: true, message: "Conta fixa criada com sucesso.", severity: "success" })
    } catch {
      notify({ open: true, message: "Erro ao criar conta fixa.", severity: "error" })
    } finally {
      setCriarSaving(false)
    }
  }

  // ── base da faixa "Próximas cobranças" ───────────────────────────────────────
  // Com busca ligada, o recarregar() só traz a lista FILTRADA — a base (última lista sem filtro)
  // seguiria mostrando como próxima cobrança o que acabou de ser pausado/cancelado/excluído, com o
  // hero já atualizado. Corrige a base no lugar, sem 2º GET (o GET da lista gera as cobranças
  // vencidas no servidor; duas chamadas simultâneas podiam lançar a mesma cobrança duas vezes).
  // Sem filtro, a própria recarga substitui a base pelos dados do servidor.
  const mudarNaBase = (id: string, mudar: (r: Recorrente) => Recorrente) =>
    setBaseProximas((b) => b.map((x) => (x.id === id ? mudar(x) : x)))
  const tirarDaBase = (id: string) => setBaseProximas((b) => b.filter((x) => x.id !== id))
  // A LISTA também muda na hora (antes da recarga voltar): a linha velha continuava clicável com o
  // estado de antes, e como pausar é um "inverte" no servidor, escolher Pausar de novo nessa janela
  // reativava a conta.
  const mudarNaLista = (id: string, mudar: (r: Recorrente) => Recorrente) =>
    lista.setItens((l) => l.map((x) => (x.id === id ? mudar(x) : x)))
  const tirarDaLista = (id: string) => lista.setItens((l) => l.filter((x) => x.id !== id))

  // ── pausar / retomar ─────────────────────────────────────────────────────────
  // Só ativa↔pausada. Cancelada/encerrada nem oferece a ação (o backend também recusa cancelada).

  async function handleToggle(r: Recorrente) {
    try {
      await toggleRecorrente(r.id)
      // Troca a situação em vez de remover: pausar e depois retomar (com a busca ligada) devolve o
      // item à faixa.
      const retomou = r.situacao === "pausada"
      const aplicar = (x: Recorrente): Recorrente => ({ ...x, ativo: retomou, situacao: retomou ? "ativa" : "pausada" })
      mudarNaBase(r.id, aplicar)
      mudarNaLista(r.id, aplicar)
      recarregar()
      notify({
        open: true,
        message: r.situacao === "pausada" ? "Conta fixa retomada." : "Conta fixa pausada.",
        severity: "success",
      })
    } catch {
      notify({ open: true, message: "Erro ao atualizar conta fixa.", severity: "error" })
    }
  }

  // ── excluir ───────────────────────────────────────────────────────────────────

  // O diálogo fica aberto (em "carregando") até a resposta: sem clique duplo.
  async function handleExcluir() {
    const alvo = excluirAlvo
    if (!alvo) return
    try {
      await deleteRecorrente(alvo.id)
      tirarDaBase(alvo.id)
      tirarDaLista(alvo.id)
      recarregar()
      notify({ open: true, message: "Conta fixa excluída.", severity: "success" })
    } catch {
      notify({ open: true, message: "Erro ao excluir conta fixa.", severity: "error" })
    } finally {
      setExcluirAlvo(null)
    }
  }

  // ── cancelar ─────────────────────────────────────────────────────────────────

  function openCancelar(r: Recorrente) {
    setCancelarTarget(r)
    setCancelarForm({ motivo: "" })
    setCancelarErrors({})
    setCancelarOpen(true)
  }

  async function handleCancelar() {
    const errs = validateCancelar(cancelarForm)
    if (Object.keys(errs).length > 0) { setCancelarErrors(errs); return }
    if (!cancelarTarget) return
    setCancelarSaving(true)
    try {
      await cancelarRecorrente(cancelarTarget.id, { motivo: cancelarForm.motivo })
      setCancelarOpen(false)
      tirarDaBase(cancelarTarget.id)
      tirarDaLista(cancelarTarget.id) // cancelada sai de "Ativas" já (vai pra "Encerradas" na recarga)
      recarregar()
      notify({ open: true, message: "Conta fixa cancelada.", severity: "success" })
    } catch {
      notify({ open: true, message: "Erro ao cancelar conta fixa.", severity: "error" })
    } finally {
      setCancelarSaving(false)
    }
  }

  // ── editar próxima ────────────────────────────────────────────────────────────

  function openEditarProxima(r: Recorrente) {
    setEditarTarget(r)
    setEditarForm({ valor: undefined, descricao: "" })
    setEditarErrors({})
    setEditarOpen(true)
  }

  async function handleEditarProxima() {
    const errs = validateEditarProxima(editarForm)
    if (Object.keys(errs).length > 0) { setEditarErrors(errs); return }
    if (!editarTarget) return
    setEditarSaving(true)
    try {
      const dto: EditarProximaDto = {}
      if (editarForm.valor != null) dto.valor = editarForm.valor
      if (editarForm.descricao.trim()) dto.descricao = editarForm.descricao
      await editarProximaOcorrencia(editarTarget.id, dto)
      setEditarOpen(false)
      recarregar()
      notify({ open: true, message: "Próxima ocorrência atualizada.", severity: "success" })
    } catch {
      notify({ open: true, message: "Erro ao editar próxima ocorrência.", severity: "error" })
    } finally {
      setEditarSaving(false)
    }
  }

  // ── selects options ───────────────────────────────────────────────────────────

  const contaOpts = contas.map(c => ({ value: c.id, label: c.nome }))
  const categoriaOpts = [
    { value: "", label: "Sem categoria" },
    ...categorias.map(c => ({ value: c.id, label: c.descricao })),
  ]
  const tipoOpts = [
    { value: "1", label: "Despesa" },
    { value: "2", label: "Receita" },
  ]
  const freqOpts = [
    { value: "1", label: "Semanal" },
    { value: "2", label: "Mensal" },
    { value: "3", label: "Anual" },
  ]

  // ── render ────────────────────────────────────────────────────────────────────

  // Projeção anual do custo mensal (×12). Próximas cobranças: contas fixas ATIVAS (não pausadas)
  // de despesa com data futura, ordenadas asc, top 6 — da última lista sem filtro (baseProximas).
  // Caveat (igual antes): usa só a página carregada (1 página = até 25; cobre o caso comum).
  const projecaoAnual = totalMensalDespesa * 12
  const proximasCobrancas = baseProximas
    .filter((r) => r.situacao === "ativa" && r.tipo === 1 && r.dataProximaGeracao && (diasAte(r.dataProximaGeracao) ?? -1) >= 0)
    .sort((a, b) => new Date(a.dataProximaGeracao!).getTime() - new Date(b.dataProximaGeracao!).getTime())
    .slice(0, 6)

  // Ações da linha, pela situação que o SERVIDOR calculou. Pausada ≠ cancelada: só a pausada
  // retoma; cancelada/encerrada só podem ser excluídas.
  function acoesDaLinha(r: Recorrente): PontesRowAction[] {
    const acoes: PontesRowAction[] = []
    if (r.situacao === "ativa") {
      acoes.push({
        key: "editar-proxima", label: "Editar próxima ocorrência",
        icon: <Pencil size={16} strokeWidth={2.5} />, onClick: () => openEditarProxima(r),
      })
      acoes.push({
        key: "pausar", label: "Pausar",
        icon: <PauseCircle size={16} strokeWidth={2.5} />, onClick: () => void handleToggle(r),
      })
    }
    if (r.situacao === "pausada") {
      acoes.push({
        key: "retomar", label: "Retomar",
        icon: <PlayCircle size={16} strokeWidth={2.5} />, onClick: () => void handleToggle(r),
      })
    }
    if (r.situacao === "ativa" || r.situacao === "pausada") {
      acoes.push({
        key: "cancelar", label: "Cancelar conta fixa",
        icon: <XCircle size={16} strokeWidth={2.5} />, onClick: () => openCancelar(r),
      })
    }
    acoes.push({
      key: "excluir", label: "Excluir", danger: true,
      icon: <Trash2 size={16} strokeWidth={2.5} />, onClick: () => setExcluirAlvo(r),
    })
    return acoes
  }

  // Linha da lista pela ficha "Conta fixa" (docs/features/padrao-telas/ficha-por-entidade.md):
  // status só fora do normal; meta em texto — frequência só se não for mensal, conta ou cartão,
  // próxima cobrança (aviso em até 7 dias) ou, se cancelada, o motivo.
  function itemDaLinha(r: Recorrente): PontesListItemProps {
    const isDespesa = r.tipo === 1
    const ativa = r.situacao === "ativa"
    const dias = diasAte(r.dataProximaGeracao)
    const meta: PontesListItemMeta[] = [
      r.frequencia !== 2 && r.frequenciaDescricao,
      r.contaNome ?? r.cartaoCreditoNome,
      ativa && !!r.dataProximaGeracao && {
        texto: `próxima cobrança ${cobraLabel(r.dataProximaGeracao)}`,
        alerta: dias != null && dias >= 0 && dias <= 7,
      },
      r.situacao === "cancelada" && !!r.motivoCancelamento && `Motivo: ${r.motivoCancelamento}`,
    ]
    return {
      icone: isDespesa ? <TrendingDown size={18} strokeWidth={2.4} /> : <TrendingUp size={18} strokeWidth={2.4} />,
      tom: isDespesa ? "saida" : "entrada",
      titulo: r.descricao,
      status: r.situacao === "ativa" ? undefined : SITUACAO_BADGE[r.situacao],
      meta,
      valor: `${isDespesa ? "−" : "+"}${formatMoney(r.valor)}`,
      valorTom: isDespesa ? "neutro" : "entrada",
      inativo: !ativa,
      acoes: acoesDaLinha(r),
    }
  }

  // Resumo do topo (ficha): custo mensal (+ por ano) e próximas 30 dias. A faixa "Próximas
  // cobranças" segue até o Gustavo decidir (decisão 3 da ficha).
  const topo = (
    <>
      <div className={styles.hero}>
        <div className={styles.heroBlob} />
        <div className={styles.heroMain}>
          <div className={styles.heroLabel}>Custo mensal em contas fixas</div>
          <div className={styles.heroValue}>{formatMoney(totalMensalDespesa)}</div>
          <div className={styles.heroProj}>
            <Repeat size={14} strokeWidth={2.4} />
            {formatMoney(projecaoAnual)} por ano
          </div>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{proximas30}</span>
            <span className={styles.heroStatLabel}>próx. 30 dias</span>
          </div>
        </div>
      </div>

      {resumoCarregado && proximasCobrancas.length > 0 && (
        <div className={styles.proxSection}>
          <div className={styles.proxTitle}>Próximas cobranças</div>
          <div className={styles.proxGrid}>
            {proximasCobrancas.map((r) => {
              const dias = diasAte(r.dataProximaGeracao) ?? 0
              const urgente = dias <= 7
              return (
                <div key={r.id} className={styles.proxCard} data-urgent={urgente ? "true" : undefined}>
                  <div className={styles.proxCardTop}>
                    <span className={styles.proxCardNome}>{r.descricao}</span>
                    <span className={styles.proxCardWhen} data-urgent={urgente ? "true" : undefined}>
                      {cobraLabel(r.dataProximaGeracao)}
                    </span>
                  </div>
                  <span className={styles.proxCardValor}>{formatMoney(r.valor)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className={styles.page}>
      <PontesListPage
        lista={lista}
        // Esqueleto até o resumo chegar também: o título do vazio depende do total geral (qtdTotal).
        carregando={!resumoCarregado}
        acao={{ label: "Nova conta fixa", onClick: openCriar }}
        topo={topo}
        busca="Buscar conta fixa…"
        filtros={[{ campo: "status", ariaLabel: "Situação", opcoes: STATUS_OPTS }]}
        rotulo={["conta fixa", "contas fixas"]}
        // Sem nenhuma conta fixa → "Nenhuma conta fixa"; tem, mas todas acabaram → a aba Ativas vazia.
        vazio={{
          icone: <Repeat size={32} strokeWidth={2.5} />,
          titulo: stats.qtdTotal === 0 ? "Nenhuma conta fixa" : "Nenhuma conta fixa ativa",
        }}
        chave={(r) => r.id}
        item={itemDaLinha}
      />

      {/* ── Modal criar ──────────────────────────────────────────────────────── */}
      <PontesModal
        open={criarOpen}
        title="Nova conta fixa"
        onClose={() => setCriarOpen(false)}
        maxWidth={520}
        footer={
          <div className={styles.modalFooter}>
            <PontesButton variant="outline" size="sm" onClick={() => setCriarOpen(false)}>Cancelar</PontesButton>
            <PontesButton variant="primary" size="sm" loading={criarSaving} onClick={handleCriar}>
              Criar conta fixa
            </PontesButton>
          </div>
        }
      >
        <div className={styles.form}>
          <PontesField label="Descrição" required error={criarErrors.descricao}>
            <PontesInput
              placeholder="Ex.: aluguel, escola, Netflix…"
              maxLength={400}
              value={criarForm.descricao}
              invalid={!!criarErrors.descricao}
              onChange={e => {
                setCriarForm(f => ({ ...f, descricao: e.target.value }))
                if (criarErrors.descricao) setCriarErrors(e2 => ({ ...e2, descricao: undefined }))
              }}
            />
          </PontesField>

          <div className={styles.row2}>
            <PontesField label="Tipo" required>
              <PontesSelect
                options={tipoOpts}
                value={criarForm.tipo}
                onChange={v => setCriarForm(f => ({ ...f, tipo: v }))}
              />
            </PontesField>
            <PontesField label="Valor" required error={criarErrors.valor}>
              <PontesMoneyField
                value={criarForm.valor}
                invalid={!!criarErrors.valor}
                onChange={v => {
                  setCriarForm(f => ({ ...f, valor: v }))
                  if (criarErrors.valor) setCriarErrors(e2 => ({ ...e2, valor: undefined }))
                }}
              />
            </PontesField>
          </div>

          <PontesField label="Conta" required error={criarErrors.contaId}>
            <PontesSelect
              options={contaOpts}
              value={criarForm.contaId}
              onChange={v => {
                setCriarForm(f => ({ ...f, contaId: v }))
                if (criarErrors.contaId) setCriarErrors(e => ({ ...e, contaId: undefined }))
              }}
              placeholder="Selecione uma conta"
              invalid={!!criarErrors.contaId}
            />
          </PontesField>

          <PontesField label="Categoria">
            <PontesSelect
              options={categoriaOpts}
              value={criarForm.categoriaId}
              onChange={v => setCriarForm(f => ({ ...f, categoriaId: v }))}
              placeholder="Sem categoria"
            />
          </PontesField>

          <div className={styles.row2}>
            <PontesField label="Frequência" required>
              <PontesSelect
                options={freqOpts}
                value={criarForm.frequencia}
                onChange={v => setCriarForm(f => ({ ...f, frequencia: v }))}
              />
            </PontesField>
            <PontesField label="Dia do mês" error={criarErrors.dia}>
              <PontesInput
                type="number"
                min={1}
                max={31}
                value={criarForm.dia}
                invalid={!!criarErrors.dia}
                onChange={e => {
                  setCriarForm(f => ({ ...f, dia: e.target.value }))
                  if (criarErrors.dia) setCriarErrors(e2 => ({ ...e2, dia: undefined }))
                }}
              />
            </PontesField>
          </div>

          <div className={styles.row2}>
            <PontesField label="Data início" required error={criarErrors.dataInicio}>
              <PontesDateInput
                value={criarForm.dataInicio}
                invalid={!!criarErrors.dataInicio}
                onChange={(v) => {
                  setCriarForm(f => ({ ...f, dataInicio: v }))
                  if (criarErrors.dataInicio) setCriarErrors(e2 => ({ ...e2, dataInicio: undefined }))
                }}
              />
            </PontesField>
            <PontesField label="Data fim (opcional)">
              <PontesDateInput
                value={criarForm.dataFim}
                onChange={(v) => setCriarForm(f => ({ ...f, dataFim: v }))}
              />
            </PontesField>
          </div>
        </div>
      </PontesModal>

      {/* ── Modal cancelar ───────────────────────────────────────────────────── */}
      <PontesModal
        open={cancelarOpen}
        title={`Cancelar: ${cancelarTarget?.descricao ?? ""}`}
        onClose={() => setCancelarOpen(false)}
        maxWidth={420}
        footer={
          <div className={styles.modalFooter}>
            <PontesButton variant="outline" size="sm" onClick={() => setCancelarOpen(false)}>Voltar</PontesButton>
            <PontesButton variant="danger" size="sm" loading={cancelarSaving} onClick={handleCancelar}>
              Confirmar cancelamento
            </PontesButton>
          </div>
        }
      >
        <div className={styles.form}>
          <p className={styles.cancelarInfo}>
            As transações futuras em <strong>Previsão</strong> serão canceladas.
            As já executadas serão mantidas.
          </p>
          <PontesField label="Motivo do cancelamento" required error={cancelarErrors.motivo}>
            <PontesInput
              placeholder="Ex.: não uso mais, preço alto…"
              maxLength={400}
              value={cancelarForm.motivo}
              invalid={!!cancelarErrors.motivo}
              onChange={e => {
                setCancelarForm({ motivo: e.target.value })
                if (cancelarErrors.motivo) setCancelarErrors({})
              }}
            />
          </PontesField>
        </div>
      </PontesModal>

      {/* ── Modal editar próxima ─────────────────────────────────────────────── */}
      <PontesModal
        open={editarOpen}
        title={`Editar próxima: ${editarTarget?.descricao ?? ""}`}
        onClose={() => setEditarOpen(false)}
        maxWidth={420}
        footer={
          <div className={styles.modalFooter}>
            <PontesButton variant="outline" size="sm" onClick={() => setEditarOpen(false)}>Cancelar</PontesButton>
            <PontesButton variant="primary" size="sm" loading={editarSaving} onClick={handleEditarProxima}>
              Salvar
            </PontesButton>
          </div>
        }
      >
        <div className={styles.form}>
          <PontesField label="Novo valor (opcional)" error={editarErrors.valor}>
            <PontesMoneyField
              placeholder={editarTarget ? formatarCampoDinheiro(editarTarget.valor) : "0,00"}
              value={editarForm.valor}
              invalid={!!editarErrors.valor}
              onChange={v => {
                setEditarForm(f => ({ ...f, valor: v }))
                if (editarErrors.valor) setEditarErrors(e2 => ({ ...e2, valor: undefined }))
              }}
            />
          </PontesField>
          <PontesField label="Nova descrição (opcional)">
            <PontesInput
              placeholder={editarTarget?.descricao ?? "Descrição…"}
              maxLength={400}
              value={editarForm.descricao}
              onChange={e => setEditarForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </PontesField>
        </div>
      </PontesModal>

      {/* ── Confirmar exclusão ─────────────────────────────────────────────── */}
      <PontesDialog
        open={excluirAlvo !== null}
        title="Excluir conta fixa?"
        description={excluirAlvo ? `Excluir "${excluirAlvo.descricao}"? As transações já geradas serão mantidas.` : undefined}
        tone="danger"
        confirmLabel="Excluir"
        onConfirm={handleExcluir}
        onCancel={() => setExcluirAlvo(null)}
      />
    </div>
  )
}
