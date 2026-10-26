// Reconciliação (/reconciliacao): "nesta conta, neste dia, o saldo no banco era X". O app soma o que tem até
// ali, mostra a diferença e guarda o marco. Diferença que sobra se resolve de dois jeitos: lançar o que faltou
// (e confirmar depois) ou ajustar (um lançamento de ajuste, fora do resultado). Uma conta por vez: o resumo
// em cima (saldo no app, última conferência), o formulário de conferir e a lista de marcos, cada um com a
// ficha aberta na própria linha (modelo das outras telas do v2). Movimentos ficam em Transações, já filtrada
// pelo período do marco. Spec: docs/features/reconciliacao/spec.md.
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, Flag, TriangleAlert, Trash2, Plus, Scale, List, Pencil } from "lucide-react"
import { getContas } from "../services/contaService"
import { listMarcos, getSaldoCalculado, criarMarco, fecharDiferenca, removerMarco } from "../services/reconciliacaoService"
import { mensagemDeErro } from "../api/cliente"
import type { Conta } from "../types/Conta"
import type { ReconciliacaoMarco } from "../types/Reconciliacao"
import { TIPO_MARCO } from "../types/Reconciliacao"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import EntradaValor from "../componentes/EntradaValor"
import Etiqueta from "../componentes/Etiqueta"
import { LinhaCampos, RodapeFormulario } from "../componentes/Formulario"
import { AcoesFicha, DadosFicha, GrupoFicha, ItemFicha, ListaFicha } from "../componentes/ListaFicha"
import Selecao from "../componentes/Selecao"
import SeletorData from "../componentes/SeletorData"
import { combinarDataHora, dataBR, dataLocalISO, horaLocalHHMM } from "../utils/dateTime"
import { parseMoney } from "../utils/money"
import styles from "./Reconciliacao.module.css"

// Última conta conferida neste navegador (conveniência; sem ela, a 1ª conta com saldo que não é a carteira).
const CHAVE_CONTA = "v2:reconciliacao:conta"
const contaLembrada = (): string => { try { return localStorage.getItem(CHAVE_CONTA) ?? "" } catch { return "" } }

/** Bate = menos de meio centavo. */
const bate = (dif: number) => Math.abs(dif) < 0.005
/** O dia do marco é o trecho da data (guardado como hora de parede). */
const diaDoMarco = (m: ReconciliacaoMarco) => m.dataHora.slice(0, 10)
/** Hora do corte: hoje é agora; dia passado é o fim do dia. */
const corteDoDia = (dia: string) => combinarDataHora(dia, dia === dataLocalISO() ? horaLocalHHMM() : "23:59")

/** A diferença que vale é a de AGORA (o servidor recalcula na lista): um lançamento com data até o marco, criado,
 *  editado ou excluído depois da conferência, faz o marco deixar de bater. Sem ela, a do dia da conferência. */
const diferencaDe = (m: ReconciliacaoMarco) => m.diferencaAgora ?? (m.temAjuste ? 0 : m.diferenca)

type Situacao = "inicial" | "bateu" | "ajustado" | "diferenca"
const situacaoDoMarco = (m: ReconciliacaoMarco): Situacao =>
  m.tipo === TIPO_MARCO.Baseline ? "inicial" : !bate(diferencaDe(m)) ? "diferenca" : m.temAjuste ? "ajustado" : "bateu"

