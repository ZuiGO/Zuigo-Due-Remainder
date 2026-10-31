# AGENT.md — Developer & Autonomous Agent Handover Guide

> **Repository:** Zuigo Due Remainder  
> **Git Identity:** `zuigo <jayesh@zuigo.ai>`  
> **Platform Purpose:** Automated and manual receivables recovery platform that ingests accounting ledgers & customer contact directories, tracks due dates & installment plans, automates multi-channel payment reminders (WhatsApp, SMS, Email), automatically flags defaulters after 4-5 unanswered reminders, and reconciles payments.

---

## 1. System Architecture & Tech Stack

- **Framework:** Next.js 14.2 (App Router) + React 18 + TypeScript + Tailwind CSS
- **Database & ORM:** SQLite via **Prisma ORM** (`dev.db`), completely switchable to PostgreSQL by providing `DATABASE_URL="postgresql://..."` in `.env`.
- **Data Ingestion:** SheetJS (`xlsx`) + Custom Regex Normalizer (`src/lib/parser.ts`) that strips ERP bracketed codes (e.g. `[ ABMATO ]`), replaces parentheses, formats phone numbers to standard E.164 (`+91...`), and parses semicolon-delimited multiple contacts (`Smit Satpute ; Vinod Kale`).
- **Payment & Installment Engine (`src/lib/payment-engine.ts`):**
  - **Milestone Installment Splitting:** Splits any balance into $N$ equal installments with rounding protection on the final installment.
  - **Reconciliation Diff Engine:** When re-uploading an updated Excel/CSV ledger, if an existing customer's `Dr` balance has decreased, the platform auto-detects that a payment was made, records a reconciled payment record, updates `remainingBalance`, and resets the aggressive reminder count so the customer is acknowledged.
  - **Manual Payment Recording:** Users can record full or partial payments with UTR reference, payment mode, and next installment due date, with optional instant payment receipt messaging.
  - **Settlement:** When remaining balance drops to 0 (or becomes `Cr`), the due is marked as `SETTLED` and customer status unflags.
- **Automated Cadence & Defaulter Escalation Engine (`src/lib/reminder-engine.ts`, `src/lib/worker.ts`):**
  - Evaluates schedules: $T-3$ days (Gentle), Day 0 (Due Date Prompt), $T+3$ days (Overdue Follow-up), $T+7$ days (Urgent), $T+15$ days (Final Notice).
  - Automatically flags customers as `FLAGGED` (`isFlagged: true`) after 4 or 5 consecutive unanswered reminders, halting automated messages to prevent friction while alerting management.
- **Messaging Dispatchers (`src/lib/dispatchers/`):**
  - WhatsApp: Meta WhatsApp Cloud API / Twilio / Built-in Sandbox Simulator
  - SMS: Twilio / MSG91 (DLT) / Fast2SMS / Sandbox Simulator
  - Email: Nodemailer SMTP / Resend / Sandbox Simulator
- **Template Designer (`src/app/templates/page.tsx`):**
  - WYSIWYG editor with live mobile previews (WhatsApp chat bubble, SMS character counter, HTML Email) and dynamic placeholder pills (`{{customer_name}}`, `{{due_amount}}`, `{{due_date}}`, `{{bank_details}}`, etc.).

---

## 2. Directory Structure

