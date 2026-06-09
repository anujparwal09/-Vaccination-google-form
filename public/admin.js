const adminForm = document.querySelector("#adminForm");
const adminPassword = document.querySelector("#adminPassword");
const adminMessage = document.querySelector("#adminMessage");
const adminLoginWrapper = document.querySelector("#adminLoginWrapper");
const adminDashboardShell = document.querySelector("#adminDashboardShell");
const adminRecords = document.querySelector("#adminRecords");
const countAll = document.querySelector("#countAll");
const countPending = document.querySelector("#countPending");
const countApproved = document.querySelector("#countApproved");
const countRejected = document.querySelector("#countRejected");
const togglePasswordBtn = document.querySelector("#togglePasswordBtn");
const downloadExcelButton = document.querySelector("#downloadExcelButton");
const adminLogoutButton = document.querySelector("#adminLogoutButton");
const totalRegistrations = document.querySelector("#totalRegistrations");
const pendingPayments = document.querySelector("#pendingPayments");
const approvedPayments = document.querySelector("#approvedPayments");
const rejectedPayments = document.querySelector("#rejectedPayments");
const adminRecordCount = document.querySelector("#adminRecordCount");
const screenshotDialog = document.querySelector("#screenshotDialog");
const screenshotTitle = document.querySelector("#screenshotTitle");
const screenshotPreview = document.querySelector("#screenshotPreview");
const closeScreenshotDialog = document.querySelector("#closeScreenshotDialog");
const openScreenshotButton = document.querySelector("#openScreenshotButton");
const downloadScreenshotButton = document.querySelector("#downloadScreenshotButton");
let activePassword = "";
let currentRecords = [];
let currentScreenshotRecord = null;
let activeFilter = "all";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function statusClass(text) {
  const normalized = String(text || "").toLowerCase();
  if (normalized === "approved" || normalized === "verified") return "approved";
  if (normalized === "rejected") return "rejected";
  return "pending";
}

function statusPill(text) {
  return `<span class="status ${statusClass(text)}">${escapeHtml(text || "Pending Verification")}</span>`;
}

function screenshotHtml(record) {
  if (!record.paymentScreenshotDataUrl) {
    return `<div class="payment-proof empty-proof">No screenshot uploaded</div>`;
  }

  return `
    <img class="payment-proof" src="${record.paymentScreenshotDataUrl}" alt="Payment screenshot for ${escapeHtml(record.registrationId)}">
    <div class="proof-actions">
      <button class="secondary" type="button" data-action="view-screenshot" data-id="${escapeHtml(record.registrationId)}">View Screenshot</button>
      <button class="secondary" type="button" data-action="open-screenshot" data-id="${escapeHtml(record.registrationId)}">Open Image</button>
      <button class="secondary" type="button" data-action="download-screenshot" data-id="${escapeHtml(record.registrationId)}">Download Image</button>
    </div>
  `;
}

function renderSummary(records) {
  totalRegistrations.textContent = records.length;
  pendingPayments.textContent = records.filter((record) => record.paymentStatus === "Pending Verification").length;
  approvedPayments.textContent = records.filter((record) => record.paymentStatus === "Approved").length;
  rejectedPayments.textContent = records.filter((record) => record.paymentStatus === "Rejected").length;
  adminRecordCount.textContent = `${records.length} record${records.length === 1 ? "" : "s"}`;
}

