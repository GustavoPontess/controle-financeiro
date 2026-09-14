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
- ✅ **UI da lista de empréstimos — bancada B promovida a tela real (2026-09-13).** `EmprestimosPage.tsx` agora é o layout B (tabela densa, kebab de ações, wizard, hero co-igual A receber/A pagar, busca/direção server-side). Labs A/C/D + nav + rotas de bancada apagados. Usa `useEmprestimosLogic` + `EmprestimosLabModals` + `EmprestimosLabItemParts` (nomes com "Lab" mantidos — renomear é cosmético, opcional). **Gaps abertos (abaixo).**
- 🟡 **P2 — Empréstimo: filtro "Arquivados" sumiu na tela nova** (regressão do port 2026-09-13) — a página antiga tinha toggle "Arquivados"; a B não expõe (o hook tem `mostrarArquivados`, falta o botão). Empréstimo quitado+arquivado fica invisível. Re-adicionar um toggle/aba "Arquivados" na toolbar.
- ⚪ **P3 — Testes de empréstimo: recobrir fluxos de modal** (2026-09-13) — ao portar B→real, o `EmprestimosPage.test.tsx` foi reescrito enxuto (13 testes de UI). Cenários profundos do modal antigo (aprovar/rejeitar/reenviar pagamento, consolidação aceitar/recusar/cancelar detalhado, adiantamento parcial) não estão recobertos no nível de página — mover pra teste do hook (`useEmprestimosLogic`) ou dos modais (`EmprestimosLabModals`).
- 🟡 **P2 — Empréstimo bancário: vincular banco + taxas (Open Finance)** (achado 2026-09-13, pesquisa em `docs/features/emprestimo-bancario/pesquisa-openfinance.md`) — hoje `Emprestimo` é P2P (`Pessoa` texto livre), não dá pra registrar empréstimo pego de banco com a instituição + taxa/parcelas. **Achados:** o Open Finance (API Loans v2.5.0, Fase 2) JÁ entrega taxa/CET/parcelas/saldo, mas **acesso direto exige ser instituição regulada BACEN** — inviável agora; caminho real é **agregador (Pluggy/Belvo)**, que é o participante regulado (OPEX ~R$2.5k+/mês, DPA/LGPD obrigatório). **Plano faseado:**
  - **Fase 1 — ✅ ENTREGUE (2026-09-13):** decidido P2P + bancário no mesmo `Emprestimo`. `BancoId` (`Guid?` FK SetNull) + enum `OrigemEmprestimo {Manual,OpenFinance}` + migration `AddBancoIdEOrigemToEmprestimo` (aplicada); `PontesSelect` de banco no passo Básico do wizard (catálogo real) + `PontesBankBadge` na lista; validação banco existe&ativo; testes back+front verdes. **Feito nas bancadas (Lab B) — falta portar pra `EmprestimosPage.tsx` real junto com o item de escolher a bancada.**
  - **Fase 2 (futuro, só com demanda + gate LGPD/DPA):** botão "importar do banco" via agregador preenche taxa/parcelas/saldo auto; `OrigemDados`; minimização na borda (descartar payload cru; não ingerir PII de terceiros/avalista); cripto at-rest; consentimento só `LOANS`/`FINANCINGS`.
  - **Reconfirmar antes de codar Fase 2:** preços reais Pluggy/Belvo; fim do teto de 12 meses de consentimento (Res. Conjunta 7/2023 — fonte secundária); figura "entidade parceira" 1x1x1 (não vigente).
