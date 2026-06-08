const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ExcelJS = require("exceljs");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const DB_FILE = path.join(DATA_DIR, "registrations.json");
const EXCEL_FILE = path.join(DATA_DIR, "vaccination_registrations.xlsx");
const SCREENSHOT_DIR = path.join(DATA_DIR, "payment-screenshots");
const ADMIN_PASSWORD = "Vac@7890";
const PAYMENT_UPI_ID = process.env.PAYMENT_UPI_ID || "9325339930@sbi";
const PAYMENT_PAYEE_NAME = process.env.PAYMENT_PAYEE_NAME || "Yash Biyani";
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const PAYMENT_STATUS = {
  PENDING: "Pending Verification",
  APPROVED: "Approved",
  REJECTED: "Rejected"
};
const VACCINES = [
  { id: "ceravac-hpv", name: "ceravac-HPV", price: 1300 },
  { id: "revac-b-hbv", name: "Revac-B+ -HBV vaccine", price: 75 },
  { id: "both-vaccines", name: "Both (ceravac-HPV & Revac-B+)", price: 1375 }
];

const HEADERS = [
  "Registration ID",
  "Name",
  "Phone",
  "Email",
  "Vaccine",
  "Dose",
  "Amount",
  "Payment Status",
  "Approval Date",
  "Registration Date",
  "Age",
  "Gender",
  "Batch Name",
  "Payment Mode",
  "UPI ID",
  "Payment Screenshot",
  "Rejection Reason",
  "Verification Status",
  "Verified At"
];

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(express.static(PUBLIC_DIR));

function normalizePaymentStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "approved" || value === "confirmed") return PAYMENT_STATUS.APPROVED;
  if (value === "rejected") return PAYMENT_STATUS.REJECTED;
  return PAYMENT_STATUS.PENDING;
}

function getApprovalDate(record) {
  return record.approvalDate || record.paymentConfirmedAt || "";
}

function normalizeStoredRecord(record) {
  const paymentStatus = normalizePaymentStatus(record.paymentStatus);

  return {
    ...record,
    paymentStatus,
    verificationStatus: record.verificationStatus || "Pending",
    verifiedAt: record.verifiedAt || "",
    approvalDate: paymentStatus === PAYMENT_STATUS.APPROVED ? getApprovalDate(record) : record.approvalDate || "",
    paymentConfirmedAt: paymentStatus === PAYMENT_STATUS.APPROVED ? getApprovalDate(record) : record.paymentConfirmedAt || "",
    rejectedAt: record.rejectedAt || "",
    rejectionReason: record.rejectionReason || ""
  };
}

function readRegistrations() {
  if (!fs.existsSync(DB_FILE)) return [];
  const records = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return Array.isArray(records) ? records.map(normalizeStoredRecord) : [];
}

function writeRegistrations(records) {
  fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2));
}

function createRegistrationId() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const token = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `VAC-${stamp}-${token}`;
}

function getVaccine(vaccineId) {
  return VACCINES.find((vaccine) => vaccine.id === vaccineId);
}

function confirmationUrl(req, registrationId) {
  return `${req.protocol}://${req.get("host")}/verify.html?id=${encodeURIComponent(registrationId)}`;
}

function receiptUrl(req, registrationId) {
  return `${req.protocol}://${req.get("host")}/receipt.html?id=${encodeURIComponent(registrationId)}`;
}

function hasAdminAccess(req, res) {
  if (req.body.password !== ADMIN_PASSWORD) {
    res.status(403).json({ error: "Invalid admin password." });
    return false;
  }
  return true;
}

function parsePaymentScreenshot(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/png|image\/jpe?g);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("Payment screenshot must be a JPG, JPEG, or PNG image.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_SCREENSHOT_BYTES) {
    throw new Error("Payment screenshot must be 5 MB or smaller.");
  }

  const ext = match[1] === "image/png" ? "png" : "jpg";
  return { buffer, ext, mime: match[1] };
}

function savePaymentScreenshot(record, dataUrl) {
  const screenshot = parsePaymentScreenshot(dataUrl);
  const filename = `${record.registrationId}.${screenshot.ext}`;
  fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), screenshot.buffer);
  record.paymentScreenshot = filename;
  record.paymentScreenshotMime = screenshot.mime;
}

function readPaymentScreenshot(record) {
  if (!record.paymentScreenshot) return "";
  const screenshotPath = path.join(SCREENSHOT_DIR, record.paymentScreenshot);
  if (!fs.existsSync(screenshotPath)) return "";
  const ext = path.extname(screenshotPath).slice(1).toLowerCase();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
  return `data:${mime};base64,${fs.readFileSync(screenshotPath).toString("base64")}`;
}

