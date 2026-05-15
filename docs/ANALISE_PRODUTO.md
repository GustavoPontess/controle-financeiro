# Análise Crítica — Controle Financeiro como Produto B2C

> Data: 2026-05-15
> Tom: brutalmente honesto, sem amaciar
> Premissa: avaliar o projeto pensando nele como **produto** para pessoas físicas brasileiras, não como projeto pessoal

---

## 1. A verdade incômoda primeiro

Você construiu um projeto pessoal **acima da média técnica** — modelo de domínio sofisticado (parcelamento, faturas, recorrentes, empréstimos, relacionamentos), backend organizado em camadas, frontend moderno (React 19 + MUI 7). Como peça de portfólio, está ótimo.

Como **produto B2C brasileiro**, ele tem três problemas que precisam ser ditos sem rodeio:

**Problema 1 — O mercado está saturado e maduro.** Mobills tem milhões de usuários, Organizze é referência há mais de uma década, GuiaBolso/Serasa, Wallet, Minhas Economias, Méliuz, Olivia, todos competem nesse espaço. Todos têm Open Finance via Belvo ou Pluggy, app mobile nativo, alguns têm sincronização automática com bancos via OFX/CSV/Open Finance, categorização por ML, anos de iteração de UX. Lançar "mais um app de lançar transação manual" hoje é morto na partida — você não tem nem o canal de aquisição, nem o orçamento de marketing, nem o diferencial.

**Problema 2 — Você não tem app mobile.** Apps financeiros são consumidos no momento da compra, no caixa, em movimento. Web responsivo não substitui isso. Nenhum produto B2C de finanças sério no Brasil é web-only.

**Problema 3 — Entrada manual é a única forma de criar transação.** Os concorrentes leem o extrato bancário automaticamente. Pedir pro usuário digitar cada despesa é a forma mais eficiente de perder o usuário na semana 2. Já existe estudo de retenção em apps assim — sem importação automática, retenção de 30 dias fica abaixo de 10%.

Isso não significa que o projeto não vale nada. Significa que **o posicionamento atual ("controle financeiro B2C genérico") é o pior posicionamento possível.** Volto nisso na seção 6.

---

## 2. Arquitetura e código — o que está bom

Sendo justo antes de bater:

- Separação Controllers/Services/Domain/DTOs está **correta** e consistente. 16 controllers + 19 services pareados.
- Multi-tenancy via `UsuarioId` está **disciplinado** — checado em 43 pontos pelos services. É raro ver isso bem feito em projeto pessoal.
- Modelagem de domínio é **sofisticada de verdade**: separar `Parcelamento` + `ParcelaTransacao` + `Fatura` + `StatusFatura` + `LimiteCalculator` é exatamente como apps financeiros sérios modelam. Muitos concorrentes brasileiros tropeçam aqui.
- `PasswordHasher` com PBKDF2 + SHA256 + 10k iterações + salt 16 bytes é **OK** (não excelente, mas defensável).
- `GlobalExceptionHandlerMiddleware` mapeando exceções para status codes com logging diferenciado é uma decisão **profissional**.
- LINQ to Entities em todos os queries — sem risco de SQL injection.
- 26 migrations versionadas, mostrando evolução real do schema.
- Hangfire para jobs recorrentes (fechamento de fatura, expansão de recorrentes) é a escolha **certa** em vez de cron caseiro.
- Frontend usa stack atual (React 19, Router 7, MUI 7) — não está legado.

Esse projeto **demonstra competência técnica** e é um excelente portfólio. Não confunda isso com "estar pronto pra ser produto".

---

## 3. Arquitetura e código — o que está ruim ou crítico

### 3.1 Bandeiras vermelhas de segurança (essas são bloqueadoras)

