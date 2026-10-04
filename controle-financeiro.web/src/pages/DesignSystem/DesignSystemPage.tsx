/**
 * Design System — rota pública /design-system.
 *
 * Showcase ao vivo da biblioteca de componentes Pontes. Trocador de paleta +
 * fonte no topo aplica em tudo. Estilo via CSS Modules + var(--pontes-*) (#122):
 * o root injeta as vars ESCOPADAS da paleta/fonte LOCAL (paletteVars), e os
 * componentes/estilos leem var(--pontes-*) desse escopo — sem props p/font.
 *
 * Quando #90 (personalização in-app) entregar, o trocador some — a paleta vem
 * do contexto global do usuário.
 */

import { useEffect, useState } from "react"
import {
  Plus, Download, ArrowRight, ChevronLeft, ChevronRight,
  Settings, MoreHorizontal, Bell, Search, Pencil, Copy, Share2, Trash2,
  TrendingDown, TrendingUp, Check, X, PauseCircle, SearchX,
} from "lucide-react"
import {
  // theme
  palettes, fonts, semantic, spacing, radii, shadows, transitions, paletteVars,
  type Palette, type FontOption,
  // botões
  PontesButton, PontesIconButton, PontesFab, PontesButtonGroup, PontesLink, PontesNavLink,
  PontesChoiceCards,
  // form
  PontesField, PontesInput, PontesMoneyInput, PontesTextarea,
  PontesSelect, PontesGroupedSelect, PontesToggle, PontesCheckbox, PontesRadioGroup,
  PontesOtpInput, PontesSlider, PontesDatePicker, PontesDateInput, PontesMonthInput, PontesFileDrop,
  PontesTagInput, PontesColorPicker, PontesRating, PontesKbd, PontesKbdGroup,
  // dados
  PontesBadge, PontesAvatar, PontesAvatarStack, PontesAlert,
  PontesProgress, PontesStatCard, PontesCategoryDonut, PontesCard, PontesTable, PontesTabela,
  // feedback
  PontesToast, PontesModal, PontesDialog, PontesSkeleton, PontesSkeletonList,
  PontesEmptyState, PontesLoadingDots, PontesDrawer,
  PontesTooltip, PontesPopover,
  // navegação
  PontesBreadcrumb, PontesTabs, PontesStepper, PontesPagination,
  PontesCommandPalette, PontesSidebarItem, PontesSidebarSection, PontesSegmented,
  // padrão de tela interna
  PontesPageHeader, PontesToolbar, PontesRowActions,
  // site
  PontesFooter, PontesLogo, PontesLogoMark,
  // util
  applyPontesScrollbar, usePontesBodyScrollbar,
} from "../../components/pontes"
import styles from "./DesignSystemPage.module.css"

type TabId = "botoes" | "form" | "data" | "feedback" | "navegacao" | "site" | "tokens" | "layout"

const TABS: { value: TabId; label: string }[] = [
  { value: "botoes", label: "Botões" },
  { value: "form", label: "Form & Inputs" },
  { value: "data", label: "Cards & Dados" },
  { value: "feedback", label: "Feedback" },
  { value: "navegacao", label: "Navegação" },
  { value: "site", label: "Site" },
  { value: "tokens", label: "Tokens" },
  { value: "layout", label: "Espaço & Efeitos" },
]

export default function DesignSystemPage() {
  const [paletteId, setPaletteId] = useState("A")
  const [fontId, setFontId] = useState("plus-jakarta")
  const [tab, setTab] = useState<TabId>("botoes")

  const palette = palettes.find((x) => x.id === paletteId) ?? palettes[0]
  const fontOpt = fonts.find((x) => x.id === fontId) ?? fonts[0]
  const font = fontOpt.family

  // Override body { overflow: hidden } global.
  useEffect(() => {
    const prev = {
      bodyO: document.body.style.overflow,
      htmlO: document.documentElement.style.overflow,
      bodyH: document.body.style.height,
      htmlH: document.documentElement.style.height,
    }
    document.body.style.overflow = "auto"
    document.documentElement.style.overflow = "auto"
    document.body.style.height = "auto"
    document.documentElement.style.height = "auto"
    const root = document.getElementById("root")
    if (root) root.style.height = "auto"
    return () => {
      document.body.style.overflow = prev.bodyO
      document.documentElement.style.overflow = prev.htmlO
      document.body.style.height = prev.bodyH
      document.documentElement.style.height = prev.htmlH
    }
  }, [])

  // Injeta fonte escolhida.
  useEffect(() => {
    const linkId = `ds-font-${fontOpt.id}`
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link")
      link.id = linkId
      link.rel = "stylesheet"
      link.href = fontOpt.url
      document.head.appendChild(link)
    }
  }, [fontOpt])

  // Scrollbar overlay (accent) sempre visível + fundo da página no body.
  usePontesBodyScrollbar(palette.accent)
  useEffect(() => { applyPontesScrollbar(palette.accent, palette.bg) }, [palette])

  return (
    // Vars escopadas: o showroom previewa a paleta/fonte LOCAL sem mexer no
    // tema global. Componentes/estilos leem var(--pontes-*) deste wrapper.
    <div className={styles.page} style={{ ...paletteVars(palette), ["--pontes-font" as string]: font } as React.CSSProperties}>
      <ControlBar
        palette={palette} fontOpt={fontOpt}
        paletteId={paletteId} setPaletteId={setPaletteId}
        fontId={fontId} setFontId={setFontId}
      />

      <div className={styles.shell}>
        <div className={styles.head}>
          <div className={styles.docEyebrow}>Documentação</div>
          <h1 className={styles.h1}>Pontes — Design System</h1>
          <p className={styles.lead}>
            Biblioteca de componentes reutilizáveis em <code className={styles.codeInline}>@/components/pontes</code>. Trocar paleta e fonte no topo aplica em tudo ao vivo.
          </p>
        </div>

        <div className={styles.body}>
          <div className={styles.tabsRow}>
            <PontesTabs<TabId> options={TABS} value={tab} onChange={setTab} variant="pills" />
          </div>

          <div className={styles.panel}>
            {tab === "botoes" && <ButtonsSection />}
            {tab === "form" && <FormSection p={palette} />}
            {tab === "data" && <DataSection p={palette} />}
            {tab === "feedback" && <FeedbackSection />}
            {tab === "navegacao" && <NavSection />}
            {tab === "site" && <SiteSection p={palette} />}
            {tab === "tokens" && <TokensSection p={palette} />}
            {tab === "layout" && <LayoutTokensSection />}
          </div>
        </div>
        <div className={styles.spacer80} />
      </div>
    </div>
  )
}

