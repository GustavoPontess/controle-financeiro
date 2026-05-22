# B2B para Contadores — Visão

> **Status:** ideia futura, não priorizada. Documento de pensamento estratégico.
> **Criado em:** 2026-05-22
> **Contexto:** conversa exploratória sobre como expandir o produto Pontes (hoje B2C de finanças pessoais e familiares) para atender contadoras e escritórios contábeis sem quebrar o código nem virar refém de customizações por cliente.

---

## 1. Motivação

O produto Pontes hoje mira casais e famílias (ver `docs/features/familia/visao.md`). Em algum momento futuro, faz sentido expandir para um público B2B — especificamente **contadoras e escritórios de contabilidade** atendendo MEIs, autônomos e pequenas PJs.

Esse movimento traz uma classe nova de desafios que o B2C não tem:

- Uma contadora atende **dezenas ou centenas de clientes**, cada um com sua realidade fiscal, plano de contas, regime tributário.
- Cada **escritório tem um jeito próprio de trabalhar** — fluxos internos, divisão de responsabilidades, terminologia, padrões de conferência. Não existem dois iguais.
- Pedidos de customização por cliente são inevitáveis e, se atendidos no código, destroem o produto em 12-18 meses.

Esse documento registra o pensamento sobre **como cobrir essa diversidade sem quebrar o código**.

---

## 2. O princípio norteador: configuração, não customização

A diferença é sutil mas é a fronteira entre um produto saudável e um pesadelo de manutenção:

- **Customização** = mudar o código pra cada cliente. (`if (cliente == "X") { ... }`)
- **Configuração** = expor opções via dados que o próprio usuário ajusta na interface.

A regra de ouro: **tudo que parece "diferente por cliente" deve virar dado, não código**. Se tem cheiro de `if`, tem que virar `SELECT`.

O contador não precisa que a gente customize o software pra cada cliente dele. Ele precisa que a gente dê **ferramentas pra ele mesmo configurar** cada cliente. É a diferença entre um alfaiate e uma loja modular.

---

## 3. As camadas de flexibilidade

### 3.1 Workspaces hierárquicos

Modelo de tenancy:

```
Escritório (conta-mãe do contador)
  └── ClienteContábil (cada empresa atendida)
        └── Usuário (pessoas com acesso àquele cliente)
```

Dados isolados em cada nível. O contador navega entre clientes com um clique. No nosso código, isso é só mais um nível de tenancy acima de `UsuarioId` — não é uma reescrita.

### 3.2 Plano de contas customizável

Coração da contabilidade. Cada cliente tem o seu. Permitir:

- Importar de modelos padrão (SPED, CRC, etc.)
- Editar livremente (criar, mover, renomear, desativar contas)
- Hierarquia em árvore
- Marcação de "conta padrão pra X" (caixa, banco, receita operacional, etc.)

Tabelas: `PlanoContas`, `Conta` (com `ParentId` pra hierarquia).

### 3.3 Campos customizados (custom fields)

Cliente PJ precisa de CNPJ, regime tributário, CNAE. MEI precisa de DAS, faturamento mensal. Autônomo precisa de RPA.

Em vez de criar 50 campos fixos no banco, criar um sistema de campos dinâmicos:

- `CampoCustomizado` (definição: tipo, label, validação, em qual entidade)
- `ValorCampoCustomizado` (valor por instância)

O contador define quais campos cada tipo de cliente tem. Mesma ideia das databases do Notion ou dos custom fields do Pipedrive.

### 3.4 Templates e playbooks

O contador faz o mesmo trabalho pra muitos clientes parecidos. Entregar templates prontos:

- "Fechamento mensal de MEI"
- "DRE de PJ Simples Nacional"
- "Conciliação bancária padrão"

Ele aplica e adapta. Reduz drasticamente o pedido de "customização".

### 3.5 Report builder

Em vez de codar 200 relatórios diferentes, dar um construtor onde o contador escolhe colunas, filtros, agrupamentos e salva como modelo. Tabela dinâmica do Excel como inspiração: a gente fornece os ingredientes, ele monta o prato.

### 3.6 Motor de workflow (o coração — ver seção 4)

A parte mais importante e mais complexa. Documentada em detalhe abaixo.

### 3.7 Integrações via API e webhooks

Em vez de integrar com cada sistema do mercado (Conta Azul, Omie, ERP do cliente X), expor uma API limpa + webhooks. Quem quiser integrar, integra. Quem não quiser, usa do jeito padrão.

