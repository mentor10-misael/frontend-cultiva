// Lógica do Modal Novo Centro (Troca de campos)
function toggleForm(tipo) {
  const camposLavoura = document.getElementById("camposLavoura");
  const camposMaquinas = document.getElementById("camposMaquinas");
  const infoGeral = document.getElementById("infoGeral");
  const inputNome = document.getElementById("inputNome");

  camposLavoura.classList.add("d-none");
  camposMaquinas.classList.add("d-none");
  infoGeral.classList.add("d-none");

  // Lógica de exibição
  if (tipo === "lavoura") {
    camposLavoura.classList.remove("d-none");
    inputNome.placeholder = "Ex: Terreno do Rio";
  } else if (tipo === "maquinas") {
    camposMaquinas.classList.remove("d-none");
    inputNome.placeholder = "Ex: Trator Principal";
  } else if (tipo === "geral") {
    infoGeral.classList.remove("d-none");
    inputNome.placeholder = "Ex: Escritório Sede";
  }
}

// 2. Lógica de Filtros (Milho/Máquinas/Geral)
function filtrarCategoria(categoria, nomeExibicao, elementoCard) {

    document.querySelectorAll(".card-cost-center").forEach((card) => {
    card.classList.remove("active");
  });
  if (elementoCard) {
    elementoCard.classList.add("active");
  }

  // Filtrar Lista
  const transacoes = document.querySelectorAll(".card-transaction");
  transacoes.forEach((card) => {
    if (card.getAttribute("data-categoria") === categoria) {
      card.classList.remove("d-none");
    } else {
      card.classList.add("d-none");
    }
  });

  // Atualizar e Botão Limpar
  const badge = document.getElementById("badgeFiltroAtual");
  badge.innerText = nomeExibicao;
  badge.classList.remove("d-none");
  document.getElementById("btnLimparFiltro").classList.remove("d-none");
}

// Lógica de Limpar Filtros
function limparFiltro() {
  document.querySelectorAll(".card-cost-center").forEach((card) => {
    card.classList.remove("active");
  });
  document.querySelectorAll(".card-transaction").forEach((card) => {
    card.classList.remove("d-none");
  });
  document.getElementById("badgeFiltroAtual").classList.add("d-none");
  document.getElementById("btnLimparFiltro").classList.add("d-none");
}