// =============================================================================
// Control bar (paleta + fonte) — dev, cores escuras fixas
// =============================================================================

function ControlBar({
  palette, fontOpt, paletteId, setPaletteId, fontId, setFontId,
}: {
  palette: Palette; fontOpt: FontOption
  paletteId: string; setPaletteId: (v: string) => void
  fontId: string; setFontId: (v: string) => void
}) {
  return (
    <div className={styles.bar}>
      <div className={styles.barTitle}>📐 DESIGN SYSTEM</div>

      <div className={styles.barGroup}>
        <span className={styles.barDim}>Paleta:</span>
        <div className={styles.swatches}>
          {palettes.map((pp) => (
            <button key={pp.id} onClick={() => setPaletteId(pp.id)} title={pp.label} className={styles.swatch} data-active={paletteId === pp.id}>
              <span className={styles.swatchChip} style={{ background: pp.primary }} />
              <span className={styles.swatchChip} style={{ background: pp.accent }} />
              <span>{pp.id}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.barGroup}>
        <span className={styles.barDim}>Fonte:</span>
        <select value={fontId} onChange={(e) => setFontId(e.target.value)} className={styles.fontSelect}>
          {fonts.map((f) => (
            <option key={f.id} value={f.id}>{f.label} — {f.description}</option>
          ))}
        </select>
      </div>

      <div className={styles.barMeta}>{palette.label} · {fontOpt.label}</div>
    </div>
  )
}

// =============================================================================
// Helper: Group
// =============================================================================

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.group}>
      <div className={styles.groupTitle}>{title}</div>
      <div className={styles.groupBody}>{children}</div>
    </div>
  )
}

// =============================================================================
// BUTTONS SECTION
// =============================================================================

function ButtonsSection() {
  const [periodTab, setPeriodTab] = useState<"dia" | "semana" | "mes" | "ano">("mes")
  const [navStep, setNavStep] = useState<"anterior" | "hoje" | "proximo">("hoje")

  return (
    <div>
      <Group title="Variantes">
        <div className={styles.row}>
          <PontesButton variant="primary">Primário</PontesButton>
          <PontesButton variant="accent">Acento</PontesButton>
          <PontesButton variant="outline">Outline</PontesButton>
          <PontesButton variant="ghost">Ghost</PontesButton>
          <PontesButton variant="soft">Soft</PontesButton>
          <PontesButton variant="danger">Perigo</PontesButton>
          <PontesButton variant="danger-outline">Perigo outline</PontesButton>
          <PontesButton variant="success">Sucesso</PontesButton>
          <PontesButton variant="success-outline">Sucesso outline</PontesButton>
          <PontesLink>Link</PontesLink>
          <PontesButton variant="primary" disabled>Desabilitado</PontesButton>
        </div>
      </Group>

      <Group title="Variantes sobre fundo escuro (glass)">
        <div className={styles.glass}>
          <PontesButton variant="outline-light">Outline light</PontesButton>
          <PontesButton variant="ghost-light">Ghost light</PontesButton>
          <PontesButton variant="accent">Acento</PontesButton>
        </div>
      </Group>

      <Group title="Tamanhos">
        <div className={styles.row}>
          {(["xs", "sm", "md", "lg", "xl"] as const).map((s) => (
            <PontesButton key={s} size={s}>{s.toUpperCase()}</PontesButton>
          ))}
        </div>
      </Group>

      <Group title="Com ícone + Estados">
        <div className={styles.row}>
          <PontesButton iconStart={<Plus size={18} strokeWidth={2.5} />}>Nova transação</PontesButton>
          <PontesButton variant="accent" iconStart={<Download size={16} strokeWidth={2.5} />}>Importar OFX</PontesButton>
          <PontesButton variant="outline" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />}>Salvar e continuar</PontesButton>
          <PontesButton loading>Salvando...</PontesButton>
          <PontesButton success>Salvo</PontesButton>
        </div>
      </Group>

      <Group title="Icon-only + FAB + Badge">
        <div className={styles.rowGap10}>
          <PontesIconButton size={24}><Plus size={14} strokeWidth={3} /></PontesIconButton>
          <PontesIconButton size={32}><Plus size={18} strokeWidth={3} /></PontesIconButton>
          <PontesIconButton size={40}><Plus size={20} strokeWidth={2.5} /></PontesIconButton>
          <PontesIconButton size={48}><Plus size={22} strokeWidth={2.5} /></PontesIconButton>
          <PontesIconButton size={40} variant="soft"><Settings size={18} strokeWidth={2} /></PontesIconButton>
          <PontesIconButton size={40} variant="outline"><MoreHorizontal size={18} strokeWidth={2.5} /></PontesIconButton>
          <PontesIconButton size={40} variant="outline" badge={3}><Bell size={18} strokeWidth={2} /></PontesIconButton>
          <PontesIconButton size={24} variant="success" aria-label="Aprovar"><Check size={12} strokeWidth={3} /></PontesIconButton>
          <PontesIconButton size={24} variant="danger" aria-label="Rejeitar"><X size={12} strokeWidth={3} /></PontesIconButton>
          <PontesFab><Plus size={26} strokeWidth={2.5} /></PontesFab>
        </div>
      </Group>

      <Group title="Button group (segmented & joined)">
        <div className={styles.rowGap16}>
          <PontesButtonGroup
            value={periodTab}
            onChange={setPeriodTab}
            options={[
              { value: "dia", label: "Dia" },
              { value: "semana", label: "Semana" },
              { value: "mes", label: "Mês" },
              { value: "ano", label: "Ano" },
            ]}
          />
          <PontesButtonGroup
            variant="joined"
            value={navStep}
            onChange={setNavStep}
            options={[
              { value: "anterior", label: <span className={styles.inlineFlex}><ChevronLeft size={14} strokeWidth={2.5} /> Anterior</span> },
              { value: "hoje", label: "Hoje" },
              { value: "proximo", label: <span className={styles.inlineFlex}>Próximo <ChevronRight size={14} strokeWidth={2.5} /></span> },
            ]}
          />
        </div>
      </Group>

      <Group title="NavLink (underline animado, não desloca texto)">
        <div className={styles.rowGap28}>
          <PontesNavLink active>Recursos</PontesNavLink>
          <PontesNavLink>Para Casais</PontesNavLink>
          <PontesNavLink>Para Contadores</PontesNavLink>
          <PontesNavLink>Sobre</PontesNavLink>
        </div>
      </Group>

      <Group title="Link inline">
        <div className={styles.rowGap24}>
          <PontesLink>Saiba mais</PontesLink>
          <PontesLink>Termos de uso</PontesLink>
          <PontesLink>Esqueci a senha</PontesLink>
        </div>
      </Group>
    </div>
  )
}

