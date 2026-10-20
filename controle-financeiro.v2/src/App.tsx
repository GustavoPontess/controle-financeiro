import { Navigate, Route, Routes, useParams } from "react-router-dom"
import Protegido from "./auth/Protegido"
import V2Layout from "./layout/V2Layout"
import Entrar from "./telas/Entrar"
import Cadastro from "./telas/Cadastro"
import RedefinirSenha from "./telas/RedefinirSenha"
import { Privacidade, TermosDeUso } from "./telas/Legal"
import ProtejaConta from "./telas/ProtejaConta"
import Dashboard from "./telas/Dashboard"
import Transacoes from "./telas/Transacoes"
import Transacao from "./telas/Transacao"
import Cartoes from "./telas/Cartoes"
import Cartao from "./telas/Cartao"
import CartaoParcelamentos from "./telas/CartaoParcelamentos"
import NovoCartao from "./telas/NovoCartao"
import EditarCartao from "./telas/EditarCartao"
import PagarFatura from "./telas/PagarFatura"
import Parcelamento from "./telas/Parcelamento"
import AnteciparParcela from "./telas/AnteciparParcela"
import ContasFixas from "./telas/ContasFixas"
import ContaFixa from "./telas/ContaFixa"
import EditarContaFixa from "./telas/EditarContaFixa"
import ProximaCobranca from "./telas/ProximaCobranca"
import Bancos from "./telas/Bancos"
import Categorias from "./telas/Categorias"
import EditarCategoria from "./telas/EditarCategoria"
import EditarSubcategoria from "./telas/EditarSubcategoria"
import ExcluirCategoria from "./telas/ExcluirCategoria"
import ImportarExtrato from "./telas/ImportarExtrato"
import Reconciliacao from "./telas/Reconciliacao"
import Renda from "./telas/Renda"
import Familias from "./telas/Familias"
import NovaFamilia from "./telas/NovaFamilia"
import FamiliaVisaoGeral from "./telas/FamiliaVisaoGeral"
import FamiliaTransacoes from "./telas/FamiliaTransacoes"
import FamiliaContasFixas from "./telas/FamiliaContasFixas"
import FamiliaEntreVoces from "./telas/FamiliaEntreVoces"
import FamiliaMembros from "./telas/FamiliaMembros"
import FamiliaPessoa from "./telas/FamiliaPessoa"
import FamiliaDependente from "./telas/FamiliaDependente"
import FamiliaRegras from "./telas/FamiliaRegras"
import Metas from "./telas/Metas"
import MetaFormulario from "./telas/MetaFormulario"
import MetaPagina from "./telas/MetaPagina"
import Limites from "./telas/Limites"
import LimiteFormulario from "./telas/LimiteFormulario"
import MovimentoMeta from "./telas/MovimentoMeta"
import ConvidarMembro from "./telas/ConvidarMembro"
import Dependente from "./telas/Dependente"
import NovoAcerto from "./telas/NovoAcerto"
import NovaConta from "./telas/NovaConta"
import EditarConta from "./telas/EditarConta"
import EncerrarConta from "./telas/EncerrarConta"
import NovaTransacao from "./telas/NovaTransacao"
import NovaContaFixa from "./telas/NovaContaFixa"
import Notificacoes from "./telas/Notificacoes"
import Configuracoes from "./telas/Configuracoes"
import EmConstrucao from "./telas/EmConstrucao"
import Emprestimos from "./telas/Emprestimos"
import EmprestimoFormulario from "./telas/EmprestimoFormulario"
import RegistrarEmprestimo from "./telas/RegistrarEmprestimo"
import ConvidarEmprestimo from "./telas/ConvidarEmprestimo"
import ConfirmarPagamentoEmprestimo from "./telas/ConfirmarPagamentoEmprestimo"

