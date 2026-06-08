const receiptCard = document.querySelector("#receiptCard");
const receiptMessage = document.querySelector("#receiptMessage");
const downloadReceiptButton = document.querySelector("#downloadReceiptButton");
const printReceiptButton = document.querySelector("#printReceiptButton");
let currentRecord = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setText(id, value) {
  document.querySelector(id).textContent = value || "-";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderReceipt(record) {
  currentRecord = record;
  receiptMessage.classList.add("hidden");
  receiptCard.classList.remove("hidden");
  setText("#rRegistrationId", record.registrationId);
  setText("#rName", record.fullName);
  setText("#rVaccine", record.vaccine);
  setText("#rDose", record.dose);
  setText("#rAmount", `Rs ${record.paymentAmount}`);
  setText("#rApprovalDate", formatDate(record.approvalDate));
  setText("#rVerificationStatus", "APPROVED");
}

function receiptHtml(record) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Receipt ${escapeHtml(record.registrationId)}</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <main class="receipt-shell printable-receipt">
      <section class="panel receipt-card">
        <div class="receipt-header">
          <img class="receipt-logo" src="assets/rotaract-omc-logo.png" alt="Rotaract Club OMC logo">
          <div>
            <span class="section-kicker">Payment Receipt</span>
            <h2>Vaccination Registration Receipt</h2>
            <p>Verification Status: <strong>APPROVED</strong></p>
          </div>
        </div>
        <dl class="receipt-details">
          <div><dt>Registration ID</dt><dd>${escapeHtml(record.registrationId)}</dd></div>
          <div><dt>Name</dt><dd>${escapeHtml(record.fullName)}</dd></div>
          <div><dt>Vaccine</dt><dd>${escapeHtml(record.vaccine)}</dd></div>
          <div><dt>Dose</dt><dd>${escapeHtml(record.dose)}</dd></div>
          <div><dt>Amount</dt><dd>Rs ${escapeHtml(record.paymentAmount)}</dd></div>
          <div><dt>Approval Date</dt><dd>${escapeHtml(formatDate(record.approvalDate))}</dd></div>
          <div><dt>Verification Status</dt><dd>APPROVED</dd></div>
        </dl>
      </section>
    </main>
  </body>
</html>`;
}

function downloadReceipt() {
  if (!currentRecord) return;
  const blob = new Blob([receiptHtml(currentRecord)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentRecord.registrationId}-receipt.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadReceipt() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    receiptMessage.innerHTML = `<div class="empty-state">Registration ID is required.</div>`;
    return;
  }

  try {
    const response = await fetch(`/api/registration/${encodeURIComponent(id)}`);
    const record = await response.json();
    if (!response.ok) throw new Error(record.error || "Receipt not found.");
    if (record.paymentStatus !== "Approved") {
      receiptMessage.innerHTML = `<div class="empty-state">Receipt is available only after admin approval.</div>`;
      return;
    }
    renderReceipt(record);
  } catch (error) {
    receiptMessage.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

downloadReceiptButton.addEventListener("click", downloadReceipt);
printReceiptButton.addEventListener("click", () => window.print());
loadReceipt();
