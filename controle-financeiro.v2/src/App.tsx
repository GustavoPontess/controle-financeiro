import { Navigate, Route, Routes } from "react-router-dom"
import Protegido from "./auth/Protegido"
import V2Layout from "./layout/V2Layout"
import Entrar from "./telas/Entrar"
import Dashboard from "./telas/Dashboard"
import Transacoes from "./telas/Transacoes"
import Transacao from "./telas/Transacao"
import EmConstrucao from "./telas/EmConstrucao"

// Telas ainda não transformadas: navegam, mostram "em construção" e apontam pro app atual.
const PENDENTES: [string, string, string][] = [
  ["/transacoes/nova", "Nova transação", "/transactions/nova"],
  ["/cartoes", "Cartões", "/credit-cards"],
  ["/cartoes/:id", "Cartão", "/credit-cards"],
  ["/contas-fixas", "Contas fixas", "/assinaturas"],
  ["/relatorios", "Relatórios", "/reports"],
  ["/reconciliacao", "Reconciliação", "/reconciliacao"],
  ["/emprestimos", "Empréstimos", "/emprestimos"],
  ["/importar", "Importar extrato", "/importacao"],
  ["/bancos", "Bancos", "/accounts"],
  ["/categorias", "Categorias", "/categories"],
  ["/familias", "Famílias", "/familias"],
  ["/metas", "Metas", "/metas"],
  ["/limites", "Limites", "/limites"],
  ["/configuracoes", "Configurações", "/settings"],
]

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route element={<Protegido><V2Layout /></Protegido>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/transacoes" element={<Transacoes />} />
        <Route path="/transacoes/:id" element={<Transacao />} />
        <Route path="/transacoes/:id/editar" element={<Transacao />} />
        {PENDENTES.map(([rota, titulo, atual]) => (
          <Route key={rota} path={rota} element={<EmConstrucao titulo={titulo} atual={atual} />} />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
