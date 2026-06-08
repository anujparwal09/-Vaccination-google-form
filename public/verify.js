const lookupForm = document.querySelector("#lookupForm");
const lookupId = document.querySelector("#lookupId");
const lookupMessage = document.querySelector("#lookupMessage");
const verificationCard = document.querySelector("#verificationCard");
const verifyButton = document.querySelector("#verifyButton");
const receiptButton = document.querySelector("#receiptButton");
let currentRegistrationId = "";

function setText(id, value) {
  document.querySelector(id).textContent = value || "-";
}

function renderRecord(record) {
  currentRegistrationId = record.registrationId;
  verificationCard.classList.remove("hidden");
  setText("#personName", record.fullName);
  setText("#verificationStatus", record.verificationStatus);
  setText("#vRegistrationId", record.registrationId);
  setText("#vPhone", record.phone);
  setText("#vAgeGender", `${record.age} / ${record.gender}`);
  setText("#vVaccine", record.vaccine);
  const batchRow = document.querySelector("#vBatchNameRow");
  if (record.batchName) {
    batchRow.classList.remove("hidden");
    setText("#vBatchName", record.batchName);
  } else {
    batchRow.classList.add("hidden");
  }
  setText("#vDose", record.dose);
  setText("#vPayment", record.paymentStatus);
  setText("#vVerifiedAt", record.verifiedAt);
  verifyButton.disabled = record.verificationStatus === "Verified" || record.paymentStatus !== "Approved";
  verifyButton.textContent =
    record.verificationStatus === "Verified"
      ? "Already Verified"
      : record.paymentStatus === "Approved"
        ? "Mark as Verified"
        : "Awaiting Payment Approval";
  receiptButton.href = `receipt.html?id=${encodeURIComponent(record.registrationId)}`;
  receiptButton.classList.toggle("hidden", record.paymentStatus !== "Approved");
}

async function fetchRegistration(id) {
  lookupMessage.textContent = "Looking up registration...";
  lookupMessage.classList.remove("error");

  try {
    const response = await fetch(`/api/registration/${encodeURIComponent(id)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Registration not found.");
    renderRecord(payload);
    lookupMessage.textContent = "Registration found.";
  } catch (error) {
    verificationCard.classList.add("hidden");
    lookupMessage.textContent = error.message;
    lookupMessage.classList.add("error");
  }
}

lookupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  fetchRegistration(lookupId.value.trim());
});

verifyButton.addEventListener("click", async () => {
  if (!currentRegistrationId) return;
  lookupMessage.textContent = "Updating verification...";

  try {
    const response = await fetch(`/api/verify/${encodeURIComponent(currentRegistrationId)}`, {
      method: "POST"
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not verify registration.");
    renderRecord(payload);
    lookupMessage.textContent = "Participant marked as verified and Excel file updated.";
  } catch (error) {
    lookupMessage.textContent = error.message;
    lookupMessage.classList.add("error");
  }
});

const params = new URLSearchParams(window.location.search);
const idFromQr = params.get("id");
if (idFromQr) {
  lookupId.value = idFromQr;
  fetchRegistration(idFromQr);
}