Isso elimina uma fonte enorme de pedidos de customização.

### 3.8 White-label e branding

Pra escritórios maiores: logo do escritório, cores próprias, eventualmente domínio próprio. Configuração visual, não código novo.

### 3.9 Permissões configuráveis

Escritório tem sócios, gerentes, assistentes, estagiários. Cada um vê e faz coisas diferentes. Sistema de papéis customizáveis por escritório, não fixos no código.

---

## 4. O motor de workflow — em detalhe

Esse é o ponto que mais sentimos que vai ser **diferencial competitivo** e ao mesmo tempo a maior armadilha de código.

### 4.1 Por que isso importa tanto

Dado é fácil de generalizar (todo cliente tem CNPJ, todo cliente tem plano de contas). Mas **processo é o jeito de cada um trabalhar**. Uma contadora faz:

> Recebe nota → confere → categoriza → manda pro cliente aprovar → contabiliza

Outra faz:

> Recebe nota → contabiliza direto → revisa no fim do mês → manda relatório

Mesmo trabalho, fluxos completamente diferentes. **Se a gente força todo mundo no nosso fluxo, perde cliente.** Se a gente customiza pra cada um, quebra o código. A solução é tornar o fluxo dado configurável.

### 4.2 A ideia central

A gente **não** modela "fechamento mensal", "conciliação bancária", "envio de DAS". A gente modela **conceitos genéricos de processo**:

- **Processo** — um tipo de fluxo (ex: "Fechamento mensal", "Atendimento de cliente novo")
- **Etapa** — os estágios desse processo (ex: "Recebido", "Em análise", "Aprovado", "Concluído")
- **Tarefa** — uma instância concreta rodando (ex: "Fechamento de março do cliente Silva")
- **Transição** — de qual etapa pra qual etapa pode ir, e quem pode fazer
- **Checklist** — o que precisa ser feito em cada etapa pra liberar a transição
- **Responsável** — quem cuida em cada etapa
- **Gatilho** — quando isso começa (data, evento externo, manual)

A contadora entra no sistema, monta o processo dela arrastando blocos numa tela, define responsáveis, e o sistema executa.

**O código não sabe NADA de contabilidade.** Ele só sabe mover tarefas entre etapas conforme as regras configuradas.

### 4.3 Os ingredientes que tornam isso poderoso

- **Estados customizáveis** — cada escritório define seus status. Só uma tabela `Etapa` por processo.
- **Checklists por etapa** — "pra mover de A pra B, itens X, Y, Z precisam estar marcados".
- **Atribuição automática** — "tarefa de cliente do segmento varejo vai pra Maria; de serviços vai pro João". Regra como dado.
- **SLAs e prazos** — "fechamento mensal precisa terminar até dia 10 do mês seguinte". Sistema avisa, escala, lembra.
- **Automações (if-this-then-that)** — "quando uma nota entra, cria tarefa no processo de conferência". "Quando o cliente aprova, move pra próxima etapa". Motor de regras genérico.
- **Views configuráveis** — kanban, lista, calendário, gantt. Mesmas tarefas, jeitos diferentes de visualizar.
- **Templates de processo** — a gente entrega processos prontos cobrindo casos comuns; a contadora clona e adapta.

### 4.4 Por que isso NÃO quebra o código

O motor é burrinho e poderoso. Ele só sabe 4 coisas:

1. Criar tarefa num processo.
2. Mover tarefa entre etapas respeitando as regras configuradas.
3. Executar automações quando eventos acontecem.
4. Mostrar tarefas em diferentes visualizações.

**Nenhuma linha do código menciona "DAS", "SPED", "DRE".** Tudo isso vive em dados que a contadora cria. Se amanhã uma contadora quiser um processo novo do zero, ela monta sozinha — a gente nem fica sabendo. O produto continua igual pra todo mundo, e cada uma sente que foi feito sob medida.

### 4.5 Tabelas que aparecem nesse modelo

- `Processo` (definição de um tipo de fluxo, escopo do `Escritorio`)
- `Etapa` (etapas do processo, ordem, cor, etc.)
- `Transicao` (de qual etapa pra qual, quem pode fazer, condições)
- `Checklist` e `ItemChecklist` (vinculados a etapas)
- `Tarefa` (instância concreta rodando, status, responsável, prazo)
- `RegraAutomacao` (gatilho + condição + ação)
- `TemplateProcesso` (modelos pré-prontos pra clonar)
- `Visualizacao` (preferências de view por usuário/processo)