```
├── .gitignore
├── .npmrc                   <-- Configured with strict-ssl=false for SSL proxy environments
├── AGENT.md                 <-- Handover documentation (keep updated!)
├── README.md                <-- User and developer overview
├── package.json             <-- Node scripts and dependencies
├── tsconfig.json            <-- TypeScript configuration
├── tailwind.config.js       <-- Styling configuration
├── prisma/
│   ├── schema.prisma        <-- Schema: Customers, Contacts, Dues, Installments, Payments, Templates, Logs
│   └── seed.ts              <-- Seeds Auric City / ABMATO dataset + demo templates
├── src/
│   ├── data/
│   │   ├── sample_ledger.csv   <-- User-provided Ledger Master Outstanding Report
│   │   └── sample_contacts.csv <-- User-provided Customer Contact Directory
│   ├── lib/
│   │   ├── db.ts               <-- Prisma client singleton
│   │   ├── parser.ts           <-- Smart parser: strips codes, filters non-customers, parses contacts
│   │   ├── payment-engine.ts   <-- Installments, payments, and Excel diff reconciliation
│   │   ├── template-renderer.ts<-- Dynamic placeholder interpolator & predefined presets
│   │   ├── reminder-engine.ts  <-- Aging calculation, cadence matching & defaulter flagging
│   │   ├── worker.ts           <-- Automated cron/background worker
│   │   └── dispatchers/
│   │       └── index.ts        <-- Multi-channel delivery engine (WhatsApp, SMS, Email)
│   ├── tests/
│   │   ├── parser.test.ts          <-- 6 unit tests
│   │   ├── payment-engine.test.ts  <-- 6 unit tests
│   │   ├── reminder-engine.test.ts <-- 4 unit tests
│   │   ├── template-renderer.test.ts<-- 2 unit tests
│   │   └── worker.test.ts          <-- 2 integration tests (20 tests total, all passing!)
│   └── app/
│       ├── layout.tsx          <-- Sidebar navigation & shell layout
│       ├── page.tsx            <-- Dashboard with KPIs, quick upload & priority watchlist
│       ├── dues/page.tsx       <-- Dues table, installment split, payment modal, manual dispatch
│       ├── customers/page.tsx  <-- Customer directory & manual defaulter flag toggles
│       ├── templates/page.tsx  <-- Template designer with live WhatsApp/SMS/Email previews
│       ├── settings/page.tsx   <-- Channel API credentials & automated cadence config
│       ├── logs/page.tsx       <-- Audit logs of all reminders dispatched
│       └── api/
│           ├── upload/route.ts       <-- Excel/CSV ingestion & auto-reconciliation
│           ├── customers/route.ts    <-- Customer master & flag toggle
│           ├── dues/route.ts         <-- Dues filtering & stats
│           ├── payments/route.ts     <-- Record manual payment / installment
│           ├── installments/route.ts <-- Split due into installments
│           ├── reminders/
│           │   ├── send/route.ts     <-- Manual reminder trigger
│           │   └── auto-check/route.ts<-- Automated cron trigger
│           ├── templates/route.ts    <-- Template CRUD
│           ├── settings/route.ts     <-- Credentials & cadence settings
│           └── logs/route.ts         <-- Delivery logs
```

---

## 3. Running & Testing Commands

```bash
# Run the automated test suite (all 20 unit & integration tests)
npm.cmd test

# Sync database schema with Prisma
npm.cmd run db:push

# Re-seed initial demo dataset
npm.cmd run db:seed

# Build Next.js production bundle
npm.cmd run build

# Start Next.js development server
npm.cmd run dev
```

---

## 4. Verification & Testing Matrix

| Module | Verification Test | Status | Results |
| :--- | :--- | :--- | :--- |
| **Parser (`parser.ts`)** | `src/tests/parser.test.ts` | ✅ Passed | 6/6 tests: Bracket stripping, Dr/Cr parsing, expense filtering, phone normalization, multi-contacts |
| **Payment Engine (`payment-engine.ts`)** | `src/tests/payment-engine.test.ts` | ✅ Passed | 6/6 tests: Installment splitting with rounding, partial payments, Excel diff auto-reconciliation |
| **Reminder Cadence (`reminder-engine.ts`)**| `src/tests/reminder-engine.test.ts` | ✅ Passed | 4/4 tests: Aging categorization, defaulter flag at 5 attempts, automated halting |
| **Template Engine (`template-renderer.ts`)**| `src/tests/template-renderer.test.ts`| ✅ Passed | 2/2 tests: Dynamic tags (`{{due_amount}}`), channel preset validation |
| **Worker Integration (`worker.ts`)** | `src/tests/worker.test.ts` | ✅ Passed | 2/2 tests: Database scan, reminder evaluation, Tragen Technology defaulter verification |
| **Full App Build** | `npm.cmd run build` | ✅ Passed | 19 static and dynamic routes compiled with 0 errors |

---

## 5. Instructions for Next Agents

- **Continuous Testing Principle:** Always run `npm.cmd test` after modifying any file in `src/lib/` or `src/app/`.
- **Database Migrations:** If modifying `prisma/schema.prisma`, run `npx.cmd prisma db push` followed by `npm.cmd test`.
- **Git Commits:** Ensure commits use author `zuigo <jayesh@zuigo.ai>`.
- **Installment Handling:** Always record partial payments using `calculatePaymentApplication` so that `consecutiveRemindersCount` is reset to 0 and payments are logged.
