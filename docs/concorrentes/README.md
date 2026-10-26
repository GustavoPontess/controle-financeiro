# Concorrentes

Análises de concorrentes do mercado de finanças pessoais BR. Cada pasta = um concorrente, navegado ao vivo e documentado (produto, design, preços, gaps).

| Concorrente | Pasta | Posicionamento | Resumo |
|---|---|---|---|
| **Pierre** (`pierre.finance`) | [`pierre/`](./pierre/) | IA-first + Open Finance, premium, individual | [README](./pierre/README.md) · [produto](./pierre/produto.md) · [design](./pierre/design.md) · [comparativo](./pierre/comparativo.md) |
| **Despezzas** (`despezzas.com.br`) | [`despezzas/`](./despezzas/) | Open Finance + IA, mobile-first, freemium barato, perfis compartilhados (família/PJ) | [README](./despezzas/README.md) · [produto](./despezzas/produto.md) · [design](./despezzas/design.md) · [comparativo](./despezzas/comparativo.md) |
| **Monarch** (`monarch.com`) | [`monarch/`](./monarch/) | Líder US de finanças pessoais (pós-Mint), **benchmark de finanças de casal**. Não opera no BR | [README](./monarch/README.md) · [produto](./monarch/produto.md) · [design](./monarch/design.md) · [comparativo](./monarch/comparativo.md) |
| **Conta Azul** (`contaazul.com`) 🔵 adjacente | [`conta-azul/`](./conta-azul/) | ERP PJ + emissão NF + **integração contador forte**. Referência do eixo PJ/contador | [README](./conta-azul/README.md) |
| **Bling** (`bling.com.br`) 🔵 adjacente | [`bling/`](./bling/) | ERP e-commerce/marketplace, NF leve e barata. Sem foco contador | [README](./bling/README.md) |
| **Emitfy** (`emitfy.com`) 🔵 adjacente | [`emitfy/`](./emitfy/) | **API de emissão de nota fiscal** (NF-e/NFS-e/NFC-e) pra ERP, software house e e-commerce. Fornecedor possível pro eixo PJ, não concorrente | [README](./emitfy/README.md) |
| **Qive** (`qive.com.br`) ⚠️ não-concorrente | [`qive/`](./qive/) | **B2B enterprise** — automação de Contas a Pagar / fiscal pra grandes empresas (CFO). Outro mercado | [README](./qive/README.md) |

> **📊 Leitura cruzada com o nosso produto:** [`COMPARATIVO_GERAL.md`](./COMPARATIVO_GERAL.md) — Pierre × Despezzas × Pontes (matriz de features, gaps priorizados, fosso, recomendações).
>
> **Processo de análise:** ver [`PROCESSO.md`](./PROCESSO.md) — playbook fixo, mesmo pra todo concorrente (Fase 1 site público → Fase 2 login → **para** → usuário loga → Fase 3 sistema interno + testes).

## Como ler

Comece pelo `README.md` de cada concorrente (resumo executivo + preços). Depois:
- `produto.md` — todas as telas/rotas e interações
- `design.md` — design system deles e o que aprender
- `comparativo.md` — comparação com o nosso produto, gaps e recomendações priorizadas

## Princípios da análise

- **Só observação.** Nunca inserir/alterar dados na conta do concorrente, nunca deixar rastro de que estamos analisando.
- Documentar **fatos** (o que a tela faz) separados de **opinião** (recomendações).
- Sempre fechar com **gaps priorizados** (impacto × custo) e o que **defender** do nosso fosso.
