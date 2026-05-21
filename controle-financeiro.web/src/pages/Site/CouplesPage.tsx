/**
 * CouplesPage — vertical "Para Casais" (#77). Rota pública `/casais`.
 *
 * Content-only: navbar/footer/control-bar/scrollbar vêm do <SiteLayout>.
 * Paleta + fonte via `useSiteTheme()` (provider global). Importa SÓ de
 * `@/components/pontes`. Ícones via lucide-react.
 */

import { useId } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Check, Play, Lock, Users, Zap, Home } from "lucide-react"
import { PontesButton, PontesCard, PontesBadge, PontesAvatar, PontesProgress } from "../../components/pontes"
import { useSiteTheme } from "./siteTheme"
import type { Palette } from "./theme"

export default function CouplesPage() {
  const { p, font } = useSiteTheme()
  return (
    <div style={{ fontFamily: font, color: p.text, background: p.surface }}>
      <Anims />
      <Hero p={p} font={font} />
      <Stats p={p} />
      <ComoFunciona p={p} font={font} />
      <SecaoRateio p={p} font={font} />
      <SecaoAprovacao p={p} font={font} />
      <SecaoAcerto p={p} font={font} />
      <SecaoPrivacidade p={p} font={font} />
      <Testimonial p={p} />
      <CtaFamilia p={p} font={font} />
    </div>
  )
}

// =============================================================================
// Helpers visuais (locais — não vão pra biblioteca)
// =============================================================================

function Anims() {
  return (
    <style>{`
      @keyframes cp-mesh { 0%,100% { transform: translate(0,0) scale(1) } 33% { transform: translate(40px,-30px) scale(1.12) } 66% { transform: translate(-25px,35px) scale(0.92) } }
      @keyframes cp-pulse { 0% { transform: scale(1); opacity: 0.65 } 100% { transform: scale(2.4); opacity: 0 } }
      @keyframes cp-toast { 0% { opacity: 0; transform: translateY(-12px) scale(0.95) } 100% { opacity: 1; transform: translateY(0) scale(1) } }
      .cp-noise { position: absolute; inset: 0; pointer-events: none; opacity: 0.05; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E"); }
    `}</style>
  )
}

function GridPattern({ color = "#FFFFFF", opacity = 0.08 }: { color?: string; opacity?: number }) {
  const id = `cp-grid-${useId().replace(/[:]/g, "")}`
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <defs>
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={color} strokeWidth="1" opacity={opacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

function Mesh({ p }: { p: Palette }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: "15%", top: "20%", width: 480, height: 480, background: p.primary, borderRadius: "50%", filter: "blur(80px)", opacity: 0.55, animation: "cp-mesh 14s ease-in-out infinite" }} />
      <div style={{ position: "absolute", right: "10%", top: "18%", width: 420, height: 420, background: p.accent, borderRadius: "50%", filter: "blur(80px)", opacity: 0.5, animation: "cp-mesh 16s ease-in-out infinite reverse" }} />
      <div style={{ position: "absolute", left: "45%", bottom: "10%", width: 380, height: 380, background: p.primaryDark, borderRadius: "50%", filter: "blur(80px)", opacity: 0.45, animation: "cp-mesh 18s ease-in-out infinite" }} />
    </div>
  )
}

function PulseDot({ color }: { color: string }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 8, height: 8 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "cp-pulse 1.6s ease-out infinite" }} />
      <span style={{ position: "relative", display: "block", width: 8, height: 8, borderRadius: "50%", background: color }} />
    </span>
  )
}