function normalizeRegistration(body) {
  const vaccine = getVaccine(String(body.vaccineId || "").trim());

  return {
    registrationId: createRegistrationId(),
    createdAt: new Date().toISOString(),
    fullName: String(body.fullName || "").trim(),
    age: Number(body.age || 0),
    gender: String(body.gender || "").trim(),
    phone: String(body.phone || "").trim(),
    email: String(body.email || "").trim(),
    address: String(body.address || "").trim(),
    batchName: String(body.batchName || body.batchNumber || "").trim(),
    vaccineId: vaccine ? vaccine.id : "",
    vaccine: vaccine ? vaccine.name : "",
    dose: String(body.dose || "").trim(),
    paymentAmount: vaccine ? vaccine.price : 0,
    paymentMode: "UPI",
    upiId: PAYMENT_UPI_ID,
    paymentStatus: PAYMENT_STATUS.PENDING,
    approvalDate: "",
    paymentConfirmedAt: "",
    paymentScreenshot: "",
    paymentScreenshotMime: "",
    rejectionReason: "",
    rejectedAt: "",
    verificationStatus: "Pending",
    verifiedAt: ""
  };
}

function validateRegistration(record, body) {
  const required = [
    "fullName",
    "age",
    "gender",
    "phone",
    "vaccine",
    "dose",
    "paymentStatus"
  ];

  for (const key of required) {
    if (record[key] === "" || record[key] === 0 || Number.isNaN(record[key])) {
      return `${key} is required.`;
    }
  }
  if (!body.paymentScreenshot) return "Payment screenshot is required.";
  return null;
}

function toExcelRow(record) {
  return [
    record.registrationId,
    record.fullName,
    record.phone,
    record.email,
    record.vaccine,
    record.dose,
    record.paymentAmount,
    record.paymentStatus,
    getApprovalDate(record),
    record.createdAt,
    record.age,
    record.gender,
    record.batchName || record.batchNumber || "",
    record.paymentMode,
    record.upiId || "",
    record.paymentScreenshot || "",
    record.rejectionReason || "",
    record.verificationStatus,
    record.verifiedAt
  ];
}

async function saveExcel(records) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vaccination Drive Registration Software";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Registrations", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.addRow(HEADERS);
  records.forEach((record) => sheet.addRow(toExcelRow(record)));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F766E" }
  };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  sheet.columns = [
    { width: 22 }, // Registration ID
    { width: 24 }, // Name
    { width: 16 }, // Phone
    { width: 26 }, // Email
    { width: 18 }, // Vaccine
    { width: 16 }, // Dose
    { width: 18 }, // Amount
    { width: 22 }, // Payment Status
    { width: 24 }, // Approval Date
    { width: 24 }, // Registration Date
    { width: 8 },  // Age
    { width: 12 }, // Gender
    { width: 16 }, // Batch Name
    { width: 16 }, // Payment Mode
    { width: 16 }, // UPI ID
    { width: 24 }, // Payment Screenshot
    { width: 28 }, // Rejection Reason
    { width: 18 }, // Verification Status
    { width: 18 }  // Verified At
  ];
  sheet.autoFilter = { from: "A1", to: "S1" };
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } }
      };
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });

  await workbook.xlsx.writeFile(EXCEL_FILE);
}

function publicRecord(record) {
  const paymentStatus = normalizePaymentStatus(record.paymentStatus);

  return {
    registrationId: record.registrationId,
    createdAt: record.createdAt,
    fullName: record.fullName,
    age: record.age,
    gender: record.gender,
    phone: record.phone,
    vaccine: record.vaccine,
    batchName: record.batchName || record.batchNumber || "",
    dose: record.dose,
    paymentAmount: record.paymentAmount,
    paymentMode: record.paymentMode,
    upiId: record.upiId || PAYMENT_UPI_ID,
    paymentStatus,
    approvalDate: paymentStatus === PAYMENT_STATUS.APPROVED ? getApprovalDate(record) : "",
    paymentConfirmedAt: paymentStatus === PAYMENT_STATUS.APPROVED ? getApprovalDate(record) : "",
    rejectionReason: paymentStatus === PAYMENT_STATUS.REJECTED ? record.rejectionReason || "" : "",
    verificationStatus: record.verificationStatus,
    verifiedAt: record.verifiedAt,
    receiptAvailable: paymentStatus === PAYMENT_STATUS.APPROVED
  };
}

function adminRecord(record) {
  return {
    ...publicRecord(record),
    email: record.email,
    address: record.address,
    upiId: record.upiId,
    paymentScreenshotName: record.paymentScreenshot || "",
    paymentScreenshotDataUrl: readPaymentScreenshot(record),
    rejectedAt: record.rejectedAt || ""
  };
}

