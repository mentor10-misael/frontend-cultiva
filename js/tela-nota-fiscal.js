// Utilitários de localStorage
function getStoredInvoices() {
  return JSON.parse(localStorage.getItem("notas_armazenadas")) || [];
}

function saveInvoices(invoices) {
  localStorage.setItem("notas_armazenadas", JSON.stringify(invoices));
}

// Atualiza os cards de contagem (Pendentes / Regularizadas)
function updateCounters() {
  const storedInvoices = getStoredInvoices();
  const pending = storedInvoices.filter((inv) => !inv.received).length;
  const regularized = storedInvoices.filter((inv) => inv.received).length;
  document.getElementById("count-pending").textContent = pending;
  document.getElementById("count-regularized").textContent = regularized;
}

// Alterna o status "recebido" de uma nota
function toggleReceived(invoiceNumber, checked) {
  const storedInvoices = getStoredInvoices();
  const updated = storedInvoices.map((invoice) =>
    invoice.invoiceNumber === invoiceNumber
      ? { ...invoice, received: checked }
      : invoice,
  );
  saveInvoices(updated);
  updateCounters();

  const card = document.querySelector(
    `[data-invoice-number="${invoiceNumber}"]`,
  );
  if (card) {
    const badge = card.querySelector(".badge-status");
    if (checked) {
      badge.textContent = "REGULARIZADA";
      badge.classList.remove("badge-pending");
      badge.classList.add("badge-regularized");
      card.classList.add("invoice-card--received");
    } else {
      badge.textContent = "PENDENTE";
      badge.classList.remove("badge-regularized");
      badge.classList.add("badge-pending");
      card.classList.remove("invoice-card--received");
    }
  }
}

// Estado do filtro ativo
let activeFilter = "all"; // "all" | "pending" | "regularized"
let searchTerm = "";

