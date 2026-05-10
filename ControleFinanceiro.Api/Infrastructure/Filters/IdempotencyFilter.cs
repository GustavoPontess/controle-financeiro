using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ControleFinanceiro.Api.Infrastructure.Filters;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class IdempotencyAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var idempotencyKey = context.HttpContext.Request.Headers["Idempotency-Key"].ToString();

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
            context.HttpContext.Items["IdempotencyKey"] = idempotencyKey;

        await next();
    }
}
