# Empresas no Pontes — Visão

> **Status:** direção estratégica, não priorizada. Pensamento do Gustavo com o Claude em 2026-10-26.
> **Contexto:** o Pontes é B2C (pessoa e família). O Gustavo quer atender empresas também, porque empresa paga mais. Este documento diz **que** empresa, **pelo que** ela paga, **o que já temos**, **o que falta**, **como cobrar**, em **que ordem**, e a camada de **automação com IA** que faz o plano valer. Complementa `docs/features/b2b-contadores/visao.md` (o escritório de contabilidade, que é o passo 4 daqui).

---

## 1. Que empresa

"Empresa" não é uma coisa só. Cada tamanho é um produto:

| Tamanho | Quem é | O que mistura | Paga por mês | Quem já atende |
|---|---|---|---|---|
| **Uma pessoa** | MEI, autônomo, profissional liberal, quem recebe aluguel | conta da casa com a do trabalho | R$ 20 a 50 | ninguém direito: ou é app pessoal ou é ERP |
| **Pequena (2 a 20 pessoas)** | loja, clínica, escritório, agência, oficina | sócio, alguém do financeiro, contador de fora | R$ 100 a 400 | Conta Azul (R$ 310+), Omie, Nibo, Bling (R$ 55+) |
| **Escritório de contabilidade** | contador com 30 a 300 clientes | não é cliente: é **canal** | por cliente atendido | Conta Azul, Nibo, Dominio |

**Alvo:** a **pequena**, entrando pela **pessoa** (que já é nosso usuário) e pelo **contador** (que traz as empresas em lote). Média e grande ficam fora: é outro produto e outro time.

## 2. Pelo que a empresa paga

Não por "ver onde gastou". Paga por quatro dores:

1. **Receber:** emitir cobrança (Pix, boleto), saber quem não pagou, lembrar o cliente.
2. **Pagar sem atrasar:** agenda de contas, fornecedor, aprovação do sócio.
3. **Fechar o mês com o contador:** conciliação com o extrato, DRE simples, exportar.
4. **Obrigação:** DAS, carnê-leão, imposto do mês, nota fiscal.

Dinheiro entrando (1) é a dor que mais paga. Fechar o mês (3) é a que traz o contador.

## 3. O que já temos que serve

Mais do que parece. **A Família já é um "espaço" com membros, papéis e regras**: troca o rótulo e vira a empresa com sócio, financeiro e contador.

| Já existe | Vira na empresa |
|---|---|
| Família (membros, papéis, convites, `FamiliaPermissoes`) | Espaço Empresa (sócio, financeiro, contador) |
| Conta fixa | Conta a pagar recorrente |
| Aprovação de despesa acima de um valor (`Familia.LimiteAprovacao`) | Sócio aprova |
| Importar extrato (OFX/CSV) + Reconciliação | Conciliação bancária |
| Relatórios (check-up do mês) | DRE simples, fechamento |
| Orçamento (planejado por categoria, fontes de receita) | Orçamento da empresa |
| Empréstimos ("falta voltar") | Começo de contas a receber |
| Permissões centralizadas, auditoria, idempotência, duas etapas | O que empresa e contador exigem |
| Respostas (`DinheiroDoMesService`, `CheckUpService`) | "Vai dar pra pagar a folha dia 5?" |

## 4. O que falta pra cobrar de empresa

- **Espaço Empresa** ao lado de "Casa": CNPJ, regime tributário, mesmo modelo da família.
- **Clientes e contas a receber:** hoje só temos empréstimo.
- **Cobrança** por Pix e boleto via parceiro (Asaas, Efí). Além do plano, rende taxa por cobrança emitida.
- **Fluxo de caixa projetado** (o que entra e sai nos próximos 30/60/90 dias, pelas regras únicas que já temos) e **DRE simples**.
- **Acesso do contador** (só leitura) e **exportação** (planilha, OFX, o que o contador pede).
- **Impostos:** DAS do MEI, carnê-leão (aluguel, serviço de PF), imposto do mês respondido, DARF como conta fixa, exportar pro IR. Regra sempre da fonte primária (Receita), mostrada como estimativa.
- **Nota fiscal via API de terceiro** (Emitfy, Focus NFe, eNotas), nunca própria. Ver `docs/concorrentes/emitfy/README.md`.
- Open Finance PJ, quando entrar o PF.

