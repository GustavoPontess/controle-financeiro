/**
 * Modelos ANTIGOS do painel de conferir (galeria DEV, rendida dentro de /reconciliacao-modelos): os 4
 * jeitos de organizar os botões que o Gustavo comparou em 2026-10-05 — ele escolheu o C (resultado em
 * destaque), que já está na tela real. Cada modelo nos 3 momentos: antes de salvar, salvo com
 * diferença e conferido. Dados fake.
 */

import type { ReactNode } from "react"
import { Check, TriangleAlert, Pencil, Trash2, ChevronRight, ChevronDown, Scale, Plus } from "lucide-react"
import { PontesButton, PontesIconButton, PontesInput } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import styles from "./ReconciliacaoModelosPainel.module.css"

type Momento = "antes" | "diferenca" | "ok"

const CALC = 1523.86
const BANCO = 3.23
const MOMENTOS: { id: Momento; rotulo: string }[] = [
  { id: "antes", rotulo: "1. Antes de salvar (digitou o saldo)" },
  { id: "diferenca", rotulo: "2. Salvo, com diferença" },
  { id: "ok", rotulo: "3. Conferido (bate)" },
]

function numeros(m: Momento) {
  const banco = m === "ok" ? CALC : BANCO
  return { calc: CALC, banco, dif: banco - CALC }
}

const titulo = (m: Momento) => (m === "antes" ? "Conferir hoje, 05/10" : "Marco de 04/10/2026")

/** Valor da diferença: preto + traço + ícone (⚠ vermelho / ✓ verde). */
function Diferenca({ dif, grande }: { dif: number; grande?: boolean }) {
  const bate = Math.abs(dif) < 0.005
  return (
    <span className={styles.dif} data-tom={bate ? "ok" : "nok"} data-grande={grande ? "true" : undefined}>
      {bate ? <Check size={grande ? 24 : 18} strokeWidth={3} aria-hidden /> : <TriangleAlert size={grande ? 26 : 19} strokeWidth={2.5} aria-hidden />}
      <span className={styles.difValor}>{bate ? formatMoney(0) : `${dif > 0 ? "+" : ""}${formatMoney(dif)}`}</span>
    </span>
  )
}

function Conferido() {
  return <span className={styles.chipOk}><Check size={14} strokeWidth={3} /> Conferido — bate com o banco</span>
}

function CampoBanco() {
  return <PontesInput iconStart="R$" inputMode="decimal" placeholder="0,00" value="3,23" onChange={() => {}} />
}

// ── Modelo A — Três números ──────────────────────────────────────────────────

function ModeloA({ m }: { m: Momento }) {
  const { calc, banco, dif } = numeros(m)
  const salvo = m !== "antes"
  return (
    <div className={styles.painel}>
      <div className={styles.topo}>
        <span className={styles.titulo}>{titulo(m)}</span>
        {salvo && (
          <span className={styles.icones}>
            <PontesIconButton size={24} variant="ghost" aria-label="Alterar valor" title="Alterar valor"><Pencil size={14} strokeWidth={2.5} /></PontesIconButton>
            <PontesIconButton size={24} variant="ghost" aria-label="Remover" title="Remover"><Trash2 size={14} strokeWidth={2.5} /></PontesIconButton>
          </span>
        )}
      </div>
      {!salvo && <CampoBanco />}
      <div className={styles.tiles}>
        <div className={styles.tile}><span className={styles.tileRot}>App</span><strong>{formatMoney(calc)}</strong></div>
        <div className={styles.tile}><span className={styles.tileRot}>Banco</span><strong>{formatMoney(banco)}</strong></div>
        <div className={styles.tile} data-destaque="true"><span className={styles.tileRot}>Diferença</span><Diferenca dif={dif} /></div>
      </div>
      <div className={styles.rodape}>
        {m === "antes" && <PontesButton size="sm" fullWidth iconStart={<Check size={14} strokeWidth={3} />}>Salvar saldo do banco</PontesButton>}
        {m === "diferenca" && (
          <>
            <PontesButton size="sm" fullWidth>Ajustar diferença</PontesButton>
            <button type="button" className={styles.link}>ou lançar o que falta</button>
          </>
        )}
        {m === "ok" && <Conferido />}
      </div>
    </div>
  )
}