export default function Reconciliacao() {
  const [contas, setContas] = useState<Conta[] | null>(null)
  const [erroCarga, setErroCarga] = useState(false)
  const [contaId, setContaId] = useState("")
  const [marcos, setMarcos] = useState<ReconciliacaoMarco[] | null>(null)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let vivo = true
    getContas()
      .then((cs) => {
        if (!vivo) return
        setContas(cs)
        const lembrada = contaLembrada()
        const padrao = cs.find((c) => c.id === lembrada) ?? cs.find((c) => !c.isCarteira && c.saldoAtual !== 0) ?? cs[0]
        setContaId((atual) => atual || padrao?.id || "")
      })
      .catch(() => { if (vivo) setErroCarga(true) })
    return () => { vivo = false }
  }, [versao])

  useEffect(() => {
    if (!contaId) return
    try { localStorage.setItem(CHAVE_CONTA, contaId) } catch { /* só não lembra */ }
    let vivo = true
    setMarcos(null)
    listMarcos(contaId).then((ms) => { if (vivo) setMarcos(ms) }).catch(() => { if (vivo) setMarcos([]) })
    return () => { vivo = false }
  }, [contaId, versao])

  const conta = contas?.find((c) => c.id === contaId)
  const ultimo = marcos?.[0]
  // Conferido = o saldo de hoje ainda é o do último marco (nada se moveu depois). Mexeu, está "a conferir".
  const conferido = !!conta && !!ultimo && bate(conta.saldoAtual - ultimo.saldoDeclarado)

  const recarregar = (abrir?: string | null) => { setVersao((v) => v + 1); if (abrir !== undefined) setAbertoId(abrir) }

  return (
    <div className={styles.pagina}>
      <Bloco className={styles.resumo}>
        <div className={styles.topo}>
          <Campo rotulo="Conta" className={styles.conta}>
            <Selecao valor={contaId} placeholder={contas?.length === 0 ? "Nenhuma conta" : "Escolha a conta"} desabilitado={!contas || contas.length === 0}
              opcoes={(contas ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))} onChange={(v) => { setContaId(v); setAbertoId(null) }} />
          </Campo>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Saldo no app</span>
            {conta ? <Dinheiro valor={conta.saldoAtual} className={styles.numeroValor} tom={conta.saldoAtual < 0 ? "negativo" : undefined} /> : <span className={styles.numeroEsqueleto} />}
          </div>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Última conferência</span>
            {!conta || marcos === null ? <span className={styles.numeroEsqueleto} />
              : !ultimo ? <span className={styles.semMarco}>Nenhuma ainda</span>
              : <span className={styles.ultima}>
                  <span className={styles.ultimaDia}>{dataBR(diaDoMarco(ultimo))}</span>
                  {conferido ? <Etiqueta tom="positivo">Bate</Etiqueta> : <Etiqueta tom="alerta">A conferir</Etiqueta>}
                </span>}
          </div>
        </div>
        {erroCarga && <p className={styles.alerta} role="alert">Não deu pra carregar as contas.</p>}
      </Bloco>

      {conta && <Conferir key={conta.id} conta={conta} aoSalvar={(m) => recarregar(m.id)} />}

      <Bloco titulo="Conferências" semRespiro>
        {marcos === null ? (
          <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
        ) : marcos.length === 0 ? (
          <p className={styles.vazio}>Nenhuma conferência nesta conta. Diga o saldo que está no banco e o app confere.</p>
        ) : (
          <ListaFicha rotulo="Conferências">
            <GrupoFicha rotulo={conta?.nome ?? ""}>
              {marcos.map((m, i) => (
                <Marco key={m.id} m={m} conta={conta!} anterior={marcos[i + 1]} aberto={m.id === abertoId}
                  aoAbrir={() => setAbertoId((atual) => (atual === m.id ? null : m.id))} aoMudar={() => recarregar(null)} />
              ))}
            </GrupoFicha>
          </ListaFicha>
        )}
      </Bloco>
    </div>
  )
}

