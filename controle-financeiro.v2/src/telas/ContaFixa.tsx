// Página de uma conta fixa (/contas-fixas/:id): valor, como repete, começo/fim, categoria, de onde sai e a
// próxima cobrança (com "alterar só esta"). Ações no pé: excluir, cancelar (definitivo, com motivo),
// pausar/retomar (só a pausada volta — cancelada é definitiva, o servidor também recusa) e editar.
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { Ban, Pause, Pencil, Play, Trash2 } from "lucide-react"
import { cancelarRecorrente, deleteRecorrente, getRecorrente, toggleRecorrente } from "../services/recorrenteService"
import { mensagemDeErro } from "../api/cliente"
import type { Recorrente } from "../types/Recorrente"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Entrada from "../componentes/Entrada"
import Etiqueta from "../componentes/Etiqueta"
import { RodapeFormulario } from "../componentes/Formulario"
import { SITUACAO, descreverRepeticao } from "../dominio/contaFixa"
import { TIPO } from "../dominio/transacao"
import { dataBR } from "../utils/dateTime"
import styles from "./ContaFixa.module.css"

const MAX_MOTIVO = 200

export default function ContaFixa() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/contas-fixas"
  const [r, setR] = useState<Recorrente | null | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<"excluir" | "cancelar" | null>(null)
  const [motivo, setMotivo] = useState("")
  const [motivoErro, setMotivoErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Pausar/retomar manda o estado pedido: enquanto o servidor não responde, o botão não aceita outro clique.
  const alternando = useRef(false)

  const carregar = () => getRecorrente(id).then(setR).catch(() => setR(null))
  useEffect(() => { setR(undefined); void carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (r === undefined) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>
  if (r === null) return <div className={styles.pagina}><Bloco><p className={styles.muted}>Conta fixa não encontrada.</p></Bloco></div>

  const receita = r.tipo === TIPO.receita
  const sit = SITUACAO[r.situacao]
  const viva = r.situacao === "ativa" || r.situacao === "pausada"
  const dados: [string, string][] = [
    ["Repete", descreverRepeticao(r)],
    ["Começou em", dataBR(r.dataInicio)],
    ["Termina em", r.dataFim ? dataBR(r.dataFim) : "Sem fim"],
    ["Categoria", r.categoriaNome ? (r.subcategoriaNome ? `${r.categoriaNome} › ${r.subcategoriaNome}` : r.categoriaNome) : "Sem categoria"],
    [r.cartaoCreditoId ? "Cartão" : "Conta", r.cartaoCreditoNome ?? r.contaNome ?? "Não informada"],
    [receita ? "Como recebe" : "Como paga", r.meioPagamentoDescricao ?? "Não informado"],
    ["Próxima cobrança", r.proximaCobranca ? dataBR(r.proximaCobranca) : "Nenhuma"],
  ]

  const alternar = async () => {
    if (alternando.current) return
    alternando.current = true; setErro(null)
    try { await toggleRecorrente(r.id, !r.ativo); await carregar() } catch (e) { setErro(mensagemDeErro(e)) } finally { alternando.current = false }
  }
  const abrir = (o: "excluir" | "cancelar") => { setMotivo(""); setMotivoErro(null); setErro(null); setConfirmando(o) }
  const confirmar = async () => {
    if (!confirmando) return
    const m = motivo.trim()
    if (confirmando === "cancelar" && !m) { setMotivoErro("Diga o motivo. Ele fica no histórico."); return }
    setOcupado(true)
    try {
      if (confirmando === "excluir") { await deleteRecorrente(r.id); navigate(voltarPara, { replace: true }); return }
      await cancelarRecorrente(r.id, { motivo: m })
    } catch (e) {
      setErro(mensagemDeErro(e)); setOcupado(false); setConfirmando(null); return
    }
    setOcupado(false); setConfirmando(null)
    await carregar()
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <h2 className={styles.titulo}>{r.descricao}</h2>
        <div className={styles.chips}>
          <Etiqueta tom={sit.tom}>{sit.rotulo}{r.situacao === "cancelada" && r.canceladoEm ? ` em ${dataBR(r.canceladoEm)}` : ""}</Etiqueta>
          <Etiqueta tom={receita ? "positivo" : undefined}>{receita ? "Receita" : "Despesa"}</Etiqueta>
        </div>
      </header>

      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      {r.situacao === "cancelada" && r.motivoCancelamento && <p className={styles.muted}>Motivo: {r.motivoCancelamento}</p>}

      <Bloco>
        <Dinheiro valor={r.valor} className={styles.valor} tom={!viva ? "neutro" : receita ? "positivo" : "negativo"} />
        <dl className={styles.dados}>
          {dados.map(([rotulo, valor]) => (
            <div key={rotulo} className={styles.dado}><dt>{rotulo}</dt><dd>{valor}</dd></div>
          ))}
        </dl>
      </Bloco>

      {r.proximaCobranca && r.situacao === "ativa" && (
        <Bloco titulo="Próxima cobrança" acao="Alterar só esta" aoClicar={() => navigate(`/contas-fixas/${r.id}/proxima`, { state: { voltarPara: `/contas-fixas/${r.id}` } })}>
          <p className={styles.muted}>{dataBR(r.proximaCobranca)} · <Dinheiro valor={r.valor} />. Dá pra mudar o valor ou a descrição só dessa, sem mexer nas seguintes.</p>
        </Bloco>
      )}

      <RodapeFormulario>
        <Botao perigo onClick={() => abrir("excluir")} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Excluir</Botao>
        {viva && <Botao perigo onClick={() => abrir("cancelar")} icone={<Ban size={15} strokeWidth={2.25} aria-hidden="true" />}>Cancelar</Botao>}
        {viva && (
          <Botao onClick={() => { void alternar() }} icone={r.ativo ? <Pause size={15} strokeWidth={2.25} aria-hidden="true" /> : <Play size={15} strokeWidth={2.25} aria-hidden="true" />}>
            {r.ativo ? "Pausar" : "Retomar"}
          </Botao>
        )}
        {viva && <Botao variante="primario" onClick={() => navigate(`/contas-fixas/${r.id}/editar`, { state: { voltarPara: `/contas-fixas/${r.id}` } })} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar</Botao>}
      </RodapeFormulario>

      <Confirmar
        aberto={confirmando !== null}
        titulo={confirmando === "excluir" ? "Excluir conta fixa?" : "Cancelar conta fixa?"}
        texto={confirmando === "excluir"
          ? <>{r.descricao} some da lista e as cobranças que ainda não aconteceram são canceladas. As já lançadas ficam.</>
          : <>Para de cobrar a partir de agora: as cobranças futuras são canceladas e a conta fixa vai pra Encerradas. Não dá pra retomar depois.</>}
        rotuloConfirmar={confirmando === "excluir" ? "Excluir" : "Cancelar conta fixa"}
        rotuloCancelar={confirmando === "excluir" ? "Cancelar" : "Manter"}
        perigo
        ocupado={ocupado}
        onConfirmar={() => { void confirmar() }}
        onCancelar={() => { if (!ocupado) setConfirmando(null) }}>
        {confirmando === "cancelar" && (
          <Campo rotulo="Motivo" erro={motivoErro}>
            <Entrada value={motivo} maxLength={MAX_MOTIVO} placeholder="Cancelei a assinatura" autoFocus
              onChange={(e) => { setMotivo(e.target.value); setMotivoErro(null) }} />
          </Campo>
        )}
      </Confirmar>
    </div>
  )
}