---

## 5. Riscos e armadilhas

### 5.1 Motor de workflow é complexo de fazer bem

Muita gente subestima e entrega um motor meia-boca que ninguém usa porque é difícil demais configurar. A estratégia certa é:

1. Começar com **templates prontos cobrindo 80% dos casos**.
2. Permitir customização **leve** no começo (mudar nomes de etapas, adicionar checklist).
3. Só evoluir pra customização **profunda** (criar processos do zero, automações complexas) quando houver demanda comprovada.

Senão é 1 ano fazendo o motor perfeito sem ninguém usando.

### 5.2 A tentação do "só esse uma vez"

Todo pedido de customização aceita é dívida técnica. Disciplina é a única defesa. A pergunta certa não é "dá pra fazer?" e sim "isso vira configuração ou é um caso isolado que vai me amarrar?".

### 5.3 Onboarding complexo

Sistema configurável demais assusta usuário novo. **Templates bons** e **defaults inteligentes** são tão importantes quanto a flexibilidade em si. O usuário precisa poder começar a usar em 5 minutos sem configurar nada, e descobrir a flexibilidade aos poucos.

### 5.4 Performance e complexidade do banco

Tudo virando configuração no banco significa joins complexas e queries dinâmicas. Indexação, caching, e talvez materialized views vão ser necessários muito antes do que no produto B2C.

### 5.5 Multi-tenancy mais profundo

Hoje a gente isola por `UsuarioId`. Pro B2B vai precisar isolar por `EscritorioId` no topo, e por `ClienteContabilId` dentro. Auditoria, billing, RLS (row-level security) viram tópicos sérios.

---

## 6. Sementes a plantar agora (sem construir B2B)

A ideia é **não construir nada disso agora**. Mas algumas decisões arquiteturais pequenas que a gente pode tomar no B2C já preparam o terreno sem custar nada:

- **Pensar em `UsuarioId` como o nível mais granular**, antecipando que um dia pode existir `OrganizacaoId` (família ou escritório) acima dele.
- **Categorias e tags como dado totalmente do usuário**, nunca hardcoded no código. Já é assim hoje, manter assim.
- **Relatórios desde já como composição de blocos** (período + agrupamento + métrica), nunca como "tela de relatório X". Facilita virar report builder no futuro.
- **Eventos de domínio bem definidos** (`TransacaoCriada`, `FaturaFechada`, etc.) — viram naturalmente os gatilhos de automação no futuro.
- **API REST limpa e versionada** (já é assim, manter). Quando o B2B chegar, vira API pública sem retrabalho.
- **Documentar decisões de schema pensando "isso é configurável?"** antes de fixar enum no código.

Nada disso é trabalho extra — é apenas disciplina arquitetural no que já estamos construindo.

---

## 7. Recomendação atual

1. **Não construir B2B agora.** O produto B2C ainda precisa amadurecer e validar PMF.
2. **Validar com contadoras reais antes de codar qualquer coisa B2B.** Conversar com 5-10 contadoras e entender o que elas REALMENTE fazem no dia a dia. Muita coisa que parece importante de fora não é. Muita coisa que parece detalhe é o que faz vender.
3. **Manter esse documento vivo** — quando aparecer alguma evidência nova (conversa com contadora, concorrente novo, padrão de mercado), atualizar aqui.
4. **Quando chegar a hora, abrir uma pasta `docs/features/b2b-contadores/`** com `arquitetura.md` (spec técnica), `ux.md` (mockups), e `roadmap.md` (faseamento). Este `visao.md` continua sendo o "norte estratégico" acima dessas specs.

---

## 8. Referências mentais (concorrentes pra estudar quando chegar a hora)

- **ClickUp, Monday, Asana** — workflow engines genéricos, ótimos pra estudar UX de configurabilidade.
- **Pipefy** — processo automatizado, foco em fluxos de trabalho empresariais.
- **Notion (databases)** — campos customizáveis, views configuráveis.
- **Conta Azul, Omie, Nibo** — concorrentes diretos no nicho contábil brasileiro. Estudar onde eles travam (provavelmente em customização de processo).
- **Pipedrive** — custom fields bem feitos pra estudar.