// =============================================================================
// FORM SECTION
// =============================================================================

function FormSection({ p }: { p: Palette }) {
  const [text, setText] = useState("voce@email.com")
  const [money, setMoney] = useState("1.240,00")
  const [tipoTx, setTipoTx] = useState("1")
  const [grpCat, setGrpCat] = useState("ali")
  const [grpSub, setGrpSub] = useState("merc")
  const [categoria, setCategoria] = useState("mercado")
  const [conta, setConta] = useState("nubank")
  const [bancoBusca, setBancoBusca] = useState("")
  const [notif, setNotif] = useState(true)
  const [dark, setDark] = useState(false)
  const [remember, setRemember] = useState(true)
  const [terms, setTerms] = useState(false)
  const [period, setPeriod] = useState<"mensal" | "anual">("mensal")
  const [otp, setOtp] = useState("835")
  const [sliderV, setSliderV] = useState(4500)
  const [date, setDate] = useState<Date | null>(new Date())
  // Month input: mínimo = mês atual (meses anteriores aparecem desabilitados).
  const [mesMinimo] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [mes, setMes] = useState(mesMinimo)
  const [tags, setTags] = useState(["Família", "Mensal", "Recorrente"])
  const [color, setColor] = useState(p.primary)
  const [rating, setRating] = useState(4)

  return (
    <div>
      <Group title="Inputs">
        <div className={styles.grid2}>
          <PontesField label="E-mail" required>
            <PontesInput value={text} onChange={(e) => setText(e.target.value)} placeholder="voce@email.com" />
          </PontesField>
          <PontesField label="Senha">
            <PontesInput type="password" defaultValue="senha123" />
          </PontesField>
          <PontesField label="Buscar">
            <PontesInput iconStart={<Search size={16} />} placeholder="Buscar transação..." />
          </PontesField>
          <PontesField label="Com erro" error="E-mail inválido">
            <PontesInput invalid defaultValue="email-invalido" />
          </PontesField>
          <PontesField label="Categoria">
            <PontesSelect
              value={categoria}
              onChange={setCategoria}
              options={[
                { value: "mercado", label: "Mercado" },
                { value: "lazer", label: "Lazer" },
                { value: "casa", label: "Casa" },
                { value: "transporte", label: "Transporte" },
                { value: "assinatura", label: "Assinatura" },
                { value: "saude", label: "Saúde" },
                { value: "outros", label: "Outros" },
              ]}
            />
          </PontesField>
          <PontesField label="Conta">
            <PontesSelect
              value={conta}
              onChange={setConta}
              options={["nubank", "itau", "bradesco", "bb", "inter", "c6", "carteira"]}
            />
          </PontesField>
          <PontesField label="Select com busca — padrão de todo PontesSelect (rola + filtra ao digitar)">
            <PontesSelect
              value={bancoBusca}
              onChange={setBancoBusca}
              placeholder="Selecione o banco"
              options={[
                "Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Inter", "C6 Bank",
                "Santander", "Caixa", "BTG Pactual", "Sicoob", "Sicredi", "Banrisul",
                "Original", "Next", "PicPay", "Mercado Pago", "Neon", "Will Bank",
              ].map((b) => ({ value: b, label: b }))}
            />
          </PontesField>
          <PontesField label="Textarea">
            <PontesTextarea placeholder="Observação..." />
          </PontesField>
        </div>
      </Group>

      <Group title="Money input">
        <PontesMoneyInput value={money} onChange={setMoney} />
      </Group>

      <Group title="Choice cards">
        <PontesChoiceCards
          value={tipoTx}
          onChange={setTipoTx}
          options={[
            { value: "1", label: "Despesa", icon: <TrendingDown size={17} strokeWidth={2.5} />, tone: "danger" },
            { value: "2", label: "Receita", icon: <TrendingUp size={17} strokeWidth={2.5} />, tone: "success" },
          ]}
        />
      </Group>

      <Group title="Grouped select (categoria → subcategoria)">
        <PontesGroupedSelect
          groups={[
            { value: "ali", label: "Alimentação", items: [{ value: "merc", label: "Mercado" }, { value: "rest", label: "Restaurante" }] },
            { value: "tra", label: "Transporte", items: [{ value: "uber", label: "App / Táxi" }, { value: "comb", label: "Combustível" }] },
            { value: "mor", label: "Moradia", items: [{ value: "alug", label: "Aluguel" }, { value: "luz", label: "Energia" }] },
          ]}
          groupValue={grpCat}
          itemValue={grpSub}
          onChange={(g, i) => { setGrpCat(g); setGrpSub(i) }}
          placeholder="Selecione a categoria"
        />
      </Group>

      <Group title="Estado inválido (padrão: borda vermelha + ring, sem fundo)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, alignItems: "start" }}>
          <PontesField label="Input" required error="Campo obrigatório">
            <PontesInput placeholder="Texto" invalid />
          </PontesField>
          <PontesField label="Select" required error="Selecione uma opção">
            <PontesSelect value="" onChange={() => { /* demo */ }} options={["A", "B"]} placeholder="Selecione" invalid />
          </PontesField>
          <PontesField label="Grouped select" required error="Selecione a categoria">
            <PontesGroupedSelect
              groups={[{ value: "ali", label: "Alimentação", items: [{ value: "merc", label: "Mercado" }] }]}
              groupValue="" itemValue="" onChange={() => { /* demo */ }}
              placeholder="Selecione a categoria" invalid
            />
          </PontesField>
          <PontesField label="Textarea" required error="Campo obrigatório">
            <PontesTextarea placeholder="Observação" invalid />
          </PontesField>
          <div style={{ gridColumn: "1 / -1" }}>
            <PontesMoneyInput value="" onChange={() => { /* demo */ }} invalid />
          </div>
        </div>
      </Group>

      <Group title="OTP code">
        <PontesOtpInput value={otp} onChange={setOtp} />
      </Group>

      <Group title="Range slider">
        <PontesSlider
          label="Limite mensal"
          min={0} max={8000}
          value={sliderV}
          onChange={setSliderV}
          formatValue={(v) => `R$ ${v.toLocaleString("pt-BR")}`}
        />
      </Group>

      <Group title="Date picker (inline) — agenda/visualização">
        <PontesDatePicker value={date} onChange={setDate} events={[new Date(2026, 4, 10), new Date(2026, 4, 18), new Date(2026, 4, 25)]} />
      </Group>

      <Group title="Date input (popover) — uso em forms">
        <div className={styles.fieldDemo}>
          <PontesDateInput
            value={date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : ""}
            onChange={(v) => {
              if (!v) { setDate(null); return }
              const [y, m, d] = v.split("-").map(Number)
              setDate(new Date(y, m - 1, d))
            }}
            placeholder="Selecione uma data"
          />
        </div>
      </Group>

      <Group title="Month input (popover) — mês de referência, com mínimo">
        <div className={styles.fieldDemo}>
          <PontesMonthInput value={mes} onChange={setMes} min={mesMinimo} placeholder="Selecione o mês" />
        </div>
      </Group>

      <Group title="File upload">
        <PontesFileDrop title="Arraste seu arquivo OFX aqui" formats="OFX, CSV, QIF · até 10MB" onFiles={() => { /* noop */ }} />
      </Group>

      <Group title="Tag input">
        <PontesTagInput tags={tags} onChange={setTags} />
      </Group>

      <Group title="Color picker">
        <PontesColorPicker
          value={color}
          onChange={setColor}
          colors={[p.primary, p.accent, "#10B981", "#F59E0B", "#DC2626", "#3B82F6", "#A855F7", "#EC4899", "#14B8A6", "#64748B"]}
        />
      </Group>

      <Group title="Rating estrelas">
        <PontesRating value={rating} onChange={setRating} />
      </Group>

      <Group title="Kbd atalhos">
        <div className={styles.kbdRow}>
          <PontesKbdGroup keys={["⌘", "K"]} label="Busca rápida" />
          <PontesKbdGroup keys={["⌘", "N"]} label="Nova transação" />
          <PontesKbdGroup keys={["G", "D"]} label="Dashboard" />
          <PontesKbdGroup keys={["?"]} label="Atalhos" />
          <PontesKbdGroup keys={["Esc"]} label="Fechar" />
        </div>
        <div className={styles.rowGap10}>
          <PontesKbd>⌘</PontesKbd>
          <PontesKbd>⇧</PontesKbd>
          <PontesKbd>Enter</PontesKbd>
        </div>
      </Group>

      <Group title="Toggle, Checkbox, Radio">
        <div className={styles.rowGap28}>
          <PontesToggle checked={notif} onChange={setNotif} label="Notificações" />
          <PontesToggle checked={dark} onChange={setDark} label="Modo escuro" />
          <PontesCheckbox checked={remember} onChange={setRemember} label="Lembrar acesso" />
          <PontesCheckbox checked={terms} onChange={setTerms} label="Aceitar termos" />
          <PontesRadioGroup
            value={period}
            onChange={setPeriod}
            options={[{ value: "mensal", label: "Mensal" }, { value: "anual", label: "Anual" }]}
          />
        </div>
      </Group>
    </div>
  )
}