## 5. Como cobrar

| Plano | Quem | Preço |
|---|---|---|
| Casa | pessoa e família | grátis no beta; depois barato |
| **Empresa** | por espaço empresa | **R$ 99 a 199 por mês** + taxa por cobrança emitida |
| Escritório | contador | por cliente atendido |

Uma empresa vale dez famílias. A família continua sendo o fosso e a porta de entrada.

## 6. Ordem (cada passo vende sozinho)

1. **Espaço Empresa** em cima da Família (rótulos, CNPJ, papéis). Barato: é configuração do que existe.
2. **Clientes, contas a receber e cobrança.** A dor que paga.
3. **Contador vê e exporta.** O canal.
4. **Escritório com vários clientes**, plano de contas e templates (`b2b-contadores/visao.md`).
5. **Nota fiscal** via API, se os clientes pedirem.

Antes de codar o passo 1: **conversar com 5 donos de empresa pequena e 3 contadores** que o Gustavo conhece. É o jeito mais barato de saber se o passo 2 é o certo.

Depois do beta pessoal e da família (`project_pessoal_antes_familia`): empresa não fura essa fila.

---

## 7. Automação com IA: a camada que faz o plano valer

### Nome

Nome de **camada do Pontes**, não de produto separado. Na identidade da ponte:

- **Pilar** (preferido): "Pilar, a inteligência que sustenta o seu financeiro." Curto, de ponte, passa segurança.
- Travessia: "do extrato ao fechamento, sem você tocar."
- Engenheiro: "o engenheiro do seu caixa."

"IA" não entra no nome; "com IA" vai no subtítulo.

### O que faz (em ordem de valor)

1. **Extrato entra categorizado.** Importou OFX/CSV, cada lançamento sai classificado; aprende com a correção da pessoa. Base: `ExtratoImportService`, `ModeloImportacao`, `Sinonimos`.
2. **Boleto e nota viram conta a pagar.** Foto ou PDF → lançamento com vencimento, fornecedor, valor, categoria.
3. **Conciliação sozinha.** Casa extrato com lançamento; só pergunta no que não bate. Base: Reconciliação.
4. **Cobrança que corre atrás.** Lembra o cliente antes e depois do vencimento; marca pago quando o Pix entra.
5. **Fechamento do mês escrito.** O check-up vira texto pro sócio e pro contador, com o que mudou e o que precisa de atenção.
6. **Pergunta em português, resposta com número.** "Quanto gastei com o fornecedor X em setembro?" A IA traduz a pergunta pra consulta e o número pra frase; **a conta continua nas regras únicas do servidor** (`RegrasFinanceiras`, `DinheiroDoMesService`). Nunca IA fazendo conta de dinheiro.
7. **Regras sem código.** "Quando entrar Pix de fulano, marca a cobrança como paga e me avisa." Automações que a pessoa monta na tela.
8. **Aviso antes do problema.** "Nesse ritmo o caixa fica negativo dia 22." Base: `PrevistosDoMesAsync`, fluxo projetado.

### Regras de ouro (inegociáveis; é dinheiro)

