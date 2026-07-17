/**
 * CouplesPage — vertical "Para Casais" (#77). Rota pública `/casais`.
 *
 * Content-only: navbar/footer/control-bar/scrollbar vêm do <SiteLayout>.
 * Estilo via CSS Modules + var(--pontes-*) (#122). Importa SÓ de
 * `@/components/pontes`. Ícones via lucide-react.
 */

import { useNavigate } from "react-router-dom"
import { ArrowRight, Check, Play, Lock, Users, Zap, Home } from "lucide-react"
import { PontesButton, PontesCard, PontesBadge, PontesAvatar, PontesProgress } from "../../components/pontes"
import styles from "./CouplesPage.module.css"

export default function CouplesPage() {
  return (
    <div className={styles.root}>
      <Hero />
      <Stats />
      <ComoFunciona />
      <SecaoRateio />
      <SecaoAprovacao />
      <SecaoAcerto />
      <SecaoPrivacidade />
      <Testimonial />
      <CtaFamilia />
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
        <pattern id="cp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity={0.08} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cp-grid)" />
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
            <PulseDot /> Para casais brasileiros
          </div>
          <h1 className={styles.heroTitle}>
            Dinheiro de casal{" "}
            <em className={styles.emAccent}>sem briga.</em>
          </h1>
          <p className={styles.heroLead}>
            Rateio explícito, aprovação de despesa e acerto mensal. Cada um mantém a conta privada — só o que vocês dois decidirem dividir aparece junto.
          </p>
          <div className={styles.heroBtns}>
            <PontesButton variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Começar grátis</PontesButton>
            <PontesButton variant="outline-light" size="lg" iconStart={<Play size={14} strokeWidth={2.5} />} onClick={() => navigate("/")}>Ver visão geral</PontesButton>
          </div>
          <div className={styles.heroChecks}>
            {["Grátis pra começar", "Conta privada respeitada", "Cancele quando quiser"].map((t) => (
              <span key={t} className={styles.heroCheck}><span className={styles.heroCheckIcon}><Check size={14} strokeWidth={2.5} /></span> {t}</span>
            ))}
          </div>
        </div>
        <div className={styles.heroArt}>
          <div className={styles.heroGlow} />
          <div className={styles.heroPhoto}>
            <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=900&auto=format&fit=crop&q=80" alt="Casal organizando finanças" className={styles.heroPhotoImg} />
          </div>
          <div className={`${styles.floatCard} ${styles.floatTop}`}>
            <div className={styles.floatRow}>
              <div className={styles.floatCheck}><Check size={16} strokeWidth={3} color="#10B981" /></div>
              <div><div className={styles.floatName}>Maria aprovou</div><div className={styles.floatSub}>Conta de luz · R$ 240</div></div>
            </div>
          </div>
          <div className={`${styles.floatCard} ${styles.floatBottom}`}>
            <div className={styles.floatLabel}>Saldo do mês</div>
            <div className={styles.floatBig}>R$ 3.420</div>
            <div className={styles.floatGreen}>Quitado entre vocês</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const stats = [{ v: "98%", l: "Casais recomendam" }, { v: "2×", l: "Menos briga sobre grana" }, { v: "15min", l: "Pra deixar tudo pronto" }]
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

function ComoFunciona() {
  const steps = [
    { n: "01", icon: <Users size={28} strokeWidth={2} />, t: "Vocês entram juntos", d: "Cria conta de casal — cada um com login próprio. Convida o parceiro por e-mail em 30 segundos." },
    { n: "02", icon: <Zap size={28} strokeWidth={2} />, t: "Definem o rateio padrão", d: "50/50, proporcional à renda, ou customizado por categoria. Muda a regra quando quiser." },
    { n: "03", icon: <Check size={28} strokeWidth={2.5} />, t: "O Pontes faz o resto", d: "Despesas conjuntas pedem aprovação. Acerto mensal mostra o que cada um tem a acertar. Privadas ficam privadas." },
  ]
  return (
    <section className={styles.sectionSurface}>
      <div className={styles.wide}>
        <div className={styles.center}>
          <div className={styles.label}>Como funciona</div>
          <h2 className={styles.h2}>3 passos. <em className={styles.em}>Sem planilha compartilhada.</em></h2>
        </div>
        <div className={styles.stepsGrid}>
          {steps.map((s) => (
            <PontesCard key={s.n} padding={32} radius={22}>
              <div className={styles.stepHead}>
                <div className={styles.stepNum}>{s.n}</div>
                <div className={styles.stepIcon}>{s.icon}</div>
              </div>
              <div className={styles.stepTitle}>{s.t}</div>
              <div className={styles.stepDesc}>{s.d}</div>
            </PontesCard>
          ))}
        </div>
      </div>
    </section>
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

function SecaoRateio() {
  return (
    <section className={`${styles.feat} ${styles.featBg}`}>
      <div className={styles.wide}>
        <FeatureRow reverse={false} tag="Rateio" title="Conta dividida exatamente como vocês combinaram." text="Aluguel 50/50, supermercado proporcional à renda, internet 100% sua. Cada despesa segue a regra do casal — sem precisar lembrar quem pagou o quê." mockup={<RateioMockup />} />
      </div>
    </section>
  )
}

function RateioMockup() {
  return (
    <div className={styles.mockWrap}>
      <PontesCard padding={24} radius={18} shadow="xl">
        <div className={styles.rateHead}>
          <div className={styles.rateLeft}>
            <div className={styles.rateIcon}><Home size={18} strokeWidth={2} /></div>
            <div><div className={styles.rateName}>Aluguel</div><div className={styles.rateMeta}>Maio · todo dia 5</div></div>
          </div>
          <div className={styles.rateValue}>R$ 2.800</div>
        </div>
        <div className={styles.rateSplit}>
          <div className={styles.rateSplitLabel}>Rateio 50/50</div>
          <div className={styles.rateChips}>
            <div className={styles.rateChipP}>
              <div className={styles.rateChipHead}>
                <PontesAvatar size={22} photoUrl="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&auto=format&fit=crop&q=80" name="Gustavo" />
                <span className={styles.rateChipWho}>Gustavo</span>
              </div>
              <div className={styles.rateChipVal}>R$ 1.400</div>
            </div>
            <div className={styles.rateChipA}>
              <div className={styles.rateChipHead}>
                <PontesAvatar size={22} photoUrl="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&auto=format&fit=crop&q=80" name="Maria" />
                <span className={styles.rateChipWho}>Maria</span>
              </div>
              <div className={styles.rateChipVal}>R$ 1.400</div>
            </div>
          </div>
        </div>
      </PontesCard>
      <div className={styles.mockBadge}><PontesBadge tone="success">REGRA ATIVA · Casa 50/50</PontesBadge></div>
    </div>
  )
}

function SecaoAprovacao() {
  return (
    <section className={`${styles.feat} ${styles.featSurface}`}>
      <div className={styles.wide}>
        <FeatureRow reverse={true} tag="Aprovação" title="Despesa grande não entra sem o sim do parceiro." text="Defina um limite (ex: R$ 300). Acima disso, qualquer compra conjunta pede aprovação por push antes de entrar no acerto do mês. Fim do 'não combinamos isso'." mockup={<AprovacaoMockup />} />
      </div>
    </section>
  )
}

function AprovacaoMockup() {
  return (
    <div className={styles.mockWrapNarrow}>
      <div className={styles.phone}>
        <div className={styles.phoneScreen}>
          <div className={styles.phoneBar}>
            <span>09:42</span><span className={styles.phoneBrand}>Pontes</span><span>●●●</span>
          </div>
          <div className={styles.approveCard}>
            <div className={styles.approveLabel}>Pedido de aprovação</div>
            <div className={styles.approveWho}>Gustavo quer registrar</div>
            <div className={styles.approveVal}>R$ 1.280,00</div>
            <div className={styles.approveDesc}>Geladeira nova · Magazine Luiza · 12x sem juros</div>
            <div className={styles.approveBtns}>
              <PontesButton variant="outline" size="sm" fullWidth>Recusar</PontesButton>
              <PontesButton variant="primary" size="sm" fullWidth>Aprovar</PontesButton>
            </div>
          </div>
          <div className={styles.histLabel}>Histórico</div>
          {[{ who: "Você aprovou", what: "Mercado · R$ 420", when: "ontem" }, { who: "Gustavo aprovou", what: "Internet · R$ 130", when: "2 dias" }].map((h) => (
            <div key={h.what} className={styles.histRow}>
              <div className={styles.histCheck}><Check size={14} strokeWidth={3} color="#10B981" /></div>
              <div style={{ flex: 1 }}><div className={styles.histWho}>{h.who}</div><div className={styles.histWhat}>{h.what} · {h.when}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SecaoAcerto() {
  return (
    <section className={`${styles.feat} ${styles.featBg}`}>
      <div className={styles.wide}>
        <FeatureRow reverse={false} tag="Acerto do mês" title="No fim do mês, o Pontes te diz exatamente como acertar as contas." text="Quem pagou mais durante o mês recebe a diferença. Calculado certinho com base no rateio combinado. Sem matemática mental, sem 'eu paguei o jantar três vezes seguidas'." mockup={<AcertoMockup />} />
      </div>
    </section>
  )
}

function AcertoMockup() {
  return (
    <div className={styles.mockWrap}>
      <PontesCard padding={26} radius={18} shadow="xl">
        <div className={styles.acertoLabel}>Acerto · Maio 2026</div>
        <div className={styles.acertoSub}>Maria acerta <strong>R$ 340,00</strong> com o Gustavo</div>
        <div className={styles.acertoBars}>
          <PontesProgress label="Gustavo pagou" value={78} showValue={false} color="var(--pontes-primary)" />
          <div className={styles.acertoBarVal}>R$ 2.340</div>
          <PontesProgress label="Maria pagou" value={55} showValue={false} color="var(--pontes-accent)" />
          <div className={styles.acertoBarVal}>R$ 1.660</div>
        </div>
        <div className={styles.acertoBox}>
          <div><div className={styles.acertoPixLabel}>Maria transfere via Pix</div><div className={styles.acertoPixVal}>R$ 340,00</div></div>
          <PontesButton variant="primary" size="sm" iconEnd={<ArrowRight size={14} strokeWidth={2.5} />}>Quitar</PontesButton>
        </div>
      </PontesCard>
    </div>
  )
}

function SecaoPrivacidade() {
  return (
    <section className={`${styles.feat} ${styles.featSurface}`}>
      <div className={styles.wide}>
        <FeatureRow reverse={true} tag="Privacidade" title="Sua conta privada continua sua." text="Cada um tem contas e cartões que ninguém vê. Só vira despesa de casal quando vocês marcam — sem expor extrato pessoal, presente surpresa ou nada que não devia entrar no acerto." mockup={<PrivacidadeMockup />} />
      </div>
    </section>
  )
}

function PrivacidadeMockup() {
  const contas = [
    { icon: <Home size={16} />, name: "Nubank · Conjunta", tipo: "Conjunta" as const, visivel: "Maria vê" },
    { icon: <Lock size={16} />, name: "Itaú · Pessoal", tipo: "Privada" as const, visivel: "Só você" },
    { icon: <Lock size={16} />, name: "Inter · Reserva", tipo: "Privada" as const, visivel: "Só você" },
  ]
  return (
    <div className={styles.mockWrap}>
      <PontesCard padding={24} radius={18} shadow="xl">
        <div className={styles.privLabel}>Suas contas</div>
        {contas.map((acc) => (
          <div key={acc.name} className={styles.privRow} data-tipo={acc.tipo}>
            <div className={styles.privIcon}>{acc.icon}</div>
            <div style={{ flex: 1 }}><div className={styles.privName}>{acc.name}</div><div className={styles.privVis}>{acc.visivel}</div></div>
            <PontesBadge tone={acc.tipo === "Conjunta" ? "primary" : "neutral"} size="sm">{acc.tipo}</PontesBadge>
          </div>
        ))}
      </PontesCard>
    </div>
  )
}

function Testimonial() {
  return (
    <section className={styles.testi}>
      <div className={styles.testiInner}>
        <div className={styles.testiQuote}>"</div>
        <p className={styles.testiText}>
          A gente brigava todo fim de mês sobre quem pagou o quê. Agora abrimos o Pontes, vemos o acerto e quitamos no Pix em 10 segundos. Mudou nosso relacionamento, sem exagero.
        </p>
        <div className={styles.testiWho}>
          <PontesAvatar size={56} photoUrl="https://images.unsplash.com/photo-1521119989659-a83eee488004?w=120&h=120&auto=format&fit=crop&q=80" name="Camila Rafael" />
          <div className={styles.alignLeft}><div className={styles.testiName}>Camila & Rafael</div><div className={styles.testiRole}>Casados há 4 anos · São Paulo</div></div>
        </div>
      </div>
    </section>
  )
}

function CtaFamilia() {
  const navigate = useNavigate()
  return (
    <section className={styles.cta}>
      <Mesh />
      <div className={styles.ctaInner}>
        <h2 className={styles.ctaTitle}>
          Pronto pra parar de brigar{" "}
          <em className={styles.emAccent}>sobre grana?</em>
        </h2>
        <p className={styles.ctaLead}>O plano Família é grátis pra começar. Você convida, define o rateio e em 15 minutos tá rodando.</p>
        <div className={styles.ctaBtns}>
          <PontesButton variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Criar conta grátis</PontesButton>
          <PontesButton variant="outline-light" size="lg" onClick={() => navigate("/")}>Ver visão geral</PontesButton>
        </div>
      </div>
    </section>
  )
}