function renderRecords(records) {
  renderSummary(records);

  const totalCount = records.length;
  const pendingCountVal = records.filter((r) => r.paymentStatus === "Pending Verification").length;
  const approvedCountVal = records.filter((r) => r.paymentStatus === "Approved").length;
  const rejectedCountVal = records.filter((r) => r.paymentStatus === "Rejected").length;

  countAll.textContent = totalCount;
  countPending.textContent = pendingCountVal;
  countApproved.textContent = approvedCountVal;
  countRejected.textContent = rejectedCountVal;

  const filteredRecords = activeFilter === "all"
    ? records
    : records.filter((r) => r.paymentStatus === activeFilter);

  adminRecordCount.textContent = `${filteredRecords.length} record${filteredRecords.length === 1 ? "" : "s"}`;

  if (!filteredRecords.length) {
    adminRecords.innerHTML = `<div class="empty-state">No registrations found in this category.</div>`;
    return;
  }

  adminRecords.innerHTML = filteredRecords
    .map((record) => {
      const approved = record.paymentStatus === "Approved";
      const rejected = record.paymentStatus === "Rejected";
      const receiptHref = `receipt.html?id=${encodeURIComponent(record.registrationId)}`;

      return `
        <article class="admin-record">
          <div class="admin-record-main">
            <div class="record-heading">
              <h3>${escapeHtml(record.fullName)}</h3>
              ${statusPill(record.paymentStatus)}
            </div>
            <div class="admin-meta-grid">
              <p><span>Registration ID</span>${escapeHtml(record.registrationId)}</p>
              <p><span>Phone</span>${escapeHtml(record.phone)}</p>
              <p><span>Email</span>${escapeHtml(record.email || "-")}</p>
              <p><span>Vaccine</span>${escapeHtml(record.vaccine)}</p>
              <p><span>Amount</span>Rs ${escapeHtml(record.paymentAmount)}</p>
              <p><span>Registration Date</span>${escapeHtml(formatDate(record.createdAt))}</p>
              <p><span>Approval Date</span>${escapeHtml(formatDate(record.approvalDate))}</p>
            </div>
            ${
              record.rejectionReason
                ? `<p class="rejection-note"><span>Rejection reason</span>${escapeHtml(record.rejectionReason)}</p>`
                : ""
            }
          </div>
          <div class="admin-proof">${screenshotHtml(record)}</div>
          <div class="admin-actions">
            <button class="primary" type="button" data-action="approve" data-id="${escapeHtml(record.registrationId)}" ${
              approved ? "disabled" : ""
            }>Approve</button>
            <button class="secondary reject-button" type="button" data-action="reject" data-id="${escapeHtml(record.registrationId)}" ${
              rejected ? "disabled" : ""
            }>Reject</button>
            <a class="secondary ${approved ? "" : "disabled-link"}" href="${receiptHref}" target="_blank" rel="noopener">Receipt</a>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadAdminRecords() {
  const response = await fetch("/api/admin/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: activePassword })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not load admin records.");
  currentRecords = payload;
  renderRecords(payload);
}

async function downloadExcel() {
  adminMessage.textContent = "Preparing Excel download...";
  adminMessage.classList.remove("error");

  const response = await fetch("/api/admin/excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: activePassword, statusFilter: activeFilter })
  });

  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error || "Excel download failed.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vaccination_registrations.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  adminMessage.textContent = "Excel download started.";
}

async function approvePayment(registrationId) {
  adminMessage.textContent = "Approving payment...";
  adminMessage.classList.remove("error");

  const response = await fetch(`/api/admin/approve-payment/${encodeURIComponent(registrationId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: activePassword })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not approve payment.");

  adminMessage.textContent = "Payment approved. Receipt is ready for download.";
  await loadAdminRecords();
}

async function rejectPayment(registrationId) {
  const rejectionReason = window.prompt("Optional rejection reason", "");
  if (rejectionReason === null) return;

  adminMessage.textContent = "Rejecting payment...";
  adminMessage.classList.remove("error");

  const response = await fetch(`/api/admin/reject-payment/${encodeURIComponent(registrationId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: activePassword, rejectionReason })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not reject payment.");

  adminMessage.textContent = "Payment rejected.";
  await loadAdminRecords();
}

function recordById(registrationId) {
  return currentRecords.find((record) => record.registrationId === registrationId);
}

function viewScreenshot(registrationId) {
  const record = recordById(registrationId);
  if (!record || !record.paymentScreenshotDataUrl) return;

  currentScreenshotRecord = record;
  screenshotTitle.textContent = `${record.fullName} - ${record.registrationId}`;
  screenshotPreview.src = record.paymentScreenshotDataUrl;
  screenshotDialog.showModal();
}

function openScreenshot(registrationId) {
  const record = recordById(registrationId);
  if (!record || !record.paymentScreenshotDataUrl) return;
  const imageWindow = window.open("", "_blank");
  if (!imageWindow) return;
  imageWindow.document.write(
    `<!doctype html><title>${escapeHtml(record.registrationId)} payment proof</title><img src="${record.paymentScreenshotDataUrl}" style="max-width:100%;height:auto;display:block;margin:0 auto;">`
  );
  imageWindow.document.close();
}

function downloadScreenshot(registrationId) {
  const record = recordById(registrationId);
  if (!record || !record.paymentScreenshotDataUrl) return;
  const link = document.createElement("a");
  link.href = record.paymentScreenshotDataUrl;
  link.download = record.paymentScreenshotName || `${record.registrationId}-payment-proof.jpg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  activePassword = adminPassword.value;
  adminMessage.textContent = "Loading admin panel...";
  adminMessage.classList.remove("error");

  try {
    await loadAdminRecords();
    sessionStorage.setItem("adminPassword", activePassword);
    adminDashboardShell.classList.remove("hidden");
    adminLoginWrapper.classList.add("hidden");
    adminMessage.textContent = "Admin panel unlocked.";
  } catch (error) {
    adminMessage.textContent = error.message;
    adminMessage.classList.add("error");
  }
});

downloadExcelButton.addEventListener("click", async () => {
  try {
    await downloadExcel();
  } catch (error) {
    adminMessage.textContent = error.message;
    adminMessage.classList.add("error");
  }
});

adminRecords.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  try {
    if (target.dataset.action === "approve") await approvePayment(target.dataset.id);
    if (target.dataset.action === "reject") await rejectPayment(target.dataset.id);
    if (target.dataset.action === "view-screenshot") viewScreenshot(target.dataset.id);
    if (target.dataset.action === "open-screenshot") openScreenshot(target.dataset.id);
    if (target.dataset.action === "download-screenshot") downloadScreenshot(target.dataset.id);
  } catch (error) {
    adminMessage.textContent = error.message;
    adminMessage.classList.add("error");
  }
});

