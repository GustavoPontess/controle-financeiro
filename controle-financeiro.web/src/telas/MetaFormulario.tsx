// Nova meta (/metas/nova) e editar (/metas/:id/editar): nome, quanto quer juntar, o ícone e o prazo (mês e ano,
// opcional). Na meta nova, as sugestões (reserva de emergência, viagem, casa…) preenchem nome e ícone num toque.
// "Criar outra igual" (de uma meta concluída) chega com `state.modelo`: nome, ícone, quanto e a mesma duração do
// prazo a partir deste mês, tudo editável; nada do dinheiro nem do histórico vem junto.
// O prazo é um MÊS; o servidor guarda o dia 1. Mês que já passou não vale (na edição, o prazo antigo pode ficar).
// Enquanto a pessoa preenche quanto e até quando, a tela responde se cabe (renda − gasto típico − outras metas, no
// servidor) e, quando não cabe, oferece o mês em que dá pra chegar como prazo. Avisa, não proíbe.
// Guardar e resgatar são outras telas (a partir da página da meta): aqui é só a meta.
import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { atualizarMeta, criarMeta, getMeta, getViabilidadeMeta } from "../services/metaService"
import type { ViabilidadeMeta } from "../types/Meta"
import Resposta from "../componentes/Resposta"
import { useAtrasado } from "../utils/useAtrasado"
import { mensagemDeErro } from "../api/cliente"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { Campos, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Interruptor from "../componentes/Interruptor"
import Selecao from "../componentes/Selecao"
import { ICONES_META, MAX_NOME_META, MESES, TEMAS_META, prazoIso, type ModeloMeta } from "../dominio/meta"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./MetaFormulario.module.css"
import { mesAtual } from "../utils/dateTime"

type Erros = Partial<Record<"nome" | "valor" | "prazo", string>>

export default function MetaFormulario() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const estado = useLocation().state as { voltarPara?: string; modelo?: ModeloMeta } | null
  const voltarPara = estado?.voltarPara ?? (id ? `/metas/${id}` : "/metas")
  const modelo = id ? undefined : estado?.modelo
  const { ano: anoAtual, mes: mesDeHoje } = mesAtual()
  // Prazo do modelo: a mesma duração, contando este mês (3 meses em out → dez).
  const fimModelo = modelo?.meses ? new Date(anoAtual, mesDeHoje - 1 + modelo.meses - 1, 1) : null
  const [carregando, setCarregando] = useState(!!id)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [nome, setNome] = useState(modelo?.nome ?? "")
  const [valor, setValor] = useState(modelo ? moneyParaCampo(modelo.valorAlvo) : "")
  const [icone, setIcone] = useState(modelo?.icone ?? "alvo")
  const [comPrazo, setComPrazo] = useState(modelo ? !!modelo.meses : true)
  const [mes, setMes] = useState(fimModelo ? String(fimModelo.getMonth() + 1) : "")
  const [ano, setAno] = useState(fimModelo ? String(fimModelo.getFullYear()) : "")
  const [prazoOriginal, setPrazoOriginal] = useState<string | null>(null)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))
  const [viabilidade, setViabilidade] = useState<ViabilidadeMeta | null>(null)

  useEffect(() => {
    if (!id) return
    let vivo = true
    getMeta(id).then((m) => {
      if (!vivo) return
      setNome(m.nome)
      setValor(moneyParaCampo(m.valorAlvo))
      setIcone(m.icone || "alvo")
      setComPrazo(!!m.dataLimite)
      if (m.dataLimite) {
        setAno(m.dataLimite.slice(0, 4)); setMes(String(Number(m.dataLimite.slice(5, 7))))
        setPrazoOriginal(m.dataLimite.slice(0, 7))
      }
      setCarregando(false)
    }).catch(() => { if (vivo) { setErroCarga("Não deu pra carregar a meta."); setCarregando(false) } })
    return () => { vivo = false }
  }, [id])

  // "Cabe?": pergunta ao servidor quando quanto e o prazo estão preenchidos (espera a pessoa parar de digitar).
  const valorNumero = parseMoney(valor)
  const prazoEscolhido = comPrazo && mes && ano ? prazoIso(Number(ano), Number(mes)) : null
  const pergunta = useAtrasado(valorNumero > 0 && (!comPrazo || prazoEscolhido) ? `${valorNumero}|${prazoEscolhido ?? ""}` : "", 400)
  useEffect(() => {
    let vivo = true
    if (!pergunta) { setViabilidade(null); return }
    const [v, p] = pergunta.split("|")
    getViabilidadeMeta(Number(v), p || null, id).then((r) => { if (vivo) setViabilidade(r) }).catch(() => { if (vivo) setViabilidade(null) })
    return () => { vivo = false }
  }, [pergunta, id])
  const usarPrazo = (iso: string) => {
    setComPrazo(true); setAno(iso.slice(0, 4)); setMes(String(Number(iso.slice(5, 7)))); limpa("prazo")
  }
  const prazoSugerido = viabilidade?.prazoQueCabe ?? null

  const anos = Array.from({ length: 31 }, (_, i) => anoAtual + i)
  if (ano && !anos.includes(Number(ano))) anos.unshift(Number(ano))

  const enviar = async () => {
    setErro(null)
    const e: Erros = {}
    if (!nome.trim()) e.nome = "Dê um nome pra meta."
    const v = parseMoney(valor)
    if (!(v > 0)) e.valor = "Diga quanto quer juntar."
    let dataLimite: string | null = null
    if (comPrazo) {
      if (!mes || !ano) e.prazo = "Escolha o mês e o ano."
      else {
        dataLimite = prazoIso(Number(ano), Number(mes))
        const passou = Number(ano) * 12 + Number(mes) < anoAtual * 12 + mesDeHoje
        if (passou && dataLimite.slice(0, 7) !== prazoOriginal) e.prazo = "Esse mês já passou."
      }
    }
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true)
    try {
      const dto = { nome: nome.trim(), valorAlvo: v, dataLimite, icone }
      const m = id ? await atualizarMeta(id, dto) : await criarMeta(dto)
      navigate(`/metas/${m.id}`, { replace: true })
    } catch (err) { setErro(mensagemDeErro(err)); setSalvando(false) }
  }

  return (
    <PaginaFormulario titulo={id ? "Editar meta" : "Nova meta"} carregando={carregando} erroCarga={erroCarga}>
      <Formulario onSubmit={() => { void enviar() }}>
        <Campos>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          {!id && (
            <Campo rotulo="Sugestões" grupo>
              <div className={styles.temas}>
                {TEMAS_META.map((t) => {
                  const Icone = ICONES_META.find((i) => i.chave === t.icone)!.Icone
                  return (
                    <button key={t.nome} type="button" className={styles.tema} data-ativo={nome === t.nome || undefined}
                      onClick={() => { setNome(t.nome); setIcone(t.icone); limpa("nome") }}>
                      <Icone size={14} strokeWidth={2.25} aria-hidden="true" />{t.nome}
                    </button>
                  )
                })}
              </div>
            </Campo>
          )}
          <LinhaCampos colunas="minmax(0, 2fr) minmax(0, 1fr)">
            <Campo rotulo="Nome" erro={erros.nome}>
              <Entrada value={nome} maxLength={MAX_NOME_META} placeholder="Entrada do apê, viagem, reserva de emergência" autoFocus
                onChange={(ev) => { setNome(ev.target.value); limpa("nome") }} />
            </Campo>
            <Campo rotulo="Quanto quer juntar" erro={erros.valor}>
              <EntradaValor compacto valor={valor} onChange={(x) => { setValor(x); limpa("valor") }} />
            </Campo>
          </LinhaCampos>
          <Campo rotulo="Ícone" grupo>
            <EscolhaIcone valor={icone} onChange={setIcone} />
          </Campo>
          <Interruptor ligado={comPrazo} onChange={(on) => { setComPrazo(on); limpa("prazo") }}>Tem prazo</Interruptor>
          {comPrazo && (
            <Campo rotulo="Até quando" erro={erros.prazo}>
              <LinhaCampos>
                <Selecao valor={mes} placeholder="Mês" ariaLabel="Mês do prazo" invalido={!!erros.prazo}
                  opcoes={MESES.map((m, i) => ({ valor: String(i + 1), rotulo: m.charAt(0).toUpperCase() + m.slice(1) }))}
                  onChange={(x) => { setMes(x); limpa("prazo") }} />
                <Selecao valor={ano} placeholder="Ano" ariaLabel="Ano do prazo" invalido={!!erros.prazo}
                  opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a) }))}
                  onChange={(x) => { setAno(x); limpa("prazo") }} />
              </LinhaCampos>
            </Campo>
          )}
          {viabilidade && (
            <div className={styles.cabe}>
              <Resposta tom={viabilidade.resposta.tom} texto={viabilidade.resposta.texto} acoes={viabilidade.resposta.acoes} />
              {prazoSugerido && prazoSugerido.slice(0, 7) !== prazoEscolhido?.slice(0, 7) && (
                <Botao variante="texto" onClick={() => usarPrazo(prazoSugerido)}>
                  Usar {MESES[Number(prazoSugerido.slice(5, 7)) - 1]} de {prazoSugerido.slice(0, 4)} como prazo
                </Botao>
              )}
            </div>
          )}
        </Campos>
        <RodapeFormulario>
          <Botao onClick={() => navigate(voltarPara, { replace: true })} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Salvando…" : id ? "Salvar" : "Criar meta"}</Botao>
        </RodapeFormulario>
      </Formulario>
    </PaginaFormulario>
  )
}

/** Escolha do ícone: role="radiogroup" (Tab entra no escolhido, setas trocam), como os Segmentos. */
function EscolhaIcone({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([])
  const ativo = Math.max(0, ICONES_META.findIndex((i) => i.chave === valor))
  const tecla = (e: KeyboardEvent, i: number) => {
    const passo = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!passo) return
    e.preventDefault()
    const n = (i + passo + ICONES_META.length) % ICONES_META.length
    onChange(ICONES_META[n].chave)
    botoes.current[n]?.focus()
  }
  return (
    <div role="radiogroup" aria-label="Ícone da meta" className={styles.icones}>
      {ICONES_META.map(({ chave, rotulo, Icone }, i) => (
        <button key={chave} ref={(el) => { botoes.current[i] = el }} type="button" role="radio" aria-checked={chave === valor}
          aria-label={rotulo} title={rotulo} tabIndex={i === ativo ? 0 : -1} className={styles.iconeOpcao} data-ativo={chave === valor || undefined}
          onClick={() => onChange(chave)} onKeyDown={(e) => tecla(e, i)}>
          <Icone size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