function Label({ p, children }: { p: Palette; children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>{children}</div>
}

function H2({ p, children }: { p: Palette; children: React.ReactNode }) {
  return <h2 style={{ fontSize: 44, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.08, fontFamily: "'Fraunces', serif", marginBottom: 18 }}>{children}</h2>
}

// =============================================================================
// SECTIONS
// =============================================================================

function Hero({ p, font }: { p: Palette; font: string }) {
  const navigate = useNavigate()
  return (
    <section style={{ position: "relative", padding: "200px 48px 140px", background: `linear-gradient(135deg, ${p.primaryDark} 0%, ${p.primary} 100%)`, color: p.heroFg, overflow: "hidden" }}>
      <GridPattern color={p.heroFg} opacity={0.08} />
      <Mesh p={p} />
      <div className="cp-noise" />
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 56, alignItems: "center", position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, marginBottom: 28 }}>
            <PulseDot color={p.accent} /> Para casais brasileiros
          </div>
          <h1 style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.035em", margin: 0, marginBottom: 28, fontFamily: "'Fraunces', serif" }}>
            Dinheiro de casal{" "}
            <em style={{ fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: p.accent }}>sem briga.</em>
          </h1>
          <p style={{ fontSize: 20, opacity: 0.88, lineHeight: 1.5, marginBottom: 36, maxWidth: 520 }}>
            Rateio explícito, aprovação de despesa e acerto mensal. Cada um mantém a conta privada — só o que vocês dois decidirem dividir aparece junto.
          </p>
          <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
            <PontesButton p={p} font={font} variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Começar grátis</PontesButton>
            <PontesButton p={p} font={font} variant="outline-light" size="lg" iconStart={<Play size={14} strokeWidth={2.5} />} onClick={() => navigate("/")}>Ver visão geral</PontesButton>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 13, opacity: 0.85, flexWrap: "wrap" }}>
            {["Grátis pra começar", "Conta privada respeitada", "Cancele quando quiser"].map((t) => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={14} strokeWidth={2.5} color={p.accent} /> {t}</span>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 480 }}>
          <div style={{ position: "absolute", inset: -40, background: `radial-gradient(ellipse at center, ${p.accent}44 0%, transparent 60%)`, filter: "blur(40px)", pointerEvents: "none" }} />
          <div style={{ position: "relative", width: 420, aspectRatio: "4/5", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 80px -20px rgba(0,0,0,0.45)", transform: "perspective(1500px) rotateY(-4deg)" }}>
            <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=900&auto=format&fit=crop&q=80" alt="Casal organizando finanças" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div style={{ position: "absolute", top: 40, right: -10, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 18px 40px -10px rgba(0,0,0,0.35)", padding: "12px 16px", minWidth: 220, fontFamily: font, animation: "cp-toast 600ms ease-out 500ms backwards", transform: "perspective(1500px) rotateY(-6deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={16} strokeWidth={3} color="#10B981" /></div>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: "#0B1220" }}>Maria aprovou</div><div style={{ fontSize: 11, color: "#64748B" }}>Conta de luz · R$ 240</div></div>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 40, left: -20, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 18px 40px -10px rgba(0,0,0,0.35)", padding: "14px 16px", minWidth: 200, fontFamily: font, animation: "cp-toast 600ms ease-out 800ms backwards", transform: "perspective(1500px) rotateY(4deg)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Saldo do mês</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0B1220" }}>R$ 3.420</div>
            <div style={{ fontSize: 11, color: "#10B981", fontWeight: 600, marginTop: 2 }}>Quitado entre vocês</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stats({ p }: { p: Palette }) {
  const stats = [{ v: "98%", l: "Casais recomendam" }, { v: "2×", l: "Menos briga sobre grana" }, { v: "15min", l: "Pra deixar tudo pronto" }]
  return (
    <section style={{ padding: "56px 48px", background: p.surface, borderBottom: `1px solid ${p.border}` }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
        {stats.map((s) => (
          <div key={s.l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: p.primary, letterSpacing: "-0.03em", marginBottom: 4 }}>{s.v}</div>
            <div style={{ fontSize: 13, color: p.textMuted, fontWeight: 500 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ComoFunciona({ p }: { p: Palette; font: string }) {
  const steps = [
    { n: "01", icon: <Users size={28} strokeWidth={2} />, t: "Vocês entram juntos", d: "Cria conta de casal — cada um com login próprio. Convida o parceiro por e-mail em 30 segundos." },
    { n: "02", icon: <Zap size={28} strokeWidth={2} />, t: "Definem o rateio padrão", d: "50/50, proporcional à renda, ou customizado por categoria. Muda a regra quando quiser." },
    { n: "03", icon: <Check size={28} strokeWidth={2.5} />, t: "O Pontes faz o resto", d: "Despesas conjuntas pedem aprovação. Acerto mensal mostra quem deve quanto. Privadas ficam privadas." },
  ]
  return (
    <section style={{ padding: "120px 48px", background: p.surface }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <Label p={p}>Como funciona</Label>
          <H2 p={p}>3 passos. <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>Sem planilha compartilhada.</em></H2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {steps.map((s) => (
            <PontesCard key={s.n} p={p} padding={32} radius={22}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 72, fontWeight: 900, color: p.primary, opacity: 0.12, lineHeight: 1, letterSpacing: "-0.04em" }}>{s.n}</div>
                <div style={{ color: p.primary }}>{s.icon}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: p.text, marginBottom: 10 }}>{s.t}</div>
              <div style={{ fontSize: 15, color: p.textMuted, lineHeight: 1.6 }}>{s.d}</div>
            </PontesCard>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureRow({ p, reverse, tag, title, text, mockup }: { p: Palette; reverse: boolean; tag: string; title: string; text: string; mockup: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", padding: "60px 0", direction: reverse ? "rtl" : "ltr" }}>
      <div style={{ direction: "ltr" }}>
        <Label p={p}>{tag}</Label>
        <h3 style={{ fontSize: 38, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.12, marginBottom: 18, fontFamily: "'Fraunces', serif" }}>{title}</h3>
        <p style={{ fontSize: 17, color: p.textMuted, lineHeight: 1.6, margin: 0 }}>{text}</p>
      </div>
      <div style={{ direction: "ltr", display: "flex", justifyContent: "center" }}>{mockup}</div>
    </div>
  )
}

function SecaoRateio({ p, font }: { p: Palette; font: string }) {
  return (
    <section style={{ padding: "60px 48px", background: p.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FeatureRow p={p} reverse={false} tag="Rateio" title="Conta dividida exatamente como vocês combinaram." text="Aluguel 50/50, supermercado proporcional à renda, internet 100% sua. Cada despesa segue a regra do casal — sem precisar lembrar quem pagou o quê." mockup={<RateioMockup p={p} font={font} />} />
      </div>
    </section>
  )
}

function RateioMockup({ p, font }: { p: Palette; font: string }) {
  return (
    <div style={{ position: "relative", width: 420, fontFamily: font }}>
      <PontesCard p={p} padding={24} radius={18} shadow="xl">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: p.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: p.primary }}><Home size={18} strokeWidth={2} /></div>
            <div><div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Aluguel</div><div style={{ fontSize: 11, color: p.textMuted }}>Maio · todo dia 5</div></div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: p.text }}>R$ 2.800</div>
        </div>
        <div style={{ borderTop: `1px solid ${p.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Rateio 50/50</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: p.primary, color: "#FFFFFF", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <PontesAvatar p={p} size={22} photoUrl="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&auto=format&fit=crop&q=80" name="Gustavo" />
                <span style={{ fontSize: 11, opacity: 0.85 }}>Gustavo</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>R$ 1.400</div>
            </div>
            <div style={{ flex: 1, background: p.accent, color: "#0B1220", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <PontesAvatar p={p} size={22} photoUrl="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&auto=format&fit=crop&q=80" name="Maria" />
                <span style={{ fontSize: 11, opacity: 0.85 }}>Maria</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>R$ 1.400</div>
            </div>
          </div>
        </div>
      </PontesCard>
      <div style={{ position: "absolute", top: -16, right: -30 }}><PontesBadge p={p} font={font} tone="success">REGRA ATIVA · Casa 50/50</PontesBadge></div>
    </div>
  )
}

function SecaoAprovacao({ p, font }: { p: Palette; font: string }) {
  return (
    <section style={{ padding: "60px 48px", background: p.surface }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FeatureRow p={p} reverse={true} tag="Aprovação" title="Despesa grande não entra sem o sim do parceiro." text="Defina um limite (ex: R$ 300). Acima disso, qualquer compra conjunta pede aprovação por push antes de virar dívida no acerto. Fim do 'não combinamos isso'." mockup={<AprovacaoMockup p={p} font={font} />} />
      </div>
    </section>
  )
}

function AprovacaoMockup({ p, font }: { p: Palette; font: string }) {
  return (
    <div style={{ width: 360, fontFamily: font }}>
      <div style={{ background: "#0B1220", borderRadius: 36, padding: 12, boxShadow: "0 30px 70px -20px rgba(0,0,0,0.4)" }}>
        <div style={{ background: p.surface, borderRadius: 28, padding: "18px 16px", minHeight: 480 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, fontSize: 11, color: p.textMuted }}>
            <span>09:42</span><span style={{ fontWeight: 700, color: p.text }}>Pontes</span><span>●●●</span>
          </div>
          <div style={{ background: p.primarySoft, borderRadius: 14, padding: 14, marginBottom: 14, border: `1px solid ${p.primary}22` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: p.primary, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Pedido de aprovação</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: p.text, marginBottom: 4 }}>Gustavo quer registrar</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: p.text, marginBottom: 6 }}>R$ 1.280,00</div>
            <div style={{ fontSize: 12, color: p.textMuted, marginBottom: 12 }}>Geladeira nova · Magazine Luiza · 12x sem juros</div>
            <div style={{ display: "flex", gap: 8 }}>
              <PontesButton p={p} font={font} variant="outline" size="sm" fullWidth>Recusar</PontesButton>
              <PontesButton p={p} font={font} variant="primary" size="sm" fullWidth>Aprovar</PontesButton>
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, marginTop: 18 }}>Histórico</div>
          {[{ who: "Você aprovou", what: "Mercado · R$ 420", when: "ontem" }, { who: "Gustavo aprovou", what: "Internet · R$ 130", when: "2 dias" }].map((h) => (
            <div key={h.what} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${p.border}` }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} strokeWidth={3} color="#10B981" /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700, color: p.text }}>{h.who}</div><div style={{ fontSize: 11, color: p.textMuted }}>{h.what} · {h.when}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SecaoAcerto({ p, font }: { p: Palette; font: string }) {
  return (
    <section style={{ padding: "60px 48px", background: p.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FeatureRow p={p} reverse={false} tag="Acerto do mês" title="No fim do mês, o Pontes te diz exatamente quem deve quanto." text="Quem pagou mais durante o mês recebe a diferença. Calculado certinho com base no rateio combinado. Sem matemática mental, sem 'eu paguei o jantar três vezes seguidas'." mockup={<AcertoMockup p={p} font={font} />} />
      </div>
    </section>
  )
}

function AcertoMockup({ p, font }: { p: Palette; font: string }) {
  return (
    <div style={{ width: 420, fontFamily: font }}>
      <PontesCard p={p} padding={26} radius={18} shadow="xl">
        <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Acerto · Maio 2026</div>
        <div style={{ fontSize: 13, color: p.text, marginBottom: 24 }}>Maria deve <strong>R$ 340,00</strong> ao Gustavo</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
          <PontesProgress p={p} font={font} label="Gustavo pagou" value={78} showValue={false} color={p.primary} />
          <div style={{ fontSize: 12, color: p.text, fontWeight: 700, marginTop: -10, textAlign: "right" }}>R$ 2.340</div>
          <PontesProgress p={p} font={font} label="Maria pagou" value={55} showValue={false} color={p.accent} />
          <div style={{ fontSize: 12, color: p.text, fontWeight: 700, marginTop: -10, textAlign: "right" }}>R$ 1.660</div>
        </div>
        <div style={{ background: p.primarySoft, borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${p.primary}22` }}>
          <div><div style={{ fontSize: 11, color: p.textMuted, marginBottom: 2 }}>Maria transfere via Pix</div><div style={{ fontSize: 22, fontWeight: 800, color: p.primary }}>R$ 340,00</div></div>
          <PontesButton p={p} font={font} variant="primary" size="sm" iconEnd={<ArrowRight size={14} strokeWidth={2.5} />}>Quitar</PontesButton>
        </div>
      </PontesCard>
    </div>
  )
}

function SecaoPrivacidade({ p, font }: { p: Palette; font: string }) {
  return (
    <section style={{ padding: "60px 48px", background: p.surface }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FeatureRow p={p} reverse={true} tag="Privacidade" title="Sua conta privada continua sua." text="Cada um tem contas e cartões que ninguém vê. Só vira despesa de casal quando vocês marcam — sem expor extrato pessoal, presente surpresa ou nada que não devia entrar no acerto." mockup={<PrivacidadeMockup p={p} font={font} />} />
      </div>
    </section>
  )
}

function PrivacidadeMockup({ p, font }: { p: Palette; font: string }) {
  const contas = [
    { icon: <Home size={16} />, name: "Nubank · Conjunta", tipo: "Conjunta" as const, visivel: "Maria vê" },
    { icon: <Lock size={16} />, name: "Itaú · Pessoal", tipo: "Privada" as const, visivel: "Só você" },
    { icon: <Lock size={16} />, name: "Inter · Reserva", tipo: "Privada" as const, visivel: "Só você" },
  ]
  return (
    <div style={{ width: 420, fontFamily: font }}>
      <PontesCard p={p} padding={24} radius={18} shadow="xl">
        <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Suas contas</div>
        {contas.map((acc) => (
          <div key={acc.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 12px", borderRadius: 12, marginBottom: 6, background: acc.tipo === "Privada" ? p.bg : p.primarySoft, border: acc.tipo === "Conjunta" ? `1px solid ${p.primary}33` : `1px solid ${p.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: p.surface, display: "flex", alignItems: "center", justifyContent: "center", color: p.primary }}>{acc.icon}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{acc.name}</div><div style={{ fontSize: 11, color: p.textMuted, marginTop: 2 }}>{acc.visivel}</div></div>
            <PontesBadge p={p} font={font} tone={acc.tipo === "Conjunta" ? "primary" : "neutral"} size="sm">{acc.tipo}</PontesBadge>
          </div>
        ))}
      </PontesCard>
    </div>
  )
}

function Testimonial({ p }: { p: Palette }) {
  return (
    <section style={{ padding: "120px 48px", background: p.bg }}>
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 64, color: p.primary, lineHeight: 1, marginBottom: 24, fontFamily: "'Fraunces', serif" }}>"</div>
        <p style={{ fontSize: 26, fontWeight: 500, color: p.text, lineHeight: 1.5, fontFamily: "'Fraunces', serif", margin: 0, marginBottom: 36, letterSpacing: "-0.01em" }}>
          A gente brigava todo fim de mês sobre quem pagou o quê. Agora abrimos o Pontes, vemos o acerto e quitamos no Pix em 10 segundos. Mudou nosso relacionamento, sem exagero.
        </p>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
          <PontesAvatar p={p} size={56} photoUrl="https://images.unsplash.com/photo-1521119989659-a83eee488004?w=120&h=120&auto=format&fit=crop&q=80" name="Camila Rafael" />
          <div style={{ textAlign: "left" }}><div style={{ fontSize: 15, fontWeight: 700, color: p.text }}>Camila & Rafael</div><div style={{ fontSize: 13, color: p.textMuted }}>Casados há 4 anos · São Paulo</div></div>
        </div>
      </div>
    </section>
  )
}

function CtaFamilia({ p, font }: { p: Palette; font: string }) {
  const navigate = useNavigate()
  return (
    <section style={{ padding: "120px 48px", background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)`, color: p.heroFg, position: "relative", overflow: "hidden" }}>
      <Mesh p={p} />
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <h2 style={{ fontSize: 56, fontWeight: 600, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.05, fontFamily: "'Fraunces', serif", marginBottom: 24 }}>
          Pronto pra parar de brigar{" "}
          <em style={{ fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: p.accent }}>sobre grana?</em>
        </h2>
        <p style={{ fontSize: 19, opacity: 0.88, marginBottom: 40, lineHeight: 1.5 }}>O plano Família é grátis pra começar. Você convida, define o rateio e em 15 minutos tá rodando.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <PontesButton p={p} font={font} variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Criar conta grátis</PontesButton>
          <PontesButton p={p} font={font} variant="outline-light" size="lg" onClick={() => navigate("/")}>Ver visão geral</PontesButton>
        </div>
      </div>
    </section>
  )
}