- ✅ **Regras de empréstimo — decididas (2026-09-13, doc `docs/features/emprestimo-bancario/regras.md` §6).** Diretriz: **tudo manual na Fase 1**; campos prontos pra integração (só troca `Origem`). Princípio: taxa/multa são **dado dinâmico do registro, nunca chumbado no código**.
  - #1 Banco ⇒ `Tipo=PeguiEmprestado` — **IMPLEMENTADO** (UI + backend + testes).
  - #2 multa ≤2% CDC — **não trava agora** (multa manual/livre; se virar regra, config nomeada, revisitar antes do 1.0.0).
  - #3 PRICE/SAC, #4 juros de mora, #5 job de atraso, #6 TipoCredito/Garantia — **adiados** (entram com integração ou por demanda).
  - #7 CET/IOF — **fora da Fase 1**, via Open Finance na Fase 2.
  - 💡 Monetização (ideia, não implementar billing): grátis = manual; pago = integração (Pluggy) que preenche automático via `Origem=OpenFinance`. Doc §7.
- 🟡 **P2 — Empréstimo ↔ Conta/Transacao real** — hoje criar/vincular `Emprestimo` não move saldo real (é só registro). Gustavo quer que emprestar gere saída real da conta e o pagamento aprovado gere entrada. **Mesma "QUESTÃO CRÍTICA" de `docs/features/familia/visao.md` §16.5** (despesa compartilhada × saldo real) — decisão de modelagem conjunta pros dois casos. Pesquisar como bancos/apps modelam antes de decidir.
- 🟡 **P2 — `PontesNavbar` contraste quebrado em `/convite/emprestimo/:token`** (2026-08-12) — navbar quase ilegível num estado "rolado" em página curta sem hero. Reproduzir e decidir se é bug do componente (afeta outras páginas) ou da landing.
- ⚪ **P3 — LGPD: avisar no "Registrar pagamento" que o credor vê o nome da conta do devedor** (2026-08-12) — `ComprovanteContaNome` tem base legal (Art. 7º-V), não é sensível, mas falta transparência explícita no momento de escolher a conta.
- ⚪ **P3 — Empréstimo/divisão de limite de cartão entre pessoas** — emprestar cartão / dividir limite. Registrado 17/07/2026, explicitamente "pra depois".

### Produto / UX
- 🟠 **P1 — Conferência de caixa (saldo declarado × calculado)** (2026-07-20) — `Conta.Saldo` é soma cega sem filtro de data; lançar retroativo faz o saldo divergir do banco real sem saber se é lançamento faltando ou erro. Spec com os 2 modos (achar lançamento × ajuste 1-clique) em `docs/features/conferencia-caixa/spec.md`. É o que mantém o Gustavo confiando no próprio saldo usando o app.
- ⚪ **P3 — Onboarding / tutorial guiado (product tour)** — passo-a-passo no 1º uso. Decidir abordagem (react-joyride/driver.js vs componente Pontes; escopo). Menos urgente que a conferência de caixa.
- ⚪ **P3 — Gesto de captura rápida (toque duplo traseira do iPhone)** — recurso nativo do iOS, PWA não intercepta; viável só instruindo o usuário a criar Atalho. Mobile é prioridade por último.

