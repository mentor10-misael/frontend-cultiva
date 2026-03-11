const invoices = [];

//Tratamento do formulário
function resetForm() {
  document.querySelector("#register-form").reset();
}

document.getElementById("register-form").addEventListener("submit", (ev) => {
  ev.preventDefault();

  let invoiceType = "";

  const invoiceTypeOut = document.getElementById("invoiceTypeOut");

  const invoiceTypeIn = document.getElementById("invoiceTypeIn");

  if (invoiceTypeOut.checked) {
    invoiceType = "Saída";
  } else if (invoiceTypeIn.checked) {
    invoiceType = "Entrada";
  }

  let invoiceNumber = document.getElementById("invoiceNumber").value;
  let invoiceIssueDate = document.getElementById("invoiceIssueDate").value;
  let invoiceValue = document.getElementById("invoiceValue").value;
  let description = document.getElementById("description").value;
  let costCenter = document.getElementById("costCenter").value;
  let fileUpload = document.getElementById("fileUpload").value;

  const formResponse = {
    invoiceType,
    invoiceNumber,
    invoiceIssueDate,
    invoiceValue,
    description,
    costCenter,
    fileUpload,
  };

  invoices.push(formResponse);

  localStorage.setItem("notas_armazenadas", JSON.stringify(invoices));

  resetForm();
});

// Renderização das notas fiscais
function renderInvoices() {
  let storedInvoices =
    JSON.parse(localStorage.getItem("notas_armazenadas")) || [];

  if (storedInvoices.length) {
    let storedInvoicesHtml = ``;
    // Usando Math.min para simplificar a lógica do limite
    let limit = Math.min(storedInvoices.length, 10);

    for (let i = 0; i < limit; i++) {
      const invoice = storedInvoices[i];

      // Lógica Condicional: Define as classes e o ícone com base no tipo
      const isSaida = invoice.invoiceType === "Saída";
      const statusClass = isSaida
        ? "bg-danger-subtle text-danger"
        : "bg-success-subtle text-success";
      const iconClass = isSaida ? "bi-arrow-down-left" : "bi-arrow-up-right";
      const valueColor = isSaida ? "text-danger" : "text-success";

      storedInvoicesHtml += `
        <div class="invoice-card mx-n3">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="d-flex gap-3">
              <div class="icon-box ${statusClass}">
                <i class="bi ${iconClass}"></i>
              </div>
              
              <div>
                <div class="d-flex align-items-center gap-1 flex-wrap">
                  <span class="fw-bold invoice-number">${invoice.invoiceNumber}</span>
                  <span class="badge badge-admin rounded-pill">Admin</span>
                  <span class="badge badge-pending rounded-pill">PENDENTE</span>
                </div>
                <div class="fw-medium mt-1" style="font-size: 0.95rem">
                  ${invoice.description}
                </div>
                <small class="text-muted d-block">${invoice.costCenter}</small>
              </div>
            </div>
            
            <div class="text-end">
              <div class="fw-bold ${valueColor} invoice-value" style="font-size: 1.1rem">
                R$ ${invoice.invoiceValue}
              </div>
              <small class="text-muted" style="font-size: 0.75rem">${invoice.invoiceIssueDate}</small>
            </div>
          </div>
          
          <div class="d-flex justify-content-between align-items-center mt-3">
            <div class="d-flex align-items-center gap-2 text-muted-custom" style="font-size: 0.85rem">
              <input type="checkbox" class="form-check-input m-0" />
              <span>Marcar recebimento</span>
            </div>
            <button
              type="button"
              class="border border-0 bg-transparent"
              data-bs-toggle="modal"
              data-bs-target="#deleteInvoiceModal"
              data-bs-invoice="${invoice.invoiceNumber}"
            >
            <i class="bi bi-trash3 text-light-emphasis"></i>
            </button>
          </div>
        </div>`;
    }
    document.getElementById("invoice-list").innerHTML = storedInvoicesHtml;
  }
}
renderInvoices();

// Lógica para deletar uma nota fiscal da tela
const deleteModal = document.getElementById("deleteInvoiceModal");

// Evento disparado pelo Bootstrap SEMPRE que o modal vai abrir
deleteModal.addEventListener("show.bs.modal", function (event) {
  // O botão que foi clicado
  const button = event.relatedTarget;

  // Extrai o número da nota do atributo data-bs-invoice
  const invoiceNumber = button.getAttribute("data-bs-invoice");

  // Atualiza os elementos dentro do modal de exclusão da nota fiscal
  const displaySpan = deleteModal.querySelector("#modal-invoice-display");
  const inputConfirm = deleteModal.querySelector("#confirm-invoice-input");

  displaySpan.textContent = invoiceNumber; // Mostra o número no título/texto
  inputConfirm.value = ""; // Limpa o input para uma nova tentativa
  inputConfirm.placeholder = `Ex: ${invoiceNumber}`;

  // Salva o número num atributo do botão de confirmar para uso posterior
  const confirmBtn = deleteModal.querySelector("#btn-confirm-delete");
  confirmBtn.setAttribute("data-current-invoice", invoiceNumber);

  // Confirmação da deleção da nota fiscal
});

// Função que remove a nota do localStorage e renderiza a pagina novamente
function deleteInvoice(invoiceNumber) {
  let storedInvoices =
    JSON.parse(localStorage.getItem("notas_armazenadas")) || [];

  const updatedInvoices = storedInvoices.filter(
    (invoice) => invoice.invoiceNumber !== invoiceNumber,
  );

  localStorage.setItem("notas_armazenadas", JSON.stringify(updatedInvoices));

  renderInvoices();
}

// Listener no formulário de confirmação de exclusão
document
  .getElementById("delete-invoice-form")
  .addEventListener("submit", function (ev) {
    ev.preventDefault();

    const confirmBtn = deleteModal.querySelector("#btn-confirm-delete");
    const invoiceToDelete = confirmBtn.getAttribute("data-current-invoice");
    const inputValue = deleteModal
      .querySelector("#confirm-invoice-input")
      .value.trim();

    if (inputValue !== invoiceToDelete) {
      // Feedback visual de erro no input
      const input = deleteModal.querySelector("#confirm-invoice-input");
      input.classList.add("is-invalid");

      // Remove a classe de erro ao começar a digitar novamente
      input.addEventListener(
        "input",
        () => input.classList.remove("is-invalid"),
        { once: true },
      );
      return;
    }

    deleteInvoice(invoiceToDelete);

    // Fecha o modal após a remoção bem-sucedida
    const modalInstance = bootstrap.Modal.getInstance(deleteModal);
    modalInstance.hide();
  });
