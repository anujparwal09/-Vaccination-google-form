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
const upiId = document.querySelector("#upiId");
const paymentQrImage = document.querySelector("#paymentQrImage");
const paymentQrText = document.querySelector("#paymentQrText");
const paymentScreenshot = document.querySelector("#paymentScreenshot");
const downloadPaymentQr = document.querySelector("#downloadPaymentQr");
const maxScreenshotBytes = 5 * 1024 * 1024;
const allowedScreenshotTypes = ["image/jpeg", "image/png"];
const allowedScreenshotExtensions = [".jpg", ".jpeg", ".png"];
let pollInterval = null;
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

async function loadConfig() {
  const response = await fetch("/api/config");
  const config = await response.json();
  vaccines = config.vaccines || [];
  upiId.value = config.payment.upiId;
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

function startPolling(regId) {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/registration/${encodeURIComponent(regId)}`);
      const record = await response.json();
      if (!response.ok) return;
      updateRegistrationStatusUI(record.paymentStatus, regId);
      if (record.paymentStatus === "Approved" || record.paymentStatus === "Rejected") {
        clearInterval(pollInterval);
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, 5000);
}

vaccineSelect.addEventListener("change", updatePaymentForVaccine);

downloadPaymentQr.addEventListener("click", () => {
  if (!paymentQrImage.src) return;
  const link = document.createElement("a");
  link.href = paymentQrImage.src;
  link.download = "upi-payment-qr.jpeg";
  document.body.appendChild(link);
  link.click();
  link.remove();
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
    registrationId.textContent = record.registrationId;
    resultName.textContent = record.fullName;
    resultEmpty.classList.add("hidden");
    resultCard.classList.remove("hidden");
    updateRegistrationStatusUI(record.paymentStatus, record.registrationId);
    formMessage.textContent =
      "Registration submitted successfully. Your payment is under verification. You will receive confirmation after admin approval.";

    startPolling(record.registrationId);
    form.reset();
    updatePaymentForVaccine();
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.classList.add("error");
  }
});

loadConfig();