// ── Modelo B — Lista de ações (sem botões grandes) ───────────────────────────

function ModeloB({ m }: { m: Momento }) {
  const { calc, banco, dif } = numeros(m)
  const salvo = m !== "antes"
  return (
    <div className={styles.painel}>
      <div className={styles.topo}><span className={styles.titulo}>{titulo(m)}</span></div>
      {!salvo && <CampoBanco />}
      <div className={styles.linhas}>
        <div className={styles.linha}><span>Calculado (app)</span><strong>{formatMoney(calc)}</strong></div>
        <div className={styles.linha}><span>Banco</span><strong>{formatMoney(banco)}</strong></div>
        <div className={styles.linha} data-total="true"><span>Diferença</span><Diferenca dif={dif} /></div>
      </div>
      <div className={styles.rodape}>
        {m === "antes" && <PontesButton size="sm" fullWidth iconStart={<Check size={14} strokeWidth={3} />}>Salvar saldo do banco</PontesButton>}
        {m === "diferenca" && (
          <div className={styles.listaAcoes}>
            <button type="button" className={styles.acaoLinha}>
              <span className={styles.acaoIcone}><Scale size={15} strokeWidth={2.4} /></span>
              <span className={styles.acaoTexto}>Ajustar a diferença</span>
              <ChevronRight size={16} strokeWidth={2.5} className={styles.acaoSeta} />
            </button>
            <button type="button" className={styles.acaoLinha}>
              <span className={styles.acaoIcone}><Plus size={15} strokeWidth={2.4} /></span>
              <span className={styles.acaoTexto}>Lançar o que falta</span>
              <ChevronRight size={16} strokeWidth={2.5} className={styles.acaoSeta} />
            </button>
          </div>
        )}
        {m === "ok" && <Conferido />}
        {salvo && (
          <div className={styles.linksPequenos}>
            <button type="button" className={styles.link}>Alterar valor</button>
            <span aria-hidden>·</span>
            <button type="button" className={styles.link} data-perigo="true">Remover</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modelo C — Resultado em destaque + um botão "Resolver" ───────────────────

function ModeloC({ m, menuAberto }: { m: Momento; menuAberto?: boolean }) {
  const { calc, banco, dif } = numeros(m)
  const salvo = m !== "antes"
  return (
    <div className={styles.painel}>
      <div className={styles.topo}>
        <span className={styles.titulo}>{titulo(m)}</span>
        {salvo && (
          <span className={styles.linksTopo}>
            <button type="button" className={styles.link}>Alterar</button>
            <span aria-hidden>·</span>
            <button type="button" className={styles.link} data-perigo="true">Remover</button>
          </span>
        )}
      </div>
      {!salvo && <CampoBanco />}
      <div className={styles.destaque}>
        <span className={styles.destaqueRot}>Diferença</span>
        <Diferenca dif={dif} grande />
        <span className={styles.destaqueSub}>App {formatMoney(calc)} · Banco {formatMoney(banco)}</span>
      </div>
      <div className={styles.rodape}>
        {m === "antes" && <PontesButton size="sm" fullWidth iconStart={<Check size={14} strokeWidth={3} />}>Salvar saldo do banco</PontesButton>}
        {m === "diferenca" && (
          <div className={styles.resolverWrap}>
            <PontesButton size="sm" fullWidth iconEnd={<ChevronDown size={14} strokeWidth={2.5} />}>Resolver diferença</PontesButton>
            {menuAberto && (
              <div className={styles.menu}>
                <button type="button" className={styles.menuItem}><Scale size={15} strokeWidth={2.4} /> Ajustar (cria lançamento)</button>
                <button type="button" className={styles.menuItem}><Plus size={15} strokeWidth={2.4} /> Lançar o que falta</button>
              </div>
            )}
          </div>
        )}
        {m === "ok" && <Conferido />}
      </div>
    </div>
  )
}

// ── Modelo D — Editar no lugar ───────────────────────────────────────────────

function ModeloD({ m }: { m: Momento }) {
  const { calc, banco, dif } = numeros(m)
  const salvo = m !== "antes"
  return (
    <div className={styles.painel}>
      <div className={styles.topo}>
        <span className={styles.titulo}>{titulo(m)}</span>
        {salvo && (
          <span className={styles.icones}>
            <PontesIconButton size={24} variant="ghost" aria-label="Remover" title="Remover"><Trash2 size={14} strokeWidth={2.5} /></PontesIconButton>
          </span>
        )}
      </div>
      {salvo ? (
        <button type="button" className={styles.valorEditavel} title="Alterar valor">
          <span className={styles.valorRot}>Saldo do banco</span>
          <span className={styles.valorNum}>{formatMoney(banco)}</span>
          <Pencil size={14} strokeWidth={2.5} className={styles.valorLapis} />
        </button>
      ) : <CampoBanco />}
      <div className={styles.linhas}>
        <div className={styles.linha}><span>Calculado (app)</span><strong>{formatMoney(calc)}</strong></div>
        <div className={styles.linha} data-total="true"><span>Diferença</span><Diferenca dif={dif} /></div>
      </div>
      <div className={styles.rodape}>
        {m === "antes" && <PontesButton size="sm" fullWidth iconStart={<Check size={14} strokeWidth={3} />}>Salvar saldo do banco</PontesButton>}
        {m === "diferenca" && (
          <>
            <PontesButton size="sm" fullWidth>Ajustar</PontesButton>
            <button type="button" className={styles.link}>ou lançar o que falta</button>
          </>
        )}
        {m === "ok" && <Conferido />}
      </div>
    </div>
  )
}

const MODELOS: { id: string; nome: string; ideia: string; render: (m: Momento) => ReactNode }[] = [
  { id: "A", nome: "Modelo A — Três números", ideia: "App, Banco e Diferença em quadrinhos. Um botão + um link. Alterar/remover = ícones pequenos no título.", render: (m) => <ModeloA m={m} /> },
  { id: "B", nome: "Modelo B — Lista de ações", ideia: "Sem botões grandes: as opções viram linhas clicáveis (tipo menu de ajustes). Alterar/remover = links pequenos embaixo.", render: (m) => <ModeloB m={m} /> },
  { id: "C", nome: "Modelo C — Resultado em destaque", ideia: "A diferença grande no centro. UM botão \"Resolver diferença\" que abre as 2 opções. Alterar/remover = links no título. (O escolhido — na tela real as 2 opções aparecem direto, sem o botão de abrir.)", render: (m) => <ModeloC m={m} menuAberto={m === "diferenca"} /> },
  { id: "D", nome: "Modelo D — Editar no lugar", ideia: "O saldo do banco é clicável (lápis) pra alterar; lixeira no título. Embaixo: \"Ajustar\" + link \"ou lançar o que falta\".", render: (m) => <ModeloD m={m} /> },
]

/** Os 4 modelos antigos do painel, cada um nos 3 momentos. */
export function ModelosPainelAntigos() {
  return (
    <>
      <h1 className={styles.grupoTitulo}>Modelos do painel de conferir (os antigos)</h1>
      {MODELOS.map((mod) => (
        <section key={mod.id} className={styles.modelo} aria-label={mod.nome}>
          <h2 className={styles.modeloNome}>{mod.nome}</h2>
          <p className={styles.modeloIdeia}>{mod.ideia}</p>
          <div className={styles.momentos}>
            {MOMENTOS.map((mo) => (
              <div key={mo.id} className={styles.momento}>
                <span className={styles.momentoRot}>{mo.rotulo}</span>
                {mod.render(mo.id)}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
