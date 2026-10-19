// Página de uma meta (/metas/:id), no modelo de caixinha: em cima o ícone, o nome e a situação; no principal,
// quanto tem guardado (de quanto, a barra) com Resgatar e Guardar, e o histórico (guardou de qual conta,
// resgatou pra qual conta, por dia). Na coluna da direita, o plano (quanto quer juntar, falta, prazo, por mês)
// e Editar / Excluir. Excluir só com a caixinha zerada: com dinheiro, a tela pede pra resgatar antes.
// Chegou lá: aparece "Concluir e usar o dinheiro" (o guardado todo vai pra uma conta e a meta vai pra
// Concluídas). Concluída é REGISTRO: "Juntou", o plano e o histórico, sem nenhuma ação, só "Criar outra igual"
// (a meta nova abre preenchida com nome, ícone, quanto e a mesma duração do prazo, zerada).
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowDownToLine, ArrowUpFromLine, CircleCheck, Copy, Pencil, Trash2 } from "lucide-react"
import { excluirMeta, getHistoricoMeta, getMeta } from "../services/metaService"
import { mensagemDeErro } from "../api/cliente"
import type { Meta, MovimentoMeta } from "../types/Meta"
import BarraProgresso from "../componentes/BarraProgresso"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import { RodapeFormulario } from "../componentes/Formulario"
import { DadosFicha } from "../componentes/ListaFicha"
import ListaPorDia, { type ItemDoDia } from "../componentes/ListaPorDia"
import { MESES, SITUACAO_META, iconeDaMeta, metaNoVerde, modeloDaMeta, progressoDaMeta, tomDaBarra } from "../dominio/meta"
import { dataBR, diaDeInstante } from "../utils/dateTime"
import { formatMoney } from "../utils/money"
import styles from "./MetaPagina.module.css"