// =============================================================================
// DATA SECTION
// =============================================================================

function DataSection({ p }: { p: Palette }) {
  type Row = { date: string; desc: string; cat: string; account: string; member: string; v: number }
  // Demo do modo "Mostrar mais" do PontesTabela: quantas linhas já vieram (lotes de 10).
  const [mostrados, setMostrados] = useState(10)
  // Lista grande pra mostrar o paginator real funcionando (47 linhas → 5 páginas a 10/pág).
  const paginationRows: Row[] = Array.from({ length: 47 }, (_, i) => {
    const cats = ["Mercado", "Renda", "Lazer", "Casa", "Alimentação", "Transporte"]
    const accs = ["Nubank", "Itaú", "Bradesco"]
    const mems = ["G", "M", "G+M"]
    const isReceita = i % 7 === 0
    return {
      date: `${String(((i % 28) + 1)).padStart(2, "0")}/05`,
      desc: isReceita ? `Renda extra #${i + 1}` : `Lançamento #${i + 1}`,
      cat: cats[i % cats.length],
      account: accs[i % accs.length],
      member: mems[i % mems.length],
      v: isReceita ? 1000 + i * 37 : -(40 + (i * 13) % 800),
    }
  })

  return (
    <div>
      <Group title="Badges (chips)">
        <div className={styles.row} style={{ gap: 8 }}>
          <PontesBadge tone="primary">Família</PontesBadge>
          <PontesBadge tone="accent">Pro</PontesBadge>
          <PontesBadge tone="soft">Pendente</PontesBadge>
          <PontesBadge tone="success">Pago</PontesBadge>
          <PontesBadge tone="danger">Atrasado</PontesBadge>
          <PontesBadge tone="warning">Vence hoje</PontesBadge>
          <PontesBadge tone="neutral">Mercado</PontesBadge>
          <PontesBadge tone="outline">Outline</PontesBadge>
        </div>
      </Group>

      <Group title="Avatares + Stack">
        <div className={styles.rowGap18}>
          <PontesAvatar size={32} name="Gustavo Pontes" />
          <PontesAvatar size={40} name="Maria Silva" status="online" bg={p.accent} fg="#0B1220" />
          <PontesAvatar size={48} name="Lucas P" status="away" />
          <PontesAvatar size={56} name="+3" status="busy" bg="#94A3B8" />
          <PontesAvatarStack avatars={[
            { name: "G", bg: p.primary }, { name: "M", bg: p.accent },
            { name: "L", bg: "#94A3B8" }, { name: "B", bg: "#22C55E" },
          ]} />
          <PontesAvatar size={40} name="BR" rounded="square" />
        </div>
      </Group>

      <Group title="Alerts / Banners">
        <div className={styles.colGap8} style={{ gap: 10 }}>
          <PontesAlert tone="info" title="Info">Sua fatura fecha em 3 dias.</PontesAlert>
          <PontesAlert tone="success" title="Pago">Conta de luz paga com sucesso.</PontesAlert>
          <PontesAlert tone="warning" title="Atenção">Limite do cartão em 85%.</PontesAlert>
          <PontesAlert tone="error" title="Erro">Não foi possível conectar com o banco.</PontesAlert>
        </div>
      </Group>

      <Group title="Progress bars">
        <div className={styles.colGap14}>
          <PontesProgress label="Meta de viagem" value={45} />
          <PontesProgress label="Limite usado" value={78} color={p.accent} />
          <PontesProgress label="Reserva de emergência" value={92} color={semantic.success} />
          <PontesProgress
            label="Empréstimo — confirmado/pendente/recusado"
            segments={[
              { value: 40, color: semantic.success, label: "Confirmado" },
              { value: 15, color: semantic.warning, label: "Pendente" },
              { value: 10, color: semantic.danger, label: "Recusado" },
            ]}
          />
        </div>
      </Group>

      <Group title="Stat cards">
        <div className={styles.grid4}>
          <PontesStatCard label="Saldo total" value="R$ 31.970" trend="+12.4%" trendUp />
          <PontesStatCard label="Despesas mês" value="R$ 5.140" trend="-3.1%" trendUp={false} />
          <PontesStatCard label="Receitas mês" value="R$ 8.200" trend="+5.8%" trendUp />
          <PontesStatCard label="Economia" value="R$ 3.060" trend="+8.2%" trendUp />
        </div>
      </Group>

      <Group title="Category donut (distribuição por categoria)">
        <PontesCard padding={24}>
          <PontesCategoryDonut
            formatMoney={(v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)}
            data={[
              { label: "Moradia", valor: 1800, percentual: 45 },
              { label: "Alimentação", valor: 1000, percentual: 25 },
              { label: "Transporte", valor: 600, percentual: 15 },
              { label: "Lazer", valor: 400, percentual: 10 },
              { label: "Outros", valor: 200, percentual: 5 },
            ]}
          />
        </PontesCard>
      </Group>

      <Group title="Card (surface primitivo)">
        <div className={styles.grid3}>
          <PontesCard>Card simples</PontesCard>
          <PontesCard shadow="md">Card com sombra</PontesCard>
          <PontesCard dashed>Card tracejado</PontesCard>
        </div>
      </Group>

      <Group title="Tabela com paginação (padrão DS)">
        <p className={styles.helper}>
          Toda tabela do produto usa o rodapé padrão: <strong>10 / 25 / 50 / 100</strong>
          linhas por página (default 25, cap 100). Renderiza só a página visível —
          evita render gigante e jank em listas grandes. Modo uncontrolled (passa{" "}
          <code>pagination</code>) ou controlado (passa <code>page</code>/<code>onPageChange</code>).
        </p>
        <PontesTable<Row>
          title="Transações de maio"
          subtitle="Demonstração do paginator embutido"
          toolbar={<>
            <PontesButton size="sm" variant="outline">Filtros</PontesButton>
            <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />}>Nova</PontesButton>
          </>}
          columns={[
            { key: "date", header: "Data ↓", render: (r) => <span className={styles.cellMuted}>{r.date}</span> },
            { key: "desc", header: "Descrição", render: (r) => <span className={styles.cellBold}>{r.desc}</span> },
            { key: "cat", header: "Categoria", render: (r) => <PontesBadge tone="soft" size="sm">{r.cat}</PontesBadge> },
            { key: "account", header: "Conta", render: (r) => <span className={styles.cellMuted}>{r.account}</span> },
            { key: "member", header: "Membro", render: (r) => <PontesBadge tone="accent" size="sm">{r.member}</PontesBadge> },
            { key: "v", header: "Valor", align: "right" as const, render: (r) => (
              <span className={r.v > 0 ? styles.cellPos : styles.cellNeg}>
                {r.v > 0 ? "+ " : "- "}R$ {Math.abs(r.v).toFixed(2).replace(".", ",")}
              </span>
            ) },
          ]}
          rows={paginationRows}
          pagination={{ pageSize: 10 }}
        />
      </Group>

      <Group title="PontesTabela — modo &quot;Mostrar mais&quot;">
        <p className={styles.helper}>
          Alternativa à paginação: <code>carregarMais={"{{ restantes, carregando, onCarregarMais }}"}</code>.
          A página busca o próximo lote no servidor e acumula em <code>itens</code>; o botão some quando
          não falta nada. Use <strong>ou</strong> <code>paginacao</code> <strong>ou</strong> este.
        </p>
        <PontesTabela<Row>
          titulo="Movimentos"
          colunas={[
            { key: "date", header: "Data/Hora", render: (r) => r.date },
            { key: "desc", header: "Lançamento", render: (r) => r.desc },
            { key: "v", header: "Valor", numerica: true, render: (r) => (
              <span className={r.v > 0 ? styles.cellPos : styles.cellNeg}>R$ {Math.abs(r.v).toFixed(2).replace(".", ",")}</span>
            ) },
          ]}
          itens={paginationRows.slice(0, mostrados)}
          chave={(r) => r.desc}
          vazio={{ icone: null, titulo: "Nenhum movimento" }}
          carregarMais={{ restantes: paginationRows.length - mostrados, onCarregarMais: () => setMostrados((n) => Math.min(n + 10, paginationRows.length)) }}
        />
      </Group>
    </div>
  )
}

