let estadoFiltros = {
  categoria: "todos",
  termoBusca: "",
};

document.addEventListener("DOMContentLoaded", () => {
  inicializarEventos();
});

function inicializarEventos() {
  // Lógica do Modal de Cadastro
  const radiosTipo = document.querySelectorAll('input[name="tipoCentro"]');
  radiosTipo.forEach((radio) => {
    radio.addEventListener("change", (evento) => {
      toggleForm(evento.target.value);
    });
  });

  //Lógica de Filtros da Lista

  //Clique nos Cards de Categoria
  const cardsFiltro = document.querySelectorAll(".card-cost-center");
  cardsFiltro.forEach((card) => {
    card.addEventListener("click", (evento) => {
      const elementoClicado = evento.currentTarget;
      const categoria = elementoClicado.dataset.categoria;
      const nomeExibicao = elementoClicado.dataset.nome;

      // Atualiza visual dos cards
      cardsFiltro.forEach((c) => c.classList.remove("active"));
      elementoClicado.classList.add("active");

      // Atualiza o texto do Badge e mostra o botão limpar
      const badge = document.getElementById("badgeFiltroAtual");
      badge.innerText = nomeExibicao;
      badge.classList.remove("d-none");

      const btnLimpar = document.getElementById("btnLimparFiltro");
      if (btnLimpar) btnLimpar.classList.remove("d-none");

      // Atualiza estado e reaplica a lógica combinada
      estadoFiltros.categoria = categoria;
      aplicarFiltrosCombinados();
    });
  });

  // Digitação na Busca
  const inputBusca = document.getElementById("inputBusca");
  if (inputBusca) {
    inputBusca.addEventListener("input", (evento) => {
      estadoFiltros.termoBusca = evento.target.value.toLowerCase();
      aplicarFiltrosCombinados();
    });
  }

  // Botão "X" dentro do input de busca
  const btnLimparBusca = document.getElementById("btnLimparBusca");
  if (btnLimparBusca) {
    btnLimparBusca.addEventListener("click", () => {
      if (inputBusca) inputBusca.value = "";
      estadoFiltros.termoBusca = "";
      aplicarFiltrosCombinados();
    });
  }

  // Link "Limpar filtro" (das categorias)
  const btnLimparFiltroCategoria = document.getElementById("btnLimparFiltro");
  if (btnLimparFiltroCategoria) {
    btnLimparFiltroCategoria.addEventListener("click", () => {
      // Remove o verde dos cards
      document
        .querySelectorAll(".card-cost-center")
        .forEach((c) => c.classList.remove("active"));

      // Esconde badge e o próprio botão
      document.getElementById("badgeFiltroAtual").classList.add("d-none");
      btnLimparFiltroCategoria.classList.add("d-none");

      // Reseta estado para 'todos' e reaplica
      estadoFiltros.categoria = "todos";
      aplicarFiltrosCombinados();
    });
  }
}

// Função de Filtro
function aplicarFiltrosCombinados() {
  const transacoes = document.querySelectorAll(".card-transaction");

  transacoes.forEach((card) => {
    //Verifica Categoria
    const categoriaCard = card.dataset.categoria;
    const passouCategoria =
      estadoFiltros.categoria === "todos" ||
      categoriaCard === estadoFiltros.categoria;

    // Verifica Texto
    // O operador ?. evita erro se não tiver badge, e o || '' garante que seja uma string
    const titulo = card
      .querySelector(".fw-bold.text-dark")
      .innerText.toLowerCase();
    const badgeFuncionario = card.querySelector(".badge");
    const nomeFuncionario = badgeFuncionario
      ? badgeFuncionario.innerText.toLowerCase()
      : "";

    const termo = estadoFiltros.termoBusca;
    const passouTexto =
      titulo.includes(termo) || nomeFuncionario.includes(termo);

    // Só exibe se passar nos DOIS testes
    if (passouCategoria && passouTexto) {
      card.classList.remove("d-none");
    } else {
      card.classList.add("d-none");
    }
  });
}

function toggleForm(tipo) {
  const camposLavoura = document.getElementById("camposLavoura");
  const camposMaquinas = document.getElementById("camposMaquinas");
  const infoGeral = document.getElementById("infoGeral");
  const inputNome = document.getElementById("inputNome");

  camposLavoura.classList.add("d-none");
  camposMaquinas.classList.add("d-none");
  infoGeral.classList.add("d-none");

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