// Gera o HTML de um card de nota
function buildInvoiceCardHtml(invoice) {
  const isReceived = invoice.received === true;
  const isSaida = invoice.invoiceType === "Saída";
  const statusClass = isSaida
    ? "bg-danger-subtle text-danger"
    : "bg-success-subtle text-success";
  const iconClass = isSaida ? "bi-arrow-down-left" : "bi-arrow-up-right";
  const valueColor = isSaida ? "text-danger" : "text-success";
  const badgeClass = isReceived ? "badge-regularized" : "badge-pending";
  const badgeText = isReceived ? "REGULARIZADA" : "PENDENTE";
  const cardReceivedClass = isReceived ? "invoice-card--received" : "";

  return `
    <div class="invoice-card mx-n3 ${cardReceivedClass}" data-invoice-number="${invoice.invoiceNumber}">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div class="d-flex gap-3">
          <div class="icon-box ${statusClass}">
            <i class="bi ${iconClass}"></i>
          </div>
          <div>
            <div class="d-flex align-items-center gap-1 flex-wrap">
              <span class="fw-bold invoice-number">${invoice.invoiceNumber}</span>
              <span class="badge badge-admin rounded-pill">Admin</span>
              <span class="badge badge-status ${badgeClass} rounded-pill">${badgeText}</span>
            </div>
            <div class="fw-medium mt-1" style="font-size: 0.95rem">${invoice.description}</div>
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
        <label class="d-flex align-items-center gap-2 text-muted-custom received-label" style="font-size: 0.85rem; cursor: pointer;">
          <input
            type="checkbox"
            class="form-check-input m-0 received-checkbox"
            data-invoice="${invoice.invoiceNumber}"
            ${isReceived ? "checked" : ""}
          />
          <span>Marcar recebimento</span>
        </label>
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

// Renderização das notas fiscais (com busca e filtro)
function renderInvoices() {
  const allInvoices = getStoredInvoices();
  const invoiceList = document.getElementById("invoice-list");

  // Aplica busca por número da nota (case-insensitive)
  let filtered = allInvoices.filter((inv) =>
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Aplica filtro de status
  if (activeFilter === "pending") {
    filtered = filtered.filter((inv) => !inv.received);
  } else if (activeFilter === "regularized") {
    filtered = filtered.filter((inv) => inv.received);
  }

  // Mostra estado vazio adequado
  if (filtered.length === 0) {
    const emptyMessage =
      searchTerm || activeFilter !== "all"
        ? `<div class="empty-state">
             <i class="bi bi-search fs-2 d-block mb-2"></i>
             <p class="fw-medium mb-1">Nenhuma nota encontrada</p>
             <small>Tente outro número ou ajuste o filtro.</small>
           </div>`
        : `<div class="empty-state">
             <i class="bi bi-file-earmark-x fs-2 d-block mb-2"></i>
             <p class="fw-medium mb-1">Nenhuma nota fiscal registrada.</p>
           </div>`;
    invoiceList.innerHTML = emptyMessage;
    updateCounters();
    return;
  }

  // Limita a 10 resultados
  const limited = filtered.slice(0, 10);
  const hasMore = filtered.length > 10;

  let html = limited.map(buildInvoiceCardHtml).join("");

  // Aviso quando há mais notas além do limite
  if (hasMore) {
    html += `
      <div class="text-center py-3">
        <small class="text-muted">
          <i class="bi bi-info-circle me-1"></i>
          Exibindo 10 de ${filtered.length} notas. Use a busca para refinar.
        </small>
      </div>`;
  }

  invoiceList.innerHTML = html;
  updateCounters();

  // Listeners nos checkboxes recém-renderizados
  document.querySelectorAll(".received-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      toggleReceived(this.dataset.invoice, this.checked);
    });
  });
}

// Lógica de Busca
const searchInput = document.getElementById("search-invoice-input");
const clearBtn = document.getElementById("btn-clear-search");

searchInput.addEventListener("input", function () {
  searchTerm = this.value.trim();
  clearBtn.classList.toggle("d-none", this.value.length === 0);
  renderInvoices();
});

clearBtn.addEventListener("click", function () {
  searchInput.value = "";
  searchTerm = "";
  this.classList.add("d-none");
  searchInput.focus();
  renderInvoices();
});

// Lógica do Dropdown de Filtro
document.querySelectorAll(".filter-option").forEach((option) => {
  option.addEventListener("click", function (e) {
    e.preventDefault();
    activeFilter = this.dataset.filter;

    // Atualiza o label do botão
    document.getElementById("filter-label").textContent =
      this.textContent.trim();

    // Marca o item ativo
    document
      .querySelectorAll(".filter-option")
      .forEach((el) => el.classList.remove("active"));
    this.classList.add("active");

    // Badge indicador de filtro ativo
    const filterBadge = document.getElementById("filter-active-badge");
    filterBadge.classList.toggle("d-none", activeFilter === "all");

    renderInvoices();
  });
});

// Tratamento do formulário de registro
function resetForm() {
  document.querySelector("#register-form").reset();
}

document.getElementById("register-form").addEventListener("submit", (ev) => {
  ev.preventDefault();

  const invoiceTypeOut = document.getElementById("invoiceTypeOut");
  const invoiceTypeIn = document.getElementById("invoiceTypeIn");

  let invoiceType = "";
  if (invoiceTypeOut.checked) invoiceType = "Saída";
  else if (invoiceTypeIn.checked) invoiceType = "Entrada";

  const newInvoice = {
    invoiceType,
    invoiceNumber: document.getElementById("invoiceNumber").value,
    invoiceIssueDate: document.getElementById("invoiceIssueDate").value,
    invoiceValue: document.getElementById("invoiceValue").value,
    description: document.getElementById("description").value,
    costCenter: document.getElementById("costCenter").value,
    fileUpload: document.getElementById("fileUpload").value,
    received: false,
  };

  const storedInvoices = getStoredInvoices();
  storedInvoices.push(newInvoice);
  saveInvoices(storedInvoices);

  renderInvoices();
  resetForm();
});

// Lógica do modal de exclusão
const deleteModal = document.getElementById("deleteInvoiceModal");

deleteModal.addEventListener("show.bs.modal", function (event) {
  const button = event.relatedTarget;
  const invoiceNumber = button.getAttribute("data-bs-invoice");

  deleteModal.querySelector("#modal-invoice-display").textContent =
    invoiceNumber;
  const inputConfirm = deleteModal.querySelector("#confirm-invoice-input");
  inputConfirm.value = "";
  inputConfirm.placeholder = `Ex: ${invoiceNumber}`;
  deleteModal
    .querySelector("#btn-confirm-delete")
    .setAttribute("data-current-invoice", invoiceNumber);
});

function deleteInvoice(invoiceNumber) {
  const updated = getStoredInvoices().filter(
    (inv) => inv.invoiceNumber !== invoiceNumber,
  );
  saveInvoices(updated);
  renderInvoices();
}

document
  .getElementById("delete-invoice-form")
  .addEventListener("submit", function (ev) {
    ev.preventDefault();

    const confirmBtn = deleteModal.querySelector("#btn-confirm-delete");
    const invoiceToDelete = confirmBtn.getAttribute("data-current-invoice");
    const input = deleteModal.querySelector("#confirm-invoice-input");

    if (input.value.trim() !== invoiceToDelete) {
      input.classList.add("is-invalid");
      input.addEventListener(
        "input",
        () => input.classList.remove("is-invalid"),
        { once: true },
      );
      return;
    }

    deleteInvoice(invoiceToDelete);
    bootstrap.Modal.getInstance(deleteModal).hide();
  });

// Init
renderInvoices();
