// Receita do Orçamento (/orcamento, seção que era a tela Renda): o mês da pessoa como FATO (o que caiu em "Renda")
// e o que ela DECLARA esperar: a fixa (salário, aposentadoria, benefício) e a variável (comissão, bico, diária).
// Vale até ela mudar. Nada a ver com "contas fixas", que são contas a pagar (o Gustavo, 2026-10-18). O que a família
// vê disso se escolhe NA família (ficha do próprio membro), não aqui. Spec: docs/features/familia/renda-e-visibilidade.md.
// O mês vem da página; quando o esperado muda, `aoMudar` avisa pra refazer o "a ser alocado".
import { useEffect, useState } from "react"
import { definirRendaPrevista, getRendaMes, limparRendaPrevista } from "../services/rendaService"
import { mensagemDeErro } from "../api/cliente"
import type { RendaMes } from "../types/Renda"
import { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import EntradaValor from "../componentes/EntradaValor"
import { LinhaCampos } from "../componentes/Formulario"
import { nomeDoPeriodo, type Periodo } from "../componentes/NavegadorMes"
import { dataBR } from "../utils/dateTime"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./OrcamentoReceita.module.css"

export default function OrcamentoReceita({ periodo, aoMudar }: { periodo: Periodo; aoMudar?: () => void }) {
  const [renda, setRenda] = useState<RendaMes | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [fixa, setFixa] = useState("")
  const [variavel, setVariavel] = useState("")
  const [salvando, setSalvando] = useState(false)

  const aplicar = (r: RendaMes) => {
    setRenda(r)
    setFixa(r.fixaEsperada ? moneyParaCampo(r.fixaEsperada) : "")
    setVariavel(r.variavelEsperada ? moneyParaCampo(r.variavelEsperada) : "")
  }

  useEffect(() => {
    let vivo = true
    setRenda(null); setErro(null)
    getRendaMes(periodo.ano, periodo.mes)
      .then((r) => { if (vivo) aplicar(r) })
      .catch((e) => { if (vivo) setErro(mensagemDeErro(e)) })
    return () => { vivo = false }
  }, [periodo])

  const rodar = async (acao: () => Promise<RendaMes>) => {
    setSalvando(true); setErro(null)
    try { aplicar(await acao()); aoMudar?.() } catch (e) { setErro(mensagemDeErro(e)) }
    setSalvando(false)
  }
  const salvar = () => rodar(() => definirRendaPrevista(periodo.ano, periodo.mes, parseMoney(fixa), parseMoney(variavel)))
  const usarMedia = (media: number) => rodar(() => definirRendaPrevista(periodo.ano, periodo.mes, media, 0))
  const mesNome = nomeDoPeriodo(periodo)
  const mudou = !!renda && (parseMoney(fixa) !== renda.fixaEsperada || parseMoney(variavel) !== renda.variavelEsperada)

  return (
    <>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      {!renda ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div> : (
        <div className={styles.miolo}>
          <div className={styles.numeros}>
            <Numero rotulo="Esperado" valor={renda.previsto} />
            <Numero rotulo="Recebido" valor={renda.recebido} tom="positivo" />
            <Numero rotulo={renda.falta > 0 ? "Falta" : "A mais"} valor={renda.falta > 0 ? renda.falta : Math.max(0, renda.recebido - renda.previsto)} />
          </div>

          {/* O que a pessoa espera receber: fixa + variável. Declara uma vez, vale até mudar. */}
          <div className={styles.esperado} aria-label="O que você espera receber">
            <span className={styles.esperadoTitulo}>
              O que você espera receber por mês
              {renda.previsto > 0 && !renda.declaradoNoMes && <span className={styles.mudo}> · vale o que você declarou antes</span>}
            </span>
            <LinhaCampos>
              <Campo rotulo="Fixa (salário, aposentadoria, benefício)">
                <EntradaValor compacto valor={fixa} onChange={setFixa} />
              </Campo>
              <Campo rotulo="Variável (comissão, bico, extra)">
                <EntradaValor compacto valor={variavel} onChange={setVariavel} />
              </Campo>
            </LinhaCampos>
            <div className={styles.esperadoAcoes}>
              {renda.sugestaoMedia3Meses !== null && renda.previsto === 0 && (
                <span className={styles.dica}>Nos últimos meses caiu em média <Dinheiro valor={renda.sugestaoMedia3Meses} /> por mês.{" "}
                  <button type="button" className={styles.linkBotao} disabled={salvando} onClick={() => usarMedia(renda.sugestaoMedia3Meses!)}>Usar como esperado</button></span>
              )}
              <span className={styles.esperadoBotoes}>
                {renda.declaradoNoMes && <Botao variante="texto" disabled={salvando} onClick={() => rodar(() => limparRendaPrevista(periodo.ano, periodo.mes))}>Limpar este mês</Botao>}
                <Botao variante="primario" disabled={salvando || !mudou} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</Botao>
              </span>
            </div>
          </div>

          {renda.entradas.length === 0 ? <p className={styles.vazio}>Nenhuma entrada de renda em {mesNome.toLowerCase()}.</p> : (
            <ul className={styles.entradas} aria-label="Entradas do mês">
              {renda.entradas.map((e) => (
                <li key={e.id} data-prevista={e.recebida ? undefined : "true"}>
                  <span className={styles.entradaData}>{dataBR(e.data)}</span>
                  <span className={styles.entradaTexto}>{e.descricao}{e.subcategoria && <span className={styles.mudo}> · {e.subcategoria}</span>}{!e.recebida && <span className={styles.mudo}> · ainda vai cair</span>}</span>
                  <Dinheiro valor={e.valor} className={styles.entradaValor} tom={e.recebida ? "positivo" : "neutro"} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: "positivo" }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      <Dinheiro valor={valor} className={styles.numeroValor} tom={tom} />
    </div>
  )
}
