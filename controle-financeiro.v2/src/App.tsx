import { Navigate, Route, Routes } from "react-router-dom"
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
import NovaConta from "./telas/NovaConta"
import EditarConta from "./telas/EditarConta"
import EncerrarConta from "./telas/EncerrarConta"
import NovaTransacao from "./telas/NovaTransacao"
import NovaContaFixa from "./telas/NovaContaFixa"
import Notificacoes from "./telas/Notificacoes"
import Configuracoes from "./telas/Configuracoes"
import EmConstrucao from "./telas/EmConstrucao"

// Telas ainda não transformadas: navegam, mostram "em construção" e apontam pro app atual.
const PENDENTES: [string, string, string][] = [
  ["/relatorios", "Relatórios", "/reports"],
  ["/reconciliacao", "Reconciliação", "/reconciliacao"],
  ["/emprestimos", "Empréstimos", "/emprestimos"],
  ["/importar", "Importar extrato", "/importacao"],
  ["/categorias", "Categorias", "/categories"],
  ["/familias", "Famílias", "/familias"],
  ["/metas", "Metas", "/metas"],
  ["/limites", "Limites", "/limites"],
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