| # | Problema | Local | Risco |
|---|---|---|---|
| 1 | JWT secret hardcoded no código e no `appsettings.json` | `Program.cs` linha 64, `appsettings.json` linha 9 | Qualquer um com acesso ao repositório forja tokens. **Crítico.** |
| 2 | CORS contraditório: `.WithOrigins("http://localhost:5173").AllowAnyOrigin()` | `Program.cs` linha 169 | `AllowAnyOrigin()` sobrescreve `WithOrigins` na prática — qualquer site no mundo pode chamar sua API. **Crítico.** |
| 3 | JWT armazenado em `localStorage` | `axiosClient.ts` | XSS rouba o token. Padrão moderno é `httpOnly` cookie + CSRF token. **Alto.** |
| 4 | Sem rate limiting em `/auth/login` | controllers de Auth | Brute force trivial. **Alto.** |
| 5 | Senha mínima de 6 caracteres, sem complexidade obrigatória | `AuthService` | Vai cair em ataque de dicionário. **Médio.** |
| 6 | Refresh token existe na entidade mas o front não usa | `axiosClient.ts` só redireciona pra login | UX ruim (sessão expira o tempo todo) e implementação inconsistente. **Médio.** |
| 7 | Mensagens de erro logadas sem sanitização | `GlobalExceptionHandlerMiddleware` | Pode vazar dado sensível em logs. **Baixo-médio.** |

Nenhuma dessas é difícil de consertar. Todas precisam estar consertadas antes de qualquer usuário real entrar.

### 3.2 Bandeiras vermelhas de infraestrutura

- **SQLite em produção é inviável.** Single-writer, sem replicação, backup é copiar arquivo. Para 100 usuários ativos talvez aguenta; para 10.000 é colapso. Migração pra Postgres não é opcional — é pré-requisito.
- **Hangfire com `MemoryStorage`** (`Program.cs` linha 58). Toda fila de jobs é perdida em qualquer restart. Fechamento de fatura agendado some no deploy. Tem que ser SqlServerStorage/PostgresStorage.
- **Sem Docker, sem CI/CD, sem `.github/workflows`.** Deploy hoje seria manual. Toda mudança vai a produção sem nenhum gate automático.
- **Sem health checks, sem observabilidade.** Quando der problema em produção você só vai descobrir pelo usuário reclamando.
- **Seeders rodando em todo startup** (Banco Central, categorias). Em produção isso fica feio rápido.
- **Port mismatch documentado mas não corrigido** (`5293` vs `5296`). O próprio CLAUDE.md diz "PRECISA AJUSTAR" — está lá há quanto tempo? Sintoma de débito processual, não técnico. Pequenas coisas não consertadas viram cultura.

### 3.3 Lacunas de engenharia que você não pode ignorar para produto

- **Zero testes no frontend.** Sem vitest/jest/RTL. Qualquer refactor é roleta russa.
- **Cobertura de testes backend é simbólica** (~9 arquivos pra 19 services + 16 controllers). Não dá confiança pra deploy contínuo.
- **Sem `FluentValidation` ou `DataAnnotations` nos DTOs.** Validação está hardcoded nos services com `throw new ArgumentException("...")`. Funciona, mas mistura responsabilidades e não documenta contrato da API.
- **Sem `AutoMapper`.** Mapeamento manual entidade↔DTO. Em projeto pequeno tudo bem, em produto com 18 entidades isso vira código burocrático que ninguém atualiza junto com mudanças de schema.
- **Sem state management e sem cache de servidor no front.** Cada navegação refaz o request. Em app financeiro isso é absurdo — `React Query` ou `SWR` resolveria. Context só pra Auth está OK; pra resto, não.
- **Sem paginação visível nos endpoints de listagem.** Quando um usuário tiver 5 anos de transações, a `GET /api/transacoes` vai devolver 50 mil registros. Servidor e browser morrem.
- **Hard delete em vez de soft delete.** Em app financeiro isso é problemático — usuário apaga transação por engano, dado se perdeu. Compliance/auditoria também sofre.
- **Transações ACID implícitas.** Operações como "criar parcelamento" criam N transações em sequência confiando em `SaveChangesAsync`. Se cair no meio, fica estado inconsistente. Precisa `TransactionScope` ou `BeginTransaction` explícito.

### 3.4 Decisões questionáveis de design