// =============================================================================
// FEEDBACK SECTION
// =============================================================================

function FeedbackSection() {
  const [modalOpen, setModalOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [cmdkQ, setCmdkQ] = useState("luz")

  return (
    <div>
      <Group title="Toast notifications">
        <div className={styles.maxw380}>
          <PontesToast tone="success" title="Despesa salva" description="R$ 142,30 · Mercado · Nubank" time="agora" />
          <PontesToast tone="info" title="Maria comentou" description="Sobre a conta de luz" time="1 min" />
          <PontesToast tone="warning" title="Limite do cartão" description="Atingiu 85% do limite Nubank" time="5 min" />
          <PontesToast tone="error" title="Erro ao sincronizar" description="Tentando reconectar..." time="10 min" />
        </div>
      </Group>

      <Group title="Modal & Dialog & Drawer">
        <div className={styles.row}>
          <PontesButton onClick={() => setModalOpen(true)}>Abrir modal</PontesButton>
          <PontesButton variant="danger" onClick={() => setDialogOpen(true)}>Diálogo de confirmação</PontesButton>
          <PontesButton variant="outline" onClick={() => setDrawerOpen(true)}>Abrir drawer</PontesButton>
          <PontesButton variant="ghost" onClick={() => setCmdkOpen(true)}>Abrir Cmd+K</PontesButton>
        </div>

        <PontesModal
          open={modalOpen} title="Nova transação" onClose={() => setModalOpen(false)}
          footer={<>
            <PontesButton variant="outline" onClick={() => setModalOpen(false)}>Cancelar</PontesButton>
            <PontesButton onClick={() => setModalOpen(false)}>Salvar transação</PontesButton>
          </>}
        >
          <div className={styles.colGap14}>
            <PontesField label="Descrição">
              <PontesInput placeholder="Ex: Almoço com Maria" />
            </PontesField>
            <PontesField label="Valor">
              <PontesInput style={{ fontSize: 24, fontWeight: 700 }} defaultValue="R$ 0,00" />
            </PontesField>
          </div>
        </PontesModal>

        <PontesDialog
          open={dialogOpen}
          title="Excluir transação?"
          description="Esta ação não pode ser desfeita. A transação será removida permanentemente."
          confirmLabel="Sim, excluir"
          onConfirm={() => setDialogOpen(false)}
          onCancel={() => setDialogOpen(false)}
        />

        <PontesDrawer
          open={drawerOpen} title="Detalhes da transação" onClose={() => setDrawerOpen(false)}
          footer={<PontesButton fullWidth>Salvar</PontesButton>}
        >
          <div className={styles.colGap14}>
            <PontesCard padding={14}>
              <div className={styles.drawerLabel}>Valor</div>
              <div className={styles.drawerVal}>- R$ 142,30</div>
            </PontesCard>
            <PontesField label="Descrição">
              <PontesInput defaultValue="Mercado Pão de Açúcar" />
            </PontesField>
            <PontesField label="Conta">
              <PontesInput defaultValue="Nubank · final 4218" />
            </PontesField>
          </div>
        </PontesDrawer>

        <PontesCommandPalette
          open={cmdkOpen}
          onClose={() => setCmdkOpen(false)}
          query={cmdkQ} onQueryChange={setCmdkQ}
          items={[
            { key: "1", icon: "⚡", label: "Conta de luz · R$ 240,00", hint: "Transação · 18/05", onSelect: () => undefined },
            { key: "2", icon: "💡", label: "Categoria: Energia elétrica", hint: "Ir pra categoria", onSelect: () => undefined },
            { key: "3", icon: "✦", label: "Nova despesa — Conta de luz", hint: "Ação rápida", onSelect: () => undefined },
          ]}
        />
      </Group>

      <Group title="Skeleton (loading)">
        <div className={styles.maxw480Mb}>
          <PontesSkeletonList rows={3} />
        </div>
        <div className={styles.maxw480}>
          <PontesSkeleton width="80%" height={16} />
          <PontesSkeleton width="60%" height={12} />
          <PontesSkeleton width={120} height={36} radius={10} />
        </div>
      </Group>

      <Group title="Empty state">
        <PontesEmptyState
          icon="📭"
          title="Nenhuma transação ainda"
          description="Adicione manualmente ou conecte uma conta pra importar tudo."
          actions={<>
            <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />}>Nova transação</PontesButton>
            <PontesButton size="sm" variant="outline">Conectar banco</PontesButton>
          </>}
        />
      </Group>

      <Group title="Loading dots">
        <PontesLoadingDots />
      </Group>

      <Group title="Tooltip / Popover">
        <div className={styles.tooltipBox}>
          <PontesTooltip label="Atalho: ⌘N">
            <PontesButton>Hover sobre mim</PontesButton>
          </PontesTooltip>

          <PontesPopover
            trigger={<PontesButton variant="outline" iconStart={<MoreHorizontal size={16} strokeWidth={2.5} />}>Mais ações</PontesButton>}
            items={[
              { key: "edit", icon: <Pencil size={14} />, label: "Editar" },
              { key: "duplicate", icon: <Copy size={14} />, label: "Duplicar" },
              { key: "share", icon: <Share2 size={14} />, label: "Compartilhar" },
              { key: "delete", icon: <Trash2 size={14} />, label: "Excluir", danger: true, divider: true },
            ]}
          />
        </div>
      </Group>
    </div>
  )
}