// Telas ainda não transformadas: navegam, mostram "em construção" e apontam pro app atual.
const PENDENTES: [string, string, string][] = [
  ["/relatorios", "Relatórios", "/reports"],
]

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/termos-de-uso" element={<TermosDeUso />} />
      <Route path="/privacidade" element={<Privacidade />} />
      <Route path="/proteja-sua-conta" element={<Protegido><ProtejaConta /></Protegido>} />
      <Route element={<Protegido><V2Layout /></Protegido>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/transacoes" element={<Transacoes />} />
        <Route path="/transacoes/nova" element={<NovaTransacao />} />
        <Route path="/transacoes/:id" element={<Transacao />} />
        <Route path="/transacoes/:id/editar" element={<Transacao />} />
        <Route path="/cartoes" element={<Cartoes />} />
        <Route path="/contas-fixas" element={<ContasFixas />} />
        <Route path="/contas-fixas/nova" element={<NovaContaFixa />} />
        <Route path="/contas-fixas/:id" element={<ContaFixa />} />
        <Route path="/contas-fixas/:id/editar" element={<EditarContaFixa />} />
        <Route path="/contas-fixas/:id/proxima" element={<ProximaCobranca />} />
        <Route path="/bancos" element={<Bancos />} />
        <Route path="/categorias" element={<Categorias />} />
        <Route path="/importar" element={<ImportarExtrato />} />
        <Route path="/reconciliacao" element={<Reconciliacao />} />
        <Route path="/renda" element={<Renda />} />
        <Route path="/metas" element={<Metas />} />
        <Route path="/emprestimos" element={<Emprestimos />} />
        <Route path="/emprestimos/novo" element={<EmprestimoFormulario />} />
        <Route path="/emprestimos/:id/registrar" element={<RegistrarEmprestimo />} />
        <Route path="/emprestimos/:id/convidar" element={<ConvidarEmprestimo />} />
        <Route path="/emprestimos/pagamentos/:id/confirmar" element={<ConfirmarPagamentoEmprestimo />} />
        <Route path="/metas/nova" element={<MetaFormulario />} />
        <Route path="/metas/:id" element={<MetaPagina />} />
        <Route path="/limites" element={<Limites />} />
        <Route path="/limites/novo" element={<LimiteFormulario modo="novo" />} />
        <Route path="/limites/editar" element={<LimiteFormulario modo="editar" />} />
        <Route path="/metas/:id/editar" element={<MetaFormulario />} />
        <Route path="/metas/:id/guardar" element={<MovimentoMeta modo="guardar" />} />
        <Route path="/metas/:id/resgatar" element={<MovimentoMeta modo="resgatar" />} />
        <Route path="/metas/:id/concluir" element={<MovimentoMeta modo="concluir" />} />
        <Route path="/familias" element={<Familias />} />
        <Route path="/familias/nova" element={<NovaFamilia />} />
        {/* Espaço da família: cada item do menu é uma página (modelo Notion/Slack, 2026-10-18). */}
        <Route path="/familias/:id" element={<FamiliaVisaoGeral />} />
        <Route path="/familias/:id/transacoes" element={<FamiliaTransacoes />} />
        <Route path="/familias/:id/contas-fixas" element={<FamiliaContasFixas />} />
        <Route path="/familias/:id/despesas" element={<ParaFamilia pagina="transacoes" />} />
        <Route path="/familias/:id/entre-voces" element={<FamiliaEntreVoces />} />
        <Route path="/familias/:id/membros" element={<FamiliaMembros />} />
        <Route path="/familias/:id/membros/:membroId" element={<FamiliaPessoa />} />
        {/* Dependentes moram em Membros desde 2026-10-19: o endereço antigo leva pra lá. */}
        <Route path="/familias/:id/dependentes" element={<ParaFamilia pagina="membros" />} />
        <Route path="/familias/:id/regras" element={<FamiliaRegras />} />
        <Route path="/familias/:id/convidar" element={<ConvidarMembro />} />
        <Route path="/familias/:id/dependentes/novo" element={<Dependente />} />
        <Route path="/familias/:id/dependentes/:depId" element={<FamiliaDependente />} />
        <Route path="/familias/:id/dependentes/:depId/editar" element={<Dependente />} />
        <Route path="/familias/:id/acertos/novo" element={<NovoAcerto />} />
        <Route path="/categorias/nova" element={<EditarCategoria />} />
        <Route path="/categorias/:id/editar" element={<EditarCategoria />} />
        <Route path="/categorias/:id/excluir" element={<ExcluirCategoria />} />
        <Route path="/categorias/:id/subcategorias/nova" element={<EditarSubcategoria nova />} />
        <Route path="/subcategorias/:id/editar" element={<EditarSubcategoria />} />
        <Route path="/subcategorias/:id/excluir" element={<ExcluirCategoria sub />} />
        <Route path="/bancos/nova" element={<NovaConta />} />
        <Route path="/bancos/:id/editar" element={<EditarConta />} />
        <Route path="/bancos/:id/encerrar" element={<EncerrarConta />} />
        <Route path="/cartoes/novo" element={<NovoCartao />} />
        <Route path="/cartoes/:id" element={<Cartao />} />
        <Route path="/cartoes/:id/editar" element={<EditarCartao />} />
        <Route path="/cartoes/:id/parcelamentos" element={<CartaoParcelamentos />} />
        <Route path="/cartoes/:id/parcelamentos/:pid" element={<Parcelamento />} />
        <Route path="/cartoes/:id/parcelamentos/:pid/parcelas/:parcelaId/antecipar" element={<AnteciparParcela />} />
        <Route path="/cartoes/:id/faturas/:faturaId/pagar" element={<PagarFatura />} />
        <Route path="/notificacoes" element={<Notificacoes />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        {PENDENTES.map(([rota, titulo, atual]) => (
          <Route key={rota} path={rota} element={<EmConstrucao titulo={titulo} atual={atual} />} />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

/** Endereço antigo da família → a página de agora (despesas → Transações; dependentes → Membros). */
function ParaFamilia({ pagina }: { pagina: string }) {
  const { id = "" } = useParams<{ id: string }>()
  return <Navigate to={`/familias/${id}/${pagina}`} replace />
}
