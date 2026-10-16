using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Categoria
{
    /// <summary>Criar ou editar categoria do usuário: nome (até 100) e tipo (1 despesa, 2 receita, 3 as duas).</summary>
    public class CriarCategoriaDto
    {
        [MaxLength(100)]
        public string Descricao { get; set; } = string.Empty;
        public int Finalidade { get; set; }
    }

    /// <summary>
    /// O que aponta pra categoria. Lançamentos e contas fixas contam só os vivos (o que a pessoa vê); ao excluir,
    /// os excluídos também vão pro destino.
    /// </summary>
    public class UsoCategoriaDto
    {
        public int Lancamentos { get; set; }
        public int ContasFixas { get; set; }
        public int Parcelamentos { get; set; }
        public int Limites { get; set; }
        public int Metas { get; set; }
        public int Subcategorias { get; set; }
        /// <summary>Lançamentos excluídos que ainda apontam pra ela (seguem no banco, no histórico).</summary>
        public int LancamentosExcluidos { get; set; }
        /// <summary>Alguma coisa aponta pra ela (inclusive excluída): excluir exige escolher o destino.</summary>
        public bool PrecisaDestino { get; set; }
    }
}
