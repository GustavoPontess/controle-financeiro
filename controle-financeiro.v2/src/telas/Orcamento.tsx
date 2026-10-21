// Orçamento (/orcamento, menu principal; juntou as telas Renda e Limites, pedido do Gustavo 2026-10-21 a partir da
// planilha dele): orçamento base zero. A renda que a pessoa espera receber no mês ganha destino nas despesas
// planejadas (por categoria, vale todo mês até mudar) e no que as metas pedem por mês. No topo, o "a ser alocado"
// (renda esperada − planejado − metas, calculado no servidor) com a resposta; zerado, toda a renda tem destino. Embaixo,
// as três seções: Receita (o que espera e o que caiu), Despesas (planejado × gasto) e Guardar (as metas).
// O formulário de planejar volta pra cá com o mês e a linha aberta (state { ano, mes, abrir }).
import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CircleCheck, PiggyBank } from "lucide-react"
import { getOrcamentoDoMes } from "../services/orcamentoService"
import type { MetaDoOrcamento, OrcamentoDoMes } from "../types/Orcamento"
import BarraProgresso from "../componentes/BarraProgresso"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { Dinheiro } from "../componentes/Dinheiro"
import { AcoesFicha, DadosFicha, ItemFicha, ListaFicha } from "../componentes/ListaFicha"
import NavegadorMes, { periodoDeHoje, type Periodo } from "../componentes/NavegadorMes"
import Resposta from "../componentes/Resposta"
import { iconeDaMeta } from "../dominio/meta"
import OrcamentoDespesas from "./OrcamentoDespesas"
import OrcamentoReceita from "./OrcamentoReceita"
import styles from "./Orcamento.module.css"

/** Ida e volta com o formulário de planejar: o mês e a linha que abre. */
type Estado = { ano?: number; mes?: number; abrir?: string } | null

export default function Orcamento() {
  const estado = useLocation().state as Estado
  const [periodo, setPeriodo] = useState<Periodo>(() => estado?.ano && estado?.mes ? { ano: estado.ano, mes: estado.mes } : periodoDeHoje())
  const [dados, setDados] = useState<OrcamentoDoMes | null>(null)
  const [erro, setErro] = useState(false)
  const [versao, setVersao] = useState(0) // muda quando uma seção muda: o "a ser alocado" se refaz
  const refazer = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    let vivo = true
    setErro(false)
    getOrcamentoDoMes(periodo.ano, periodo.mes)
      .then((d) => { if (vivo) setDados(d) })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [periodo, versao])

  const mudarMes = (p: Periodo) => { setDados(null); setPeriodo(p) }
  const alocado = !!dados && dados.rendaEsperada > 0 && Math.abs(dados.aAlocar) < 0.005

  return (
    <div className={styles.pagina}>
      <NavegadorMes periodo={periodo} onChange={mudarMes} prefixo="Orçamento de" />

      <Bloco className={styles.topo}>
        {erro ? <p className={styles.alerta} role="alert">Não deu pra carregar o orçamento.</p>
          : !dados ? <Esqueleto linhas={3} altura={18} /> : (
            <>
              <div className={styles.alocar}>
                <span className={styles.rotulo}>A ser alocado</span>
                <span className={styles.alocarValor}>
                  <Dinheiro valor={dados.aAlocar} className={styles.alocarNumero} tom={dados.aAlocar < -0.005 ? "negativo" : alocado ? "positivo" : undefined} />
                  {alocado && <CircleCheck size={26} strokeWidth={2.25} className={styles.ok} aria-label="Toda a renda tem destino" />}
                </span>
              </div>
              <div className={styles.numeros}>
                <Numero rotulo="Renda esperada" valor={dados.rendaEsperada} />
                <Numero rotulo="Despesas planejadas" valor={dados.despesasPlanejadas} />
                <Numero rotulo="Pra guardar" valor={dados.praGuardar} />
              </div>
              <Resposta tom={dados.resposta.tom} texto={dados.resposta.texto} acoes={dados.resposta.acoes} />
            </>
          )}
      </Bloco>

      <Bloco titulo="Receita" semRespiro>
        <OrcamentoReceita periodo={periodo} aoMudar={refazer} />
      </Bloco>

      <Bloco titulo="Despesas" semRespiro>
        <OrcamentoDespesas periodo={periodo} abrir={estado?.abrir} aoMudar={refazer} />
      </Bloco>

      <Bloco titulo="Guardar" semRespiro>
        <Guardar dados={dados} />
      </Bloco>
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      <Dinheiro valor={valor} className={styles.numeroValor} />
    </div>
  )
}

