/**
 * RecursosPage — vertical "Recursos" (#79). Rota pública `/recursos`.
 *
 * Detalha TODAS as features do produto (mais profundo que os 3 blocos da Home).
 * Content-only sob <SiteLayout>. Estilo via CSS Modules + var(--pontes-*) (#122).
 * Importa SÓ de `@/components/pontes`. Ícones via lucide-react.
 */

import { useNavigate } from "react-router-dom"
import {
  ArrowRight, Check, LineChart, PieChart, Users, CreditCard,
  Target, FileUp, Landmark, Bell,
} from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesAvatar, PontesProgress,
} from "../../components/pontes"
import styles from "./RecursosPage.module.css"

export default function RecursosPage() {
  return (
    <div className={styles.root}>
      <Hero />
      <Categorias />
      <Comparativo />
      <CtaRecursos />
    </div>
  )
}

// =============================================================================
// Helpers visuais (locais — não vão pra biblioteca)
// =============================================================================

/** Grade decorativa sobre o hero. Stroke branco fixo (SVG não lê var()). */
function GridPattern() {
  return (
    <svg className={styles.grid}>
      <defs>
        <pattern id="rc-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity={0.08} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#rc-grid)" />
    </svg>
  )
}

function Mesh() {
  return (
    <div className={styles.mesh}>
      <div className={styles.meshA} />
      <div className={styles.meshB} />
    </div>
  )
}

function FeatureRow({ reverse, icon, tag, title, text, mockup }: { reverse: boolean; icon: React.ReactNode; tag: string; title: string; text: string; mockup: React.ReactNode }) {
  return (
    <div className={`${styles.featRow} ${reverse ? styles.featRowRev : ""}`}>
      <div className={styles.featText}>
        <div className={styles.featTag}>
          <div className={styles.featTagIcon}>{icon}</div>
          <span className={styles.featTagText}>{tag}</span>
        </div>
        <h3 className={styles.featTitle}>{title}</h3>
        <p className={styles.featP}>{text}</p>
      </div>
      <div className={styles.featMock}>{mockup}</div>
    </div>
  )
}

// Card base pros mockups das categorias.
function MockCard({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.mockCard}>
      <PontesCard padding={24} radius={18} shadow="xl">{children}</PontesCard>
    </div>
  )
}

function MockHeader({ children }: { children: React.ReactNode }) {
  return <div className={styles.mockHeader}>{children}</div>
}

// =============================================================================
// HERO
// =============================================================================

function Hero() {
  const navigate = useNavigate()
  return (
    <section className={styles.hero}>
      <GridPattern />
      <Mesh />
      <div className={styles.noise} />
      <div className={styles.heroInner}>
        <div className={styles.badge}>Tudo que o Pontes faz</div>
        <h1 className={styles.heroTitle}>
          Um app de finanças{" "}
          <em className={styles.emAccent}>de verdade completo.</em>
        </h1>
        <p className={styles.heroLead}>
          Do lançamento diário ao Open Finance, do rateio de casal ao painel do contador. Conheça cada recurso em detalhe.
        </p>
        <PontesButton variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Começar grátis</PontesButton>
      </div>
    </section>
  )
}

// =============================================================================
// CATEGORIAS (8 features alternadas)
// =============================================================================

