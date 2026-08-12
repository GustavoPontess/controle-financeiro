import { useState } from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import {
  palettes, fonts,
  PontesButton, PontesIconButton, PontesField, PontesInput, PontesMoneyInput, PontesSelect,
  PontesToggle, PontesCheckbox, PontesBadge, PontesAvatar, PontesAlert,
  PontesProgress, PontesStatCard, PontesCategoryDonut, PontesCard, PontesTabs, PontesLogoMark,
  PontesSidebarItem, PontesChoiceCards, PontesGroupedSelect,
  PontesModal, PontesDialog,
  PontesTable, PontesTablePagination,
  PONTES_TABLE_PAGE_SIZE_DEFAULT, PONTES_TABLE_PAGE_SIZE_MAX, PONTES_TABLE_PAGE_SIZES,
} from "../../components/pontes"

const p = palettes[0]
const font = fonts[0].family

describe("Biblioteca Pontes — smoke tests (#101)", () => {
  it("PontesButton renderiza children e dispara onClick", () => {
    let clicked = 0
    render(<PontesButton p={p} font={font} onClick={() => clicked++}>Salvar</PontesButton>)
    fireEvent.click(screen.getByText("Salvar"))
    expect(clicked).toBe(1)
  })

  it("PontesButton em loading state mostra spinner e fica disabled", () => {
    let clicked = 0
    render(<PontesButton p={p} font={font} loading onClick={() => clicked++}>Salvando</PontesButton>)
    fireEvent.click(screen.getByText("Salvando"))
    expect(clicked).toBe(0)
  })

  it("PontesLogoMark renderiza o P e dispara onClick", () => {
    let clicked = 0
    render(<PontesLogoMark color={p.primary} size={28} onClick={() => clicked++} />)
    const mark = screen.getByText("P")
    expect(mark).toBeInTheDocument()
    fireEvent.click(mark)
    expect(clicked).toBe(1)
  })

  it("PontesSidebarItem renderiza label e dispara onClick", () => {
    let clicked = 0
    render(<PontesSidebarItem p={p} font={font} icon={<span>i</span>} label="Dashboard" active onClick={() => clicked++} />)
    fireEvent.click(screen.getByText("Dashboard"))
    expect(clicked).toBe(1)
  })

  it("PontesSidebarItem colapsado marca data-collapsed (label recolhido via CSS)", () => {
    render(<PontesSidebarItem p={p} font={font} icon={<span>i</span>} label="Transações" collapsed />)
    // label fica no DOM (pra animar); recolhimento é via CSS module (data-collapsed).
    const label = screen.getByText("Transações")
    const button = label.closest("button")
    expect(button).toHaveAttribute("data-collapsed", "true")
  })

  it("PontesIconButton com badge renderiza contador", () => {
    render(<PontesIconButton p={p} badge={3}>🔔</PontesIconButton>)
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("PontesButton e PontesIconButton aceitam variant success/danger preenchidos", () => {
    render(<>
      <PontesButton p={p} variant="success">Sucesso</PontesButton>
      <PontesIconButton p={p} variant="success" aria-label="Aprovar">✓</PontesIconButton>
      <PontesIconButton p={p} variant="danger" aria-label="Rejeitar">✗</PontesIconButton>
    </>)
    expect(screen.getByText("Sucesso")).toHaveAttribute("data-variant", "success")
    expect(screen.getByLabelText("Aprovar")).toHaveAttribute("data-variant", "success")
    expect(screen.getByLabelText("Rejeitar")).toHaveAttribute("data-variant", "danger")
  })

  it("PontesField mostra label, required asterisk e erro", () => {
    render(
      <PontesField p={p} font={font} label="E-mail" required error="Inválido">
        <PontesInput p={p} font={font} />
      </PontesField>
    )
    expect(screen.getByText("E-mail")).toBeInTheDocument()
    expect(screen.getByText("*")).toBeInTheDocument()
    expect(screen.getByText("Inválido")).toBeInTheDocument()
  })

  it("PontesMoneyInput só aceita números e formata como moeda BR", () => {
    function Wrapper() {
      const [v, setV] = useState("")
      return <PontesMoneyInput p={p} font={font} value={v} onChange={setV} suggestions={[]} />
    }
    render(<Wrapper />)
    const input = screen.getByPlaceholderText("0,00") as HTMLInputElement
    // letras e símbolos são descartados, dígitos viram centavos
    fireEvent.change(input, { target: { value: "abc12345xyz" } })
    expect(input.value).toBe("123,45")
    // limpar volta a vazio
    fireEvent.change(input, { target: { value: "" } })
    expect(input.value).toBe("")
  })

  it("PontesChoiceCards marca ativo e dispara onChange", () => {
    function Wrapper() {
      const [v, setV] = useState("1")
      return (
        <PontesChoiceCards
          p={p} font={font} value={v} onChange={setV}
          options={[
            { value: "1", label: "Despesa", tone: "danger" },
            { value: "2", label: "Receita", tone: "success" },
          ]}
        />
      )
    }
    render(<Wrapper />)
    const despesa = screen.getByText("Despesa").closest("button")!
    expect(despesa).toHaveAttribute("data-active", "true")
    fireEvent.click(screen.getByText("Receita"))
    expect(screen.getByText("Receita").closest("button")).toHaveAttribute("data-active", "true")
    expect(despesa).not.toHaveAttribute("data-active")
  })

  it("PontesGroupedSelect abre, escolhe grupo e item", () => {
    function Wrapper() {
      const [g, setG] = useState<string>("")
      const [i, setI] = useState<string>("")
      return (
        <PontesGroupedSelect
          p={p} font={font}
          groups={[{ value: "cat1", label: "Alimentação", items: [{ value: "sub1", label: "Mercado" }] }]}
          groupValue={g} itemValue={i}
          onChange={(gv, iv) => { setG(gv); setI(iv) }}
        />
      )
    }
    render(<Wrapper />)
    fireEvent.click(screen.getByText("Selecione")) // abre painel
    fireEvent.click(screen.getByText("Mercado")) // escolhe item
    expect(screen.getByText("Alimentação · Mercado")).toBeInTheDocument()
  })

  it("PontesGroupedSelect busca filtra grupos e itens (acento-insensível)", () => {
    render(
      <PontesGroupedSelect
        p={p} font={font}
        groups={[
          { value: "cat1", label: "Alimentação", items: [{ value: "s1", label: "Supermercado" }, { value: "s2", label: "Delivery" }] },
          { value: "cat2", label: "Transporte", items: [{ value: "s3", label: "Uber" }] },
        ]}
        groupValue="" itemValue="" onChange={() => { /* noop */ }}
      />
    )
    fireEvent.click(screen.getByText("Selecione"))
    const busca = screen.getByPlaceholderText("Buscar categoria…")
    fireEvent.change(busca, { target: { value: "aliment" } }) // sem acento, acha "Alimentação"
    expect(screen.getByText("Supermercado")).toBeInTheDocument()
    expect(screen.queryByText("Uber")).not.toBeInTheDocument()
    // busca por item: mostra o grupo-cabeçalho + só o item que bate
    fireEvent.change(busca, { target: { value: "uber" } })
    expect(screen.getByText("Uber")).toBeInTheDocument()
    expect(screen.queryByText("Supermercado")).not.toBeInTheDocument()
    // termo sem match → "Nada encontrado"
    fireEvent.change(busca, { target: { value: "zzz" } })
    expect(screen.getByText("Nada encontrado")).toBeInTheDocument()
  })

  it("PontesModal mostra título, ícone X (svg) e fecha", () => {
    let closed = 0
    render(
      <PontesModal p={p} font={font} open title="Nova transação" onClose={() => closed++}>
        <div>conteúdo</div>
      </PontesModal>
    )
    expect(screen.getByText("Nova transação")).toBeInTheDocument()
    const closeBtn = screen.getByLabelText("Fechar")
    expect(closeBtn.querySelector("svg")).toBeTruthy() // lucide, não char "×"
    expect(closeBtn.textContent).toBe("")
    fireEvent.click(closeBtn)
    expect(closed).toBe(1)
  })

  it("PontesDialog renderiza ícone svg e confirma", () => {
    let confirmed = 0
    render(
      <PontesDialog
        p={p} font={font} open tone="danger"
        title="Excluir?" description="Sem volta"
        onConfirm={() => confirmed++} onCancel={() => { /* noop */ }}
      />
    )
    expect(screen.getByText("Excluir?")).toBeInTheDocument()
    expect(document.querySelector("svg")).toBeTruthy()
    fireEvent.click(screen.getByText("Confirmar"))
    expect(confirmed).toBe(1)
  })

  it("PontesSelect abre, lista options e seleciona", () => {
    function Wrapper() {
      const [v, setV] = useState("a")
      return (
        <PontesSelect
          p={p} font={font}
          value={v} onChange={setV}
          options={[{ value: "a", label: "Opção A" }, { value: "b", label: "Opção B" }]}
        />
      )
    }
    render(<Wrapper />)
    fireEvent.click(screen.getByText("Opção A"))
    fireEvent.click(screen.getByText("Opção B"))
    expect(screen.getByText("Opção B")).toBeInTheDocument()
  })

  it("PontesToggle alterna estado on click", () => {
    let v = false
    const { rerender } = render(
      <PontesToggle p={p} checked={v} onChange={(n) => { v = n }} label="Notif" />
    )
    fireEvent.click(screen.getByText("Notif"))
    rerender(<PontesToggle p={p} checked={v} onChange={(n) => { v = n }} label="Notif" />)
    expect(v).toBe(true)
  })

  it("PontesCheckbox alterna estado", () => {
    let v = false
    render(<PontesCheckbox p={p} checked={v} onChange={(n) => { v = n }} label="Termos" />)
    fireEvent.click(screen.getByText("Termos"))
    expect(v).toBe(true)
  })

  it("PontesBadge renderiza com tone correto", () => {
    render(<PontesBadge p={p} font={font} tone="success">Pago</PontesBadge>)
    expect(screen.getByText("Pago")).toBeInTheDocument()
  })

  it("PontesAvatar renderiza iniciais quando sem foto", () => {
    render(<PontesAvatar p={p} name="Gustavo Pontes" />)
    expect(screen.getByText("GP")).toBeInTheDocument()
  })

  it("PontesAlert mostra title e children", () => {
    render(<PontesAlert p={p} font={font} tone="success" title="Pago">Conta de luz quitada</PontesAlert>)
    expect(screen.getByText(/Conta de luz quitada/)).toBeInTheDocument()
  })

  it("PontesProgress mostra label e percentual", () => {
    render(<PontesProgress p={p} font={font} label="Meta" value={75} />)
    expect(screen.getByText("Meta")).toBeInTheDocument()
    expect(screen.getByText("75%")).toBeInTheDocument()
  })

  it("PontesProgress com segments renderiza cada fatia, sem percentual único", () => {
    render(<PontesProgress p={p} font={font} label="Empréstimo" segments={[
      { value: 40, color: "#0a0", label: "Confirmado" },
      { value: 20, color: "#a00", label: "Recusado" },
    ]} />)
    expect(screen.getByText("Empréstimo")).toBeInTheDocument()
    expect(screen.getByTitle("Confirmado")).toBeInTheDocument()
    expect(screen.getByTitle("Recusado")).toBeInTheDocument()
  })

  it("PontesStatCard mostra label/value/trend", () => {
    render(<PontesStatCard p={p} font={font} label="Saldo" value="R$ 1.000" trend="+5%" trendUp />)
    expect(screen.getByText("Saldo")).toBeInTheDocument()
    expect(screen.getByText("R$ 1.000")).toBeInTheDocument()
    expect(screen.getByText(/\+5%/)).toBeInTheDocument()
  })

  it("PontesCategoryDonut lista categorias com % e total; vazio mostra emptyLabel", () => {
    const fmt = (v: number) => `R$ ${v}`
    const { rerender } = render(
      <PontesCategoryDonut
        p={p} font={font} formatMoney={fmt}
        data={[
          { label: "Moradia", valor: 600, percentual: 60 },
          { label: "Mercado", valor: 400, percentual: 40 },
        ]}
      />
    )
    expect(screen.getByText("Moradia")).toBeInTheDocument()
    expect(screen.getByText("Mercado")).toBeInTheDocument()
    expect(screen.getByText("60%")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
    expect(screen.getByText("R$ 1000")).toBeInTheDocument() // soma 600+400
    rerender(<PontesCategoryDonut p={p} font={font} formatMoney={fmt} data={[]} emptyLabel="Nada aqui" />)
    expect(screen.getByText("Nada aqui")).toBeInTheDocument()
  })

  it("PontesCard renderiza children", () => {
    render(<PontesCard p={p}>Conteúdo</PontesCard>)
    expect(screen.getByText("Conteúdo")).toBeInTheDocument()
  })

  it("PontesTabs muda valor ao clicar", () => {
    let v: "a" | "b" = "a"
    const { rerender } = render(
      <PontesTabs<"a" | "b">
        p={p} font={font}
        value={v} onChange={(n) => { v = n }}
        options={[{ value: "a", label: "Tab A" }, { value: "b", label: "Tab B" }]}
      />
    )
    fireEvent.click(screen.getByText("Tab B"))
    rerender(
      <PontesTabs<"a" | "b">
        p={p} font={font}
        value={v} onChange={(n) => { v = n }}
        options={[{ value: "a", label: "Tab A" }, { value: "b", label: "Tab B" }]}
      />
    )
    expect(v).toBe("b")
  })

  // ── PontesTable + paginação (padrão DS) ────────────────────────────────────
  it("PONTES_TABLE_* constantes seguem o padrão decidido (10/25/50/100, default 25, cap 100)", () => {
    expect(PONTES_TABLE_PAGE_SIZE_DEFAULT).toBe(25)
    expect(PONTES_TABLE_PAGE_SIZE_MAX).toBe(100)
    expect([...PONTES_TABLE_PAGE_SIZES]).toEqual([10, 25, 50, 100])
  })

  it("PontesTable com pagination=true renderiza só 1 página de cada vez", () => {
    type R = { id: number; n: string }
    const rows: R[] = Array.from({ length: 47 }, (_, i) => ({ id: i, n: `linha-${i + 1}` }))
    render(
      <PontesTable<R>
        p={p} font={font}
        columns={[
          { key: "id", header: "ID", render: (r) => r.id },
          { key: "n", header: "Nome", render: (r) => r.n },
        ]}
        rows={rows}
        pagination={{ pageSize: 10 }}
        rowKey={(r) => r.id}
      />
    )
    // Página inicial mostra linhas 1-10. linha-11 NÃO deve estar no DOM.
    expect(screen.getByText("linha-1")).toBeInTheDocument()
    expect(screen.getByText("linha-10")).toBeInTheDocument()
    expect(screen.queryByText("linha-11")).not.toBeInTheDocument()
    // Range "1–10 de 47 registros" no rodapé.
    expect(screen.getByText(/1–10 de 47/)).toBeInTheDocument()
  })

  it("PontesTablePagination dispara onPageChange + onPageSizeChange", () => {
    let page = 1
    let size = 25
    render(
      <PontesTablePagination
        p={p} font={font}
        total={100} page={page} pageSize={size}
        onPageChange={(np) => { page = np }}
        onPageSizeChange={(ns) => { size = ns }}
      />
    )
    fireEvent.click(screen.getByLabelText("Próxima página"))
    expect(page).toBe(2)
  })

  it("PontesTablePagination desabilita ←/→ nas pontas", () => {
    render(
      <PontesTablePagination
        p={p} font={font}
        total={10} page={1} pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    )
    // 10 itens / 10 por página = 1 página total → ambos disabled.
    expect(screen.getByLabelText("Página anterior")).toBeDisabled()
    expect(screen.getByLabelText("Próxima página")).toBeDisabled()
  })

  it("PontesTablePagination mostra 0 registros sem quebrar quando total=0", () => {
    render(
      <PontesTablePagination
        p={p} font={font}
        total={0} page={1} pageSize={25}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    )
    expect(screen.getByText(/0 registros/)).toBeInTheDocument()
  })
})
