---
owner: Gustavo
last_reviewed: 2026-08-23
status: EM_DISCUSSAO
---

# Decisão de hospedagem + escopo essencial do beta

**Documento vivo de decisão (ADR).** Hub de planejamento do beta fechado do Pontes: ONDE hospedar
+ o que é essencial ter pronto antes de publicar. **Hospedagem ainda não decidida.** Fase atual:
planejar/pesquisar/discutir — **sem criar código de deploy** até a decisão estar fechada aqui.

> Regra desta fase (Gustavo, 2026-08-23): documentação pode; código/config de deploy **não**, até a
> decisão estar fechada aqui.

## Premissas (Gustavo, 2026-08-23)

- **Beta = produção de verdade.** Pessoas reais (conhecidas do Gustavo) vão pôr dado financeiro
  real. Tratar o ambiente como produção desde o dia 1, não como sandbox descartável.
- **Provedor confiável e conhecido, nunca host obscuro grátis** — "não sei o que fariam com os dados
  no servidor". Aceita pagar por isso (provedor grande/reputado ou nacional).
- **Beta FECHADO** — sem cadastro aberto ao público; só entra quem o Gustavo convidar.

---

## Contexto

O Pontes hoje só roda local (`docker compose up` + `dotnet run` + `npm run dev`). Pra um beta
fechado (poucos testadores convidados colocando dado financeiro real), precisa ir pra um host
persistente e sempre no ar. O código já está **pronto e neutro** — roda em qualquer host de
container (Docker nos dois lados, nginx no front, tudo configurável por env var; health checks
`/health` e `/health/ready`; `ForwardedHeaders` pra cookie Secure atrás de proxy TLS).

## Requisitos técnicos (do app, já conhecidos)

