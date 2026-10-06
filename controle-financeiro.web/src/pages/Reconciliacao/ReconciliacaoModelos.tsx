/**
 * ReconciliacaoModelos — galeria DEV (/reconciliacao-modelos) com OPÇÕES pra ESCOLHA DA CONTA na
 * reconciliação (o bloco "Conta a conferir" dentro do painel incomodava o Gustavo). Cada opção mostra
 * o conjunto (hero + painel + calendário) com o CSS REAL da tela; só muda onde/como se escolhe a conta.
 * Dados fake; não vai pro build de produção (rota atrás de DEV).
 */

import { useState, type ReactNode } from "react"
import { Check, ChevronDown, ChevronLeft, ChevronRight, Flag, Landmark, Pencil, TriangleAlert } from "lucide-react"
import { PontesBankBadge, PontesButton, PontesField, PontesInput, PontesSelect } from "@/components/pontes"
import { formatMoney, maskMoney, parseMoney } from "@/utils/money"
import { ModelosPainelAntigos } from "./ReconciliacaoModelosPainel"
import pg from "./ReconciliacaoPage.module.css"
import s from "./ReconciliacaoModelos.module.css"

type Status = "aconferir" | "diferenca" | "conferido"
type ContaFake = { id: string; nome: string; sub: string; saldo: number; status: Status; cor: string }

const CONTAS: ContaFake[] = [
  { id: "carteira", nome: "Carteira", sub: "Dinheiro", saldo: 1461.39, status: "aconferir", cor: "#1E40AF" },
  { id: "cc", nome: "Conta Corrente", sub: "Banco Inter", saldo: 14874.42, status: "diferenca", cor: "#FF7A00" },
  { id: "poupanca", nome: "Poupança", sub: "Banco Inter", saldo: 2000, status: "conferido", cor: "#FF7A00" },
]
const SELECIONADA = CONTAS[0]
const CALC_FAKE = 1523.86
const STATUS_TEXTO: Record<Status, string> = { aconferir: "A conferir", diferenca: "Com diferença", conferido: "Conferido 04/10" }

function StatusDot({ status }: { status: Status }) {
  return <span className={s.dot} data-status={status} aria-hidden="true" />
}

function StatusChip({ status }: { status: Status }) {
  return (
    <span className={s.chip} data-status={status}>
      {status === "conferido" ? <Check size={11} strokeWidth={3} /> : status === "diferenca" ? <TriangleAlert size={11} strokeWidth={2.5} /> : null}
      {STATUS_TEXTO[status]}
    </span>
  )
}

// ── Peças comuns (CSS real da tela) ──────────────────────────────────────────

function Hero({ seletor }: { seletor?: ReactNode }) {
  return (
    <div className={pg.hero}>
      <div className={pg.heroBlob} />
      <div className={pg.heroMain}>
        {seletor ?? <div className={pg.heroLabel}>Saldo em conta</div>}
        <div className={pg.heroValor}>{formatMoney(SELECIONADA.saldo)}</div>
      </div>
      <div className={pg.heroRight}>
        <span className={pg.heroChip} data-ok="false"><TriangleAlert size={14} strokeWidth={2.5} /> A conferir</span>
        <button type="button" className={pg.heroBtn}><Flag size={14} strokeWidth={2.5} /> Conferir hoje</button>
      </div>
    </div>
  )
}

/** O seletor de hoje ("Conta a conferir") — na referência "Atual" ele vai pro topo do CALENDÁRIO. */
function SeletorConta() {
  return (
    <div className={pg.painelSel}>
      <PontesField label="Conta a conferir" helper="Tudo nesta tela é desta conta.">
        <PontesSelect value={SELECIONADA.id} onChange={() => {}} options={CONTAS.map((c) => ({ value: c.id, label: c.nome }))} />
      </PontesField>
    </div>
  )
}

