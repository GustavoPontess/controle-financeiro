---
feature: notificacoes
issue: '#30'
status: CONCLUIDA
owner: Gustavo
created: 2026-05-18
---

# Feature — Notificações

Spec técnica da Issue #30 (Bloco D — Retenção e UX B2C).

Entrega: central de notificações no app. Eventos relevantes para o usuário
viram notificações persistidas, exibidas num sino com contador de não lidas.

**Escopo desta entrega:** notificações **in-app** (persistidas + central no
frontend). Entrega por **Web Push** e **e-mail transacional** fica para uma
etapa seguinte — exige VAPID keys / provedor SMTP e configuração de produção
que não dá para validar aqui. A modelagem já deixa o caminho aberto: cada
notificação é um registro; um worker de entrega pode consumi-las depois.

---

## 1. Eventos que geram notificação

| Evento | Destinatário | Origem |
|---|---|---|
| Novo convite de família | usuário convidado | `ConviteService.CriarAsync` |
| Despesa compartilhada lançada | demais membros da família | `DespesaCompartilhadaService.CompartilharAsync` |
| Acerto de contas registrado | quem recebeu o acerto | `AcertoService.RegistrarAsync` |

Vencimento de fatura e estouro de orçamento (jobs Hangfire) ficam para a etapa
de entrega — mesmos registros, geração agendada.

---

## 2. Entidade

### Notificacao
| Campo | Tipo | Notas |
|---|---|---|
| Id | Guid | PK |
| UsuarioId | Guid | destinatário |
| Tipo | int (enum) | classifica a notificação |
| Titulo | string(160) | linha principal |
| Mensagem | string(500) | detalhe |
| LinkRelativo | string(200)? | rota do app para abrir ao clicar |
| Lida | bool | false ao criar |
| CriadoEm | DateTime | UTC |

### Enum `TipoNotificacao`
```csharp
public enum TipoNotificacao
{
    ConviteFamilia = 1,
    DespesaCompartilhada = 2,
    AcertoContas = 3,
    FaturaVencendo = 4,
    OrcamentoEstourado = 5,
    Outro = 99,
}
```

---

## 3. Endpoints — `/api/v1/notificacoes`

| Método | Rota | Descrição |
|---|---|---|
| GET | `/notificacoes` | Lista as notificações do usuário (mais recentes primeiro) |
| GET | `/notificacoes/contagem` | Quantidade de não lidas |
| PUT | `/notificacoes/{id}/lida` | Marca uma como lida |
| PUT | `/notificacoes/lidas` | Marca todas como lidas |

---

## 4. DTOs

- `NotificacaoDto { Id, Tipo, Titulo, Mensagem, LinkRelativo?, Lida, CriadoEm }`
- `ContagemNotificacaoDto { int NaoLidas }`

---

## 5. Regras

- Notificação só é vista pelo próprio destinatário (`UsuarioId`).
- Criar notificação nunca derruba a operação de origem — falha de notificação
  é tolerada (não lança para o fluxo principal).
- Marcar como lida é idempotente.
- A geração de notificações na origem não notifica o próprio autor do evento.

---

## 6. Etapas de implementação

1. Spec + entidade `Notificacao` + enum + `AppDbContext` + migration + DTOs
2. `NotificacaoService` (criar, listar, contar não lidas, marcar lida(s)) +
   `NotificacoesController`
3. Integração: convite, despesa compartilhada e acerto geram notificação
4. Frontend: sino de notificações (contador + lista) no layout
5. Testes de serviço
