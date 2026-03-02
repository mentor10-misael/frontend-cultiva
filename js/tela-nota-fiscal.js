const invoices = [];

function resetForm() {
  document.querySelector("#register-form").reset();
}

document.getElementById("register-form").addEventListener("submit", (ev) => {
  ev.preventDefault();

  let invoiceType = "";

  const invoiceTypeOut = document.getElementById("invoiceTypeOut");

  const invoiceTypeIn = document.getElementById("invoiceTypeIn");

  if (invoiceTypeOut.checked) {
    invoiceType = "saída";
  } else if (invoiceTypeIn.checked) {
    invoiceType = "entrada";
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

  localStorage.setItem("Notas armazenadas", JSON.stringify(invoices));

  resetForm();
});
