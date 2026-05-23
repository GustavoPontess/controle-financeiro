// PostToolUse hook — lembra a regra de validação de formulários ao editar forms.
// Dispara em Edit/Write; só imprime se o arquivo for um form (*Form*.tsx / *Dialog*.tsx).
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  try {
    const j = JSON.parse(s);
    const f = (j.tool_input && j.tool_input.file_path) || "";
    if (/(Form|Dialog)[^/\\]*\.tsx$/.test(f)) {
      console.log(
        "REGRA FORM (obrigatoria): validar por campo antes de submeter e bloquear se invalido; " +
        "erro visual via PontesField error= + invalid no controle (NUNCA toast pra campo faltando); " +
        "erro limpa ao editar; mensagem != placeholder; toast acima do modal; " +
        "teste obrigatorio (submit vazio bloqueia + mostra erros). Ver docs/STANDARDS.md > Validacao de formularios."
      );
    }
  } catch (e) {
    /* ignora entrada malformada */
  }
});