function Categorias() {
  return (
    <section className={styles.categorias}>
      <div className={styles.wide}>
        <FeatureRow reverse={false} icon={<LineChart size={20} strokeWidth={2} />} tag="Tracking"
          title="Cada centavo no lugar certo"
          text="Lançe receitas e despesas em segundos, com categorias e subcategorias. Recorrentes e parcelados se distribuem sozinhos nos meses certos. Saldo sempre real, calculado na hora."
          mockup={<TrackingMock />} />
        <FeatureRow reverse={true} icon={<PieChart size={20} strokeWidth={2} />} tag="Orçamento"
          title="Limites que avisam antes de estourar"
          text="Defina um teto por categoria. O Pontes acompanha o gasto do mês e te alerta quando chega perto do limite — não depois que já passou."
          mockup={<BudgetMock />} />
        <FeatureRow reverse={false} icon={<Users size={20} strokeWidth={2} />} tag="Família"
          title="Dinheiro de casal e família, sem briga"
          text="Rateio explícito de quem paga o quê, aprovação de despesa grande e acerto mensal. Cada um mantém a conta privada — só o combinado aparece junto."
          mockup={<FamiliaMock />} />
        <FeatureRow reverse={true} icon={<CreditCard size={20} strokeWidth={2} />} tag="Cartão"
          title="Fatura na régua"
          text="Aberta, fechada, paga. Limite real em barra, pagamento parcial mantido e cada compra parcelada distribuída automaticamente nas faturas certas."
          mockup={<CartaoMock />} />
        <FeatureRow reverse={false} icon={<Target size={20} strokeWidth={2} />} tag="Metas"
          title="Objetivos que saem do papel"
          text="Crie metas individuais ou conjuntas — viagem, reserva de emergência, entrada do apê. Acompanhe o progresso e veja quanto poupar por mês pra chegar lá."
          mockup={<MetasMock />} />
        <FeatureRow reverse={true} icon={<FileUp size={20} strokeWidth={2} />} tag="Importação"
          title="Traga seu extrato em um clique"
          text="Importe OFX e CSV do seu banco. O Pontes reconhece e categoriza os lançamentos, evita duplicados e te poupa de digitar tudo de novo."
          mockup={<ImportMock />} />
        <FeatureRow reverse={false} icon={<Landmark size={20} strokeWidth={2} />} tag="Open Finance"
          title="Seus bancos conectados"
          text="Conecte suas contas via Open Finance e veja saldos e transações sincronizados automaticamente. Menos digitação, mais visão real do seu dinheiro."
          mockup={<OpenFinanceMock />} />
        <FeatureRow reverse={true} icon={<Bell size={20} strokeWidth={2} />} tag="Notificações"
          title="O Pontes te avisa na hora certa"
          text="Fatura fechando, limite perto do teto, despesa esperando aprovação, meta atingida. Alertas no momento que importam — sem virar spam."
          mockup={<NotifMock />} />
      </div>
    </section>
  )
}

// --- Mockups por categoria ----------------------------------------------------

function TrackingMock() {
  const items = [
    { c: "Mercado", s: "Alimentação", v: "− R$ 420", up: false },
    { c: "Salário", s: "Receita", v: "+ R$ 6.200", up: true },
    { c: "Uber", s: "Transporte", v: "− R$ 38", up: false },
  ]
  return (
    <MockCard>
      <MockHeader>Lançamentos · hoje</MockHeader>
      {items.map((it) => (
        <div key={it.c} className={styles.row}>
          <div className={styles.rowIcon}>{it.c[0]}</div>
          <div style={{ flex: 1 }}><div className={styles.rowMain}>{it.c}</div><div className={styles.rowSub}>{it.s}</div></div>
          <span className={styles.rowVal} data-up={it.up}>{it.v}</span>
        </div>
      ))}
    </MockCard>
  )
}

function BudgetMock() {
  const cats = [
    { n: "Alimentação", pct: 82, val: "R$ 820 / 1.000" },
    { n: "Transporte", pct: 45, val: "R$ 135 / 300" },
    { n: "Lazer", pct: 97, val: "R$ 388 / 400" },
  ]
  return (
    <MockCard>
      <MockHeader>Orçamento · maio</MockHeader>
      <div className={styles.budgetList}>
        {cats.map((c) => (
          <div key={c.n}>
            <div className={styles.budgetHead}>
              <span className={styles.budgetName}>{c.n}</span>
              <span className={styles.budgetVal} data-over={c.pct >= 95}>{c.val}</span>
            </div>
            <PontesProgress value={c.pct} showValue={false} color={c.pct >= 95 ? "var(--pontes-danger)" : "var(--pontes-primary)"} />
          </div>
        ))}
      </div>
    </MockCard>
  )
}