- **Backend .NET 8 sempre ligado** — sem cold start (pedido explícito do Gustavo: "não quero acordar
  servidor toda hora"). O Hangfire (jobs de fatura/recorrente) exige o processo vivo continuamente,
  não serverless que dorme.
- **Postgres persistente de verdade** — não pode resetar/expirar (é dado financeiro dos testadores).
- **Frontend** — build estático de React (Vite), servível por CDN ou nginx.
- **HTTPS obrigatório** — cookie de sessão só vai `Secure` sob HTTPS (já resolvido no código).
- **Secrets** — `JWT_SECRET`, `PASSWORD_PEPPER`, `MFA_ENCRYPTION_KEY`, `DATABASE_URL`,
  `CORS_ALLOWED_ORIGINS`, `HANGFIRE_ADMIN_EMAILS` — precisam de um mecanismo de secret do host
  (nunca em arquivo versionado).

## Escopo essencial do beta (features gate — decidido 2026-08-23)

Além da infra, o que precisa estar pronto ANTES de abrir o beta:

- **Cadastro fechado por allowlist de e-mail** (caminho A, escolhido pra liberar rápido) — só
  e-mails pré-aprovados conseguem registrar. Hoje `/auth/register` é aberto (só rate-limit); precisa
  gatear contra uma lista (reaproveitar o padrão do `HANGFIRE_ADMIN_EMAILS`). Detalhe/prioridade no
  `ROADMAP.md`.
- **Admin v1 — escopo enxuto** (não é o painel admin completo, que fica pro futuro):
  1. **Gerenciar convites** — gerir a allowlist de quem pode entrar (add/remover e-mail).
  2. **Dashboard de métricas** — ver dados/uso dos testadores (quantos cadastraram, uso básico).
  - Hoje NÃO existe admin global no código (só `PapelFamilia`, por família; e o Hangfire usa
    allowlist de e-mail avulsa). Decidir na implementação se admin vira flag `IsAdmin` no usuário ou
    reusa allowlist de e-mail. Suporte (mexer em conta de terceiro, atender LGPD pela UI) fica pro
    admin completo, depois.
- **Termos de Uso revisados** (hoje rascunho) + **canal de contato real** (hoje "fale com quem te
  convidou", provisório) — viram essenciais porque é produção real, não mais "pro futuro".
- **Backup automático do banco** — inegociável em produção (critério de escolha do provedor).
- **Ambiente sobe como `Production`, não `Development`** — garante que seeders de teste
  (`dev@controle.test`) e rotas dev-only não nasçam no ar.

## Restrições do Gustavo (respondidas 2026-08-23)

- **Servidor no Brasil** — ✅ SIM, por latência (1-5ms BR vs 200ms+ gringo). Filtra a lista: só
  entram provedores com região São Paulo/BR.
- **Orçamento** — "aceitável", sem teto rígido; referência ~R$25-60/mês do que já topou, mas aceita
  subir um pouco por menos trabalho/mais confiança já que é produção real.
- **Cartão internacional (USD)** — preferência por provedor nacional (cobra em real, sem IOF/câmbio),
  coerente com "provedor confiável e conhecido". Não é veto absoluto a USD, mas BR na frente.
- **Nº de testadores** — poucos, conhecidos (beta fechado). Carga baixa → máquina pequena serve.
- **Manutenção** — a decidir no trade-off abaixo (é o eixo principal da escolha).

## Pesquisa de mercado (2026-08-23)

### Filtro aplicado: só região Brasil
- **Saem por NÃO ter região BR** (latência 200ms+): **Render** (Oregon/Ohio/Virginia/Frankfurt/
  Singapura), **Railway** (US/EU/Singapura). Descartados pela restrição de latência.
- **Têm região São Paulo:** Fly.io (gru), hyperscalers (AWS/Azure/GCP/Oracle), nacionais (Hostinger
  BR, Magalu Cloud, Locaweb, Audaks), Supabase (Postgres, sa-east-1).
- **Hyperscalers (AWS/Azure/GCP) em SP:** descartados pro beta — Postgres gerenciado + compute
  sempre-ligado facilmente passa de R$150-300/mês nesse porte, e a complexidade de setup é alta pra
  um solo. Reconsiderar só se escalar muito.

### Tabela completa — custo mensal pra hospedar o Pontes inteiro (região BR)
_(backend .NET sempre ligado + Postgres + frontend. Câmbio ~R$5,40/US$, aproximado. Fonte nas
referências. .NET 8 + Hangfire + Postgres juntos pedem ~2GB RAM confortável; 1GB aperta.)_

**Grupo 1 — VPS (você administra tudo junto num servidor só):**
| Provedor (região) | Plano | Preço/mês | Backup |
|---|---|---|---|
| **Hostinger VPS BR** (SP) | KVM1: 1vCPU / 4GB / 50GB | **R$ ~28** | Semanal automático grátis + `pg_dump` diário (você configura) |
| **Magalu Cloud VM** (SP) | BV2-2-10: 2vCPU / 2GB (aperta) | **R$ 60** | Snapshot + `pg_dump` diário |
| **AWS Lightsail** (SP) | ~2GB RAM | **~US$12 (~R$65)** | Snapshot automático (add-on) + `pg_dump` |

**Grupo 2 — Compute barato + Postgres GERENCIADO (banco cuidado por terceiro, menos trabalho):**
| Combinação | Preço/mês | Backup do banco |
|---|---|---|
| VPS BR (R$28) + **Magalu DBaaS** (R$94) | **~R$122** | Automático ✅ (nacional, real) |
| VPS BR (R$28) + **Supabase SP** (US$25) | **~R$163** | Automático ✅ (USD) |

**Grupo 3 — Hyperscaler 100% gerenciado (o "caro" que você questionou — com números):**
| Provedor (região SP) | Compute + Postgres gerenciado | Preço/mês | Obs |
|---|---|---|---|
| **AWS** | Lightsail/App (~US$12) + RDS db.t4g.micro (~US$20 +storage) | **~R$225** | SP é a região +cara da AWS (RDS 1.6× us-east) |
| **Azure** | App Service B1 (~US$21) + PostgreSQL B1ms (~US$20) | **~R$220** | Brazil South tem **+60%** de premium |
| **GCP** | Cloud Run + Cloud SQL db-f1-micro (~US$16) | **~R$150-200** | db-f1-micro é shared-core, **sem SLA**; SP 1.6× us-central |

### O que a tabela confirma (e onde você tem razão)
- **Você tem razão parcial:** a grande empresa TEM opção barata — a **AWS Lightsail** (a "VPS da
  AWS") chegou em São Paulo em jun/2026, ~R$65, competitiva. Quando o hyperscaler oferece um produto
  tipo-VPS (preço fixo, simples), o preço é razoável.
- **O que confirma o ponto anterior:** o **caro** é o modelo GERENCIADO/fragmentado (RDS, Azure DB,
  Cloud SQL) — 3 a 8× mais que VPS nacional. Motivos, agora com número: **premium de região SP**
  (AWS RDS 1.6×, Azure BR +60%, GCP 1.6×) + cobrança fragmentada (compute + storage + IOPS + egress
  separados) + você paga robustez corporativa (multi-AZ, SLA) que um beta não usa. E o "barato" deles
  às vezes nem tem SLA (Cloud SQL db-f1-micro).
- **Conclusão:** pra beta pequeno em BR, VPS nacional (R$28-65) ou VPS + Postgres gerenciado nacional
  (R$122) ganham de longe do hyperscaler gerenciado (R$150-225). Migrar pra um grande faz sentido
  só **quando escalar** (aí o preço/unidade cai e a robustez compensa).

### Os 3 caminhos que se desenham

**A) VPS único nacional — tudo junto (mais barato, você administra).** Backend .NET + Postgres +
frontend num só VPS BR via Docker Compose. Ex: **Hostinger KVM1 SP ~R$28/mês** (4GB RAM) ou Magalu VM.
- ✅ Baratíssimo, região BR, em reais, 1 fatura.
- ✅ **Backup semanal automático grátis** (snapshot do VPS, restaurável pelo painel) — NÃO é "sem
  backup". Diário é opcional pago.
- ⚠️ **Nuance importante pra app de dinheiro:** o backup da Hostinger é snapshot do DISCO inteiro,
  não backup lógico do Postgres. Snapshot tirado com o banco escrevendo pode restaurar
  inconsistente; e é semanal (perde até 7 dias). Cobre bem "perdi o servidor todo", cobre mal
  "preciso voltar o banco 2 dias limpo". **Plano pra fechar isso:** somar um `pg_dump` diário via
  cron pra storage externo (config única, ~0 custo). Aí: snapshot semanal do VPS + dump diário
  consistente do banco = rede de segurança sólida pra beta, mantendo ~R$28/mês.
- ⚠️ Você ainda administra o servidor (atualizar SO, firewall, o cron do dump).

**B) Compute + Postgres gerenciado separados (mais caro, menos trabalho no banco).** Ex: VPS BR ou
Fly.io pro backend + **Magalu DBaaS (R$94) ou Supabase SP (US$25)** pro Postgres gerenciado.
- ✅ Postgres gerenciado = backup/patch automático de verdade (o "backup obrigatório" resolvido sem
  esforço). Menos coisa pra você administrar.
- ⚠️ Custo sobe (banco gerenciado sozinho já é R$94+ ou US$25). Duas faturas/serviços.

**C) Híbrido.** Front num CDN (Cloudflare Pages, grátis, tem edge no BR) + backend+banco numa VPS
BR. Reduz um pouco a carga do VPS, mas adiciona um serviço a gerenciar. Ganho pequeno pro beta.