### Backend / débito técnico
- 🟠 **P1 — Auditar TODAS as tabelas/listas: busca/filtro/paginação server-side** (Gustavo, 2026-09-13) — regra inegociável: "tudo que for tabela a gente não pode ter esse tipo de erro". Filtro client-side numa lista paginada no servidor fura (só acha na página carregada; contador errado). **Já corrigido:** empréstimos (`ListarAsync` + `busca`/`direcao`). **Auditar o resto:** Transações (tem `ListTransactionsFilter` — conferir se TUDO é server-side), Admin (Pendentes/Usuários/Auditoria/LGPD), Recorrentes, Parcelamentos, Cartões, Categorias/Bancos, Famílias. Para cada: filtro/busca/ordenação vão pro backend, `total` reflete o filtro. Padrão em `docs` + memória `feedback_consultas_server_side`.
- 🟠 **P1 — CI/Docker: build da imagem da API quebrado (E2E vermelho)** (achado 2026-09-13, PR #235) — `ControleFinanceiro.Api/Dockerfile:16` faz `addgroup -S app && adduser -S app -G app` (hardening não-root de 2026-08-18), mas a imagem base `mcr.microsoft.com/dotnet/aspnet:8.0-alpine` **passou a trazer o usuário/grupo `app` embutido** (drift do upstream) → o passo falha com exit 1 → imagem não builda → API não sobe → **job E2E Playwright falha** (não é check obrigatório, mas **quebra o build de deploy**). Correção: não recriar o usuário se já existir (guardar com `getent group app || addgroup ...` / `id app || adduser ...`) ou usar `USER $APP_UID` que a base já provê, mantendo o não-root. Verificar imagem base antes de afirmar a causa exata. — tudo é service unitário (InMemory); nenhum teste HTTP real (`WebApplicationFactory`). Camada de controller (`[Authorize]`, `UsuarioId` do token, status codes, middlewares) só validada à mão no pentest. Fazer suite cobrindo: login sem/com MFA, sem token (401), IDOR cross-user (403/404), Hangfire allowlist.
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
- [~] **🔒 Admin + gate do beta — spec em `docs/features/admin/spec.md`.** Segurança da flag ✅ (2026-09-09) + **Módulo A (fila de aprovação + métricas) ✅ (2026-09-09, `038d522`)** — `StatusUsuario` substituiu `bool Ativo`; cadastro nasce pendente sem sessão; endpoints admin pendentes/aprovar/recusar/metricas; front `/admin` (Pendentes + Métricas). **Verificado ao vivo** (2026-09-09): cadastro nasce pendente → login barra com "aguardando aprovação" → admin aprova em `/admin`. **Falta (próximas rodadas):**
  - ✅ **Painel admin com a MESMA cara do app (sidebar+navbar, menus de admin) + hardening de front — feito 2026-09-10 (`75c027d`→`087e253`), validado ao vivo.** `AdminLayout` reusa o shell do `DefaultLayout`; `Sidebar`/`Navbar` parametrizados (`nav`/`showFinance`/`title`, sem `if isAdmin`); menus Fila de aprovação + Métricas na lateral. `AdminRoute` lê `isAdmin` do `/auth/me` (não importa `adminService`) → **zero endpoint/tela/menu de admin no bundle comum** (só `/admin/*`+`isAdmin`, irredutível); lazy load; source maps off. _(Detalhe no histórico quando fechar a branch.)_
  - ⚪ **P3 — Entrada do painel admin (só pra admin).** Hoje só por URL (`/admin`). Com `isAdmin` já no `/auth/me`, dá pra mostrar um item "Painel Admin" na sidebar **condicionado a `currentUser.isAdmin`** — comum não vê, e se forçar cai no 403/redirect. Decisão do Gustavo: A) pôr o link, B) manter só-URL (máxima discrição).
  - ✅ **Módulo B (gestão de usuários) — feito 2026-09-10 (`87266ce`), validado ao vivo.** Listar + bloquear/reativar (estado `Bloqueado` com ação na UI + login barrado) + forçar reset; admin não bloqueia a si. _(Detalhe no histórico quando fechar a branch.)_
  - ✅ **Módulo D (visualizador de auditoria) — feito 2026-09-10 (`df26a39`), validado ao vivo.** `AdminAuditLog` append-only + toda ação de admin registra rastro (snapshot admin+alvo) + tela só-leitura `/admin/auditoria`. _(Detalhe no histórico quando fechar a branch.)_
  - ✅ **Módulo C (LGPD ⚠️ sensível) — feito 2026-09-10, validado ao vivo E2E contra Postgres real.** Exportar dados (JSON, auditado) + exclusão 2 estágios (soft `MarcadoParaExclusao` + carência 30d + job `PurgaExclusaoExpiradaJob`) + **purga física real** com confirmação forte (digitar e-mail), **recusa se houver vínculo com outro usuário** (não quebra dado de terceiro), deleção ordenada child→parent, `FinancialEventLog` anonimizado, `AdminAuditLog` preservado. `AdminLgpdService` + `AdminLgpdPage` (`/admin/lgpd`) + migration `AddMarcadoExclusaoEm`. Purga validada ao vivo (204, cascade OK, sem erro de FK). **Ressalva resolvida:** o store Marco Civil (captura de log de acesso) foi entregue em 2026-09-12 — a purga LGPD preserva `RegistroAcesso` por não haver FK. _(Detalhe no histórico quando fechar a branch.)_
  - **Admin do beta COMPLETO:** A · B · C · D ✅. Store Marco Civil ✅ (2026-09-12). Notificações admin (stream próprio) ✅ + mascaramento de PII com olhinho ✅ (2026-09-12). Falta só (opcional) testes de integração HTTP do admin (P1).
  - ✅ **Mensagem do sino de admin sem e-mail — feito 2026-09-12.** As notificações (NovoCadastro/Seguranca) agora usam só o nome; o e-mail (mascarado) fica a 1 clique na tela. Menor exposição de PII, consistente com o mascaramento das tabelas.
  - MFA obrigatório pra admin + break-glass adiados pra produção. Feature flags descartados.
  - _Obs: os 5 estados de `StatusUsuario` já existem no modelo e nas Métricas; a aba Pendentes só expõe Aprovar/Recusar porque é a fila (Módulo A). Não é o padrão ativo/inativo — as outras transições chegam com B/C._
