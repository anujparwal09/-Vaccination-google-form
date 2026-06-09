# Vaccination Drive Registration Software

This web app lets staff register vaccination participants, collect manual UPI payment proof, let the admin approve or reject payments, generate approved receipts, and keep all records in an Excel file.

## Run

```powershell
npm.cmd install
npm.cmd start
```

Check the project before deploying or committing:

```powershell
npm.cmd test
```

Optional payment settings:

```powershell
$env:PORT="3000"
$env:DATA_DIR="./data"
$env:PAYMENT_UPI_ID="your-upi-id"
$env:PAYMENT_PAYEE_NAME="Payee Name"
npm.cmd start
```

Open:

```text
http://localhost:3000
```

## What it stores

- `data/registrations.json`: local registration database
- `data/payment-screenshots/`: uploaded payment screenshots
- `data/vaccination_registrations.xlsx`: Excel file updated after registration, admin approval or rejection, and verification

For public deployment, set `DATA_DIR` to a persistent disk or volume path.

## Main screens

- Registration: `http://localhost:3000`
- Verification: `http://localhost:3000/verify.html`
- Admin payment verification: `http://localhost:3000/admin.html`
- Receipt download: `http://localhost:3000/receipt.html?id=<registration-id>`

Admin password is `Vac@7890`.

## Permanent Public URL With Render

Use this if you want a permanent public link such as `https://your-app.onrender.com`.

1. Create a GitHub account or use your existing GitHub account.
2. Create a new GitHub repository.
3. Upload this project folder to that repository.
4. Create a Render account at `https://render.com`.
5. In Render, choose **New +** then **Blueprint**.
6. Connect the GitHub repository.
7. Render will read `render.yaml` and create a web service with a persistent disk.
8. Deploy the service.
9. After deploy finishes, Render gives you a permanent public URL.

Important: keep the persistent disk enabled. Without it, registrations, payment screenshots, and Excel data can be lost after redeploys.

The repository `.gitignore` excludes runtime data, uploads, Excel exports, logs, local environment files, and `node_modules/`.

## Vercel Note

This project uses an Express server, local JSON storage, uploaded payment screenshots, and generated Excel files. Vercel is not the right deployment target for this exact setup unless the storage layer is rebuilt to use a database and cloud file storage. Render with a persistent disk is the recommended deployment path for the current codebase.

## Manual Render Settings

If you do not use Blueprint, create a Web Service with:

- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `DATA_DIR=/var/data`
- Environment variable: `PAYMENT_UPI_ID=9325339930@sbi`
- Environment variable: `PAYMENT_PAYEE_NAME=Yash Biyani`
- Persistent disk mount path: `/var/data`
