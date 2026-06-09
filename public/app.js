const form = document.querySelector("#registrationForm");
const formMessage = document.querySelector("#formMessage");
const resultEmpty = document.querySelector("#resultEmpty");
const resultCard = document.querySelector("#resultCard");
const resultStatus = document.querySelector("#resultStatus");
const registrationId = document.querySelector("#registrationId");
const resultName = document.querySelector("#resultName");
const resultPayment = document.querySelector("#resultPayment");
const receiptLink = document.querySelector("#receiptLink");
const vaccineSelect = document.querySelector("#vaccineSelect");
const paymentAmount = document.querySelector("#paymentAmount");
const paymentModeSelect = document.querySelector("#paymentModeSelect");
const upiIdContainer = document.querySelector("#upiIdContainer");
const upiId = document.querySelector("#upiId");
const paymentQrImage = document.querySelector("#paymentQrImage");
const paymentQrBlock = document.querySelector("#paymentQrBlock");
const paymentQrText = document.querySelector("#paymentQrText");
const paymentScreenshot = document.querySelector("#paymentScreenshot");
const downloadPaymentQr = document.querySelector("#downloadPaymentQr");
const browserRegistrationsSection = document.querySelector("#browserRegistrationsSection");
const browserRegistrationCount = document.querySelector("#browserRegistrationCount");
const browserRegistrationsList = document.querySelector("#browserRegistrationsList");
const maxScreenshotBytes = 5 * 1024 * 1024;
const allowedScreenshotTypes = ["image/jpeg", "image/png"];
const allowedScreenshotExtensions = [".jpg", ".jpeg", ".png"];
const browserStorageKey = "vaccinationDriveBrowserRegistrations";
let activeStatusPoll = null;
let browserListPoll = null;
let vaccines = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formToJson(target) {
  const data = Object.fromEntries(new FormData(target).entries());
  delete data.paymentScreenshotFile;
  return data;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function validateScreenshot(file) {
  if (!file) throw new Error("Payment screenshot is required.");
  const lowerName = file.name.toLowerCase();
  const hasValidExtension = allowedScreenshotExtensions.some((ext) => lowerName.endsWith(ext));
  if (!allowedScreenshotTypes.includes(file.type) && !hasValidExtension) {
    throw new Error("Payment screenshot must be JPG, JPEG, or PNG.");
  }
  if (file.size > maxScreenshotBytes) {
    throw new Error("Payment screenshot must be 5 MB or smaller.");
  }
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

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  return "pending";
}

function readStoredRegistrationIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(browserStorageKey) || "[]");
    return Array.isArray(ids) ? [...new Set(ids.filter((id) => typeof id === "string" && id.trim()))] : [];
  } catch (error) {
    return [];
  }
}

function writeStoredRegistrationIds(ids) {
  localStorage.setItem(browserStorageKey, JSON.stringify([...new Set(ids)].slice(0, 20)));
}

function rememberRegistrationId(id) {
  const existingIds = readStoredRegistrationIds().filter((item) => item !== id);
  writeStoredRegistrationIds([id, ...existingIds]);
}

async function fetchRegistration(id) {
  const response = await fetch(`/api/registration/${encodeURIComponent(id)}`);
  if (!response.ok) return null;
  return response.json();
}

async function loadConfig() {
  const response = await fetch("/api/config");
  const config = await response.json();
  vaccines = config.vaccines || [];
  upiId.value = config.payment.upiId || "9325339930-2@ybl";
  paymentQrImage.src = config.payment.referenceQrImage;
  vaccineSelect.innerHTML = `<option value="">Select vaccine</option>${vaccines
    .map((vaccine) => `<option value="${escapeHtml(vaccine.id)}">${escapeHtml(vaccine.name)}</option>`)
    .join("")}`;
}

function updatePaymentForVaccine() {
  const vaccine = vaccines.find((item) => item.id === vaccineSelect.value);
  paymentAmount.value = vaccine ? vaccine.price : "";

  if (!vaccine) {
    paymentQrText.textContent = "Select a vaccine to view the fee. Pay using any UPI app and upload payment proof below.";
    return;
  }

  paymentQrText.textContent = `${vaccine.name}: Rs ${vaccine.price}. Pay using any UPI app and upload payment proof below.`;
}

