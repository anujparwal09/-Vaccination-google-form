# Repository Guidelines

## Project Structure & Module Organization

This is a small Express application with static frontend pages. `server.js` owns the API, local JSON persistence, screenshot storage, QR generation, receipt links, and Excel export. `public/` contains the browser UI: `index.html`/`app.js` for registration, `admin.html`/`admin.js` for payment verification, `verify.html`/`verify.js` for participant verification, and `receipt.html`/`receipt.js` for approved receipts. Static brand and payment assets live in `public/assets/`.

Runtime data is intentionally not versioned. The app creates `data/registrations.json`, `data/payment-screenshots/`, and `data/vaccination_registrations.xlsx` at runtime or under `DATA_DIR`.

## Build, Test, and Development Commands

Install dependencies:

```powershell
npm install
```

Run locally:

```powershell
npm start
```

Check JavaScript syntax before committing:

```powershell
npm test
```

`npm test` currently runs `npm run check`, which verifies `server.js` and each browser script with `node --check`.

## Coding Style & Naming Conventions

The project uses plain CommonJS JavaScript, HTML, and CSS with no build step. Keep backend helpers in `server.js` small and named by behavior, such as `normalizeRegistration` or `saveExcel`. Frontend scripts use DOM IDs from their matching HTML page; update the HTML and JS together when changing UI controls.

## Deployment Notes

Render deployment is configured through `render.yaml`. Keep `DATA_DIR=/var/data` and the persistent disk enabled so registrations, uploaded screenshots, and Excel exports survive redeploys. Set `ADMIN_PASSWORD`, `PAYMENT_UPI_ID`, and `PAYMENT_PAYEE_NAME` in the hosting environment, not in committed files. Do not commit `.env`, `data/`, uploaded screenshots, generated Excel files, logs, or `node_modules/`.
