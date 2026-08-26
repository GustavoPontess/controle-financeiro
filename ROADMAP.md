---
owner: Gustavo
last_reviewed: 2026-08-24
status: ATIVO
---

# Roadmap — Pontes

**Fonte única do "o que fazer a seguir".** Backlog vivo do produto — **só o que falta**. O estado
granular do que está em execução agora vive em [`STATE.md`](STATE.md). O que já foi entregue está
arquivado em [`docs/history/ROADMAP_CONCLUIDO.md`](docs/history/ROADMAP_CONCLUIDO.md).

> Projeto **solo** (Gustavo). `gh issue` opcional pra rastrear no GitHub, sem assignee de terceiros.
>
> **Regra de manutenção (higiene):** item concluído sai daqui e vai pro arquivo de histórico — este
> arquivo é só backlog aberto. Detalhe em `PROMPT_NOVA_SESSAO.md` §9.

---

## Onde estamos

- **Fundação fechada:** app refatorado pra biblioteca **Pontes** (zero MUI), CSS Modules + `var(--pontes-*)`, personalização global, paginação server-side, CI gate. Auth hardening (OWASP/NIST) + MFA opt-in + conformidade LGPD pesquisada — tudo feito (ver arquivo de histórico).
- **Módulo Empréstimo compartilhado:** backend 100% pronto e testado; **falta escolher a UI da lista** (bancadas `/emprestimos-lab-*`, item P2 abaixo).
- **Beta fechado:** hospedagem decidida (Hostinger, execução adiada por orçamento); faltam 2 itens de código (cadastro fechado + admin v1).
- **Fosso de produto:** gestão financeira de casal/família real BR. Ver `docs/features/familia/visao.md`.

---

## Backlog — features de concorrentes

> Origem: `docs/concorrentes/ACHADOS_ACIONAVEIS.md`.

### Lote 2 — família (parcial)
- [~] **2.3 Papéis/permissões + dependentes** → **BACKEND ✅ / FRONT pendente** — spec em `docs/features/familia/papeis-permissoes.md`. Backend inteiro pronto (enum `PapelFamilia`, `FamiliaPermissoes.ExigirPapelAsync` nos 6 services, endpoint `PUT .../membros/{id}/permissao`). **Falta front:** badge de papel, convite com papel, promover/rebaixar, gates de UI por papel.

### Lote 3 — aquisição / SEO (site público)
- [ ] **3.1 Tela de Assinaturas** — derivar de `Recorrente`: agrupar, total/mês, projeção anual. _Pierre, Despezzas, Monarch._
- [ ] **3.2 Ferramentas grátis + comparações** — `pages/Site/ferramentas/`: juros compostos, CLT×PJ. SEO "sem cadastro". _Despezzas, Monarch, Qive._
- [ ] **3.3 Fotografia lifestyle de casal/família** em `/casais` e `/contadores`. _Monarch._
- [ ] **3.4 Programa de indicação (referral)** — código por usuário + "Convide e ganhe". _Despezzas + Monarch._

### Lote 4 — eixo PJ / contador (futuro)
- [ ] **4.1 Wedge PJ leve + ponte contador** — separar PF/PJ, módulo NF simples, conexão com contador (ref. Conta Azul). Spec antes de codar. `docs/features/b2b-contadores/visao.md`.

