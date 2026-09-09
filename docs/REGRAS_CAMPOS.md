---
owner: Gustavo
last_reviewed: 2026-09-09
status: ATIVO
---

# Regras de campos & formulários (segurança de input)

**Leitura obrigatória antes de criar/editar qualquer campo ou formulário.** Objetivo: você não
precisar re-pensar segurança de input toda vez — as regras estão aqui, é só seguir a tabela.

> **Por que isso importa:** é app de dinheiro + dados pessoais. Campo sem limite = alguém manda
> texto gigante ("caracteres infinitos") e enche/trava o sistema; campo sem tipo/obrigatório =
> dado inválido entra e quebra a lógica depois. Regra do projeto: nada que toca input sobe sem isso.

---

## ✅ Checklist — todo campo novo

Pra CADA campo de um DTO de entrada (o que vem no corpo da requisição):

1. **Tipo correto** — usa o tipo certo (`decimal` pra dinheiro, `int` pra quantidade, `Guid` pra id,
   `DateTime` pra data, enum pra opção fixa). Nunca `string` pra o que é número/data/opção.
2. **Obrigatório?** — se o campo é necessário, `[Required]`. Se é opcional, deixa anulável (`string?`,
   `int?`) e SEM `[Required]`.
3. **Limite de tamanho** — todo `string` de entrada leva `[MaxLength(N)]` (ver tabela abaixo).
4. **Faixa de valor** — todo número com faixa conhecida leva `[Range(min, max)]` (dia 1-31, etc.).
5. **Formato** — e-mail leva `[EmailAddress]`; formatos fixos (ex.: `yyyy-MM`) levam
   `[RegularExpression(...)]`.
6. **Espelhar na entidade** — o campo equivalente na entidade (`Domain/Entities/`) leva o mesmo
   `[MaxLength(N)]` (limite também no banco, não só na borda).
7. **Espelhar no frontend** — o input correspondente leva `maxLength` igual ao do DTO + o controle
   Pontes certo (ver seção Frontend).

**Não precisa validar:** DTO de **resposta** (saída) — é dado que a gente gera, não recebe. Só os de
entrada (`Criar*`, `Editar*`, `Atualizar*`, `*Request`, login/reset, etc.).

---

## 📏 Tabela de limites padrão

Use estes como default. Ajuste só com motivo.

| Tipo de campo | Anotação | Limite |
|---|---|---|
| Nome de pessoa | `[Required][MaxLength(200)]` | 200 |
| Nome curto (conta, cartão, categoria, banco) | `[Required][MaxLength(100)]` | 100 |
| Nome de subcategoria / meta | `[Required][MaxLength(120)]` | 120 |
| E-mail | `[Required][EmailAddress][MaxLength(255)]` | 255 |
| Senha | `[Required][MaxLength(128)]` | 128 (teto; mín. 15 no `PasswordPolicyService`) |
| Descrição curta (transação, transferência) | `[MaxLength(255)]` | 255 |
| Descrição de parcelamento/recorrente | `[Required][MaxLength(400)]` | 400 |
| Observação / motivo (texto livre longo) | `[MaxLength(1000)]` | 1000 |
| Motivo de cancelamento | `[Required][MaxLength(400)]` | 400 |
| Código MFA/OTP | `[Required][MaxLength(10)]` | 10 |
| Token opaco (reset, refresh, challenge) | `[Required][MaxLength(512)]` | 512 |
| IdempotencyKey | `[Required][MaxLength(100)]` | 100 |
| Cor (hex) | `[MaxLength(20)]` | 20 |
| Ícone (nome) | `[MaxLength(60)]` | 60 |
| Últimos dígitos do cartão | `[MaxLength(4)]` | 4 |
| Papel/label curto | `[Required][MaxLength(30)]` | 30 |

**Faixas numéricas padrão:**

| Campo | Anotação |
|---|---|
| Dia (fechamento/vencimento) | `[Range(1, 31)]` |
| Mês | `[Range(1, 12)]` |
| Ano | `[Range(2000, 2100)]` |
| Parcelas | `[Range(2, 36)]` |
| Percentual | `[Range(0, 100)]` |
| Valor monetário (quando deve ser positivo) | `[Range(0.01, double.MaxValue)]` |

---

## Backend — como aplicar

**Classe (DTO comum):**
```csharp
using System.ComponentModel.DataAnnotations;

public class CriarAlgoDto
{
    [Required]
    [MaxLength(200)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Observacao { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }
}
```

**Record posicional** (precisa de `[property: ...]`, senão a anotação vai no parâmetro e o
`ModelState` não enxerga):
```csharp
public record CriarAlgoDto(
    [property: Required, EmailAddress, MaxLength(255)] string Email,
    [property: Required, MaxLength(30)] string Papel);
```

**Quem valida:** o `[ApiController]` valida o `ModelState` **automaticamente** e devolve **400** com a
mensagem — você NÃO precisa checar na mão no controller/service. Só anotar.

**Backstop global:** o Kestrel limita o corpo de qualquer requisição a **10 MB** (`Program.cs`,
`MaxRequestBodySize`) — rede de segurança contra payload gigante, além do limite por campo.

---

## Frontend — como aplicar

- **`maxLength`** no input, igual ao limite do DTO (defesa em profundidade + UX: o usuário não digita
  além do que o backend aceita).
- **Controle certo da biblioteca Pontes pelo tipo:** `PontesMoneyInput` pra dinheiro, `PontesDateInput`
  pra data, `PontesSelect` pra opção fixa, `type="number"`/`inputMode` pra número. Nunca um input de
  texto solto pra o que é número/data.
- **Validação por campo** (obrigatório, já é padrão do projeto): `PontesField error=` + `invalid` no
  controle, bloqueia submit, erro inline (nunca toast pra campo). Detalhe em `STANDARDS.md` →
  "Validação de formulários".

---

## Aplicar em campo ANTIGO

Achou um campo/DTO antigo sem essas regras? **Boy-scout:** arruma na hora (mesmo critério da tabela)
ou, se for grande, cataloga em `ROADMAP.md`. O sweep inicial (2026-09-09) cobriu os DTOs de entrada
existentes — histórico em `docs/history/ROADMAP_CONCLUIDO.md`.
