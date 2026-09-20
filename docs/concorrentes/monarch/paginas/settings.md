# Monarch — **Settings** (`/settings/*`)

> Mapa completo do painel de configurações. Casal/contador em doc próprio ([household-casal](./household-casal.md)).

## Estrutura do menu
### Account (do usuário)
- **Profile** — dados pessoais.
- **Display** — tema/exibição, moeda, formato.
- **Notifications** — preferências de alerta (email/push) — ver sino em [notificacoes-topo](./notificacoes-e-topo.md).
- **Security** — senha, **2FA**, sessões/dispositivos (relevante pro nosso baseline de segurança [[feedback_baseline_seguranca_qualidade]]).
- **Early Access** — features beta opt-in.
- **Integrations** (badge Beta) — integrações de terceiros.

### Household (compartilhado)
- **General** — nome/config do household.
- **Businesses** — contas de negócio (eixo PJ; casa com nosso B2B).
- **Members** ⭐ — casal/família + acesso a profissional/contador → [household-casal](./household-casal.md).
- **Preferences** — preferências do household.
- **Institutions** — bancos/instituições conectadas (sync).
- **Categories** — gerenciar taxonomia (grupos + categorias + emoji; ver [transacao-modal](./transacao-modal.md)).
- **Merchants** — gerenciar comerciantes (entidade Merchant).
- **Rules** ⭐ — motor de automação (abaixo).
- **Tags** — gerenciar tags.
- **Data** — export/import/portabilidade (LGPD: portabilidade é direito do titular).

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