## Recomendação (minha, pra você decidir)

Pro **beta fechado tratado como produção**, com você **solo** e querendo **facilitar a vida** mas
sem estourar custo, o trade-off real é **A vs B** — e gira em torno de **quem cuida do backup do
banco**:

- Se topar **administrar o servidor** (atualizar SO, configurar `pg_dump` agendado): **caminho A
  com Hostinger VPS BR (~R$28/mês)** é imbatível em custo e atende tudo (BR, sempre ligado, backup
  de VPS). O preço do "barato" é seu tempo de administração.
- Se quer **mínimo de manutenção** e o banco cuidado por terceiro confiável (recomendado pra dado
  financeiro real, e alinhado ao seu "facilitar minha vida"): **caminho B** — backend numa VPS BR
  barata + **Postgres gerenciado** (Magalu DBaaS R$94 se quiser tudo nacional/reais, ou Supabase SP
  US$25 se aceitar USD). Custo total ~R$120-160/mês, mas o backup e a saúde do banco (a parte mais
  crítica de um app de dinheiro) deixam de ser problema seu.

**Meu voto (revisado 2026-08-23 após checar o backup da Hostinger):** ficou mais equilibrado do que
eu tinha pintado. A Hostinger TEM backup semanal automático, então o caminho A não é "sem rede" —
com o `pg_dump` diário complementar, cobre bem um beta por ~R$28/mês. Continua valendo que, pra dado
financeiro sendo solo, **Postgres gerenciado (B) tem menos risco** (backup consistente/point-in-time
sem você tocar). Resumo honesto do trade-off:
- **Beta com orçamento enxuto e você topando 1 config de cron:** caminho A (Hostinger ~R$28 +
  `pg_dump` diário) é defensável e ótimo custo.
- **Menos risco/menos trabalho no que mais dói (o banco), topando ~R$94+:** caminho B com Magalu
  DBaaS (nacional, real, backup automático de verdade).

## Decisão

**Pendente** — aguardando Gustavo escolher entre caminho A (barato, administra) e B (gerenciado,
menos trabalho), e dentro de B, Magalu DBaaS (BRL) vs Supabase (USD).

## Referências

- serverspace.com.br/about/blog/melhores-provedores-de-nuvem-para-pequenas-empresas-no-brasil-em-2026
- audaks.com.br/blog/melhores-vps-brasil-2026-comparativo-honesto
- kildaryoliver.com.br/quanto-custa-vps-hostinger-brasil (Hostinger VPS BR)
- magalu.cloud/precos/dbaas + magalu.cloud/precos/virtual-machines (preços Magalu)
- makerkit.dev/blog/saas/supabase-pricing (Supabase Pro US$25, região SP)
- render.com/articles/railway-vs-fly-io + expresstech.io/render-vs-railway-vs-fly-io-2026-pricing-showdown (regiões Render/Railway — sem BR)

## Decisão

**Pendente.** Nada escolhido.

## Histórico

- 2026-08-23 — Doc criado. Decisão começa do zero, a partir das restrições reais do Gustavo (sem
  stack pré-escolhida).
