using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// A tabela de docs/PERMISSOES.md, linha a linha, contra <see cref="FamiliaPermissoes"/> (o único lugar da regra):
/// admin, membro, "só vê", quem saiu e quem é de fora. E os dois furos que a centralização fechou (2026-10-19): quem
/// "só vê" não ganha parte no "Do meu jeito" nem é parte no dinheiro entre vocês.
/// </summary>
public class QuemPodeOQueTests
{
    private sealed record Casa(AppDbContext Ctx, Guid FamiliaId, Guid Admin, Guid Membro, Guid SoVe, Guid Saiu, Guid DeFora);

    private static async Task<Casa> Build()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        Guid Pessoa(string nome)
        {
            var u = new Usuario { Id = Guid.NewGuid(), Email = $"{nome}@t.com", Nome = nome, PasswordHash = "x", Status = StatusUsuario.Ativo };
            ctx.Usuarios.Add(u);
            return u.Id;
        }
        var admin = Pessoa("admin"); var membro = Pessoa("membro"); var soVe = Pessoa("sove"); var saiu = Pessoa("saiu"); var deFora = Pessoa("fora");
        ctx.SaveChanges();
        var familia = await new FamiliaService(ctx).CriarAsync(new CriarFamiliaDto("Casa"), admin);
        void Membro(Guid u, PapelFamilia papel, bool ativo = true) => ctx.MembrosFamilia.Add(new MembroFamilia
            { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = u, Papel = "x", PapelPermissao = papel, Ativo = ativo });
        Membro(membro, PapelFamilia.Membro);
        Membro(soVe, PapelFamilia.Dependente);
        Membro(saiu, PapelFamilia.Membro, ativo: false);
        ctx.SaveChanges();
        return new Casa(ctx, familia.Id, admin, membro, soVe, saiu, deFora);
    }

    [Fact]
    public async Task VeAFamilia_SoQuemEstaAtivo_QualquerPapel()
    {
        var c = await Build();
        Assert.True(await FamiliaPermissoes.EhMembroAsync(c.Ctx, c.FamiliaId, c.Admin));
        Assert.True(await FamiliaPermissoes.EhMembroAsync(c.Ctx, c.FamiliaId, c.Membro));
        Assert.True(await FamiliaPermissoes.EhMembroAsync(c.Ctx, c.FamiliaId, c.SoVe));
        Assert.False(await FamiliaPermissoes.EhMembroAsync(c.Ctx, c.FamiliaId, c.Saiu));
        Assert.False(await FamiliaPermissoes.EhMembroAsync(c.Ctx, c.FamiliaId, c.DeFora));
    }

    [Fact]
    public async Task Lanca_AdminEMembro_NuncaQuemSoVe()
    {
        var c = await Build();
        Assert.True(await FamiliaPermissoes.LancaNaFamiliaAsync(c.Ctx, c.FamiliaId, c.Admin));
        Assert.True(await FamiliaPermissoes.LancaNaFamiliaAsync(c.Ctx, c.FamiliaId, c.Membro));
        Assert.False(await FamiliaPermissoes.LancaNaFamiliaAsync(c.Ctx, c.FamiliaId, c.SoVe));
        Assert.False(await FamiliaPermissoes.LancaNaFamiliaAsync(c.Ctx, c.FamiliaId, c.Saiu));
        Assert.False(await FamiliaPermissoes.LancaNaFamiliaAsync(c.Ctx, c.FamiliaId, c.DeFora));
        Assert.Equal(new[] { c.Admin, c.Membro }.OrderBy(x => x),
            (await FamiliaPermissoes.QuemLanca(c.Ctx, c.FamiliaId).Select(m => m.UsuarioId).ToListAsync()).OrderBy(x => x));
        Assert.False(FamiliaPermissoes.VeRendaDosOutros(PapelFamilia.Dependente));
        Assert.True(FamiliaPermissoes.VeRendaDosOutros(PapelFamilia.Membro));
    }

    [Fact]
    public async Task Exigencias_DeForaDa404_SemPoderDa403()
    {
        var c = await Build();
        await Assert.ThrowsAsync<KeyNotFoundException>(() => FamiliaPermissoes.ExigirMembroAsync(c.Ctx, c.FamiliaId, c.DeFora));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => FamiliaPermissoes.ExigirMembroAsync(c.Ctx, c.FamiliaId, c.Saiu));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => FamiliaPermissoes.ExigirLancarAsync(c.Ctx, c.FamiliaId, c.SoVe));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => FamiliaPermissoes.ExigirAdminAsync(c.Ctx, c.FamiliaId, c.Membro));
        Assert.Equal(PapelFamilia.Admin, await FamiliaPermissoes.ExigirAdminAsync(c.Ctx, c.FamiliaId, c.Admin));
    }

    [Fact]
    public async Task DividemFamilia_SoComOsDoisAtivos_NumaFamiliaAtiva()
    {
        var c = await Build();
        Assert.True(await FamiliaPermissoes.DividemFamiliaAsync(c.Ctx, c.Membro, c.SoVe));
        Assert.False(await FamiliaPermissoes.DividemFamiliaAsync(c.Ctx, c.Membro, c.Saiu));
        Assert.False(await FamiliaPermissoes.DividemFamiliaAsync(c.Ctx, c.Membro, c.DeFora));
        (await c.Ctx.Familias.SingleAsync()).Ativa = false;
        c.Ctx.SaveChanges();
        Assert.False(await FamiliaPermissoes.DividemFamiliaAsync(c.Ctx, c.Membro, c.Admin));
    }

    [Fact]
    public async Task DoMeuJeito_NaoDaParteProQuemSoVe()
    {
        var c = await Build();
        var t = new Transacao { Id = Guid.NewGuid(), Descricao = "Luz", Valor = 100m, Tipo = TipoTransacao.Despesa, CriadoPor = c.Admin, Data = new DateOnly(2026, 10, 1) };
        await Assert.ThrowsAsync<ArgumentException>(() => new RateioService(c.Ctx).CalcularPartesAsync(c.FamiliaId, t, ModoRateio.Personalizado,
            [new RateioItemDto(c.Admin, 50m), new RateioItemDto(c.SoVe, 50m)]));
    }

    [Fact]
    public async Task DinheiroEntreVoces_QuemSoVeNaoEParte()
    {
        var c = await Build();
        await Assert.ThrowsAsync<ArgumentException>(() => new AcertoService(c.Ctx, TestHelpers.Notif(c.Ctx), TestHelpers.EventLog(c.Ctx))
            .RegistrarAsync(c.FamiliaId, c.Admin, new RegistrarAcertoDto(c.Admin, c.SoVe, 10m, 10, 2026, null, Guid.NewGuid().ToString())));
    }
}
