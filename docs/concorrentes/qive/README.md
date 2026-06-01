# Qive — análise (⚠️ NÃO é concorrente nosso)

> `qive.com.br`, analisado em 2026-05-31. **Importante:** Qive **não compete com a gente.** É **B2B enterprise** (automação de Contas a Pagar / fiscal-financeiro pra grandes empresas), nós somos **B2C** (finanças pessoais e de família). Mercados, públicos e produtos diferentes. Documentado aqui porque você pediu, com o enquadramento honesto.

## O que é

**Plataforma SaaS B2B de Contas a Pagar + gestão fiscal-financeira.** Tagline: *"A plataforma que redefine o Contas a Pagar"*. Centraliza num fluxo único, integrado ao ERP: **gestão de pagamentos, fornecedores, documentos fiscais (NFe/NFSe/CTe/MDFe/boleto) e financeiro**, com automação e inteligência analítica.

## Pra quem (público)

- **CFOs e líderes de finanças** de empresas médias/grandes.
- **Times de Contas a Pagar, Fiscal, Financeiro** com alto volume de documentos.
- **Não é pra pessoa física, nem pra família, nem pra contador autônomo** — é pro **departamento financeiro/fiscal da própria empresa**.
- Clientes (logos no site): iFood, Rappi, KaBuM!, C&A, Riachuelo, PicPay, Outback, Mobly, Loggi, Mary Kay, Nuvemshop, MercadoCar.

## Módulos / features

| Categoria | O que faz |
|---|---|
| **Gestão de pagamentos** | recebe documento → valida → aprova (workflow) → gera pagamento |
| **Gestão de documentos fiscais** | captura/centraliza NFe, NFSe, CTe, MDFe, boleto |
| **Gestão de fornecedores** | portal do fornecedor, comunicação, governança/validação |
| **Inteligência de dados** | dashboards, KPIs, relatórios fiscal-financeiros |
| **Automação** | lote, gatilhos inteligentes, fluxos conectados ao ERP |
| **Integrações** | SAP, TOTVS, Oracle, marketplace, APIs |

## Escala declarada

+20 milhões de requisições/dia · 210.000+ CNPJs · R$ 3 trilhões em documentos fiscais · CSAT 98% · cases: −85% lançamento manual, −80% tempo de pagamento, −86% multas de juros.

## Preço

Não exposto na home → `/planos` ("diversos planos por porte de empresa"). Modelo **enterprise/sales-led** ("Fale com um especialista" é o CTA principal, não self-service). Login enterprise via Keycloak (`auth.qive.com.br`).

## Design

- **Dark + laranja/vermelho** primário (enterprise-tech, bold). Logo "Qive" wordmark.
- Hero: executiva + laptop + cards flutuantes de UI fiscal (Total de gastos, NFSe Nacional, CTe, NFe, CFe SAT, donut Analytics 80%).
- Trust pesado: logos de clientes grandes, selos **ISO 27001**, ByCompany, Reclame Aqui.
- Nav: Soluções (por necessidade / por time / por documento) · Por que a Qive? · Cases · Integrações · Insights (blog/materiais/panorama). Footer: Sobre, Contato, Imprensa, Carreiras + **ferramentas grátis** (XML→DANFe, XML→Excel) + social (LinkedIn/Instagram/YouTube/Facebook).

## Nota fiscal tem DOIS lados (importante não confundir)

| | **Emitir** (saída) | **Receber/pagar** (entrada / Contas a Pagar) |
|---|---|---|
| Quem | MEI/PJ emite pro cliente; contador organiza | empresa recebe NF do fornecedor e paga |
| Qive faz? | ❌ não | ✅ **sim** (é exatamente isso, escala enterprise) |
| Referências | Conta Azul, Bling, NFe.io, eNotas, Tiny | **Qive**, Arquivei |

**Qive cobre só o lado "entrada/AP enterprise".** Não emite nota, não é pra MEI/PJ pequeno, não é pra contador gerenciar clientes.

## Relação com a gente (honesta + corrigida)

- **Concorrência direta: nenhuma.** Eles vendem automação de AP pra CFO de empresa grande; a gente faz finanças pessoais/família B2C.
- **MAS — a camada fiscal É uma adjacência real pro nosso futuro.** Como a gente mira **família + PJ + contador** e quer ser **referência no mercado financeiro**, faz sentido considerar no roadmap uma **camada fiscal pro segmento PJ/MEI** (emitir/organizar nota, conciliar) — porque PJ **precisa** emitir NF e contador vive disso.
  - Pra ESSE caminho, a referência **não é o Qive** (enterprise/entrada) e sim **Conta Azul / Bling** (emissão de NF + gestão PJ + ponte com contador, SMB). **Analisar esses** como concorrentes do segmento PJ/contador é o próximo passo lógico.
  - Qive só vira referência **se** a gente um dia for pro B2B-fiscal/contas-a-pagar — hoje, longe.
- **O que dá pra aprender já (indireto):**
  - **Ferramentas grátis utilitárias** (conversor XML→Excel) como isca de SEO/lead — mesma lógica das calculadoras do Despezzas.
  - **Prova social com logos + selos ISO 27001** elevam confiança — válido pra qualquer produto financeiro.

## Veredito

Qive = **referência do lado enterprise/contas-a-pagar**, não concorrente nosso. Não entra na matriz `COMPARATIVO_GERAL.md`. **Ação recomendada:** analisar **Conta Azul e Bling** (emissão de NF + PJ + contador) — esses sim tocam o nosso segmento PJ/contador e a ambição de ser referência no mercado financeiro.
