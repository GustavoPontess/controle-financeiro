import { lazy, Suspense } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import Protegido from "./auth/Protegido"
import type { NomePagina } from "./site/PaginaSite"
import Entrar from "./telas/Entrar"
import Cadastro from "./telas/Cadastro"
import RedefinirSenha from "./telas/RedefinirSenha"
import { Privacidade, TermosDeUso } from "./telas/Legal"
import { ConfirmarEmail, NaoFuiEu, NaoPediSenha } from "./telas/LinkDoPedido"
import ProtejaConta from "./telas/ProtejaConta"

// Dois pacotes à parte, cada um baixado só quando precisa (2026-10-26, pro site abrir rápido no celular):
// o site público (HTML das 7 páginas) e o app logado inteiro (menu + telas, RotasApp.tsx).
const PaginaSiteSobDemanda = lazy(() => import("./site/PaginaSite"))
const PaginaSite = ({ nome }: { nome: NomePagina }) => <Suspense fallback={null}><PaginaSiteSobDemanda nome={nome} /></Suspense>
const RotasApp = lazy(() => import("./RotasApp"))

// "Proteja sua conta" exige login. Só em dev, aberta pela barra de estados (#estado no endereço), abre sem login pra ver o passo.
function RotaProteja() {
  const { hash } = useLocation()
  return import.meta.env.DEV && hash ? <ProtejaConta /> : <Protegido><ProtejaConta /></Protegido>
}

export default function App() {
  return (
    <Routes>
      {/* Site público: idêntico ao rascunho aprovado (hub Pontes Dev). "/" logado vai pra Visão geral. */}
      <Route path="/" element={<PaginaSite nome="home" />} />
      <Route path="/recursos" element={<PaginaSite nome="recursos" />} />
      <Route path="/casa" element={<PaginaSite nome="casa" />} />
      <Route path="/contadores" element={<PaginaSite nome="contadores" />} />
      <Route path="/planos" element={<PaginaSite nome="planos" />} />
      <Route path="/seguranca" element={<PaginaSite nome="seguranca" />} />
      <Route path="/sobre" element={<PaginaSite nome="sobre" />} />
      <Route path="/entrar" element={<Entrar />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/confirmar-email" element={<ConfirmarEmail />} />
      <Route path="/nao-fui-eu" element={<NaoFuiEu />} />
      <Route path="/nao-pedi-senha" element={<NaoPediSenha />} />
      <Route path="/termos-de-uso" element={<TermosDeUso />} />
      <Route path="/privacidade" element={<Privacidade />} />
      <Route path="/proteja-sua-conta" element={<RotaProteja />} />
      {/* Todo o resto é o app logado (RotasApp.tsx): tela nova entra lá. */}
      <Route path="/*" element={<Suspense fallback={null}><RotasApp /></Suspense>} />
    </Routes>
  )
}
