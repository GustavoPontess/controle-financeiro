# Monarch — **Settings** (`/settings/*`)

> Mapa completo do painel de configurações. Casal/contador em doc próprio ([household-casal](./household-casal.md)).

## Estrutura do menu (todas as sub-páginas mapeadas)
### Account (do usuário)
- **Profile** — avatar · Full Name · **Display Name** ("we'll address you by this name") · Birthday · Timezone.
- **Display** — **Visual Appearance** (Light/Dark).
- **Notifications** — **matriz tipo × canal** (canais: **Monarch in-app · Email · Push**, cada um "Turn all off"). Tipos: Account disconnected · **Deposit alert** (valor mín) · **Expense alert** (valor mín) · Transactions that need review · **Receipt** import error/imported · (+ Accounts/Budgets/Goals). Ver sino em [notificacoes-topo](./notificacoes-e-topo.md).
- **Security** — Email (verified, Edit) · Password (Edit) · **MFA** (Disabled → Enable) · **Grant support access** (agente de suporte, **auto-desabilita 14 dias**, revogável) · **Delete account** (permanente, exige cancelar sub/trial antes). *(relevante pro baseline [[feedback_baseline_seguranca_qualidade]].)*
- **Early Access** — toggles de features experimentais (ex.: **Investment Transactions** Beta).
- **Integrations** (Beta) — ⭐ **"Monarch MCP"** (Model Context Protocol pra IA/ferramentas conectarem aos dados) — **pausado** por acordo de portabilidade. *Data point: eles apostam em MCP pra ecossistema de IA.*

### Household (compartilhado)
- **General** — Household Name · Country · Address/City/State/Zip.
- **Businesses** ⭐ (**Plus**) — rastreio financeiro **separado de negócios/PJ** ("clear financials for your businesses"). = o ângulo P&L/PJ; casa com nosso eixo B2B contadores.
- **Members** ⭐ — casal/família + acesso a profissional/contador → [household-casal](./household-casal.md).
- **Preferences** — **"How transactions work":** Mark new/uncategorized transactions as **Needs Review** · **Allow edits to pending transactions** (read-only × incluído em budget/reports) · matching de pending.
- **Institutions** — bancos conectados (Refresh all / Add account) via agregador.
- **Categories** — gestão da taxonomia: **Create group** + grupos (Income/Expenses→subgrupos), cada um **Edit** + **Create Category**. Emoji por item (ver [transacao-modal](./transacao-modal.md)).
- **Merchants** — lista de comerciantes do histórico (All/Recommended, por contagem), **Edit** (como exibe) / **Delete**. Confirma **Merchant como entidade 1ª classe** (nós não temos).
- **Rules** ⭐ — motor de automação (abaixo).
- **Tags** — New tag + lista (contagem, Edit/Delete). **Tags padrão seedadas: Tax · Reimburse · Split · Business · Subscription**.
- **Data** — **Download transactions** (CSV) · **Download account balances** (CSV) · **Remove credit data access** (via **Spinwheel** = credit score + saldos/vencimentos de cartão no Recurring) · **Delete transaction history** (LGPD: portabilidade + eliminação = direitos do titular).

### Billing / Estate Planning / Gift / Referrals
- **Estate Planning** (aparece após o questionário de sucessório — Plus) — testamento/procuração/beneficiários.
- Billing/Gift/Referrals — ver [notificacoes-topo](./notificacoes-e-topo.md).

### Billing / Gift Monarch / Referrals
- **Billing** — assinatura/plano/pagamento (preços em [onboarding](../onboarding.md): ~$14,99/mês ou ~$99,99/ano; **Plus** é tier acima que libera Forecasting + Investments Advanced).
- **Gift Monarch** — dar de presente.
- **Referrals** — "Invite a friend, get $30" (também aparece no rodapé, rotativo com "Get 45% discount").

## ⭐ Rules — motor de automação (auto-categorização)
`/settings/rules`. "Rules allow you to rename, recategorize, split your transactions, and more. If multiple rules apply, they apply **in order (top to bottom)** — drag and drop to reorder."

**Builder (New rule):**
- **IF transaction matches criteria** (toggles): **Original statement · Merchant name · Amount · Categories · Accounts**. (Operadores vistos: contains · greater than…)
- **THEN apply these updates** (toggles): **Rename merchant · Update category · Add tags · Hide transaction · Review status · Link to save up goal · Link to pay down goal · Split transaction**.
- **Update existing transactions** (aplica retroativo) + aba **Preview changes** (mostra quantas transações seriam afetadas antes de salvar).
- Exemplo real: `IF merchant name contains "monarch" AND debit > $0 → recategorize to Financial & Legal Services + add tag Subscription`.

### Como fazer no nosso
- **Regras** = `Regra { Ordem, Condicoes[], Acoes[] }`; aplicar no pipeline de import/criação de transação + botão "aplicar retroativo". Preview antes de salvar. Ordenável.
- **Split transaction** — dividir 1 transação em N (ex.: compra mista) — feature útil (checar se temos).
- **Categories/Merchants/Tags/Rules** juntos = sistema de organização; base pra auto-categorização (e depois IA).

## Segurança (Account → Security)
- Confirmar: 2FA (TOTP), gestão de sessões, dispositivos confiáveis, troca de senha. Alinha com nosso baseline (2 camadas, menor exposição). Nosso ROADMAP tem "Dispositivos confiáveis" pendente — o Monarch tem, comparar UX.

## Data (Household → Data)
- Export/import completo + portabilidade. **LGPD**: portabilidade e eliminação são direitos do titular — nosso app precisa disso pra `1.0.0` (ver CLAUDE.md regra de conformidade).