/** As metas em andamento: quanto cada uma pede por mês pra chegar no prazo e quanto entrou nela no mês. */
function Guardar({ dados }: { dados: OrcamentoDoMes | null }) {
  const navigate = useNavigate()
  const [aberta, setAberta] = useState<string | null>(null)
  if (!dados) return <div className={styles.respiro}><Esqueleto linhas={2} altura={18} /></div>
  if (dados.metas.length === 0) return (
    <div className={styles.vazio}>
      <p>Nenhuma meta em andamento.</p>
      <Botao onClick={() => navigate("/metas/nova")} icone={<PiggyBank size={15} strokeWidth={2.25} aria-hidden="true" />}>Criar meta</Botao>
    </div>
  )
  return (
    <ListaFicha rotulo="Metas do mês">
      {dados.metas.map((m) => (
        <LinhaMeta key={m.id} m={m} aberta={aberta === m.id} aoAbrir={() => setAberta((a) => a === m.id ? null : m.id)} />
      ))}
    </ListaFicha>
  )
}

function LinhaMeta({ m, aberta, aoAbrir }: { m: MetaDoOrcamento; aberta: boolean; aoAbrir: () => void }) {
  const navigate = useNavigate()
  const Icone = iconeDaMeta(m.icone)
  const falta = Math.max(0, m.porMes - m.guardadoNoMes)
  return (
    <ItemFicha id={`meta-${m.id}`} aberto={aberta} aoAbrir={aoAbrir}
      marca={<span className={styles.icone} aria-hidden="true"><Icone size={18} strokeWidth={2.25} /></span>}
      titulo={m.nome}
      detalhe={m.porMes > 0 ? <><Dinheiro valor={m.guardadoNoMes} /> de <Dinheiro valor={m.porMes} /> no mês</> : <>Sem prazo</>}
      direita={
        <span className={styles.direita}>
          <span className={styles.direitaTopo}>
            {m.porMes > 0 && (falta > 0 ? <>falta <Dinheiro valor={falta} /></> : <span className={styles.feito}>guardado no mês</span>)}
          </span>
          {m.porMes > 0 && (
            <span className={styles.barra}>
              <BarraProgresso fracao={Math.min(1, m.guardadoNoMes / m.porMes)} tom={falta > 0 ? undefined : "positivo"}
                rotulo={`${Math.round(Math.min(1, m.guardadoNoMes / m.porMes) * 100)}% do mês guardado`} />
            </span>
          )}
        </span>
      }>
      <DadosFicha>
        <div><dt>Pra chegar no prazo</dt><dd>{m.porMes > 0 ? <><Dinheiro valor={m.porMes} /> por mês</> : "Sem prazo"}</dd></div>
        <div><dt>Guardado no mês</dt><dd><Dinheiro valor={m.guardadoNoMes} /></dd></div>
        <div><dt>Falta pra meta</dt><dd><Dinheiro valor={m.falta} /></dd></div>
      </DadosFicha>
      <AcoesFicha>
        <Botao onClick={() => navigate(`/metas/${m.id}`)}>Ver meta</Botao>
        <Botao variante="primario" icone={<PiggyBank size={15} strokeWidth={2.25} aria-hidden="true" />}
          onClick={() => navigate(`/metas/${m.id}/guardar`, { state: { voltarPara: "/orcamento" } })}>Guardar</Botao>
      </AcoesFicha>
    </ItemFicha>
  )
}