closeScreenshotDialog.addEventListener("click", () => {
  screenshotDialog.close();
});

openScreenshotButton.addEventListener("click", () => {
  if (currentScreenshotRecord) openScreenshot(currentScreenshotRecord.registrationId);
});

downloadScreenshotButton.addEventListener("click", () => {
  if (currentScreenshotRecord) downloadScreenshot(currentScreenshotRecord.registrationId);
});

togglePasswordBtn.addEventListener("click", () => {
  const type = adminPassword.getAttribute("type") === "password" ? "text" : "password";
  adminPassword.setAttribute("type", type);
  togglePasswordBtn.textContent = type === "password" ? "Show" : "Hide";
});

document.querySelector(".filter-tabs").addEventListener("click", (event) => {
  const tab = event.target.closest(".filter-tab");
  if (!tab) return;

  document.querySelectorAll(".filter-tab").forEach((btn) => btn.classList.remove("active"));
  tab.classList.add("active");
  activeFilter = tab.dataset.status;
  renderRecords(currentRecords);
});

adminLogoutButton.addEventListener("click", () => {
  sessionStorage.removeItem("adminPassword");
  activePassword = "";
  adminPassword.value = "";
  adminDashboardShell.classList.add("hidden");
  adminLoginWrapper.classList.remove("hidden");
  adminMessage.textContent = "Logged out successfully.";
});

document.addEventListener("DOMContentLoaded", async () => {
  const savedPassword = sessionStorage.getItem("adminPassword");
  if (savedPassword) {
    adminPassword.value = savedPassword;
    activePassword = savedPassword;
    adminMessage.textContent = "Loading admin panel...";
    try {
      await loadAdminRecords();
      adminDashboardShell.classList.remove("hidden");
      adminLoginWrapper.classList.add("hidden");
      adminMessage.textContent = "Admin panel unlocked.";
    } catch (error) {
      sessionStorage.removeItem("adminPassword");
      adminMessage.textContent = "Session expired. Please log in again.";
    }
  }
});
