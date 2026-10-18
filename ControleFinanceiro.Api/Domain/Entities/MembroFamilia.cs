using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class MembroFamilia
{
    public Guid Id { get; set; }

    public Guid FamiliaId { get; set; }
    public Familia? Familia { get; set; }

    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    /// <summary>Rótulo editável da relação do membro com a família (texto livre, ex. "Cônjuge").</summary>
    [Required]
    [MaxLength(60)]
    public string Papel { get; set; } = string.Empty;

    /// <summary>Feature 2.3 — papel de permissão (authz). Default Membro; o criador é Admin.</summary>
    public PapelFamilia PapelPermissao { get; set; } = PapelFamilia.Membro;

    /// <summary>O que a família vê da renda desta pessoa (renda-e-visibilidade.md §2.3). A renda em si não mora
    /// aqui: é derivada dos lançamentos e da <see cref="RendaPrevista"/> do mês. Só a própria pessoa muda.</summary>
    public VisibilidadeRenda VisibilidadeRenda { get; set; } = VisibilidadeRenda.SoPeso;

    /// <summary>Com <see cref="Domain.Enums.VisibilidadeRenda.ValorParaAlguns"/>: os usuários que veem o valor.</summary>
    public List<Guid> RendaVisivelPara { get; set; } = new();

    public DateTime EntrouEm { get; set; } = DateTime.UtcNow;

    public bool Ativo { get; set; } = true;
}