function FamiliaMock() {
  return (
    <MockCard>
      <div className={styles.famHead}>
        <div><div className={styles.famName}>Aluguel</div><div className={styles.famSub}>Rateio 50/50</div></div>
        <span className={styles.famTotal}>R$ 2.800</span>
      </div>
      <div className={styles.famChips}>
        <div className={styles.famChipP}>
          <div className={styles.famChipHead}><PontesAvatar size={22} name="Gustavo" /><span className={styles.famChipWho}>Gustavo</span></div>
          <div className={styles.famChipVal}>R$ 1.400</div>
        </div>
        <div className={styles.famChipA}>
          <div className={styles.famChipHead}><PontesAvatar size={22} name="Maria" /><span className={styles.famChipWho}>Maria</span></div>
          <div className={styles.famChipVal}>R$ 1.400</div>
        </div>
      </div>
    </MockCard>
  )
}

function CartaoMock() {
  return (
    <MockCard>
      <div className={styles.spread}>
        <MockHeader>Fatura · Nubank</MockHeader>
        <PontesBadge tone="warning" size="sm">Aberta</PontesBadge>
      </div>
      <div className={styles.bigVal}>R$ 2.340,00</div>
      <div className={styles.barMb}>
        <PontesProgress value={47} showValue={false} color="var(--pontes-primary)" />
      </div>
      <div className={styles.limitRow}>
        <span>Limite usado</span><span className={styles.limitStrong}>R$ 2.340 / 5.000</span>
      </div>
    </MockCard>
  )
}

function MetasMock() {
  return (
    <MockCard>
      <div className={styles.spreadTight}>
        <div><div className={styles.metaName}>Viagem Nordeste</div><div className={styles.metaSub}>Meta conjunta</div></div>
        <PontesBadge tone="success" size="sm">68%</PontesBadge>
      </div>
      <div className={styles.barMb14}>
        <PontesProgress value={68} showValue={false} color="var(--pontes-accent)" />
      </div>
      <div className={styles.metaFoot}>
        <div><div className={styles.metaSmallLabel}>Guardado</div><div className={styles.metaSmallVal}>R$ 5.440</div></div>
        <div className={styles.metaFootRight}><div className={styles.metaSmallLabel}>Meta</div><div className={styles.metaSmallValMuted}>R$ 8.000</div></div>
      </div>
    </MockCard>
  )
}

function ImportMock() {
  const files = [
    { n: "extrato-nubank.ofx", s: "142 lançamentos", ok: true },
    { n: "fatura-itau.csv", s: "38 lançamentos", ok: true },
  ]
  return (
    <MockCard>
      <MockHeader>Importar extrato</MockHeader>
      <div className={styles.dropzone}>
        <span className={styles.dropzoneIcon}><FileUp size={24} strokeWidth={2} /></span>
        <div className={styles.dropzoneText}>Arraste OFX ou CSV aqui</div>
      </div>
      {files.map((f) => (
        <div key={f.n} className={styles.fileRow}>
          <div className={styles.fileCheck}><Check size={14} strokeWidth={3} color="#10B981" /></div>
          <div style={{ flex: 1 }}><div className={styles.fileName}>{f.n}</div><div className={styles.fileSub}>{f.s}</div></div>
        </div>
      ))}
    </MockCard>
  )
}

function OpenFinanceMock() {
  const banks = [
    { n: "Nubank", s: "Sincronizado · agora", v: "R$ 4.820" },
    { n: "Itaú", s: "Sincronizado · 5min", v: "R$ 12.350" },
    { n: "Inter", s: "Sincronizado · 5min", v: "R$ 980" },
  ]
  return (
    <MockCard>
      <MockHeader>Contas conectadas</MockHeader>
      {banks.map((b) => (
        <div key={b.n} className={styles.row}>
          <div className={styles.rowIcon}><Landmark size={16} strokeWidth={2} /></div>
          <div style={{ flex: 1 }}><div className={styles.rowMain}>{b.n}</div><div className={styles.rowSubGreen}>{b.s}</div></div>
          <span className={styles.rowVal}>{b.v}</span>
        </div>
      ))}
    </MockCard>
  )
}

