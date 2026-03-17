const btnRelatorio = document.getElementById("btnRelatorio");

btnRelatorio.addEventListener("click", () => {
  const inicio = document.getElementById("dataInicio").value;
  const fim = document.getElementById("dataFim").value;

  if (!inicio || !fim) {
    alert("Por favor, selecione ambas as datas!");
    return;
  }

  console.log("Chamando API com filtros:", { inicio, fim });

  alert("A API ainda não está implementada. Quando estiver, aqui vai baixar o arquivo.");
});