function updateRegistrationStatusUI(status, regId) {
  resultPayment.textContent = status;
  resultStatus.textContent = status;

  const resultBanner = document.querySelector("#resultBanner");
  const resultBannerTitle = document.querySelector("#resultBannerTitle");
  const resultBannerText = document.querySelector("#resultBannerText");

  if (status === "Approved") {
    resultBannerTitle.textContent = "Registration Approved!";
    resultBannerText.textContent = "Your payment is verified. You can now download your receipt below.";
    resultBanner.style.borderColor = "rgba(4, 120, 87, 0.4)";
    resultBanner.style.backgroundColor = "var(--success-bg)";
    receiptLink.href = `receipt.html?id=${encodeURIComponent(regId)}`;
    receiptLink.className = "primary";
    receiptLink.classList.remove("hidden");
    return;
  }

  if (status === "Rejected") {
    resultBannerTitle.textContent = "Payment Verification Rejected";
    resultBannerText.textContent = "Your payment screenshot was rejected by the admin. Please contact the organizer or submit a corrected registration.";
    resultBanner.style.borderColor = "rgba(225, 29, 72, 0.4)";
    resultBanner.style.backgroundColor = "#fff1f2";
    receiptLink.classList.add("hidden");
    return;
  }

  resultBannerTitle.textContent = "Registration submitted successfully.";
  resultBannerText.textContent = "Your payment is under verification. You will receive confirmation after admin approval.";
  resultBanner.style.borderColor = "";
  resultBanner.style.backgroundColor = "";
  receiptLink.classList.add("hidden");
}

function showCurrentRegistration(record) {
  registrationId.textContent = record.registrationId;
  resultName.textContent = record.fullName;
  resultEmpty.classList.add("hidden");
  resultCard.classList.remove("hidden");
  updateRegistrationStatusUI(record.paymentStatus, record.registrationId);
  if (record.paymentStatus === "Pending Verification") startStatusPolling(record.registrationId);
}