### Lote 5 — estratégico (caro, longo)
- [ ] **Open Finance / agregação** — gap nº 1, table-stakes. Via Pluggy ou Belvo, começa com 1 banco.
- [ ] **IA conversacional / categorização automática**.
- [ ] **App mobile** — estratégia em `docs/features/pwa/estrategia-mobile.md` (PWA polida → Capacitor → nativo; custos de loja). **Beta roda no PC** (2026-08-24) — mobile só depois do beta. PWA base existe (#28) mas mínima.

---

## Higiene / dívida conhecida

> **Prioridade:** **P0** 🔴 bloqueador/segurança crítica · **P1** 🟠 alta · **P2** 🟡 média · **P3** ⚪ baixa. Todo achado entra aqui com nível, na hora.

### Empréstimos (backend fechado, faltam pontas)
- 🟡 **P2 — UI da lista de empréstimos: escolher a bancada vencedora** (achado 2026-08-14) — Gustavo não gostou do UI da lista real. Bancada `/emprestimos-lab-a/b/c/d` (Extrato / Tabela / Agrupado por pessoa) usa o empréstimo real e os mesmos serviços. **Gustavo ainda não escolheu** (ou se nenhuma resolve). Próximo passo: escolher → portar a vencedora pra `EmprestimosPage.tsx` com teste. _(Gustavo está arrumando as bancadas.)_
- 🟡 **P2 — Empréstimo ↔ Conta/Transacao real** — hoje criar/vincular `Emprestimo` não move saldo real (é só registro). Gustavo quer que emprestar gere saída real da conta e o pagamento aprovado gere entrada. **Mesma "QUESTÃO CRÍTICA" de `docs/features/familia/visao.md` §16.5** (despesa compartilhada × saldo real) — decisão de modelagem conjunta pros dois casos. Pesquisar como bancos/apps modelam antes de decidir.
- 🟡 **P2 — `PontesNavbar` contraste quebrado em `/convite/emprestimo/:token`** (2026-08-12) — navbar quase ilegível num estado "rolado" em página curta sem hero. Reproduzir e decidir se é bug do componente (afeta outras páginas) ou da landing.
- ⚪ **P3 — LGPD: avisar no "Registrar pagamento" que o credor vê o nome da conta do devedor** (2026-08-12) — `ComprovanteContaNome` tem base legal (Art. 7º-V), não é sensível, mas falta transparência explícita no momento de escolher a conta.
- ⚪ **P3 — Empréstimo/divisão de limite de cartão entre pessoas** — emprestar cartão / dividir limite. Registrado 17/07/2026, explicitamente "pra depois".

### Produto / UX
- 🟠 **P1 — Conferência de caixa (saldo declarado × calculado)** (2026-07-20) — `Conta.Saldo` é soma cega sem filtro de data; lançar retroativo faz o saldo divergir do banco real sem saber se é lançamento faltando ou erro. Spec com os 2 modos (achar lançamento × ajuste 1-clique) em `docs/features/conferencia-caixa/spec.md`. É o que mantém o Gustavo confiando no próprio saldo usando o app.
- ⚪ **P3 — Onboarding / tutorial guiado (product tour)** — passo-a-passo no 1º uso. Decidir abordagem (react-joyride/driver.js vs componente Pontes; escopo). Menos urgente que a conferência de caixa.
- ⚪ **P3 — Gesto de captura rápida (toque duplo traseira do iPhone)** — recurso nativo do iOS, PWA não intercepta; viável só instruindo o usuário a criar Atalho. Mobile é prioridade por último.

### Backend / débito técnico
- 🟠 **P1 — Backend: zero teste de integração de controller** (2026-08-23) — tudo é service unitário (InMemory); nenhum teste HTTP real (`WebApplicationFactory`). Camada de controller (`[Authorize]`, `UsuarioId` do token, status codes, middlewares) só validada à mão no pentest. Fazer suite cobrindo: login sem/com MFA, sem token (401), IDOR cross-user (403/404), Hangfire allowlist.
- 🟡 **P2 — Backend: 6 services sem teste dedicado** (2026-08-23) — por risco: `FaturaService`, `FamiliaPermissoes`, `FinancialEventLogService`, `ParcelaTransacaoService`, `BancoService`/`CategoriaService`.
- 🟡 **P2 — Cobertura de teste das páginas sem teste dedicado** (2026-08-23) — faltam 6: `Settings` (⭐ UI de MFA), `Transactions` (container), `Importacao` (OFX/CSV), `Onboarding`, `PrivacidadePage`, `TermosDeUsoPage`. Decisão do Gustavo: fazer pra todas, depois.
- 🟠 **P1 — Upgrade .NET 8 → 10** (2026-08-23) — .NET 8 (LTS) e 9 (STS) **perdem suporte na MESMA data: 10/11/2026**. .NET 10 é a LTS atual (suporte até nov/2028), pula o 9 direto. Prazo real (sem patch de segurança depois). Bump do TFM (API+Tests) + pacotes EF + `dotnet-version` no CI + retestar. Mapear esforço antes de out/2026.
- 🟡 **P2 — A4: critério de gasto divergente** Orçamento (`CriadoPor`) × Relatório (ownership) — padronizar.
- 🟡 **P2 — KPIs de topo agregam só 1 página** (Transactions/Recorrentes/Emprestimos/Parcelamentos) — endpoints `/stats` dedicados.
- 🟡 **P2 — Médios da auditoria família** — enumeração de usuário, categoria sem filtro de dono, nits Pontes nas telas família/auth, coverage gate no CI. Branch de fixes.
- ⚪ **P3 — `CLAUDE.md` "Adicionar Nova Entidade" usa `int Id`/`int usuarioId`** — mas toda entidade real usa `Guid`. Template desatualizado, confunde se copiado literal.
- ⚪ **P3 — blocklist de senha comum virou inalcançável** — todas as entradas de `SenhasComuns` têm < 15 chars, mas o mínimo é 15. Código morto (não é bug — tamanho já barra). Limpar ou repovoar com passphrases 15+.

### 🔬 Re-pesquisar antes de codar (gaps que o rate-limit cortou)
- [ ] **Rotação de segredos / key rollover** da JWT key sem downtime · **cripto-at-rest / PII em EF Core** · **logging/auditoria** · **LGPD + BACEN/Open Finance** (BACEN já fechado fora do escopo). _MFA e pepper já feitos (ver histórico)._

### Legais (não-código)
- [ ] **#125 INPI marca Pontes** _(#126 LGPD pré-lançamento ✅ fechada — ver histórico)._

### Branches
- [ ] `polish/relatorios` — nenhum PR no GitHub, branch não existe local/remoto. Provavelmente abandonada. Se o trabalho ainda for necessário, tratar como item novo.

---

## 🚦 Gate de lançamento `1.0.0` (conformidade obrigatória)

> **Regra inegociável** (também em `CLAUDE.md`): app de dinheiro + dados pessoais. Antes de lançar, aplicar prática bancária/fintech + LGPD + regras regulatórias. `1.0.0` só sai com:

- [x] **Sprint de Auth Hardening fechado** (🔴 C1/C2/C3 + 🟠) — ✅ concluído (ver histórico).
- [x] **Pesquisa de conformidade completa** (#126) — ✅ fechada 2026-08-18 (`docs/CONFORMIDADE_BR.md`).
- [~] **Segredos rotacionados** — JWT local rotacionado (2026-08-23) + pepper implementado; **falta prod** (JWT/pepper/MFA-key/senha Postgres novos no secret manager do host, quando houver deploy).
- [ ] **Gaps de segurança re-pesquisados e fechados** (`docs/SEGURANCA_BEST_PRACTICES.md`) — ver "Re-pesquisar" acima.

### 🎯 Preparação pro beta fechado (código; deploy ainda NÃO aconteceu)

Escopo menor que o `1.0.0` (poucos testadores convidados). Trabalho de código local. **Nada foi ao ar.** Feitos estão no histórico; abertos abaixo.

- [~] **Hospedagem do beta — DECIDIDO (Hostinger), execução adiada por orçamento.** `docs/features/hospedagem-beta/decisao.md`. Hostinger VPS BR ~R$28 + `pg_dump` diário + backup semanal automático; Gustavo administra. Caminho B descartado por custo. ⏳ **Contrata quando receber** — nada provisionado. Código já é neutro pra qualquer host de container (Dockerfile API/web, nginx.conf, health checks, ForwardedHeaders, CORS/baseURL por env var).
- [ ] **🔒 Admin + gate do beta — spec pronta em `docs/features/admin/spec.md`** (2026-08-26). Gustavo optou por ir além do mínimo (tem tempo até pagar a hospedagem). Modelo: cadastro aberto → conta nasce `AguardandoAprovacao` → admin aprova/recusa (fila) + e-mails pré-aprovados auto-aprovam. **Gate pra abrir o beta.** Módulos: fila de aprovação + métricas (núcleo) · gestão de usuários · ferramentas LGPD (exportar + exclusão soft→carência 30d→hard) · visualizador de auditoria. Segurança: `Usuario.IsAdmin` nunca setável por endpoint (só seed/DB), mass-assignment blindado, authz com re-check no banco, **MFA obrigatório pra admin**, **conta break-glass** de emergência. Feature flags **descartados** (complexidade sem necessidade). Ordem: segurança da flag → fila de aprovação (abre beta) → usuários → auditoria → LGPD.
- [ ] **Segredos de produção** (quando houver deploy) — gerar `JWT_SECRET`, `PASSWORD_PEPPER`, `MFA_ENCRYPTION_KEY` novos (nunca reusar dev); `DATABASE_URL` Npgsql com TLS (`;SSL Mode=Require;Trust Server Certificate=true`); `CORS_ALLOWED_ORIGINS` pro domínio real. Via secrets do host, nunca versionado.
- [ ] **Ambiente sobe como `Production`** — garantir que o deploy NÃO rode como `Development` (senão nascem seeders de teste `dev@controle.test` + rotas dev-only no ar). Checável na config.

### Catalogado pro lançamento público (não bloqueia o beta)
- 🟡 **P2 — Criptografia de campo em repouso (PII/financeiro no Postgres)** — decisão (2026-08-23): só catalogar, não bloqueia beta (Postgres gerenciado já tem cripto de disco; LGPD não exige técnica específica; poucos testadores). Peça pronta: `MfaCrypto` (AES-256-GCM). **Estender:** generalizar num helper + ligar via EF Core `ValueConverter`. **Análise dos campos:** ✅ seguro cifrar `Emprestimo.Pessoa`/`Descricao`/`Observacao`; ⚠️ precisa retrabalho `Transacao.Descricao` (WHERE LIKE), valores (soma/filtro), `Emprestimo.EmailContraparte` (lookup exato).
- 🟡 **P2 — Mapa de "onde entram os dados de contato da empresa"** (2026-08-19) — e-mail pessoal removido das páginas legais; TODOs no código apontam pra cá pra quando existir e-mail/CNPJ/redes da empresa: caixa "Fale com a gente" (Privacidade/Termos) provisória; `Footer.tsx` com dead links (`/contato`, `/blog`, `/lgpd`), CNPJ placeholder fictício mantido de propósito, ícones sociais/badges de loja em `href="#"`.
- 🟡 **P2 — Revisão jurídica dos Termos de Uso** (`/termos-de-uso`) — rascunho (CDC/Marco Civil), sem revisão jurídica de verdade. Gustavo revisa antes do público.
- 🟡 **P2 — CAPTCHA no login** (Cloudflare Turnstile, grátis) só depois de N tentativas, complementando o delay já implementado. Decisão (2026-08-19): não vale criar conta externa agora pro beta fechado. OWASP: MFA é defesa mais forte que CAPTCHA (MFA já feito).
- 🟡 **P2 — reavaliar porte** (pequeno → DPO/RIPD?) se base/receita crescer — Resolução CD/ANPD nº 2/2022.
- ⚪ **P3 — política de exclusão/acesso** pra pessoa citada num empréstimo sem conta no Pontes (zona cinzenta LGPD — `docs/CONFORMIDADE_BR.md`).
- ⚪ **P3 — endpoint de autoatendimento (exportar/apagar dado)** — cumprimento manual por e-mail basta pro beta.
- ⚪ **P3 — aviso inline no "Registrar pagamento"** sobre o nome da conta aparecer pro credor (2026-08-12).

---

## Processo (futuro, quando atacar feature grande)

**Spec-Driven Development** — antes de feature complexa (módulo contador, Open Finance), escrever `docs/features/<feature>/spec.md` (comportamento, regras, casos de uso, edge cases, contrato de API) e só depois codar. Reduz drift.