- **16 controllers e 19 services para um produto que ainda não validou nada.** Você construiu **cobertura ampla e rasa** em vez de **profundidade no fluxo core**. Isso é o sintoma clássico de "engenharia em busca de produto". A pergunta não é "que entidades faltam" mas "quais 3 telas o usuário usa todo dia e elas são perfeitas?" — provavelmente não são.
- **Cálculo de saldo dinâmico** (`Conta.Saldo` calculado a cada query). Decisão correta para consistência, mas mata performance quando volume cresce. Em algum momento vai precisar de saldo materializado + invalidação.
- **`Banco` populado via API do Banco Central no startup.** Decisão criativa, mas: (a) cria dependência externa para subir o sistema, (b) se a API mudar, o seed quebra, (c) seria mais simples ter um JSON estático versionado.

---

## 4. UX e usabilidade — o que falta para ser usável

Você priorizou usabilidade como princípio mas o produto ainda está longe de fácil. Lista do que está faltando, em ordem de impacto na retenção:

1. **Importação automática de extrato.** OFX, CSV de banco, Open Finance via Belvo/Pluggy. Sem isso, taxa de abandono na semana 1 é altíssima.
2. **App mobile nativo (ou ao menos PWA instalável).** Lançar transação no momento da compra. Hoje é só web, sem PWA, sem offline, sem push.
3. **Categorização automática de transações.** Quando o usuário lança "Uber", o app já sugere categoria "Transporte". Sem isso, cada lançamento custa 3x mais cliques.
4. **Notificações.** Vencimento de fatura, estouro de orçamento, gasto incomum, recorrente prestes a debitar. Hoje, zero.
5. **Captura de comprovante por foto + OCR.** Casos modernos. Você não tem upload de arquivo nem em endpoint.
6. **Recorrentes inteligentes.** A modelagem existe, mas falta detecção automática ("Netflix R$39,90 todo dia 10 — quer marcar como recorrente?").
7. **Dark mode.** Trivial em MUI, ausente. Para app financeiro consultado à noite, importa.
8. **Onboarding guiado.** Primeira tela depois de cadastro deveria ser "vamos cadastrar suas 3 principais contas". Hoje, supostamente, joga o usuário no dashboard vazio.
9. **Relatórios decentes.** Você tem `DashboardController` e `RelatoriosController`, mas sem importação prévia tem pouco a relatar. Concorrentes têm comparativo mês a mês, projeção, análise por categoria, evolução patrimonial.
10. **Metas, alertas e orçamento ativo.** Você tem entidade `Orcamento`, mas é estática. Concorrentes mostram "você gastou 80% do orçamento de comida e ainda faltam 10 dias do mês".
11. **Exportação (PDF, CSV, Excel).** Para conciliar, declarar IR, mostrar pro contador.
12. **Multi-conta compartilhada bem feita.** Você tem `CompartilhamentoConta` na modelagem — isso é potencialmente diferencial, mas não está exposto no front de forma clara.

---

## 5. Organização do projeto e processos

- **Documentação:** existe README e CLAUDE.md (este último é genuinamente bom para um agente trabalhar). Mas **não existe** `docs/` com decisões de arquitetura, diagrama de domínio, fluxos de negócio, guia de troubleshooting. Para um produto, isso vira problema rápido quando entra a segunda pessoa no time.
- **Sem ADRs (Architecture Decision Records).** Decisões importantes (por que SQLite, por que Hangfire MemoryStorage, por que JWT 60min) não estão registradas. Daqui a 6 meses você não vai lembrar e vai refazer escolhas que já foram feitas.
- **Sem CHANGELOG.** Em produto B2C você vai querer comunicar mudanças.
- **Sem CONTRIBUTING ou guia de setup formal além do README.** Onboarding de novo dev é tribal.
- **`bin/` e `obj/` aparecendo no glob.** Provavelmente o `.gitignore` está correto e isso é só local, mas vale conferir que esses diretórios não foram comitados em algum momento.
- **Diretório `Migrations/` com 26 migrations e migrations destrutivas no meio** (`RemovePessoa`, `RemoveLegacyColumns`). Em produção isso é munição pra perder dado. Você precisa de uma política: nenhuma migration destrutiva sem janela de manutenção planejada.