function renderBrowserRegistrations(records) {
  if (!records.length) {
    browserRegistrationsSection.classList.add("hidden");
    browserRegistrationsList.innerHTML = "";
    browserRegistrationCount.textContent = "0 records";
    return;
  }

  browserRegistrationsSection.classList.remove("hidden");
  browserRegistrationCount.textContent = `${records.length} record${records.length === 1 ? "" : "s"}`;
  browserRegistrationsList.innerHTML = records
    .map((record) => {
      const receiptAction =
        record.paymentStatus === "Approved"
          ? `<a class="secondary" href="receipt.html?id=${encodeURIComponent(record.registrationId)}" target="_blank" rel="noopener">Download Receipt</a>`
          : `<span class="muted mini-note">Receipt after approval</span>`;

      return `
        <article class="browser-registration-card">
          <div>
            <h4>${escapeHtml(record.fullName)}</h4>
            <p>${escapeHtml(record.registrationId)}</p>
            <p>${escapeHtml(record.vaccine)} · Rs ${escapeHtml(record.paymentAmount)}</p>
            <p>Submitted: ${escapeHtml(formatDate(record.createdAt))}</p>
          </div>
          <div class="browser-registration-actions">
            <span class="status ${statusClass(record.paymentStatus)}">${escapeHtml(record.paymentStatus)}</span>
            <button class="secondary" type="button" data-registration-id="${escapeHtml(record.registrationId)}">View Status</button>
            ${receiptAction}
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadBrowserRegistrations(options = {}) {
  const ids = readStoredRegistrationIds();
  if (!ids.length) {
    renderBrowserRegistrations([]);
    return [];
  }

  const records = (await Promise.all(ids.map(fetchRegistration))).filter(Boolean);
  writeStoredRegistrationIds(records.map((record) => record.registrationId));
  renderBrowserRegistrations(records);

  const selectedRecord = options.selectId
    ? records.find((record) => record.registrationId === options.selectId)
    : options.showLatest
      ? records[0]
      : null;
  if (selectedRecord) showCurrentRegistration(selectedRecord);

  scheduleBrowserListPolling(records);
  return records;
}

function scheduleBrowserListPolling(records) {
  const hasPending = records.some((record) => record.paymentStatus === "Pending Verification");
  if (hasPending && !browserListPoll) {
    browserListPoll = setInterval(() => loadBrowserRegistrations(), 5000);
  }
  if (!hasPending && browserListPoll) {
    clearInterval(browserListPoll);
    browserListPoll = null;
  }
}

function startStatusPolling(regId) {
  if (activeStatusPoll) clearInterval(activeStatusPoll);
  activeStatusPoll = setInterval(async () => {
    try {
      const record = await fetchRegistration(regId);
      if (!record) return;
      if (registrationId.textContent === regId) updateRegistrationStatusUI(record.paymentStatus, regId);
      await loadBrowserRegistrations();
      if (record.paymentStatus === "Approved" || record.paymentStatus === "Rejected") {
        clearInterval(activeStatusPoll);
        activeStatusPoll = null;
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, 5000);
}

vaccineSelect.addEventListener("change", updatePaymentForVaccine);

paymentModeSelect.addEventListener("change", () => {
  if (paymentModeSelect.value === "UPI ID") {
    upiIdContainer.classList.remove("hidden");
    paymentQrBlock.classList.add("hidden");
    downloadPaymentQr.classList.add("hidden");
  } else if (paymentModeSelect.value === "QR Code") {
    upiIdContainer.classList.add("hidden");
    paymentQrBlock.classList.remove("hidden");
    downloadPaymentQr.classList.remove("hidden");
  } else {
    upiIdContainer.classList.add("hidden");
    paymentQrBlock.classList.add("hidden");
    downloadPaymentQr.classList.add("hidden");
  }
});

const termsLink = document.querySelector("#termsLink");
if (termsLink) {
  termsLink.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Terms and Conditions:\n\nI understand that once paid, the money is non-refundable.");
  });
}

downloadPaymentQr.addEventListener("click", () => {
  if (!paymentQrImage.src) return;
  const link = document.createElement("a");
  link.href = paymentQrImage.src;
  link.download = "upi-payment-qr.jpeg";
  document.body.appendChild(link);
  link.click();
  link.remove();
});

browserRegistrationsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-registration-id]");
  if (!button) return;
  const record = await fetchRegistration(button.dataset.registrationId);
  if (record) showCurrentRegistration(record);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "Submitting registration...";
  formMessage.classList.remove("error");

  try {
    validateScreenshot(paymentScreenshot.files[0]);
    const body = formToJson(form);
    body.paymentScreenshot = await fileToDataUrl(paymentScreenshot.files[0]);

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not save registration.");

    const record = payload.registration;
    rememberRegistrationId(record.registrationId);
    showCurrentRegistration(record);
    await loadBrowserRegistrations({ selectId: record.registrationId });
    formMessage.textContent =
      "Registration submitted successfully. Your payment is under verification. You will receive confirmation after admin approval.";

    form.reset();
    draftFields.forEach(field => sessionStorage.removeItem(`draft_${field}`));
    updatePaymentForVaccine();
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.classList.add("error");
  }
});

const draftFields = ["fullName", "age", "gender", "phone", "email", "vaccineId", "dose"];

document.addEventListener("DOMContentLoaded", () => {
  draftFields.forEach(field => {
    const input = form.elements[field];
    const saved = sessionStorage.getItem(`draft_${field}`);
    if (input && saved) {
      input.value = saved;
    }
  });
  updatePaymentForVaccine();
});

form.addEventListener("input", (e) => {
  if (draftFields.includes(e.target.name)) {
    sessionStorage.setItem(`draft_${e.target.name}`, e.target.value);
  }
});

loadConfig();
loadBrowserRegistrations({ showLatest: true });
