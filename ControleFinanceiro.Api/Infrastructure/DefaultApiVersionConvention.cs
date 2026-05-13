using Asp.Versioning.Conventions;
using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace ControleFinanceiro.Api.Infrastructure;

/// <summary>
/// Convention global que aplica automaticamente ApiVersion 1.0
/// e reescreve as rotas de "api/..." para "api/v{version:apiVersion}/..."
/// em todos os controllers, sem precisar decorar cada um individualmente.
/// </summary>
public class DefaultApiVersionConvention : IControllerConvention
{
    public bool Apply(IControllerConventionBuilder builder, ControllerModel controller)
    {
        builder.HasApiVersion(1, 0);

        foreach (var selector in controller.Selectors)
        {
            var template = selector.AttributeRouteModel?.Template;
            if (template != null &&
                template.StartsWith("api/", StringComparison.OrdinalIgnoreCase) &&
                !template.Contains("version", StringComparison.OrdinalIgnoreCase))
            {
                selector.AttributeRouteModel!.Template =
                    "api/v{version:apiVersion}/" + template["api/".Length..];
            }
        }

        return true;
    }
}
