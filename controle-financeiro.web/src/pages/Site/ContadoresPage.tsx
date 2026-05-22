/**
 * ContadoresPage — vertical "Para Contadores" (#78). Rota pública `/contadores`.
 *
 * Público B2B: contador autônomo / escritório acompanhando N clientes. Mercado
 * virgem no BR. Content-only: navbar/footer/control-bar/scrollbar vêm do
 * <SiteLayout>. Estilo via CSS Modules + var(--pontes-*) (#122). Importa SÓ de
 * `@/components/pontes`. Ícones via lucide-react.
 */

import { useNavigate } from "react-router-dom"
import {
  ArrowRight, Check, Play, Users, Building2, Send, Wallet,
  BarChart3, ShieldCheck, FileText, Clock,
} from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesAvatar,
  PontesProgress, PontesStatCard, PontesTable,
  type PontesTableColumn,
} from "../../components/pontes"
import styles from "./ContadoresPage.module.css"

export default function ContadoresPage() {
  return (
    <div className={styles.root}>
      <Hero />
      <Stats />
      <SecaoMultiCliente />
      <SecaoConvite />
      <SecaoCobranca />
      <SecaoRelatorios />
      <Testimonial />
      <CtaContador />
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
        <pattern id="ct-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity={0.08} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ct-grid)" />
    </svg>
  )
}

function Mesh() {
  return (
    <div className={styles.mesh}>
      <div className={styles.meshA} />
      <div className={styles.meshB} />
      <div className={styles.meshC} />
    </div>
  )
}

function PulseDot() {
  return (
    <span className={styles.pulse}>
      <span className={styles.pulseRing} />
      <span className={styles.pulseDot} />
    </span>
  )
}

function FeatureRow({ reverse, tag, title, text, mockup }: { reverse: boolean; tag: string; title: string; text: string; mockup: React.ReactNode }) {
  return (
    <div className={`${styles.featRow} ${reverse ? styles.featRowRev : ""}`}>
      <div className={styles.featText}>
        <div className={styles.label}>{tag}</div>
        <h3 className={styles.featTitle}>{title}</h3>
        <p className={styles.featP}>{text}</p>
      </div>
      <div className={styles.featMock}>{mockup}</div>
    </div>
  )
}

// =============================================================================
// SECTIONS
// =============================================================================