- [ ] **Segredos de produção** (quando houver deploy) — gerar `JWT_SECRET`, `PASSWORD_PEPPER`, `MFA_ENCRYPTION_KEY` novos (nunca reusar dev); `DATABASE_URL` Npgsql com TLS (`;SSL Mode=Require;Trust Server Certificate=true`); `CORS_ALLOWED_ORIGINS` pro domínio real. Via secrets do host, nunca versionado.
- [ ] **Ambiente sobe como `Production`** — garantir que o deploy NÃO rode como `Development` (senão nascem seeders de teste `dev@controle.test` + rotas dev-only no ar). Checável na config.

### Catalogado pro lançamento público (não bloqueia o beta)
- 🟡 **P2 — Criptografia de campo em repouso (PII/financeiro no Postgres)** — decisão (2026-08-23): só catalogar, não bloqueia beta (Postgres gerenciado já tem cripto de disco; LGPD não exige técnica específica; poucos testadores). Peça pronta: `MfaCrypto` (AES-256-GCM). **Estender:** generalizar num helper + ligar via EF Core `ValueConverter`. **Análise dos campos:** ✅ seguro cifrar `Emprestimo.Pessoa`/`Descricao`/`Observacao`; ⚠️ precisa retrabalho `Transacao.Descricao` (WHERE LIKE), valores (soma/filtro), `Emprestimo.EmailContraparte` (lookup exato).
- 🟡 **P2 — Mapa de "onde entram os dados de contato da empresa"** (2026-08-19) — e-mail pessoal removido das páginas legais; TODOs no código apontam pra cá pra quando existir e-mail/CNPJ/redes da empresa: caixa "Fale com a gente" (Privacidade/Termos) provisória; `Footer.tsx` com dead links (`/contato`, `/blog`, `/lgpd`), CNPJ placeholder fictício mantido de propósito, ícones sociais/badges de loja em `href="#"`.
- ✅ **Store de "registros de acesso" (Marco Civil Art. 15) + captura de IP no login — feito 2026-09-12, validado ao vivo E2E.** Entidade `RegistroAcesso` (store separado, **sem FK** → fora do cascade da conta, sobrevive à purga LGPD), captura de login+IP+timestamp no `AuthController` (best-effort, não derruba o login), retenção 6m (`RetencaoDias=180`) com `PurgaRegistroAcessoExpiradoJob` (Hangfire diário). Guarda só o registro legal (data/hora + IP + identificador) — **sem User-Agent** (minimização, reconfirmado na fonte primária: Marco Civil Art. 5 VIII = data/hora + IP). +5 testes back. Validado ao vivo (registrar→aprovar→login → linha no Postgres com IP capturado; sobrevivência à purga coberta em teste). Pesquisado 2026-08-26 + reconfirmado 2026-09-12, ver `docs/CONFORMIDADE_BR.md`. _(Detalhe no histórico quando fechar a branch.)_
- 🟡 **P2 — Revisão jurídica dos Termos de Uso** (`/termos-de-uso`) — rascunho (CDC/Marco Civil), sem revisão jurídica de verdade. Gustavo revisa antes do público.
- ✅ **Enumeração de usuário no `/auth/register` — corrigido 2026-09-12 (pentest).** `RegisterAsync` responde sempre a mesma mensagem genérica (não revela se o e-mail existe), sem criar duplicata, com hash descartado p/ equalizar timing. Login/forgot já eram genéricos. 2 testes + validado ao vivo. _(Detalhe no histórico quando fechar a branch.)_
- ✅ **Notificação de admin acionável se resolve ao tratar o cadastro — feito 2026-09-12.** Pesquisa de UX (NN/g/Carbon/Toptal): notificação **acionável** deve sumir quando a ação é feita; **informativa** fica como log. Implementado: `NotificacaoAdmin.AlvoId` (Guid solto, migration `AddAlvoIdNotificacaoAdmin`) ligado ao usuário nas notificações NovoCadastro; aprovar/recusar chama `MarcarLidasPorAlvoAsync` → a notificação daquele cadastro baixa do sino (atômico na mesma transação). Segurança/LGPD seguem como log (informativas, sem AlvoId). +3 testes, validado ao vivo (registrar→aprovar→Lida=t). _(Detalhe no histórico quando fechar a branch.)_
- ⚪ **P3 — HSTS `preload`** (só quando existir domínio real + deploy) — hoje o HSTS já sai sob HTTPS (`max-age=31536000; includeSubDomains`, verificado 2026-09-12). Falta o passo opcional de preload: adicionar `preload` ao header (`SecurityHeadersMiddleware`) e **submeter o domínio em https://hstspreload.org** pra forçar HTTPS já na 1ª visita (antes da 1ª resposta). Requisitos: max-age ≥ 1 ano (ok), includeSubDomains (ok), servir preload no apex. Gated no domínio de produção.
- 🟡 **P2 — CAPTCHA no login** (Cloudflare Turnstile, grátis) só depois de N tentativas, complementando o delay já implementado. Decisão (2026-08-19): não vale criar conta externa agora pro beta fechado. OWASP: MFA é defesa mais forte que CAPTCHA (MFA já feito).
- 🟡 **P2 — reavaliar porte** (pequeno → DPO/RIPD?) se base/receita crescer — Resolução CD/ANPD nº 2/2022.
- ⚪ **P3 — política de exclusão/acesso** pra pessoa citada num empréstimo sem conta no Pontes (zona cinzenta LGPD — `docs/CONFORMIDADE_BR.md`).
- ✅ **Autoatendimento do titular (exportar/apagar dado) — feito 2026-09-12.** LGPD Art. 18: usuário exclui a própria conta (step-up senha + 2º fator TOTP/PIN-email → soft-delete 30d → reativar no login), exporta os próprios dados, tudo self-service. Precedido de pesquisa OWASP/NIST (`docs/SEGURANCA_BEST_PRACTICES.md` §0). Back 526/526 + front 369/369, validado ao vivo. _(Detalhe no histórico quando fechar a branch.)_
- ⚪ **P3 — aviso inline no "Registrar pagamento"** sobre o nome da conta aparecer pro credor (2026-08-12).

---

## Processo (futuro, quando atacar feature grande)

**Spec-Driven Development** — antes de feature complexa (módulo contador, Open Finance), escrever `docs/features/<feature>/spec.md` (comportamento, regras, casos de uso, edge cases, contrato de API) e só depois codar. Reduz drift.
