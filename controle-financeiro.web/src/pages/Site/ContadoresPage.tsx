/**
 * ContadoresPage — vertical "Para Contadores" (#78). Rota pública `/contadores`.
 *
 * Público B2B: contador autônomo / escritório acompanhando N clientes. Mercado
 * virgem no BR. Content-only: navbar/footer/control-bar/scrollbar vêm do
 * <SiteLayout>. Paleta + fonte via `useSiteTheme()`. Importa SÓ de
 * `@/components/pontes`. Ícones via lucide-react.
 */

import { useId } from "react"
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
import { useSiteTheme } from "./siteTheme"
import type { Palette } from "./theme"

export default function ContadoresPage() {
  const { p, font } = useSiteTheme()
  return (
    <div style={{ fontFamily: font, color: p.text, background: p.surface }}>
      <Anims />
      <Hero p={p} font={font} />
      <Stats p={p} />
      <SecaoMultiCliente p={p} font={font} />
      <SecaoConvite p={p} font={font} />
      <SecaoCobranca p={p} font={font} />
      <SecaoRelatorios p={p} />
      <Testimonial p={p} />
      <CtaContador p={p} font={font} />
    </div>
  )
}

// =============================================================================
// Helpers visuais (locais — não vão pra biblioteca)
// =============================================================================

function Anims() {
  return (
    <style>{`
      @keyframes ct-mesh { 0%,100% { transform: translate(0,0) scale(1) } 33% { transform: translate(40px,-30px) scale(1.12) } 66% { transform: translate(-25px,35px) scale(0.92) } }
      @keyframes ct-pulse { 0% { transform: scale(1); opacity: 0.65 } 100% { transform: scale(2.4); opacity: 0 } }
      @keyframes ct-toast { 0% { opacity: 0; transform: translateY(-12px) scale(0.95) } 100% { opacity: 1; transform: translateY(0) scale(1) } }
      .ct-noise { position: absolute; inset: 0; pointer-events: none; opacity: 0.05; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E"); }
    `}</style>
  )
}

function GridPattern({ color = "#FFFFFF", opacity = 0.08 }: { color?: string; opacity?: number }) {
  const id = `ct-grid-${useId().replace(/[:]/g, "")}`
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
      <div style={{ position: "absolute", left: "15%", top: "20%", width: 480, height: 480, background: p.primary, borderRadius: "50%", filter: "blur(80px)", opacity: 0.55, animation: "ct-mesh 14s ease-in-out infinite" }} />
      <div style={{ position: "absolute", right: "10%", top: "18%", width: 420, height: 420, background: p.accent, borderRadius: "50%", filter: "blur(80px)", opacity: 0.5, animation: "ct-mesh 16s ease-in-out infinite reverse" }} />
      <div style={{ position: "absolute", left: "45%", bottom: "10%", width: 380, height: 380, background: p.primaryDark, borderRadius: "50%", filter: "blur(80px)", opacity: 0.45, animation: "ct-mesh 18s ease-in-out infinite" }} />
    </div>
  )
}

function PulseDot({ color }: { color: string }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 8, height: 8 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "ct-pulse 1.6s ease-out infinite" }} />
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

// =============================================================================
// SECTIONS
// =============================================================================