function NotifMock() {
  const notifs = [
    { t: "Fatura fechando amanhã", s: "Nubank · R$ 2.340", tone: "warning" as const },
    { t: "Meta Viagem em 68%", s: "Faltam R$ 2.560", tone: "success" as const },
    { t: "Aprovação pendente", s: "Geladeira · R$ 1.280", tone: "primary" as const },
  ]
  return (
    <MockCard>
      <MockHeader>Notificações</MockHeader>
      {notifs.map((n) => (
        <div key={n.t} className={styles.notifRow}>
          <div className={styles.notifIcon}><Bell size={15} strokeWidth={2} /></div>
          <div style={{ flex: 1 }}><div className={styles.notifTitle}>{n.t}</div><div className={styles.notifSub}>{n.s}</div></div>
          <PontesBadge tone={n.tone} size="sm">novo</PontesBadge>
        </div>
      ))}
    </MockCard>
  )
}

// =============================================================================
// COMPARATIVO (reaproveita padrão da Home)
// =============================================================================

function CheckIcon({ muted }: { muted?: boolean }) {
  return <span className={muted ? styles.checkMuted : styles.checkPrimary}><Check size={18} strokeWidth={3} /></span>
}

function Comparativo() {
  const rows = [
    { f: "Conexão Open Finance", a: true, b: false, c: true },
    { f: "Rateio entre casal", a: true, b: false, c: false },
    { f: "Aprovação de despesa", a: true, b: false, c: false },
    { f: "Acesso pra contador", a: true, b: false, c: false },
    { f: "Visão única ↔ família", a: true, b: false, c: false },
    { f: "Metas conjuntas", a: true, b: false, c: false },
    { f: "Categorias + subcategorias", a: true, b: true, c: true },
    { f: "Importação OFX/CSV", a: true, b: true, c: true },
  ]
  return (
    <section className={styles.comparativo}>
      <div className={styles.cmpWide}>
        <div className={styles.center}>
          <div className={styles.label}>Comparativo</div>
          <h2 className={styles.cmpTitle}>
            Por que <em className={styles.em}>Pontes</em> e não os outros
          </h2>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.theadRow}>
                <th className={styles.thEmpty}></th>
                <th className={styles.thMain}>Pontes</th>
                <th className={styles.thOther}>Mobills</th>
                <th className={styles.thOther}>Despezzas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={styles.bodyRow}>
                  <td className={styles.tdFeature}>{row.f}</td>
                  <td className={styles.tdMain}>{row.a ? <CheckIcon /> : <span className={styles.dash}>—</span>}</td>
                  <td className={styles.tdOther}>{row.b ? <CheckIcon muted /> : <span className={styles.dash}>—</span>}</td>
                  <td className={styles.tdOther}>{row.c ? <CheckIcon muted /> : <span className={styles.dash}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function CtaRecursos() {
  const navigate = useNavigate()
  return (
    <section className={styles.cta}>
      <Mesh />
      <div className={styles.ctaInner}>
        <h2 className={styles.ctaTitle}>
          Tudo isso{" "}
          <em className={styles.emAccent}>num app só.</em>
        </h2>
        <p className={styles.ctaLead}>Grátis pra começar. Sem cartão de crédito, sem pegadinha.</p>
        <div className={styles.ctaBtns}>
          <PontesButton variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Criar conta grátis</PontesButton>
          <PontesButton variant="outline-light" size="lg" onClick={() => navigate("/casais")}>Ver plano Família</PontesButton>
        </div>
      </div>
    </section>
  )
}