- **IA sugere, pessoa confirma.** Nunca paga, nunca apaga, nunca manda cobrança sem a regra ligada pela pessoa. Toda ação sugerida fica em fila de confirmação.
- **Tudo registrado** (`FinancialEventLog` + auditoria): o que a IA sugeriu, o que a pessoa aceitou.
- **Número vem do servidor**, da regra única. A IA escreve e interpreta, não calcula saldo, imposto ou divisão.
- **LGPD:** só vai pro provedor o que a tarefa precisa; sem CPF, CNPJ, e-mail ou nome onde não for necessário; contrato com o provedor de não treinar com os dados; registrar no `CONFORMIDADE_BR.md` e na Política de Privacidade antes de ligar.
- **Custo por chamada:** só em plano pago (Empresa, Escritório); na Casa, só o que couber no grátis (categorização, por exemplo).
- **Modelo:** Claude (família 5), escolhido por tarefa: o barato pra categorizar e extrair, o forte pra escrever o fechamento e responder pergunta. Decisão técnica em `docs/features/empresas/arquitetura.md` quando chegar a hora.

### Como vende

Na página de empresas: "Você fatura. O Pilar categoriza, concilia, cobra e fecha o mês. Você só confirma." Cada item da lista acima vira um bloco com a tela real.

### Esteira de documentos por cliente (validação documental)

Pedido do Gustavo (2026-10-26): automatizar a conferência dos documentos que cada cliente manda pro contador. Hoje isso é WhatsApp e conferência na mão; é das coisas que mais fazem o escritório pagar.

**Checklist do mês, por cliente.** Cada empresa tem a lista do que precisa chegar todo mês (extrato de cada conta, notas emitidas, notas recebidas, comprovantes de pagamento, DAS pago, folha…), definida pela regra do cliente (regime, atividade). Cada item tem estado:

`esperado → recebido → extraído → conferido → pendência | aprovado → conciliado → mês fechado`

O contador vê um painel com semáforo de todos os clientes; o cliente vê só o dele e o que falta mandar.

**Entrada do documento.** Pelo app (foto ou PDF), por um e-mail só daquele cliente (`<cliente>@docs…`), pelo WhatsApp depois. O sistema identifica cliente e mês pelo canal e pelo conteúdo, sem renomear arquivo.

**Conferência em camadas:**
1. **Forma:** tipo certo, legível, período certo, duplicado (hash do conteúdo).
2. **Dados:** IA extrai emitente, CNPJ, data, valor, chave da nota, vencimento.
3. **Cruzamento (a validação de verdade):** nota × lançamento no extrato; comprovante × dinheiro saindo da conta; chave da NF-e autorizada (consulta pública); CNPJ do emitente ativo (API pública da Receita); soma das notas × faturamento do mês.
4. **Regra do cliente:** configuração, não código (`b2b-contadores/visao.md` §2): regime, o que exige nota, teto de faturamento.
5. **Resultado:** aprovado, ou **pendência com motivo em português** ("falta o comprovante do pagamento da nota 1234, de R$ 1.800"), enviada ao cliente sozinha, com lembrete até resolver.

**Honestidade na tela.** O que dá pra garantir: chave de NF-e, CNPJ, extrato, comprovante contra extrato. Recibo solto e contrato a IA lê e cruza, mas não garante autenticidade: a tela diz "conferido contra o extrato", nunca "autêntico".

**O que falta no código:** armazenamento de arquivo (objeto, criptografado, com prazo de retenção e log de acesso: é dado sensível de terceiro; LGPD antes de ligar), entidades `Documento`, `ChecklistDoMes`, `Pendencia`, `RegraDeConferencia`; extração e cruzamento em jobs (Hangfire); fila de confirmação do contador. Regras de ouro da IA valem aqui inteiras.

**Na ordem:** é o passo 3 ("contador vê e exporta") mais forte: **"contador recebe, confere e fecha"**. É o que faz o escritório trazer os clientes em lote.

---

## 8. Riscos

- **Dispersão.** Solo, beta nem lançado. Empresa só depois do pessoal e da família. Este doc existe pra não precisar pensar de novo, não pra começar agora.
- **Virar ERP.** O momento em que entra estoque, PDV ou folha, virou outro produto. Não entra.
- **Nota fiscal própria.** Nunca. API de terceiro.
- **IA que erra com dinheiro.** As regras de ouro acima são a resposta. Sem elas, não liga.