// =============================================================================
// PADRÃO DE TELA INTERNA (demo)
// =============================================================================

// Composição de referência das telas internas: sem título (mora na Navbar) → PageHeader com o
// botão "Novo…" → Toolbar (busca + situação) → lista com ⋮ por linha → vazio "Nada encontrado".
const DEMO_LINHAS = [
  { id: "1", nome: "Aluguel", valor: "R$ 2.400,00", encerrada: false },
  { id: "2", nome: "Netflix", valor: "R$ 55,90", encerrada: false },
  { id: "3", nome: "Academia", valor: "R$ 119,00", encerrada: true },
]

function PadraoTelaDemo() {
  const [busca, setBusca] = useState("")
  const [status, setStatus] = useState("ativas")
  const [ultimaAcao, setUltimaAcao] = useState("—")

  const linhas = DEMO_LINHAS.filter((l) =>
    (status === "encerradas") === l.encerrada && l.nome.toLowerCase().includes(busca.trim().toLowerCase()))

  return (
    <div className={styles.colGap14}>
      <PontesPageHeader actionLabel="Nova conta fixa" onAction={() => setUltimaAcao("Nova conta fixa")} />
      <PontesToolbar search={{ value: busca, onChange: setBusca, placeholder: "Buscar conta fixa…" }}>
        <PontesSegmented
          ariaLabel="Situação"
          value={status}
          onChange={setStatus}
          options={[{ value: "ativas", label: "Ativas" }, { value: "encerradas", label: "Encerradas" }]}
        />
      </PontesToolbar>
      {linhas.length === 0 ? (
        <PontesEmptyState
          icon={<SearchX size={28} strokeWidth={2.5} />}
          title="Nada encontrado"
          actions={<PontesButton size="sm" variant="outline" onClick={() => { setBusca(""); setStatus("ativas") }}>Limpar filtros</PontesButton>}
        />
      ) : (
        <PontesCard padding={0}>
          {linhas.map((l) => (
            <div key={l.id} className={styles.demoRow}>
              <span className={styles.demoRowNome}>{l.nome}</span>
              <span className={styles.demoRowValor}>{l.valor}</span>
              <PontesRowActions
                actions={[
                  // Ordem livre: o componente joga o destrutivo pro fim (com divisor).
                  { key: "excluir", label: "Excluir", danger: true, icon: <Trash2 size={16} strokeWidth={2.5} />, onClick: () => setUltimaAcao(`Excluir ${l.nome}`) },
                  { key: "editar", label: "Editar", icon: <Pencil size={16} strokeWidth={2.5} />, onClick: () => setUltimaAcao(`Editar ${l.nome}`) },
                  { key: "pausar", label: "Pausar", icon: <PauseCircle size={16} strokeWidth={2.5} />, onClick: () => setUltimaAcao(`Pausar ${l.nome}`) },
                ]}
              />
            </div>
          ))}
        </PontesCard>
      )}
      <div className={styles.demoUltimaAcao}>Última ação: {ultimaAcao}</div>
    </div>
  )
}