function Painel({ titulo }: { titulo?: ReactNode }) {
  // O campo JÁ VEM ABERTO (sem valor ainda). Enter/sair com valor → fecha no valor + lápis; vazio →
  // continua aberto. Foco automático só quando reaberto pelo lápis (na galeria há vários painéis).
  const [editando, setEditando] = useState(true)
  const [reaberto, setReaberto] = useState(false)
  const [valor, setValor] = useState("")
  const preenchido = valor.trim() !== ""
  const fecharSeTemValor = () => { if (preenchido) setEditando(false) }
  const banco = parseMoney(valor)
  const dif = banco - CALC_FAKE
  const bate = preenchido && Math.abs(dif) < 0.005
  return (
    // painelCurto + destaqueCompacto: o painel só com a altura do conteúdo (sem esticar até o calendário)
    // e o destaque no tamanho dele — esticado ficava um bloco cinza enorme.
    <div className={`${pg.painel} ${pg.painelConf} ${s.painelCurto}`}>
      <div className={`${pg.painelTitulo} ${s.tituloMaior}`}>
        {titulo ?? <><Flag size={15} strokeWidth={2.2} /> Conferir <strong className={pg.diaSelLabel}>hoje, 05/10</strong></>}
      </div>
      {/* Sem o campo de dinheiro em cima: o saldo do banco mora na linha "Banco", com o lápis pra editar
          (clicou → vira o campo ali mesmo; Enter/sair do campo → volta pro valor). */}
      <div className={s.linhas}>
        <div className={s.linha}><span>Calculado (app)</span><strong>{formatMoney(CALC_FAKE)}</strong></div>
        <div className={s.linha}>
          <span>Banco</span>
          {editando ? (
            <span className={s.bancoCampo}>
              <PontesInput iconStart="R$" inputMode="decimal" placeholder="0,00" aria-label="Saldo que aparece no seu banco" className={s.campoBanco}
                value={valor} autoFocus={reaberto} onChange={(e) => setValor(maskMoney(e.target.value, valor))}
                onBlur={fecharSeTemValor} onKeyDown={(e) => { if (e.key === "Enter") fecharSeTemValor() }} />
            </span>
          ) : (
            <button type="button" className={s.bancoValor} onClick={() => { setReaberto(true); setEditando(true) }} aria-label="Editar saldo do banco">
              <strong>{preenchido ? formatMoney(banco) : "—"}</strong>
              <Pencil size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
      <div className={`${pg.destaque} ${s.destaqueCompacto}`}>
        <span className={pg.destaqueRot}>Diferença</span>
        {preenchido ? (
          <span className={pg.destaqueValor} data-tom={bate ? "ok" : "nok"}>
            {bate ? <Check size={24} strokeWidth={3} aria-hidden /> : <TriangleAlert size={26} strokeWidth={2.5} aria-hidden />}
            <span className={pg.destaqueNum}>{bate ? formatMoney(0) : `${dif > 0 ? "+" : ""}${formatMoney(dif)}`}</span>
          </span>
        ) : <span className={pg.destaqueVazio}>—</span>}
      </div>
      <div className={pg.painelFooter}>
        <PontesButton size="sm" fullWidth disabled={!preenchido} iconStart={<Check size={14} strokeWidth={3} />}>Salvar saldo do banco</PontesButton>
      </div>
    </div>
  )
}

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
function Calendario({ seletorEmCima }: { seletorEmCima?: boolean }) {
  // Outubro/2026 começa numa quinta (offset 4). Igual à tela real.
  const celulas: (number | null)[] = [...Array(4).fill(null), ...Array.from({ length: 31 }, (_, i) => i + 1)]
  return (
    <div className={`${pg.painel} ${pg.painelCal}`}>
      {seletorEmCima && <SeletorConta />}
      <div className={pg.calTopo}>
        <div className={pg.painelTitulo}>Outubro 2026</div>
        <div className={pg.calNav}>
          <button type="button" className={pg.calNavBtn} aria-label="Mês anterior"><ChevronLeft size={15} strokeWidth={2.5} /></button>
          {/* "Hoje" entre as setas: volta pro mês atual e seleciona o dia de hoje. */}
          <button type="button" className={`${pg.calNavBtn} ${s.calHoje}`}>Hoje</button>
          <button type="button" className={pg.calNavBtn} aria-label="Próximo mês"><ChevronRight size={15} strokeWidth={2.5} /></button>
        </div>
      </div>
      <div className={pg.calGrid}>
        {SEMANA.map((d) => <div key={d} className={pg.calWeekday}>{d}</div>)}
        {celulas.map((dia, i) => dia === null
          ? <div key={`v${i}`} className={pg.calVazio} />
          : (
            <button key={dia} type="button" className={pg.calDia} data-hoje={dia === 5 ? "true" : undefined}
              data-sel={dia === 5 ? "true" : undefined} data-pendente={dia >= 1 && dia <= 5 ? "true" : undefined}>
              <span className={pg.calDiaNum}>{dia}</span>
            </button>
          ))}
      </div>
      <div className={pg.histTitulo}>Última conferência</div>
      <button type="button" className={pg.histLinha}>
        <span className={pg.histEsq}><Landmark size={13} strokeWidth={2.5} className={pg.histIconInicial} /> 22/06 <span className={pg.histTagPartida}>partida</span></span>
        <span className={pg.histValor}>{formatMoney(200)}</span>
      </button>
    </div>
  )
}

function Conjunto({ acima, seletorHero, sobreHero, tituloPainel, seletorDentro }: {
  acima?: ReactNode; seletorHero?: ReactNode; sobreHero?: ReactNode; tituloPainel?: ReactNode; seletorDentro?: boolean
}) {
  return (
    <div className={s.conjunto}>
      {acima}
      <div className={s.heroWrap}>
        <Hero seletor={seletorHero} />
        {sobreHero}
      </div>
      {/* Lados trocados (pedido do Gustavo): calendário à esquerda, painel de conferir à direita. */}
      <div className={s.colsInvertidas}>
        <Calendario seletorEmCima={seletorDentro} />
        <Painel titulo={tituloPainel} />
      </div>
    </div>
  )
}

// ── Opção A — Abas de conta no topo ──────────────────────────────────────────

function AbasDeConta() {
  return (
    <div className={s.abas} role="tablist" aria-label="Conta a conferir">
      {CONTAS.map((c) => (
        <button key={c.id} type="button" role="tab" aria-selected={c.id === SELECIONADA.id} className={s.aba}>
          <PontesBankBadge name={c.sub === "Dinheiro" ? c.nome : c.sub} cor={c.cor} size={22} />
          <span className={s.abaNome}>{c.nome}</span>
          <StatusDot status={c.status} />
        </button>
      ))}
    </div>
  )
}

// ── Opção B — Conta dentro do hero (dropdown) ────────────────────────────────

function ContaNoHero() {
  return (
    <button type="button" className={s.heroSeletor} aria-haspopup="listbox" aria-expanded="true">
      Saldo em <strong>{SELECIONADA.nome}</strong> <ChevronDown size={14} strokeWidth={2.5} />
    </button>
  )
}

// A lista aberta fica FORA do hero (que corta o que transborda) — na tela real seria um popover.
function MenuContas() {
  return (
    <div className={s.menuContas} role="listbox" aria-label="Conta a conferir">
      {CONTAS.map((c) => (
        <div key={c.id} role="option" aria-selected={c.id === SELECIONADA.id} className={s.menuConta}>
          <PontesBankBadge name={c.sub === "Dinheiro" ? c.nome : c.sub} cor={c.cor} size={24} />
          <span className={s.menuContaTexto}><span className={s.menuContaNome}>{c.nome}</span><span className={s.menuContaSub}>{formatMoney(c.saldo)}</span></span>
          <StatusChip status={c.status} />
        </div>
      ))}
    </div>
  )
}

// ── Opção C — Cartões de conta (com status da conferência) ───────────────────

function CartoesDeConta() {
  return (
    <div className={s.cartoes} role="tablist" aria-label="Conta a conferir">
      {CONTAS.map((c) => (
        <button key={c.id} type="button" role="tab" aria-selected={c.id === SELECIONADA.id} className={s.cartao}>
          <span className={s.cartaoTopo}>
            <PontesBankBadge name={c.sub === "Dinheiro" ? c.nome : c.sub} cor={c.cor} size={28} />
            <span className={s.cartaoTexto}><span className={s.cartaoNome}>{c.nome}</span><span className={s.cartaoSub}>{c.sub}</span></span>
          </span>
          <span className={s.cartaoBase}>
            <strong className={s.cartaoSaldo}>{formatMoney(c.saldo)}</strong>
            <StatusChip status={c.status} />
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Opção D — No título do painel ────────────────────────────────────────────

function TituloComConta() {
  return (
    <>
      <Flag size={15} strokeWidth={2.2} /> Conferir <strong className={pg.diaSelLabel}>hoje, 05/10</strong>
      <span className={s.tituloSep} aria-hidden="true">·</span>
      <button type="button" className={s.tituloConta} aria-haspopup="listbox">
        <PontesBankBadge name={SELECIONADA.nome} cor={SELECIONADA.cor} size={18} />
        {SELECIONADA.nome} <ChevronDown size={13} strokeWidth={2.5} />
      </button>
    </>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────

const OPCOES: { id: string; nome: string; ideia: string; conjunto: ReactNode }[] = [
  { id: "Atual", nome: "Atual — seletor em cima do calendário", ideia: "O seletor de hoje (\"Conta a conferir\") saiu do painel de conferir e foi pro topo do calendário.", conjunto: <Conjunto seletorDentro /> },
  { id: "A", nome: "Opção A — Abas de conta no topo", ideia: "Uma aba por conta acima do hero (logo + nome + bolinha do status). Um clique troca.", conjunto: <Conjunto acima={<AbasDeConta />} /> },
  { id: "B", nome: "Opção B — Conta dentro do hero", ideia: "\"Saldo em Carteira ▾\" no próprio hero; abre a lista de contas com saldo e status (mostrada aberta aqui).", conjunto: <Conjunto seletorHero={<ContaNoHero />} sobreHero={<MenuContas />} /> },
  { id: "C", nome: "Opção C — Cartões de conta", ideia: "Um cartão por conta com saldo e status da conferência (conferido / a conferir / com diferença). Dá a visão de todas de uma vez.", conjunto: <Conjunto acima={<CartoesDeConta />} /> },
  { id: "D", nome: "Opção D — No título do painel", ideia: "\"Conferir hoje, 05/10 · Carteira ▾\" — pequeno, dentro do título; sem campo nem texto de ajuda.", conjunto: <Conjunto tituloPainel={<TituloComConta />} /> },
]

export default function ReconciliacaoModelos() {
  return (
    <div className={s.pagina}>
      <ModelosPainelAntigos />
      <h1 className={s.paginaTitulo}>Reconciliação — onde escolher a conta</h1>
      {OPCOES.map((o) => (
        <section key={o.id} className={s.opcao} aria-label={o.nome}>
          <h2 className={s.opcaoNome}>{o.nome}</h2>
          <p className={s.opcaoIdeia}>{o.ideia}</p>
          {o.conjunto}
        </section>
      ))}
    </div>
  )
}
