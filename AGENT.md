# AGENT.md — Developer & Autonomous Agent Handover Guide

> **Repository:** [ZuiGO/Zuigo-Due-Remainder](https://github.com/ZuiGO/Zuigo-Due-Remainder)  
> **Git Identity:** `zuigo <jayesh@zuigo.ai>`  
> **Remote Origin:** `https://github.com/ZuiGO/Zuigo-Due-Remainder.git`  
> **Platform Purpose:** Automated and manual receivables recovery platform that accepts real Excel/CSV workbooks, handles multiple invoices and contacts per customer, tracks due dates & milestone installments, automates multi-channel payment reminders (WhatsApp, SMS, Email), generates personalized messages with Groq AI, and automatically flags defaulters after 4-5 unanswered reminders.

---

## 1. System Architecture & Tech Stack

- **Framework:** Next.js 14.2 (App Router) + React 18 + TypeScript + Tailwind CSS
- **Database & ORM:** **PostgreSQL 18** (`zuigo_due_reminder`) on `localhost:5432` via **Prisma ORM** (`DATABASE_URL="postgresql://postgres:zuigo@localhost:5432/zuigo_due_reminder?schema=public"` in `.env`).
- **PostgreSQL Tables:**
  1. `User` — User accounts with scrypt hashed passwords and role (`ADMIN`, `MANAGER`, `VIEWER`).
  2. `Customer` — Master customer records, normalized party names, total outstanding balance, defaulter flags.
  3. `CustomerContact` — Normalized 1-to-many contact profiles (primary contact, multiple phones, multiple emails).
  4. `Invoice` — Bill-level records: `billNo`, `billDate`, `dueDate`, `billAmount`, `adjustment`, `outstandingAmount`, `daysOverdue`, `agingBucket`, `status` (`Pending`, `Payment Received`, `Partially Paid`, `Promise to Pay`, `Disputed`, etc.).
  5. `Installment` — Milestone installment plans ($N$ installments with due dates linked to invoices).
  6. `PaymentRecord` — Partial payment logs with UTR/mode and notes.
  7. `MessageTemplate` — WhatsApp, SMS, and Email templates with dynamic placeholders.
  8. `IntegrationSetting` — Channel API keys and provider toggles (WhatsApp, SMS, Email, Groq AI).
  9. `ReminderLog` — Complete audit trail of dispatched reminders.
  10. `ReminderSchedule` — Automated cadence intervals ($T-3$, $0$, $T+3$, $T+7$, $T+15$, and 5-reminder threshold).

- **Authentication System (`src/lib/auth.ts`):**
  - Secure scrypt hashing with per-user salt and signed stateless session tokens via `HTTP-only` cookies (`zuigo_session`).
  - Endpoints: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`.
  - Frontend: `/login` and `/register` pages, and `AppShell.tsx` protecting internal routes.
  - Default Administrator Seeded: `jayesh@zuigo.ai` (Password: `zuigo123`).

- **Direct Dispatch & Test Target Routing:**
  - **WhatsApp Message:** Directly opens WhatsApp Web / App (`https://wa.me/918530383141?text=...`) targeting **`+918530383141`**, while recording the reminder log in PostgreSQL.
  - **Text Message (SMS):** Directly opens the SMS application (`sms:+918530383141?body=...`) targeting **`+918530383141`**, while recording the reminder log in PostgreSQL.
  - **Email:** Directly opens the default email client (`mailto:jayesh@zuigo.ai?subject=...&body=...`) targeting **`jayesh@zuigo.ai`**, while recording the reminder log in PostgreSQL.

- **Groq AI Integration (`src/lib/groq.ts` & `/api/groq/generate`):**
  - Powered by model **`qwen/qwen3.8-27b`** via `GROQ_API_KEY` in `.env`.
  - Intelligently modulates message tone according to aging bucket:
    - Advance ($T-3$): Courteous advance notice.
    - Day 0: Prompt notification for today's due date.
    - 1-30 days overdue: Friendly follow-up.
    - 31-60 days overdue: Firm business reminder.
    - 60+ days overdue: Urgent escalation warning.
  - In the reminder modal, a **"✨ Generate with Groq AI"** button automatically crafts personalized ready-to-send messages.

- **Real Excel Workbook & Daily SAP ALV Ingestion (`src/lib/parser.ts`, `src/lib/diff-engine.ts` & `/api/upload`):**
  - Accepts `.xlsx`, `.xls` (including SAP ALV HTML table exports), and `.csv` via drag & drop or file selection.
  - **Filename-Agnostic Structure Detection:** Distinguishes SAP Dues exports from Customer Contact sheets by inspecting column headers (`bill no`, `outstanding`, `contact person`, `company name`).
  - **Multi-Contact & Semicolon Delimiter Unpacking:** Parses real-world spreadsheets where cells have multiple names, phones, or emails delimited by semicolons (e.g. `Smit Satpute ; Vinod Kale`, `89560 81914;70309 40425`, `sumit.satpute@parason.com; vinod.kale@parason.com`). Automatically creates individual primary/secondary `CustomerContact` profiles.
  - **Smart Two-Way Customer Join:** Matches by `Ledger Code` when present, with fallback normalized prefix matching on `Company Name` / `Party Name`. If contacts are uploaded before SAP dues, creates a placeholder customer that seamlessly updates to the official SAP ledger code when dues are imported.
  - **Missing Contacts Detection:** Automatically flags companies that have no contact phone or email (e.g. `OSHIYA METALS PRIVATE LIMITED`) so teams can take action.
  - **Daily SAP ALV Diff Reconciliation:** Categorizes daily imported bills against the database: `[NEW TODAY]`, `[PERSISTENT / SAME]`, `[PARTIAL PAYMENT DETECTED]`, and `[SETTLED IN SAP]`.
  - **Promise-to-Pay (PTP):** Automatically records customer installment commitments (e.g. ₹5,000 paid, ₹5,000 promised next week) and pauses reminders until the committed date.
  - **Per-Customer Daily Digest Messaging:** Consolidates all open bills for a customer into 1 single message per channel per day (`{bills_list}` sorted by days overdue), with run-lock mutex and daily idempotency.

- **Clear Column Separation:**
  - Replaced the confusing combined "Paid/Remaining" column with 3 clear, distinct columns:
    1. **Bill Amount (₹)**: Original invoice amount (`billAmount`).
    2. **Paid / Adjusted (₹)**: Total paid or adjusted amount (`adjustment`).
    3. **Outstanding Due (₹)**: Outstanding balance prominently styled in bold red/amber (`outstandingAmount`).

- **Manual Payment Status Control (`/api/invoices/status`):**
  - Dropdown options: `Pending`, `Payment Received`, `Partially Paid`, `Promise to Pay`, `Disputed`, `Escalated`, `Legal Notice`.
  - Quick 1-click **"Mark Paid"** button: immediately zeroes `outstandingAmount`, sets status to `Payment Received`, records a payment record, and updates the customer's total balance.

- **Automated Reminder Cadence Engine (`src/lib/reminder-engine.ts`, `src/lib/worker.ts`):**
  - Automatically evaluates active invoices:
    - Approaching due date ($T-3$)
    - Due date today
    - Overdue ($T+3$, $T+7$, $T+15$)
  - Auto-flags customer as `FLAGGED` after 4-5 unanswered reminders.

---

## 2. Directory Structure

```
├── .gitignore
├── .npmrc                   <-- strict-ssl=false for proxy environments
├── AGENT.md                 <-- Handover documentation (keep updated!)
├── README.md                <-- User and developer overview
├── package.json             <-- Node scripts and dependencies
├── tsconfig.json            <-- TypeScript configuration
├── prisma/
│   ├── schema.prisma        <-- PostgreSQL schema: User, Customer, Contact, Invoice, Installment, Payment, Template, Log
│   └── seed.ts              <-- Seeds templates, default cadence schedule & default integrations (no fake customers)
├── src/
│   ├── lib/
│   │   ├── auth.ts             <-- scrypt password hashing & session token management
│   │   ├── db.ts               <-- Prisma client singleton
│   │   ├── groq.ts             <-- Groq AI client using qwen/qwen3.8-27b
│   │   ├── parser.ts           <-- Excel workbook & CSV parser (.xlsx, .xls, .csv)
│   │   ├── payment-engine.ts   <-- Installments, payments, and reconciliation
│   │   ├── template-renderer.ts<-- Dynamic placeholder interpolator
│   │   ├── reminder-engine.ts  <-- Aging calculation, cadence matching & defaulter flagging
│   │   ├── worker.ts           <-- Automated reminder runner
│   │   └── dispatchers/
│   │       └── index.ts        <-- Multi-channel delivery engine (WhatsApp, SMS, Email)
│   ├── components/
│   │   └── AppShell.tsx        <-- Client shell with auth check, user badge & logout
│   ├── tests/
│   │   ├── parser.test.ts          <-- Excel parsing tests
│   │   ├── payment-engine.test.ts  <-- Payment & installment tests
│   │   ├── reminder-engine.test.ts <-- Cadence & flagging tests
│   │   ├── template-renderer.test.ts<-- Template placeholder tests
│   │   └── worker.test.ts          <-- Automated reminder worker integration test (16 tests total, all passing!)
│   └── app/
│       ├── layout.tsx          <-- Root layout with AppShell wrapper
│       ├── page.tsx            <-- Dashboard with KPIs, drag & drop Excel upload, empty state, watchlist
│       ├── dues/page.tsx       <-- Invoices table with separated columns, status dropdown, quick mark paid
│       ├── login/page.tsx      <-- Login page with encrypted session authentication
│       ├── register/page.tsx   <-- Registration page for new users
│       ├── customers/page.tsx  <-- Customer directory, contacts, total due & defaulter toggles
│       ├── templates/page.tsx  <-- Template designer with live WhatsApp/SMS/Email previews
│       ├── settings/page.tsx   <-- Channel API credentials & automated cadence config
│       ├── logs/page.tsx       <-- Audit logs of all reminders dispatched
│       └── api/
│           ├── auth/           <-- Login, register, me, logout endpoints
│           ├── upload/route.ts <-- Real multipart Excel (.xlsx/.xls/.csv) ingestion
│           ├── groq/generate/  <-- Groq AI reminder generation endpoint
│           ├── customers/      <-- Customer master & flag toggle
│           ├── dues/route.ts   <-- Invoice receivables query & KPIs
│           ├── invoices/status/<-- Manual invoice status updater
│           ├── payments/       <-- Record manual payment / installment
│           ├── installments/   <-- Split invoice into milestone installments
│           ├── reminders/
│           │   ├── send/route.ts     <-- Manual reminder trigger with action URLs
│           │   └── auto-check/route.ts<-- Automated cron trigger
│           ├── templates/route.ts    <-- Template CRUD
│           ├── settings/route.ts     <-- Credentials & cadence settings
│           └── logs/route.ts         <-- Delivery logs
```

---

## 3. How to Run & Verify

1. **Prisma & Database:**
   ```powershell
   npx prisma db push
   ```
2. **Run Tests:**
   ```powershell
   npx tsx --test src/tests/parser.test.ts src/tests/payment-engine.test.ts src/tests/reminder-engine.test.ts src/tests/template-renderer.test.ts src/tests/worker.test.ts
   ```
3. **Build Application:**
   ```powershell
   npm run build
   ```
4. **Start Development Server:**
   ```powershell
   npm run dev
   ```
   Open `http://localhost:3000`. Login with `jayesh@zuigo.ai` / `zuigo123` or register a new account.