// =============================================================================
// NAV SECTION
// =============================================================================

function NavSection() {
  const [pillTab, setPillTab] = useState<"visao" | "transacoes" | "categorias" | "relatorios">("visao")
  const [underTab, setUnderTab] = useState<"transacoes" | "faturas" | "recorrentes" | "parcelamentos">("transacoes")
  const [page, setPage] = useState(3)
  const [navActive, setNavActive] = useState("Dashboard")

  return (
    <div>
      <Group title="Padrão de tela interna — PageHeader + Toolbar + RowActions">
        <PadraoTelaDemo />
      </Group>

      <Group title="Breadcrumb">
        <PontesBreadcrumb items={[
          { label: "Início" }, { label: "Família" }, { label: "Membros" }, { label: "Maria Silva" },
        ]} />
      </Group>

      <Group title="Tabs — pills">
        <PontesTabs<"visao" | "transacoes" | "categorias" | "relatorios">
          value={pillTab} onChange={setPillTab}
          options={[
            { value: "visao", label: "Visão geral" },
            { value: "transacoes", label: "Transações" },
            { value: "categorias", label: "Categorias" },
            { value: "relatorios", label: "Relatórios" },
          ]}
        />
      </Group>

      <Group title="Tabs — underline">
        <PontesTabs<"transacoes" | "faturas" | "recorrentes" | "parcelamentos">
          variant="underline"
          value={underTab} onChange={setUnderTab}
          options={[
            { value: "transacoes", label: "Transações" },
            { value: "faturas", label: "Faturas" },
            { value: "recorrentes", label: "Recorrentes" },
            { value: "parcelamentos", label: "Parcelamentos" },
          ]}
        />
      </Group>

      <Group title="Stepper">
        <PontesStepper
          steps={[
            { label: "Dados", status: "done" },
            { label: "Categoria", status: "done" },
            { label: "Confirmação", status: "current" },
            { label: "Pronto" },
          ]}
        />
      </Group>

      <Group title="Pagination">
        <PontesPagination
          page={page}
          totalPages={24}
          onChange={setPage}
          totalLabel="Mostrando 21–30 de 240"
        />
      </Group>

      <Group title="Sidebar — item + section (clique pra trocar o ativo)">
        <div className={styles.sidebarRow}>
          <div className={styles.sidebar240}>
            <PontesSidebarSection label="Principal" />
            {([
              { label: "Dashboard", icon: "◧" },
              { label: "Transações", icon: "≣" },
              { label: "Cartões", icon: "▤" },
            ] as const).map((it) => (
              <PontesSidebarItem key={it.label} icon={<span className={styles.iconText}>{it.icon}</span>} label={it.label} active={navActive === it.label} onClick={() => setNavActive(it.label)} />
            ))}
          </div>
          <div className={styles.sidebar72}>
            <PontesSidebarSection label="Principal" collapsed />
            {([
              { label: "Dashboard", icon: "◧" },
              { label: "Transações", icon: "≣" },
              { label: "Cartões", icon: "▤" },
            ] as const).map((it) => (
              <PontesSidebarItem key={it.label} icon={<span className={styles.iconText}>{it.icon}</span>} label={it.label} active={navActive === it.label} collapsed onClick={() => setNavActive(it.label)} />
            ))}
          </div>
        </div>
      </Group>
    </div>
  )
}

// =============================================================================
// SITE SECTION
// =============================================================================