app.get("/api/registrations", (req, res) => {
  res.status(403).json({ error: "Registration records are available only in the admin panel." });
});

app.get("/api/config", (req, res) => {
  res.json({
    vaccines: VACCINES,
    payment: {
      mode: "UPI",
      upiId: PAYMENT_UPI_ID,
      payeeName: PAYMENT_PAYEE_NAME,
      referenceQrImage: "/assets/upi-payment-qr.jpeg"
    }
  });
});

app.post("/api/register", async (req, res) => {
  try {
    const records = readRegistrations();
    const registration = normalizeRegistration(req.body);
    const validationError = validateRegistration(registration, req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    savePaymentScreenshot(registration, req.body.paymentScreenshot);
    records.push(registration);
    writeRegistrations(records);
    await saveExcel(records);

    res.status(201).json({
      registration: publicRecord(registration)
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not save registration." });
  }
});

app.get("/api/registration/:id", (req, res) => {
  const record = readRegistrations().find((item) => item.registrationId === req.params.id);
  if (!record) return res.status(404).json({ error: "Registration not found." });
  res.json(publicRecord(record));
});

app.post("/api/verify/:id", async (req, res) => {
  const records = readRegistrations();
  const index = records.findIndex((item) => item.registrationId === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Registration not found." });
  if (records[index].paymentStatus !== PAYMENT_STATUS.APPROVED) {
    return res.status(400).json({ error: "Payment must be approved before verification." });
  }

  records[index].verificationStatus = "Verified";
  records[index].verifiedAt = new Date().toISOString();
  writeRegistrations(records);
  await saveExcel(records);
  res.json(publicRecord(records[index]));
});

app.get("/download/excel", async (req, res) => {
  res.status(403).send("Use the admin page to download Excel.");
});

app.post("/api/admin/excel", async (req, res) => {
  if (!hasAdminAccess(req, res)) return;

  let records = readRegistrations();
  const statusFilter = req.body.statusFilter || "all";
  if (statusFilter !== "all") {
    records = records.filter((r) => r.paymentStatus === statusFilter);
  }

  await saveExcel(records);
  res.download(EXCEL_FILE, "vaccination_registrations.xlsx");
});

app.post("/api/admin/registrations", (req, res) => {
  if (!hasAdminAccess(req, res)) return;

  res.json(readRegistrations().map(adminRecord).reverse());
});

async function approvePayment(req, res) {
  if (!hasAdminAccess(req, res)) return;
  const records = readRegistrations();
  const index = records.findIndex((item) => item.registrationId === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Registration not found." });

  const approvedAt = new Date().toISOString();
  records[index].paymentStatus = PAYMENT_STATUS.APPROVED;
  records[index].approvalDate = approvedAt;
  records[index].paymentConfirmedAt = approvedAt;
  records[index].rejectionReason = "";
  records[index].rejectedAt = "";
  writeRegistrations(records);
  await saveExcel(records);

  const confirmation = confirmationUrl(req, records[index].registrationId);
  const receipt = receiptUrl(req, records[index].registrationId);
  const confirmationQrDataUrl = await QRCode.toDataURL(confirmation, {
    width: 320,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" }
  });
  const subject = encodeURIComponent("Vaccination registration approved");
  const body = encodeURIComponent(
    `Dear ${records[index].fullName},\n\nYour vaccination payment is approved.\nRegistration ID: ${records[index].registrationId}\nVaccine: ${records[index].vaccine}\nReceipt: ${receipt}\nVerification link: ${confirmation}\n\nPlease carry your approved receipt on the vaccination day.`
  );
  const mailtoUrl = `mailto:${encodeURIComponent(records[index].email || "")}?subject=${subject}&body=${body}`;

  res.json({
    registration: adminRecord(records[index]),
    confirmationUrl: confirmation,
    confirmationQrDataUrl,
    receiptUrl: receipt,
    mailtoUrl
  });
}

app.post("/api/admin/approve-payment/:id", approvePayment);
app.post("/api/admin/confirm-payment/:id", approvePayment);

app.post("/api/admin/reject-payment/:id", async (req, res) => {
  if (!hasAdminAccess(req, res)) return;
  const records = readRegistrations();
  const index = records.findIndex((item) => item.registrationId === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Registration not found." });

  records[index].paymentStatus = PAYMENT_STATUS.REJECTED;
  records[index].approvalDate = "";
  records[index].paymentConfirmedAt = "";
  records[index].rejectedAt = new Date().toISOString();
  records[index].rejectionReason = String(req.body.rejectionReason || "").trim();
  writeRegistrations(records);
  await saveExcel(records);

  res.json({ registration: adminRecord(records[index]) });
});

app.listen(PORT, () => {
  console.log(`Vaccination drive app running at http://localhost:${PORT}`);
});