function Hero({ p, font }: { p: Palette; font: string }) {
  const navigate = useNavigate()
  return (
    <section style={{ position: "relative", padding: "200px 48px 140px", background: `linear-gradient(135deg, ${p.primaryDark} 0%, ${p.primary} 100%)`, color: p.heroFg, overflow: "hidden" }}>
      <GridPattern color={p.heroFg} opacity={0.08} />
      <Mesh p={p} />
      <div className="ct-noise" />
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 56, alignItems: "center", position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, marginBottom: 28 }}>
            <PulseDot color={p.accent} /> Para contadores e escritórios
          </div>
          <h1 style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.035em", margin: 0, marginBottom: 28, fontFamily: "'Fraunces', serif" }}>
            Todos os clientes{" "}
            <em style={{ fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: p.accent }}>numa tela só.</em>
          </h1>
          <p style={{ fontSize: 20, opacity: 0.88, lineHeight: 1.5, marginBottom: 36, maxWidth: 520 }}>
            Acompanhe as finanças de cada cliente em tempo real, convide-os com um link e embuta a cobrança do seu honorário. O painel que faltava pro contador autônomo brasileiro.
          </p>
          <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
            <PontesButton p={p} font={font} variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Testar grátis</PontesButton>
            <PontesButton p={p} font={font} variant="outline-light" size="lg" iconStart={<Play size={14} strokeWidth={2.5} />} onClick={() => navigate("/")}>Ver visão geral</PontesButton>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 13, opacity: 0.85, flexWrap: "wrap" }}>
            {["Clientes ilimitados", "Dados isolados por cliente", "Cancele quando quiser"].map((t) => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={14} strokeWidth={2.5} color={p.accent} /> {t}</span>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 480 }}>
          <div style={{ position: "absolute", inset: -40, background: `radial-gradient(ellipse at center, ${p.accent}44 0%, transparent 60%)`, filter: "blur(40px)", pointerEvents: "none" }} />
          <div style={{ position: "relative", width: 420, aspectRatio: "4/5", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 80px -20px rgba(0,0,0,0.45)", transform: "perspective(1500px) rotateY(-4deg)" }}>
            <img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&auto=format&fit=crop&q=80" alt="Contador analisando finanças de clientes" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div style={{ position: "absolute", top: 40, right: -10, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 18px 40px -10px rgba(0,0,0,0.35)", padding: "12px 16px", minWidth: 220, fontFamily: font, animation: "ct-toast 600ms ease-out 500ms backwards", transform: "perspective(1500px) rotateY(-6deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center" }}><Building2 size={16} strokeWidth={2.5} color="#2563EB" /></div>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: "#0B1220" }}>Padaria do Zé</div><div style={{ fontSize: 11, color: "#64748B" }}>Fechamento OK · maio</div></div>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 40, left: -20, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 18px 40px -10px rgba(0,0,0,0.35)", padding: "14px 16px", minWidth: 200, fontFamily: font, animation: "ct-toast 600ms ease-out 800ms backwards", transform: "perspective(1500px) rotateY(4deg)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Carteira ativa</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0B1220" }}>24 clientes</div>
            <div style={{ fontSize: 11, color: "#10B981", fontWeight: 600, marginTop: 2 }}>Todos em dia</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stats({ p }: { p: Palette }) {
  const stats = [{ v: "10h", l: "Economizadas por mês" }, { v: "∞", l: "Clientes por conta" }, { v: "5min", l: "Pra integrar um cliente" }]
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

// --- Visão multi-cliente: dashboard com KPIs + tabela de clientes ------------

type ClienteRow = { nome: string; tipo: string; status: "Em dia" | "Pendente" | "Atrasado"; saldo: string }

function SecaoMultiCliente({ p, font }: { p: Palette; font: string }) {
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PontesAvatar p={p} size={28} name={r.nome} />
          <div><div style={{ fontWeight: 700, color: p.text, fontSize: 13 }}>{r.nome}</div><div style={{ fontSize: 11, color: p.textMuted }}>{r.tipo}</div></div>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <PontesBadge p={p} font={font} tone={tone[r.status]} size="sm">{r.status}</PontesBadge> },
    { key: "saldo", header: "Saldo do mês", align: "right", render: (r) => <span style={{ fontWeight: 700, color: p.text }}>{r.saldo}</span> },
  ]
  return (
    <section style={{ padding: "120px 48px", background: p.surface }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Label p={p}>Visão multi-cliente</Label>
          <H2 p={p}>Uma carteira inteira <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>num relance.</em></H2>
        </div>
        <PontesCard p={p} padding={28} radius={22} shadow="xl">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {kpis.map((k) => (
              <PontesStatCard key={k.label} p={p} font={font} label={k.label} value={k.value} trend={k.trend} trendUp={k.trendUp} hint={k.hint} />
            ))}
          </div>
          <PontesTable<ClienteRow>
            p={p} font={font}
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

function SecaoConvite({ p, font }: { p: Palette; font: string }) {
  return (
    <section style={{ padding: "60px 48px", background: p.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FeatureRow p={p} reverse={false} tag="Convite" title="O cliente entra com um link. Você assume o controle." text="Manda o convite por WhatsApp ou e-mail, o cliente cria a conta dele e te dá acesso de contador. Os dados de cada cliente ficam isolados — você vê tudo, eles veem só o próprio." mockup={<ConviteMockup p={p} font={font} />} />
      </div>
    </section>
  )
}

function ConviteMockup({ p, font }: { p: Palette; font: string }) {
  return (
    <div style={{ width: 420, fontFamily: font }}>
      <PontesCard p={p} padding={24} radius={18} shadow="xl">
        <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Convidar cliente</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <Send size={16} strokeWidth={2} color={p.primary} />
          <span style={{ fontSize: 14, color: p.text, flex: 1 }}>contato@padariadoze.com.br</span>
          <PontesBadge p={p} font={font} tone="primary" size="sm">Contador</PontesBadge>
        </div>
        <PontesButton p={p} font={font} variant="primary" size="md" fullWidth iconEnd={<ArrowRight size={14} strokeWidth={2.5} />}>Enviar convite</PontesButton>
        <div style={{ borderTop: `1px solid ${p.border}`, marginTop: 18, paddingTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Aguardando aceite</div>
          {[{ n: "Studio Bella", s: "Enviado há 2h" }, { n: "TechParts ME", s: "Aceito · hoje" }].map((c) => (
            <div key={c.n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: p.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: p.primary }}><Building2 size={14} strokeWidth={2} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{c.n}</div><div style={{ fontSize: 11, color: p.textMuted }}>{c.s}</div></div>
            </div>
          ))}
        </div>
      </PontesCard>
    </div>
  )
}

// --- Cobrança embutida no honorário ------------------------------------------

function SecaoCobranca({ p, font }: { p: Palette; font: string }) {
  return (
    <section style={{ padding: "60px 48px", background: p.surface }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FeatureRow p={p} reverse={true} tag="Honorários" title="Cobre seu honorário sem sair do sistema." text="Defina o valor mensal por cliente, gere a cobrança e acompanhe quem pagou. O Pontes avisa atrasos automaticamente — você foca na contabilidade, não na cobrança." mockup={<CobrancaMockup p={p} font={font} />} />
      </div>
    </section>
  )
}

function CobrancaMockup({ p, font }: { p: Palette; font: string }) {
  return (
    <div style={{ width: 420, fontFamily: font }}>
      <PontesCard p={p} padding={26} radius={18} shadow="xl">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Honorários · Maio</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: p.text }}>R$ 18.600</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: p.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: p.primary }}><Wallet size={22} strokeWidth={2} /></div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <PontesProgress p={p} font={font} label="Recebido (R$ 14.200)" value={76} showValue={false} color={p.primary} />
        </div>
        {[
          { n: "Studio Bella", v: "R$ 1.200", pago: true },
          { n: "TechParts ME", v: "R$ 2.400", pago: true },
          { n: "Café Aurora", v: "R$ 800", pago: false },
        ].map((c) => (
          <div key={c.n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${p.border}` }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: c.pago ? "#D1FAE5" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {c.pago ? <Check size={14} strokeWidth={3} color="#10B981" /> : <Clock size={13} strokeWidth={2.5} color="#DC2626" />}
            </div>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: p.text }}>{c.n}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: c.pago ? p.text : "#DC2626" }}>{c.v}</span>
          </div>
        ))}
      </PontesCard>
    </div>
  )
}

// --- Relatórios contábeis -----------------------------------------------------

function SecaoRelatorios({ p }: { p: Palette }) {
  return (
    <section style={{ padding: "120px 48px", background: p.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Label p={p}>Relatórios</Label>
          <H2 p={p}>Tudo pronto pro <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>fechamento.</em></H2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { icon: <FileText size={28} strokeWidth={2} />, t: "DRE por cliente", d: "Receitas, despesas e resultado de cada cliente, exportável em PDF e Excel num clique." },
            { icon: <BarChart3 size={28} strokeWidth={2} />, t: "Fluxo de caixa consolidado", d: "Entradas e saídas categorizadas, prontas pra conferência e classificação contábil." },
            { icon: <ShieldCheck size={28} strokeWidth={2.5} />, t: "Trilha de auditoria", d: "Cada lançamento registrado com data e autor. Histórico imutável pra sua segurança." },
          ].map((s) => (
            <PontesCard key={s.t} p={p} padding={32} radius={22}>
              <div style={{ color: p.primary, marginBottom: 16 }}>{s.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: p.text, marginBottom: 10 }}>{s.t}</div>
              <div style={{ fontSize: 15, color: p.textMuted, lineHeight: 1.6 }}>{s.d}</div>
            </PontesCard>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonial({ p }: { p: Palette }) {
  return (
    <section style={{ padding: "120px 48px", background: p.surface }}>
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 64, color: p.primary, lineHeight: 1, marginBottom: 24, fontFamily: "'Fraunces', serif" }}>"</div>
        <p style={{ fontSize: 26, fontWeight: 500, color: p.text, lineHeight: 1.5, fontFamily: "'Fraunces', serif", margin: 0, marginBottom: 36, letterSpacing: "-0.01em" }}>
          Eu controlava 18 clientes em planilhas separadas e vivia perdido no fechamento. Com o Pontes vejo todos num painel, cobro o honorário no mesmo lugar e ganhei meu sábado de volta.
        </p>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
          <PontesAvatar p={p} size={56} photoUrl="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&h=120&auto=format&fit=crop&q=80" name="Ricardo Mendes" />
          <div style={{ textAlign: "left" }}><div style={{ fontSize: 15, fontWeight: 700, color: p.text }}>Ricardo Mendes</div><div style={{ fontSize: 13, color: p.textMuted }}>Contador autônomo · Belo Horizonte</div></div>
        </div>
      </div>
    </section>
  )
}

function CtaContador({ p, font }: { p: Palette; font: string }) {
  const navigate = useNavigate()
  return (
    <section style={{ padding: "120px 48px", background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)`, color: p.heroFg, position: "relative", overflow: "hidden" }}>
      <Mesh p={p} />
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Users size={18} strokeWidth={2.5} color={p.accent} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85 }}>Plano Contador</span>
        </div>
        <h2 style={{ fontSize: 56, fontWeight: 600, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.05, fontFamily: "'Fraunces', serif", marginBottom: 24 }}>
          Sua carteira inteira{" "}
          <em style={{ fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: p.accent }}>sob controle.</em>
        </h2>
        <p style={{ fontSize: 19, opacity: 0.88, marginBottom: 40, lineHeight: 1.5 }}>Comece grátis, adicione seus primeiros clientes e veja a diferença já no próximo fechamento.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <PontesButton p={p} font={font} variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Criar conta grátis</PontesButton>
          <PontesButton p={p} font={font} variant="outline-light" size="lg" onClick={() => navigate("/casais")}>Ver plano Família</PontesButton>
        </div>
      </div>
    </section>
  )
}