function SiteSection({ p }: { p: Palette }) {
  return (
    <div>
      <Group title="Logo — PontesLogo">
        <div className={styles.colGap24}>
          <div>
            <div className={styles.subLabel}>Interativo — passe o mouse e clique</div>
            <div className={styles.logoRow}>
              {([20, 28, 36, 48, 64] as const).map((s) => (
                <div key={s} className={styles.logoCell}>
                  <PontesLogo color="var(--pontes-primary)" size={s} />
                  <span className={styles.logoCaption}>{s}px</span>
                </div>
              ))}
            </div>
            <div className={styles.logoHint}>
              <span>🖱️ <b>hover</b> — scale spring + arco re-traça da esquerda pra direita</span>
              <span>👆 <b>click</b> — scale press (0.93) + spring de volta</span>
            </div>
          </div>

          <div>
            <div className={styles.subLabel}>Sobre fundo escuro (navbar / hero)</div>
            <div className={styles.logoRowDark}>
              {([22, 32, 44] as const).map((s) => (
                <div key={s} className={styles.logoCell}>
                  <PontesLogo color="#ffffff" size={s} />
                  <span className={styles.logoCaptionDark}>{s}px</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className={styles.subLabel}>Marca compacta — PontesLogoMark (rail colapsada, favicon)</div>
            <div className={styles.logoRow}>
              {([20, 28, 36, 48] as const).map((s) => (
                <div key={s} className={styles.logoCell}>
                  <PontesLogoMark color="var(--pontes-primary)" size={s} />
                  <span className={styles.logoCaption}>{s}px</span>
                </div>
              ))}
              <div className={styles.markDarkCell}>
                <PontesLogoMark color="#ffffff" size={32} />
                <span className={styles.markDarkCaption}>dark</span>
              </div>
            </div>
          </div>

          <div className={styles.snippet}>
            <div className={styles.subLabel}>Import</div>
            <code className={styles.snippetCodeMb}>
              {"import { PontesLogo, PontesLogoMark } from '@/components/pontes'"}
            </code>
            <code className={styles.snippetCode}>
              {"<PontesLogo color={p.primary} size={32} />"}
            </code>
            <code className={styles.snippetCode}>
              {"<PontesLogoMark color={p.primary} size={28} />"}
            </code>
            <div className={styles.snippetNote}>
              <b>color</b> — string (hex, CSS var, currentColor) ·{" "}
              <b>size</b> — number, altura em px ·{" "}
              <b>onClick</b> — handler opcional (ativa cursor pointer)
            </div>
          </div>
        </div>
      </Group>

      <Group title="Navbar (fixed sobre hero — preview estático)">
        <div className={styles.navPreviewBox}>
          <div className={styles.navPreviewInner}>
            <NavbarPreview p={p} />
          </div>
          <div className={styles.navPreviewHint}>Hero simulado · navbar glass por cima</div>
        </div>
        <div className={styles.navLiveLine}>
          Ao vivo: <PontesLink href="/">/</PontesLink> e <PontesLink href="/casais">/casais</PontesLink>
        </div>
      </Group>

      <Group title="Footer — variant rich (4 colunas + brand + app badges)">
        <div className={styles.footerWrap}>
          <PontesFooter
            variant="rich"
            onNavigate={() => undefined}
            appBadges={[{ label: "App Store" }, { label: "Google Play" }]}
          />
        </div>
      </Group>

      <Group title="Footer — variant minimal (linha única)">
        <div className={styles.footerWrap}>
          <PontesFooter variant="minimal" onNavigate={() => undefined} />
        </div>
      </Group>
    </div>
  )
}

/** Navbar com posicionamento absolute (override do fixed) pra caber no preview. */
function NavbarPreview({ p }: { p: Palette }) {
  return (
    <div className={styles.npAbs}>
      <div className={styles.npCenter}>
        <div className={styles.npBar}>
          <PontesLogo color={p.heroFg} size={18} />
          <div className={styles.npLinks}>
            <PontesNavLink color={p.heroFg} hoverColor={p.accent} active>Recursos</PontesNavLink>
            <PontesNavLink color={p.heroFg} hoverColor={p.accent}>Para Casais</PontesNavLink>
            <PontesNavLink color={p.heroFg} hoverColor={p.accent}>Sobre</PontesNavLink>
          </div>
          <div className={styles.npBtns}>
            <PontesButton variant="outline-light" size="sm" style={{ borderRadius: 999 }}>Entrar</PontesButton>
            <PontesButton variant="accent" size="sm" style={{ borderRadius: 999 }}>Criar conta</PontesButton>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// TOKENS SECTION
// =============================================================================

function LayoutTokensSection() {
  return (
    <div>
      <p className={styles.helper}>
        Tokens de layout e efeito — espaçamento, raios, sombras e transições — definidos em{" "}
        <code>theme.ts</code>. Independem da paleta.
      </p>

      <Group title="Espaçamento (escala base-4)">
        <div className={styles.scaleCol}>
          {Object.entries(spacing).map(([k, v]) => (
            <div key={k} className={styles.scaleRow}>
              <span className={styles.scaleKey}>{k}</span>
              <span className={styles.scaleBar} style={{ width: v }} />
              <span className={styles.tokenVal}>{v}px</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Raios (radii)">
        <div className={styles.rowGap16}>
          {Object.entries(radii).map(([k, v]) => (
            <div key={k} className={styles.radiiCell}>
              <div className={styles.radiiBox} style={{ borderRadius: v }} />
              <span className={styles.tokenName}>{k}</span>
              <span className={styles.tokenVal}>{v === 999 ? "full" : `${v}px`}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Sombras">
        <div className={styles.grid3}>
          {Object.entries(shadows).map(([k, v]) => (
            <div key={k} className={styles.shadowCell}>
              <div className={styles.shadowBox} style={{ boxShadow: v }} />
              <span className={styles.tokenName}>{k}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Transições">
        <div className={styles.colGap8}>
          {Object.entries(transitions).map(([k, v]) => (
            <div key={k} className={styles.tokenLine}>
              <span className={styles.tokenName}>{k}</span>
              <span className={styles.tokenVal}>{v}</span>
            </div>
          ))}
        </div>
      </Group>
    </div>
  )
}

function TokensSection({ p }: { p: Palette }) {
  const tokens: { key: keyof Palette; label: string }[] = [
    { key: "primary", label: "primary" },
    { key: "primaryDark", label: "primaryDark" },
    { key: "primarySoft", label: "primarySoft" },
    { key: "accent", label: "accent" },
    { key: "accentSoft", label: "accentSoft" },
    { key: "text", label: "text" },
    { key: "textMuted", label: "textMuted" },
    { key: "bg", label: "bg" },
    { key: "surface", label: "surface" },
    { key: "border", label: "border" },
  ]

  return (
    <div>
      <Group title="Cores da paleta atual">
        <div className={styles.grid5}>
          {tokens.map((t) => (
            <div key={t.key} className={styles.swatchCard}>
              <div className={styles.swatchBlock} style={{ background: p[t.key] }} />
              <div className={styles.swatchInfo}>
                <div className={styles.swatchName}>{t.label}</div>
                <div className={styles.swatchHex}>{p[t.key]}</div>
              </div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Tipografia">
        <p className={styles.helper}>
          Títulos usam <code>--pontes-font-heading</code>, que no app é a mesma fonte do tema
          (<code>--pontes-font</code>, trocável no topo). A Fraunces fica só no site público.
        </p>
        <div className={styles.typoCol}>
          <div className={styles.typoH1}>H1 título · 56 / 600</div>
          <div className={styles.typoH2}>H2 título · 42 / 600</div>
          <div className={styles.typoH3}>H3 · 28 / 700</div>
          <div className={styles.typoH4}>H4 · 18 / 600</div>
          <div className={styles.typoBody}>Body · 14 / 400 — texto padrão de UI.</div>
          <div className={styles.typoCaption}>Caption · 12 / 400 — secundário.</div>
          <div className={styles.typoEyebrow}>Eyebrow · 11 / 700 LETRA-SPACED</div>
        </div>
      </Group>

      <Group title="Semânticas (independentes de paleta)">
        <div className={styles.grid4}>
          {[
            { name: "success", color: semantic.success, soft: semantic.successSoft },
            { name: "warning", color: semantic.warning, soft: semantic.warningSoft },
            { name: "danger", color: semantic.danger, soft: semantic.dangerSoft },
            { name: "info", color: semantic.info, soft: semantic.infoSoft },
          ].map((t) => (
            <div key={t.name} className={styles.semCard}>
              <div className={styles.semTop} style={{ background: t.color }} />
              <div className={styles.semSoft} style={{ background: t.soft }} />
              <div className={styles.semName}>{t.name}</div>
            </div>
          ))}
        </div>
      </Group>
    </div>
  )
}