function Hero() {
  const navigate = useNavigate()
  return (
    <section className={styles.hero}>
      <GridPattern />
      <Mesh />
      <div className={styles.noise} />
      <div className={styles.heroGrid}>
        <div>
          <div className={styles.badge}>
            <PulseDot /> Para contadores e escritórios
          </div>
          <h1 className={styles.heroTitle}>
            Todos os clientes{" "}
            <em className={styles.emAccent}>numa tela só.</em>
          </h1>
          <p className={styles.heroLead}>
            Acompanhe as finanças de cada cliente em tempo real, convide-os com um link e embuta a cobrança do seu honorário. O painel que faltava pro contador autônomo brasileiro.
          </p>
          <div className={styles.heroBtns}>
            <PontesButton variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Testar grátis</PontesButton>
            <PontesButton variant="outline-light" size="lg" iconStart={<Play size={14} strokeWidth={2.5} />} onClick={() => navigate("/")}>Ver visão geral</PontesButton>
          </div>
          <div className={styles.heroChecks}>
            {["Clientes ilimitados", "Dados isolados por cliente", "Cancele quando quiser"].map((t) => (
              <span key={t} className={styles.heroCheck}><span className={styles.heroCheckIcon}><Check size={14} strokeWidth={2.5} /></span> {t}</span>
            ))}
          </div>
        </div>
        <div className={styles.heroArt}>
          <div className={styles.heroGlow} />
          <div className={styles.heroPhoto}>
            <img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&auto=format&fit=crop&q=80" alt="Contador analisando finanças de clientes" className={styles.heroPhotoImg} />
          </div>
          <div className={`${styles.floatCard} ${styles.floatTop}`}>
            <div className={styles.floatRow}>
              <div className={styles.floatIcon}><Building2 size={16} strokeWidth={2.5} color="#2563EB" /></div>
              <div><div className={styles.floatName}>Padaria do Zé</div><div className={styles.floatSub}>Fechamento OK · maio</div></div>
            </div>
          </div>
          <div className={`${styles.floatCard} ${styles.floatBottom}`}>
            <div className={styles.floatLabel}>Carteira ativa</div>
            <div className={styles.floatBig}>24 clientes</div>
            <div className={styles.floatGreen}>Todos em dia</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const stats = [{ v: "10h", l: "Economizadas por mês" }, { v: "∞", l: "Clientes por conta" }, { v: "5min", l: "Pra integrar um cliente" }]
  return (
    <section className={styles.stats}>
      <div className={styles.statsGrid}>
        {stats.map((s) => (
          <div key={s.l} className={styles.statItem}>
            <div className={styles.statV}>{s.v}</div>
            <div className={styles.statL}>{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// --- Visão multi-cliente: dashboard com KPIs + tabela de clientes ------------

type ClienteRow = { nome: string; tipo: string; status: "Em dia" | "Pendente" | "Atrasado"; saldo: string }

function SecaoMultiCliente() {
  const kpis = [
    { label: "Clientes ativos", value: "24", trend: "3", trendUp: true, hint: "novos no mês" },
    { label: "Fechamentos OK", value: "21/24", trend: "88%", trendUp: true, hint: "do total" },
    { label: "Honorários a receber", value: "R$ 12.4k", trend: "2", trendUp: false, hint: "em atraso" },
    { label: "Pendências", value: "5", trend: "2", trendUp: false, hint: "vs mês anterior" },
  ]
  const tone: Record<ClienteRow["status"], "success" | "warning" | "danger"> = {
    "Em dia": "success", "Pendente": "warning", "Atrasado": "danger",
  }
  const rows: ClienteRow[] = [
    { nome: "Padaria do Zé", tipo: "MEI", status: "Em dia", saldo: "R$ 8.240" },
    { nome: "Studio Bella", tipo: "Simples", status: "Em dia", saldo: "R$ 14.100" },
    { nome: "TechParts ME", tipo: "Lucro Pres.", status: "Pendente", saldo: "R$ 32.500" },
    { nome: "Café Aurora", tipo: "MEI", status: "Atrasado", saldo: "R$ 3.180" },
  ]
  const columns: PontesTableColumn<ClienteRow>[] = [
    {
      key: "nome", header: "Cliente", render: (r) => (
        <div className={styles.cellNome}>
          <PontesAvatar size={28} name={r.nome} />
          <div><div className={styles.cellNomeMain}>{r.nome}</div><div className={styles.cellNomeSub}>{r.tipo}</div></div>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <PontesBadge tone={tone[r.status]} size="sm">{r.status}</PontesBadge> },
    { key: "saldo", header: "Saldo do mês", align: "right", render: (r) => <span className={styles.cellSaldo}>{r.saldo}</span> },
  ]
  return (
    <section className={styles.sectionSurface}>
      <div className={styles.wide}>
        <div className={styles.center}>
          <div className={styles.label}>Visão multi-cliente</div>
          <h2 className={styles.h2}>Uma carteira inteira <em className={styles.em}>num relance.</em></h2>
        </div>
        <PontesCard padding={28} radius={22} shadow="xl">
          <div className={styles.kpiGrid}>
            {kpis.map((k) => (
              <PontesStatCard key={k.label} label={k.label} value={k.value} trend={k.trend} trendUp={k.trendUp} hint={k.hint} />
            ))}
          </div>
          <PontesTable<ClienteRow>
            title="Clientes"
            subtitle="Status de fechamento · maio 2026"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.nome}
          />
        </PontesCard>
      </div>
    </section>
  )
}

// --- Convite contador → cliente ----------------------------------------------

function SecaoConvite() {
  return (
    <section className={`${styles.feat} ${styles.featBg}`}>
      <div className={styles.wide}>
        <FeatureRow reverse={false} tag="Convite" title="O cliente entra com um link. Você assume o controle." text="Manda o convite por WhatsApp ou e-mail, o cliente cria a conta dele e te dá acesso de contador. Os dados de cada cliente ficam isolados — você vê tudo, eles veem só o próprio." mockup={<ConviteMockup />} />
      </div>
    </section>
  )
}

function ConviteMockup() {
  return (
    <div className={styles.mockWrap}>
      <PontesCard padding={24} radius={18} shadow="xl">
        <div className={styles.mockLabel}>Convidar cliente</div>
        <div className={styles.inviteField}>
          <span className={styles.inviteFieldIcon}><Send size={16} strokeWidth={2} /></span>
          <span className={styles.inviteEmail}>contato@padariadoze.com.br</span>
          <PontesBadge tone="primary" size="sm">Contador</PontesBadge>
        </div>
        <PontesButton variant="primary" size="md" fullWidth iconEnd={<ArrowRight size={14} strokeWidth={2.5} />}>Enviar convite</PontesButton>
        <div className={styles.inviteDivider}>
          <div className={styles.inviteWaitLabel}>Aguardando aceite</div>
          {[{ n: "Studio Bella", s: "Enviado há 2h" }, { n: "TechParts ME", s: "Aceito · hoje" }].map((c) => (
            <div key={c.n} className={styles.inviteRow}>
              <div className={styles.inviteRowIcon}><Building2 size={14} strokeWidth={2} /></div>
              <div style={{ flex: 1 }}><div className={styles.inviteRowName}>{c.n}</div><div className={styles.inviteRowSub}>{c.s}</div></div>
            </div>
          ))}
        </div>
      </PontesCard>
    </div>
  )
}

// --- Cobrança embutida no honorário ------------------------------------------

function SecaoCobranca() {
  return (
    <section className={`${styles.feat} ${styles.featSurface}`}>
      <div className={styles.wide}>
        <FeatureRow reverse={true} tag="Honorários" title="Cobre seu honorário sem sair do sistema." text="Defina o valor mensal por cliente, gere a cobrança e acompanhe quem pagou. O Pontes avisa atrasos automaticamente — você foca na contabilidade, não na cobrança." mockup={<CobrancaMockup />} />
      </div>
    </section>
  )
}

function CobrancaMockup() {
  return (
    <div className={styles.mockWrap}>
      <PontesCard padding={26} radius={18} shadow="xl">
        <div className={styles.cobHead}>
          <div>
            <div className={styles.cobLabel}>Honorários · Maio</div>
            <div className={styles.cobBig}>R$ 18.600</div>
          </div>
          <div className={styles.cobIcon}><Wallet size={22} strokeWidth={2} /></div>
        </div>
        <div className={styles.cobProgress}>
          <PontesProgress label="Recebido (R$ 14.200)" value={76} showValue={false} color="var(--pontes-primary)" />
        </div>
        {[
          { n: "Studio Bella", v: "R$ 1.200", pago: true },
          { n: "TechParts ME", v: "R$ 2.400", pago: true },
          { n: "Café Aurora", v: "R$ 800", pago: false },
        ].map((c) => (
          <div key={c.n} className={styles.cobRow}>
            <div className={styles.cobCheck} data-pago={c.pago}>
              {c.pago ? <Check size={14} strokeWidth={3} color="#10B981" /> : <Clock size={13} strokeWidth={2.5} color="#DC2626" />}
            </div>
            <span className={styles.cobName}>{c.n}</span>
            <span className={styles.cobVal} data-pago={c.pago}>{c.v}</span>
          </div>
        ))}
      </PontesCard>
    </div>
  )
}

// --- Relatórios contábeis -----------------------------------------------------

function SecaoRelatorios() {
  return (
    <section className={styles.sectionBg}>
      <div className={styles.wide}>
        <div className={styles.center}>
          <div className={styles.label}>Relatórios</div>
          <h2 className={styles.h2}>Tudo pronto pro <em className={styles.em}>fechamento.</em></h2>
        </div>
        <div className={styles.repGrid}>
          {[
            { icon: <FileText size={28} strokeWidth={2} />, t: "DRE por cliente", d: "Receitas, despesas e resultado de cada cliente, exportável em PDF e Excel num clique." },
            { icon: <BarChart3 size={28} strokeWidth={2} />, t: "Fluxo de caixa consolidado", d: "Entradas e saídas categorizadas, prontas pra conferência e classificação contábil." },
            { icon: <ShieldCheck size={28} strokeWidth={2.5} />, t: "Trilha de auditoria", d: "Cada lançamento registrado com data e autor. Histórico imutável pra sua segurança." },
          ].map((s) => (
            <PontesCard key={s.t} padding={32} radius={22}>
              <div className={styles.repIcon}>{s.icon}</div>
              <div className={styles.repTitle}>{s.t}</div>
              <div className={styles.repDesc}>{s.d}</div>
            </PontesCard>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonial() {
  return (
    <section className={styles.sectionSurface}>
      <div className={styles.testiInner}>
        <div className={styles.testiQuote}>"</div>
        <p className={styles.testiText}>
          Eu controlava 18 clientes em planilhas separadas e vivia perdido no fechamento. Com o Pontes vejo todos num painel, cobro o honorário no mesmo lugar e ganhei meu sábado de volta.
        </p>
        <div className={styles.testiWho}>
          <PontesAvatar size={56} photoUrl="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&h=120&auto=format&fit=crop&q=80" name="Ricardo Mendes" />
          <div className={styles.alignLeft}><div className={styles.testiName}>Ricardo Mendes</div><div className={styles.testiRole}>Contador autônomo · Belo Horizonte</div></div>
        </div>
      </div>
    </section>
  )
}

function CtaContador() {
  const navigate = useNavigate()
  return (
    <section className={styles.cta}>
      <Mesh />
      <div className={styles.ctaInner}>
        <div className={styles.ctaEyebrow}>
          <span className={styles.ctaEyebrowIcon}><Users size={18} strokeWidth={2.5} /></span>
          <span className={styles.ctaEyebrowText}>Plano Contador</span>
        </div>
        <h2 className={styles.ctaTitle}>
          Sua carteira inteira{" "}
          <em className={styles.emAccent}>sob controle.</em>
        </h2>
        <p className={styles.ctaLead}>Comece grátis, adicione seus primeiros clientes e veja a diferença já no próximo fechamento.</p>
        <div className={styles.ctaBtns}>
          <PontesButton variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Criar conta grátis</PontesButton>
          <PontesButton variant="outline-light" size="lg" onClick={() => navigate("/casais")}>Ver plano Família</PontesButton>
        </div>
      </div>
    </section>
  )
}
