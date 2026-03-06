using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Mvc;
using ControleFinanceiro.Api.DTOs.Relatorios;

namespace ControleFinanceiro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RelatoriosController : ControllerBase
    {
        private readonly RelatorioService _service;

        public RelatoriosController(RelatorioService service)
        {
            _service = service;
        }

        [HttpGet("totais-por-pessoa")]
        [ProducesResponseType(typeof(RelatorioTotaisPessoaDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> ObterTotaisPorPessoa()
        {
            var relatorio = await _service.ObterTotaisPorPessoaAsync();
            return Ok(relatorio);
        }
    }
}