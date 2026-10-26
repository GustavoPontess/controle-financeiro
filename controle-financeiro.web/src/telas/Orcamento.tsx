// Orçamento (/orcamento, menu principal; juntou as telas Renda e Limites, pedido do Gustavo 2026-10-21 a partir da
// planilha dele): orçamento base zero. A renda que a pessoa espera receber no mês ganha destino nas despesas
// planejadas e nos investimentos planejados (por categoria, vale todo mês até mudar). No topo, o "a ser alocado"
// (renda esperada − despesas − investimentos, calculado no servidor; sem frase embaixo, o número já diz); zerado, ✔.
// Embaixo, as três seções: Receitas, Despesas e Investimentos. Metas ficam na tela Metas (decisão do Gustavo 2026-10-22).
// Tudo em planilha aberta (sem ficha que abre). O formulário de planejar volta pra cá com o mês (state { ano, mes }).
import { useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { CircleCheck } from "lucide-react"
import { getOrcamentoDoMes } from "../services/orcamentoService"
import type { OrcamentoDoMes } from "../types/Orcamento"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { Dinheiro } from "../componentes/Dinheiro"
import NavegadorMes, { periodoDeHoje, type Periodo } from "../componentes/NavegadorMes"
import OrcamentoDespesas from "./OrcamentoDespesas"
import OrcamentoFontes from "./OrcamentoFontes"
import styles from "./Orcamento.module.css"

/** Ida e volta com o formulário de planejar: o mês. */
type Estado = { ano?: number; mes?: number } | null

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
                <Numero rotulo="Investimentos planejados" valor={dados.investimentosPlanejados} />
              </div>
            </>
          )}
      </Bloco>

      <OrcamentoFontes lado="receitas" periodo={periodo} aoMudar={refazer} />
      <OrcamentoDespesas periodo={periodo} aoMudar={refazer} />
      <OrcamentoFontes lado="investimentos" periodo={periodo} aoMudar={refazer} />
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
