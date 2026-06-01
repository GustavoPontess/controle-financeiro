# Conta Azul — análise (adjacente: PJ + contador)

> `contaazul.com`, 2026-05-31. **Não é concorrente do nosso core B2C** (finanças pessoais/família). É **ERP B2B pra PME (PJ)** — mas é **A referência BR de "PJ + emissão de NF + integração com contador"**, exatamente o eixo que você levantou pro nosso `/contadores`. Estudar como benchmark dessa adjacência.

## O que é

**Sistema de gestão (ERP) financeiro pra pequenas/médias empresas brasileiras.** Tagline: *"Juntos, a gente dá conta do seu financeiro — seu negócio organizado, sua operação no controle."* Centraliza financeiro + fiscal + vendas + estoque + conta PJ, com **integração nativa ao contador**.

## Público

- **ME** (R$ 81k–360k/ano), **pequena** (360k–1,5M), **média** (1,5M+).
- **Contadores / BPO financeiro** — unidade de negócio dedicada (programa de parceria).
- Por segmento: comércio, serviços, saúde, consultoria, engenharia, educação, tecnologia, atacado.
- **Não é pra pessoa física / família** — é pro negócio (PJ).

## Módulos

Nota Fiscal (NF-e/NFS-e/NFC-e) · Gestão financeira (fluxo de caixa, extrato) · **Conta PJ** (com pagamentos) · Cobrança automática (SMS/WhatsApp/email) · Controle de estoque · Controle de vendas · Conciliação bancária · Relatórios · App (CA de Bolso) · **Conexão com Contador** · Conta AI Captura (captura de documento).

## Nota Fiscal — central

Primeira feature do hero. NF-e/NFS-e/NFC-e. Posicionamento de compliance: *"Diga adeus às multas"*, "Pronto para a Reforma Tributária". Emissão é o gancho de entrada.

## Integração com CONTADOR — o ponto de ouro (pro nosso /contadores)

**Muito central.** Modelo que vale copiar/estudar:
- *"Você emite a nota, a gente entrega pro cliente **e também pra sua contabilidade**."* — NF transmitida automático pro contador + cliente.
- Módulo **"Conexão com o contador"** (sync de documento/dados).
- **Programa de parceria** com contadores (área exclusiva `parceria.contaazul.com`, eventos, treinamento).
- Integração com **Domínio** (sistema contábil).

→ É o **gold standard BR** de "produto financeiro PJ que fala com o contador". Se a gente for pro segmento PJ/contador, **este é o fluxo de referência.**

## Preço (anual, com desconto)

| Plano | Pra quem | Mensal | Usuários |
|---|---|---|---|
| **Controle** | ME | R$ 309,90 (de 499,90) | 2 |
| **Avançado** | pequena | R$ 399,90 (de 649,90) | 5 |
| **Performance** | média | R$ 719,90 (de 929,90) | 15 |

**Pesado** (R$ 310–720/mês) — preço de ERP, não de app pessoal.

## Design

**Azul corporativo** (gradiente), dashboards densos (saldo PJ, a receber/a pagar, gráfico de vendas, fluxo de caixa, conciliações), badge Reforma Tributária. Tom B2B amigável ("a gente"). Suporte 0800 + WhatsApp. Selos AWS/Stone.

## Relação com a gente (honesta + oportunidade)

- **Concorrência com nosso core: nenhuma.** É ERP PJ pra empresa estabelecida; a gente é finanças pessoais/família B2C.
- **Oportunidade (o ponto que você levantou):** existe um **gap entre o pessoal e o ERP pesado.** Conta Azul é caro (R$ 310+/mês) e robusto demais pra **MEI / autônomo / família com um PJ pequeno**. Há espaço pra uma camada **leve**: finanças pessoais/família **+ um módulo PJ enxuto** (emitir NF simples, separar PF/PJ, conciliar) **com ponte pro contador** — sem virar ERP. Esse seria o **wedge** pro nosso `/contadores` + PJ, sem competir de frente com a Conta Azul.
- **Lição direta:** o **fluxo contador** da Conta Azul (emite NF → entrega auto pro cliente + contabilidade + área de parceiro) é o modelo a estudar pro nosso segmento contador.

## Veredito

Benchmark da adjacência **PJ + NF + contador** (não do core família). Não entra na matriz `COMPARATIVO_GERAL.md` (B2C família). Serve de referência **se/quando** a gente atacar o segmento PJ/contador — provável **wedge leve**, não ERP completo.