// ── Conferir: dia + saldo no banco → o app mostra o que tem até ali e a diferença; salvar grava o marco ─────
function Conferir({ conta, aoSalvar }: { conta: Conta; aoSalvar: (m: ReconciliacaoMarco) => void }) {
  const hoje = dataLocalISO()
  const [dia, setDia] = useState(hoje)
  const [saldo, setSaldo] = useState("")
  const [calculado, setCalculado] = useState<number | null>(null)
  const [erroCalculo, setErroCalculo] = useState(false)
  const [erros, setErros] = useState<{ dia?: string; saldo?: string }>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Uma chave por tentativa: repetir o clique (ou a rede cair no meio) não grava dois marcos.
  const [chave, setChave] = useState(() => crypto.randomUUID())

  useEffect(() => {
    if (!dia) { setCalculado(null); return }
    let vivo = true
    setCalculado(null); setErroCalculo(false)
    getSaldoCalculado(conta.id, corteDoDia(dia))
      .then((v) => { if (vivo) setCalculado(v) })
      .catch(() => { if (vivo) setErroCalculo(true) })
    return () => { vivo = false }
  }, [conta.id, dia])

  const preenchido = saldo.trim() !== ""
  const declarado = parseMoney(saldo)
  const diferenca = calculado !== null && preenchido ? declarado - calculado : null

  const salvar = async () => {
    const e: typeof erros = {}
    if (!dia) e.dia = "Escolha o dia."
    else if (dia > hoje) e.dia = "O dia não pode ser no futuro."
    if (!preenchido) e.saldo = "Digite o saldo que está no banco."
    setErros(e)
    if (Object.keys(e).length > 0 || calculado === null) return
    setSalvando(true); setErro(null)
    try {
      const m = await criarMarco({ contaId: conta.id, dataHora: corteDoDia(dia), saldoDeclarado: declarado, tipo: TIPO_MARCO.Verificacao }, chave)
      setSaldo(""); setChave(crypto.randomUUID())
      aoSalvar(m)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally { setSalvando(false) }
  }

  return (
    <Bloco titulo="Conferir saldo">
      <div className={styles.conferir}>
        <LinhaCampos>
          <Campo rotulo="Dia" erro={erros.dia}>
            <SeletorData valor={dia} max={hoje} onChange={(v) => { setDia(v); setErros((x) => ({ ...x, dia: undefined })) }} />
          </Campo>
          <Campo rotulo="Saldo no banco" erro={erros.saldo}>
            <EntradaValor compacto valor={saldo} onChange={(v) => { setSaldo(v); setErros((x) => ({ ...x, saldo: undefined })) }} />
          </Campo>
        </LinhaCampos>

        <dl className={styles.comparacao} aria-label="Comparação">
          <div>
            <dt>No app {dia === hoje ? "agora" : `até ${dataBR(dia)}`}</dt>
            <dd>{erroCalculo ? <span className={styles.mudo}>não deu pra calcular</span> : calculado === null ? <span className={styles.mudo}>calculando…</span> : <Dinheiro valor={calculado} />}</dd>
          </div>
          <div data-destaque="true">
            <dt>Diferença</dt>
            <dd>
              {diferenca === null ? <span className={styles.mudo}>digite o saldo do banco</span>
                : bate(diferenca) ? <span className={styles.bateu}><Check size={16} strokeWidth={2.5} aria-hidden="true" />Bate</span>
                : <span className={styles.difere}><TriangleAlert size={16} strokeWidth={2.25} aria-hidden="true" /><Dinheiro valor={diferenca} tom={diferenca > 0 ? "positivo" : "negativo"} className={styles.diferenca} /></span>}
            </dd>
          </div>
        </dl>
        {diferenca !== null && !bate(diferenca) && (
          <p className={styles.dica}>{diferenca > 0 ? "O banco tem mais que o app: falta lançar alguma entrada." : "O banco tem menos que o app: falta lançar alguma saída."} Salve e resolva na lista embaixo.</p>
        )}
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <RodapeFormulario>
          <Botao variante="primario" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar conferência"}</Botao>
        </RodapeFormulario>
      </div>
    </Bloco>
  )
}

// ── Um marco: a linha (dia, saldo, situação) e, aberta, a ficha com a diferença de AGORA e o que fazer ─────
function Marco({ m, conta, anterior, aberto, aoAbrir, aoMudar }: {
  m: ReconciliacaoMarco; conta: Conta; anterior?: ReconciliacaoMarco; aberto: boolean; aoAbrir: () => void; aoMudar: () => void
}) {
  const navigate = useNavigate()
  const situacao = situacaoDoMarco(m)
  const real = !m.derivado
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [chave] = useState(() => crypto.randomUUID())
  // O app até a data do marco, como está AGORA (lançar o que faltava faz bater; lançar algo antigo depois desfaz).
  const calculado = m.saldoCalculadoAgora ?? m.saldoCalculado
  const diferenca = diferencaDe(m)
  const pendente = real && !m.temAjuste && !bate(diferenca)
  // Já tinha ajuste e mudou depois: um ajuste por marco; resolve lançando ou corrigindo o que mudou.
  const mudouDepoisDoAjuste = real && m.temAjuste && !bate(diferenca)
  // Salvou com diferença, lançou o que faltava: agora bate; só confirmar (o marco atualiza).
  const passouABater = real && !m.temAjuste && bate(diferenca) && !bate(m.diferenca)

  const fechar = async () => {
    setOcupado(true); setErro(null)
    try { await fecharDiferenca(m.id, chave); aoMudar() } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const remover = async () => {
    setOcupado(true); setErro(null)
    try { await removerMarco(m.id); aoMudar() } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setRemovendo(false) }
  }
  const verLancamentos = () => navigate("/transacoes", { state: { filtros: { contaId: conta.id, de: anterior ? diaDoMarco(anterior) : "", ate: diaDoMarco(m) } } })

  const etiqueta = situacao === "inicial" ? <Etiqueta>Ponto de partida</Etiqueta>
    : situacao === "ajustado" ? <Etiqueta>Ajustado</Etiqueta>
    : situacao === "bateu" ? <Etiqueta tom="positivo">Bateu</Etiqueta>
    : <Etiqueta tom="alerta">Diferença</Etiqueta>

  return (
    <>
      <ItemFicha id={`marco-${m.id}`} aberto={aberto} aoAbrir={aoAbrir}
        marca={<span className={styles.marca} data-situacao={situacao} aria-hidden="true">
          {situacao === "inicial" ? <Flag size={16} strokeWidth={2.25} /> : situacao === "diferenca" ? <TriangleAlert size={16} strokeWidth={2.25} /> : <Check size={16} strokeWidth={2.5} />}
        </span>}
        titulo={dataBR(diaDoMarco(m))}
        detalhe={situacao === "inicial" ? "Saldo inicial da conta" : situacao === "diferenca" ? <>Banco <Dinheiro valor={m.saldoDeclarado} /> · app <Dinheiro valor={calculado} /></> : <>Banco <Dinheiro valor={m.saldoDeclarado} /></>}
        direita={etiqueta}>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <DadosFicha>
          <div><dt>Saldo no banco</dt><dd><Dinheiro valor={m.saldoDeclarado} /></dd></div>
          {situacao !== "inicial" && <div><dt>No app</dt><dd><Dinheiro valor={calculado} /></dd></div>}
          {situacao !== "inicial" && (
            <div><dt>Diferença</dt><dd>{bate(diferenca) ? "Bate" : <Dinheiro valor={diferenca} tom={diferenca > 0 ? "positivo" : "negativo"} />}</dd></div>
          )}
          {m.temAjuste && <div><dt>Ajuste lançado</dt><dd><Dinheiro valor={Math.abs(m.diferenca)} tom={m.diferenca > 0 ? "positivo" : "negativo"} /></dd></div>}
        </DadosFicha>
        <AcoesFicha>
          {real && <Botao variante="texto" perigo disabled={ocupado} onClick={() => setRemovendo(true)} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Remover</Botao>}
          {m.derivado && <Botao variante="texto" onClick={() => navigate(`/bancos/${conta.id}/editar`, { state: { voltarPara: "/reconciliacao" } })} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar saldo inicial</Botao>}
          {situacao !== "inicial" && <Botao onClick={verLancamentos} icone={<List size={15} strokeWidth={2.25} aria-hidden="true" />}>Ver lançamentos</Botao>}
          {(pendente || mudouDepoisDoAjuste) && <Botao onClick={() => navigate("/transacoes/nova", { state: { voltarPara: "/reconciliacao" } })} icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Lançar o que falta</Botao>}
          {pendente && <Botao variante="primario" disabled={ocupado} onClick={fechar} icone={<Scale size={15} strokeWidth={2.25} aria-hidden="true" />}>{ocupado ? "Ajustando…" : "Ajustar"}</Botao>}
          {passouABater && <Botao variante="primario" disabled={ocupado} onClick={fechar} icone={<Check size={15} strokeWidth={2.5} aria-hidden="true" />}>{ocupado ? "Confirmando…" : "Agora bate: confirmar"}</Botao>}
        </AcoesFicha>
      </ItemFicha>
      <Confirmar aberto={removendo} titulo="Remover esta conferência?" perigo ocupado={ocupado} rotuloConfirmar="Remover"
        texto={m.temAjuste ? "O lançamento de ajuste que ela criou também sai." : "Só a conferência sai; nenhum lançamento muda."}
        onConfirmar={remover} onCancelar={() => setRemovendo(false)} />
    </>
  )
}
