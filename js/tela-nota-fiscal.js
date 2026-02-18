const invoices = [];

document.getElementById("register-form").addEventListener("submit", (ev) => {
  ev.preventDefault();

  let invoiceType = "";

  const invoiceTypeOut = document.getElementById("invoiceTypeOut").checked;
  const invoiceTypeIn = document.getElementById("invoiceTypeIn").checked;

  if (invoiceTypeOut) {
    invoiceType = "saída";
  } else if (invoiceTypeIn) {
    invoiceType = "entrada";
  }

  const invoiceNumber = document.getElementById("invoiceNumber").value;
  const invoiceIssueDate = document.getElementById("invoiceIssueDate").value;
  const invoiceValue = document.getElementById("invoiceValue").value;
  const description = document.getElementById("description").value;
  const costCenter = document.getElementById("costCenter").value;
  const fileUpload = document.getElementById("fileUpload").value;

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
  console.log(invoices);
});