---

## 6. Decisão de estágio — três caminhos honestos

Você disse que está "ainda decidindo". As três opções reais, em ordem decrescente de probabilidade de sucesso:

### Opção A — Manter como projeto pessoal/portfólio. **Recomendado se você está empregado e quer alavancar carreira.**

Você já ganhou o que esse projeto pode dar como portfólio. Polir alguns pontos (testes, CI/CD, Docker, segurança) e usar como prova de competência em entrevistas vale ouro. Não precisa transformar em produto. **Custo: 2-3 semanas. Retorno: cargo melhor.**

### Opção B — Pivotar para um nicho não-saturado. **Recomendado se você quer produto de verdade.**

O posicionamento "controle financeiro genérico B2C" é cemitério. Mas há nichos onde os concorrentes são fracos:

- **Casais/famílias com finanças compartilhadas e regras.** Você já tem `CompartilhamentoConta` e `Relacionamento`. Mobills/Organizze são individuais por design. Há demanda real — fóruns de finanças domésticas estão cheios de pedido por isso. Diferencial: "quem paga o quê", "rateio justo", "transparência sem brigas".
- **Empréstimos entre pessoas físicas.** Você já tem `Emprestimo`. Apps tipo "emprestei R$200 pro meu irmão e nunca mais cobrei" — Splitwise gringo, mas nada bom em PT-BR com integração financeira.
- **Freelancers/MEI com controle de regime de caixa + DARF + pró-labore.** Os apps B2C ignoram que metade dos brasileiros tem renda variável e obrigações fiscais. Aqui a competição é com planilhas de Excel, não com Mobills.

Pivot custa **4-6 meses sério** de redirecionamento. Mas é a única chance de não ser esmagado.

### Opção C — Continuar como concorrente do Mobills. **Não recomendado.**

Você vai gastar 12+ meses, vai chegar num produto inferior por falta de Open Finance e mobile nativo, e vai precisar de marketing pago para roubar usuário de quem já tem a marca consolidada. Probabilidade de sucesso, sendo honesto: <5%.

---

## 7. Roadmap recomendado se for seguir adiante (qualquer opção)

**Sprint 0 (1 semana) — Higiene crítica:**
- JWT secret via variável de ambiente, fora do código
- Corrigir CORS (remover `AllowAnyOrigin`)
- Corrigir port mismatch frontend/backend
- Adicionar rate limiting em `/auth/*`
- Ativar HTTPS enforcement em produção

**Sprint 1 (2-3 semanas) — Fundação para produção:**
- Migrar SQLite → Postgres atrás de abstração de connection string
- Hangfire com PostgresStorage
- Docker + docker-compose
- GitHub Actions: build + test + lint
- Health checks (`/health`, `/health/ready`)
- Logging estruturado (Serilog + Seq ou similar)
- Sentry/Application Insights para erros

**Sprint 2 (2-3 semanas) — Segurança e qualidade:**
- JWT em httpOnly cookie + refresh token funcional no front
- FluentValidation nos DTOs
- Testes de integração nos fluxos críticos (auth, transação, fatura)
- Vitest + RTL no frontend cobrindo fluxos críticos
- Soft delete onde fizer sentido
- Paginação em todos endpoints de listagem

**Sprint 3 em diante — Diferencial de produto:**
- Decidir nicho (Opção B)
- Importação OFX como primeira melhoria de UX (alavanca enorme)
- PWA instalável
- Onboarding guiado
- Categorização automática (regra simples antes de ML)

---

## 8. Conclusão em uma frase

Tecnicamente, é um **portfólio de 8/10**. Como produto B2C, hoje é um **3/10** — não pela qualidade do código, mas pela ausência das coisas que tornam um app financeiro usável (importação, mobile, automação) e pela escolha do mercado mais saturado possível.

O caminho mais inteligente é decidir antes: portfólio polido, ou pivot para nicho. Tentar competir de frente com Mobills é a única opção que tem chance real de não dar em nada.
