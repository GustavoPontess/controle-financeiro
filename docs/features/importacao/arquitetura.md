---
feature: importacao
issue: '#27'
status: CONCLUIDA
owner: Gustavo
created: 2026-05-18
---

# Feature — Importação de extrato OFX/CSV

Spec técnica da Issue #27 (Bloco D — Retenção e UX B2C).

Entrega: o usuário sobe o extrato do banco (OFX ou CSV), o sistema lê as
transações, marca prováveis duplicatas, sugere categoria e mostra uma tela de
revisão. Nada é salvo até o usuário aprovar.

**Por que crítica:** sem importação o usuário lança cada despesa na mão — maior
causa de abandono em apps de finanças pessoais.

---

## 1. Fluxo

1. Usuário escolhe a conta de destino e envia o arquivo.
2. Backend faz o **parse** (OFX ou CSV), **deduplica** contra o que já existe e
   **sugere categoria** por palavra-chave.
3. Frontend mostra a **tela de revisão**: cada linha com data, descrição, valor,
   tipo, categoria sugerida e flag de duplicata. Duplicatas vêm desmarcadas.
4. Usuário ajusta/aprova e confirma. Só então as transações são criadas.

---

## 2. Entidade (alteração)

`Transacao` ganha `ImportacaoFitId` (`string?`, nullable) — o `FITID` do OFX,
identificador único da transação no banco. Usado para deduplicar reimportações.
CSV não tem FITID — dedup de CSV é heurística (conta + data + valor + descrição).

---

## 3. Parsing

### OFX
OFX 1.x é SGML (tags às vezes sem fechamento); OFX 2.x é XML. Parser tolerante,
linha a linha, extrai os blocos `<STMTTRN>`:

| Tag OFX | Uso |
|---|---|
| `<DTPOSTED>` | data (YYYYMMDD[HHMMSS]) |
| `<TRNAMT>` | valor (negativo = despesa, positivo = receita) |
| `<FITID>` | id único da transação |
| `<MEMO>` / `<NAME>` | descrição |

### CSV
Delimitador detectado (`;` ou `,`). Colunas identificadas por cabeçalho
(`data`, `descrição`/`histórico`/`lançamento`, `valor`) com fallback posicional
(data, descrição, valor). Valor aceita `R$`, separador de milhar `.` e decimal
`,`. Sinal do valor define o tipo.

---

## 4. Deduplicação

- **OFX:** linha é duplicata se já existe `Transacao` ativa com o mesmo
  `ImportacaoFitId`.
- **CSV:** duplicata se já existe `Transacao` ativa na mesma conta com mesma
  data, mesmo valor e mesma descrição.

Duplicatas vêm na preview com `Duplicada = true` e desmarcadas por padrão — o
usuário pode forçar a importação.

---

## 5. Sugestão de categoria

Regra por palavra-chave (MVP, sem ML): a descrição é comparada (case-insensitive)
com as categorias do usuário e padrão. Match simples por substring do nome da
categoria na descrição. Sem match = sem sugestão (usuário escolhe).

---

## 6. Endpoints — `/api/v1/importacao`

| Método | Rota | Descrição |
|---|---|---|
| POST | `/importacao/preview` | multipart: `arquivo` + `contaId`. Retorna a preview parseada |
| POST | `/importacao/confirmar` | JSON: conta + linhas aprovadas. Cria as transações |

Limite de tamanho do arquivo: 2 MB. Formatos aceitos: `.ofx`, `.csv`.

---

## 7. DTOs

- `ExtratoLinhaDto { DateTime Data, string Descricao, decimal Valor, TipoTransacao Tipo, string? FitId, bool Duplicada, Guid? CategoriaSugeridaId, string? CategoriaSugeridaNome }`
- `PreviewImportacaoDto { List<ExtratoLinhaDto> Linhas, int Total, int Duplicadas }`
- `LinhaImportarDto { DateTime Data, string Descricao, decimal Valor, TipoTransacao Tipo, string? FitId, Guid? CategoriaId }`
- `ConfirmarImportacaoDto { Guid ContaId, List<LinhaImportarDto> Linhas }`

---

## 8. Regras

- A conta de destino deve pertencer ao usuário.
- Importação só cria transações em **conta** (não cartão) nesta entrega.
- Cada transação criada reaproveita `TransacaoService.CriarTransacaoAsync`
  (mantém saldo, log e validações consistentes).
- `Tipo` derivado do sinal do valor: negativo = Despesa, positivo = Receita.
- Linhas marcadas como duplicata podem ser importadas se o usuário insistir —
  a decisão final é do usuário na tela de revisão.

---

## 9. Etapas de implementação

1. Spec + `Transacao.ImportacaoFitId` + migration + DTOs
2. `ExtratoImportService` — parsers OFX e CSV
3. Preview + confirmar (`ImportacaoController`) — dedup + sugestão de categoria
4. Frontend: página de importação (upload + tela de revisão)
5. Testes de serviço (parsers + dedup)
