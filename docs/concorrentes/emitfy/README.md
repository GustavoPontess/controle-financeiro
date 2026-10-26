# Emitfy — análise (adjacente: infraestrutura fiscal, API de nota)

> `emitfy.com` e `emitfy.com/erp`, 2026-10-26 (Fase 1, site público; sem conta). **Não é concorrente do nosso core B2C família.** É **API de emissão de nota fiscal** (NF-e, NFC-e, NFS-e, CT-e, MDF-e) pra quem já tem sistema: ERP próprio, software house e grupo com vários CNPJs. Documentado pra fechar o mapa PJ/NF e como referência de site B2B enxuto.

## O que é

"Seu ERP fatura. A Emitfy emite." A empresa (EMITFY B2B LTDA, CNPJ 59.517.578/0001-62; cidade e fundadores não aparecem) vende **só a camada de emissão**: o sistema do cliente chama a API, ela fala com a SEFAZ e as prefeituras, refaz o que falha e devolve PDF + XML por webhook. A página diz com todas as letras o que **não** é: não é ERP, não tem estoque, financeiro nem PDV.

Na home, o mesmo motor vendido pro infoprodutor e pro e-commerce: nota automática a cada venda aprovada na Hotmart, Kiwify, Nuvemshop etc.

## Público

Desenvolvedor e gestor de ERP (página `/erp`); infoprodutor, loja virtual, prestador, MEI, agência, afiliado (home). "Contadores" aparece só no rodapé. **Não é pra pessoa física nem família.**

## O que a API cobre

- Documentos: NF-e, NFS-e, NFC-e, CT-e, CT-e OS, MDF-e. Cancelamento, carta de correção, inutilização de faixa, XML de rejeição.
- Empresas e certificado A1 pela API; vários CNPJs numa credencial só, cada um com sua configuração fiscal.
- Produtos (NCM, CFOP, tributos) e clientes salvos; emissão pelo SKU.
- Notas recebidas contra o CNPJ: sincronização, XML, manifestação do destinatário.
- Consultas: NCM, NBS, CFOP, CNAE, CEST, código de serviço.
- **Idempotência por id do pedido** (nota não duplica), POST assíncrono com webhook de status.
- SDKs em Node/TypeScript, PHP, Python, .NET e Java; **MCP** pra assistente de IA; documentação pública (`docs.emitfy.com`).
- Sem sandbox: toda emissão é em produção, com validade fiscal. Começa com 10 notas grátis, sem cartão.

## Preço (mensal)

| Plano | Preço | Notas/mês | CNPJs |
|---|---|---|---|
| Ruby (só painel/integrações) | R$ 97 (R$ 970/ano) | 300 | 1 |
| Emerald (primeiro com API) | R$ 187 | 800 | 3 |
| Amethyst | R$ 247 | 2.000 | 5 |
| Diamond | R$ 397 | 5.000 | 15 |
| Sapphire | R$ 697 (R$ 6.970/ano) | 10.000 | 50 |

Nota extra de R$ 0,18 a R$ 0,69 conforme o plano. Sem adesão, garantia de 7 dias, cupom OUT15 (15% na primeira cobrança). Também vendem certificado digital A1.

## Prova social e confiança

**Nenhuma prova social real:** sem depoimento, sem logo de cliente, sem volume de notas. Os painéis e conversas de suporte na home estão marcados como "ilustrativo/fictício" (honesto, mas fraco). O que passa confiança é o produto: documentação aberta, SDKs, idempotência, webhooks, "o que falhar a gente refaz".

## Design

Claro, fundo branco com cartões levemente bege, **laranja como cor única** (logo, botão principal, números dos passos, pontinhos), título grande em sans com a segunda frase em **serifa itálica** ("Seu ERP fatura. *A Emitfy emite.*", "Do pedido à entrada *de mercadoria*."). Menu em pílula flutuante, barra de promoção no topo, cartões com borda fina, diagrama de 3 passos (pedido → API → webhook) no lugar de mock, exemplo de código, tabela "tela do ERP → rota da API", passos numerados em bolinhas. Botão flutuante de WhatsApp. Tom: frases curtas e afirmativas ("Um pedido, uma chamada."), técnico sem explicar demais.

## Relação com a gente

- **Concorrência com o core: nenhuma.** Outro mercado (B2B fiscal, por API).
- **Relevância:** o eixo `/contadores` e o PJ. Se um dia o Pontes emitir nota pra MEI/prestador (o "wedge leve" anotado no Bling), **não construir emissão fiscal: plugar uma API assim** (ou similar: Focus NFe, eNotas, NFE.io). A Emitfy cobra R$ 187/mês pelo plano com API, o que mata a conta pra um app B2C barato; só faria sentido num plano Contador/PJ pago.
- **Lições pro nosso site (B2B/contador):** dizer o que o produto **não é** tira objeção; diagrama do fluxo no lugar de mock; tabela "sua tela → nossa função"; "comece grátis sem cartão" + garantia.
- **Lição de produto:** idempotência por id do pedido e webhook de status são exatamente o padrão `Idempotency-Key` + `RegistroIdempotencia` que já temos. Bom sinal.
- **Não copiar:** mock e depoimento "fictício" na home. Preferimos o que fizemos no v2: print real do app e etiqueta "exemplo" só onde ainda não tem dado.

## Veredito

Adjacência distante (API fiscal). Não entra na matriz `COMPARATIVO_GERAL.md`. Entra no mapa PJ/NF como **fornecedor possível**, não como concorrente. Referência de site B2B enxuto e honesto.