/** "dezembro de 2027" */
const mesPorExtenso = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`

export default function MetaPagina() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [meta, setMeta] = useState<Meta | null | undefined>(undefined)
  const [historico, setHistorico] = useState<MovimentoMeta[] | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    setMeta(undefined); setHistorico(null)
    getMeta(id).then((m) => { if (vivo) setMeta(m) }).catch(() => { if (vivo) setMeta(null) })
    getHistoricoMeta(id).then((h) => { if (vivo) setHistorico(h) }).catch(() => { if (vivo) setHistorico([]) })
    return () => { vivo = false }
  }, [id])

  if (meta === undefined) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>
  if (meta === null)
    return (
      <div className={styles.pagina}>
        <h1 className={styles.titulo}>Meta não encontrada</h1>
        <p className={styles.muted}>Ela pode ter sido excluída.</p>
      </div>
    )

  const Icone = iconeDaMeta(meta.icone)
  const situacao = SITUACAO_META[meta.situacao]
  const pct = Math.round(meta.percentualConcluido)
  const concluida = meta.concluida
  const chegouLa = meta.situacao === "chegou-la"
  const progresso = progressoDaMeta(meta)
  const criarOutraIgual = () => navigate("/metas/nova", { state: { voltarPara: `/metas/${meta.id}`, modelo: modeloDaMeta(meta) } })
  const voltar = { state: { voltarPara: `/metas/${meta.id}` } }
  const pedirExclusao = () => {
    setErro(null)
    if (meta.guardado > 0) setErro(`A meta ainda tem ${formatMoney(meta.guardado)} guardado. Resgate pra uma conta antes de excluir.`)
    else setExcluindo(true)
  }
  const excluir = async () => {
    setOcupado(true); setErro(null)
    try { await excluirMeta(meta.id) } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setExcluindo(false); return }
    navigate("/metas", { replace: true })
  }
  const linhas: ItemDoDia[] = (historico ?? []).map((h) => ({
    id: h.transferenciaId,
    dia: h.data.slice(0, 10),
    icone: h.tipo === "guardou" ? <ArrowDownToLine size={16} strokeWidth={2.25} aria-hidden="true" /> : <ArrowUpFromLine size={16} strokeWidth={2.25} aria-hidden="true" />,
    tomIcone: h.tipo === "guardou" ? "positivo" : "neutro",
    nome: h.tipo === "guardou" ? "Guardou" : "Resgatou",
    sub: h.tipo === "guardou" ? `de ${h.contaNome}` : `pra ${h.contaNome}`,
    valor: h.valor,
    tom: h.tipo === "guardou" ? "positivo" : "neutro",
  }))

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div className={styles.identidade}>
          <span className={styles.icone} data-concluida={metaNoVerde(meta.situacao) || undefined} aria-hidden="true"><Icone size={24} strokeWidth={2.25} /></span>
          <div className={styles.identidadeTexto}>
            <h1 className={styles.titulo}>{meta.nome}</h1>
            <span className={styles.muted}>{meta.dataLimite ? `Até ${mesPorExtenso(meta.dataLimite)}` : "Sem prazo"}</span>
          </div>
        </div>
        {situacao && <Etiqueta tom={situacao.tom}>{situacao.rotulo}</Etiqueta>}
      </header>

      {erro && <p className={styles.alerta} role="alert">{erro}</p>}

      <div className={styles.grade}>
        <div className={styles.principal}>
          <Bloco className={styles.saldo}>
            <span className={styles.rotulo}>{concluida ? "Juntou" : "Guardado"}</span>
            <Dinheiro valor={progresso} className={styles.valorGrande} />
            <span className={styles.muted}>de <Dinheiro valor={meta.valorAlvo} /> · {pct}%{concluida ? ` · concluída em ${dataBR(meta.concluidaEm!)}` : ""}</span>
            <BarraProgresso fracao={meta.valorAlvo > 0 ? progresso / meta.valorAlvo : 0} tom={tomDaBarra(meta.situacao)} rotulo={`${pct}% ${concluida ? "juntado" : "guardado"}`} />
            {concluida ? (
              <div className={styles.acoes}>
                <Botao variante="primario" onClick={criarOutraIgual} icone={<Copy size={15} strokeWidth={2.25} aria-hidden="true" />}>Criar outra igual</Botao>
              </div>
            ) : (
              <div className={styles.acoes}>
                <Botao disabled={meta.guardado <= 0} onClick={() => navigate(`/metas/${meta.id}/resgatar`, voltar)}
                  icone={<ArrowUpFromLine size={15} strokeWidth={2.25} aria-hidden="true" />}>Resgatar</Botao>
                <Botao variante={chegouLa ? "secundario" : "primario"} onClick={() => navigate(`/metas/${meta.id}/guardar`, voltar)}
                  icone={<ArrowDownToLine size={15} strokeWidth={2.25} aria-hidden="true" />}>Guardar</Botao>
                {chegouLa && (
                  <Botao variante="primario" onClick={() => navigate(`/metas/${meta.id}/concluir`, voltar)}
                    icone={<CircleCheck size={15} strokeWidth={2.25} aria-hidden="true" />}>Concluir e usar o dinheiro</Botao>
                )}
              </div>
            )}
          </Bloco>

          <Bloco titulo="Histórico" semRespiro>
            {historico === null ? <div className={styles.respiro}><Esqueleto linhas={3} /></div>
              : linhas.length === 0 ? <p className={styles.vazio}>Nada guardado ainda.</p>
              : <ListaPorDia itens={linhas} />}
          </Bloco>
        </div>

        <aside className={styles.lado}>
          <Bloco titulo="Plano">
            <DadosFicha>
              <div><dt>Quanto quer juntar</dt><dd><Dinheiro valor={meta.valorAlvo} /></dd></div>
              {concluida
                ? <div><dt>Concluída em</dt><dd>{dataBR(meta.concluidaEm!)}</dd></div>
                : <div><dt>Falta</dt><dd><Dinheiro valor={meta.falta} /></dd></div>}
              <div><dt>Prazo</dt><dd>{meta.dataLimite
                ? `${mesPorExtenso(meta.dataLimite)}${meta.mesesRestantes ? ` · ${meta.mesesRestantes} ${meta.mesesRestantes === 1 ? "mês" : "meses"}` : ""}`
                : "Sem prazo"}</dd></div>
              {meta.porMes !== null && <div><dt>Por mês pra chegar no prazo</dt><dd><Dinheiro valor={meta.porMes} /></dd></div>}
              <div><dt>Criada em</dt><dd>{diaDeInstante(meta.criadoEm)}</dd></div>
            </DadosFicha>
          </Bloco>
          {!concluida && (
            <RodapeFormulario>
              <Botao perigo disabled={ocupado} onClick={pedirExclusao} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Excluir</Botao>
              <Botao onClick={() => navigate(`/metas/${meta.id}/editar`, voltar)} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar meta</Botao>
            </RodapeFormulario>
          )}
        </aside>
      </div>

      <Confirmar aberto={excluindo} perigo ocupado={ocupado} titulo={`Excluir a meta ${meta.nome}?`}
        rotuloConfirmar="Excluir" onConfirmar={() => void excluir()} onCancelar={() => setExcluindo(false)} />
    </div>
  )
}
