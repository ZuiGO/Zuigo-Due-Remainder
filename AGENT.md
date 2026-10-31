# AGENT.md — Developer & Autonomous Agent Handover Guide

> **Repository:** Zuigo Due Remainder  
> **Git Identity:** `zuigo <jayesh@zuigo.ai>`  
> **Platform Purpose:** Automated and manual receivables recovery platform that ingests accounting ledgers & customer contact directories, tracks due dates & installment plans, automates multi-channel payment reminders (WhatsApp, SMS, Email), automatically flags defaulters after 4-5 unanswered reminders, and reconciles payments.

---

## 1. System Architecture & Tech Stack

- **Framework:** Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- **Database & ORM:** SQLite for zero-config local run, switchable to PostgreSQL via `DATABASE_URL` in `.env` using **Prisma ORM**.
- **Data Ingestion:** SheetJS (`xlsx`) with custom Ledger Code Strip (`[ ABMATO ]`) and Semicolon-Contact Normalization (`name1 ; name2`, `phone1 ; phone2`).
- **Scheduling & Automation:** Built-in Background Auto-Check Worker with configurable frequency (daily morning cron window) and idempotency guards.
- **Messaging Engines:**
  - WhatsApp: WhatsApp Business Cloud API / Twilio WhatsApp Simulator
  - SMS: Twilio / MSG91 / Fast2SMS
  - Email: Nodemailer SMTP / Resend
- **Testing Suite:** Vitest / Node test runner with comprehensive unit, integration, and parser tests.

---

## 2. Directory Structure

```
├── .gitignore
├── AGENT.md                 <-- Handover documentation (keep updated!)
├── README.md                <-- User and developer overview
├── package.json             <-- Node dependencies & scripts
├── tsconfig.json            <-- TypeScript configuration
├── tailwind.config.js       <-- Styling configuration
├── prisma/
│   ├── schema.prisma        <-- Database schema (Customers, Contacts, Dues, Installments, Payments, Templates, Logs)
│   └── seed.ts              <-- Sample demo data loader based on real Auric City DMIC dataset
├── src/
│   ├── app/                 <-- Next.js App Router (Pages, UI, and API Routes)
│   │   ├── api/
│   │   │   ├── upload/      <-- Excel & CSV Parser API
│   │   │   ├── customers/   <-- Customer Master & Contact CRUD
│   │   │   ├── dues/        <-- Dues management & filters (Upcoming, Overdue, Flagged)
│   │   │   ├── payments/    <-- Manual & Reconciled Installment/Payment recording
│   │   │   ├── installments/<-- Installment plan generator & status tracker
│   │   │   ├── reminders/   <-- Manual dispatch & automated scheduler trigger
│   │   │   ├── templates/   <-- WhatsApp, SMS, Email template manager
│   │   │   └── settings/    <-- API credentials & reminder rules configuration
│   │   ├── page.tsx         <-- Dashboard with real-time analytics & quick actions
│   │   ├── dues/            <-- Dues table, installment manager, reminder triggers
│   │   ├── customers/       <-- Customer directory, contact cards, flag overrides
│   │   ├── templates/       <-- Template designer with live preview & dynamic pills
│   │   ├── settings/        <-- Channel credentials & global reminder schedule
│   │   └── logs/            <-- Full audit log of all automated & manual reminders
│   ├── lib/                 <-- Core business logic & utility modules
│   │   ├── db.ts            <-- Prisma client singleton
│   │   ├── parser.ts        <-- Smart Excel / CSV parser & normalizer
│   │   ├── reminder-engine.ts <-- Due calculation, cadence matcher & auto-flagging
│   │   ├── payment-engine.ts  <-- Installment calculation & Excel diff reconciliation
│   │   ├── template-renderer.ts <-- Dynamic placeholder interpolator
│   │   └── dispatchers/     <-- WhatsApp, SMS, and Email delivery clients
│   └── tests/               <-- Automated tests for each module
```

---

## 3. Core Business Rules

1. **Dr vs. Cr Ledger Logic:**
   - **`Dr` (Debit):** Amount owed **to** the company (Receivable due). Only positive `Dr` balances trigger reminders.
   - **`Cr` (Credit):** Customer has an advance balance or credit note. System flags as advance; reminders are suppressed.
   - **Non-Customer Ledgers:** Accounts like `Electricity Bill`, `TDS on Sales`, `Sales Return`, and `Depreciation` are automatically filtered out.
2. **Name & Contact Normalization:**
   - Strips ledger codes: `DHOOT AUTOCOMPONENTS PRIVATE LIMITED [ ABMATO ]` $\to$ `DHOOT AUTOCOMPONENTS PRIVATE LIMITED`.
   - Contact splits: `Kamran Khan;` + `77579 07578; 70576 18529` + `finance@sscontrols.in; design.mech@sscontrols.in` creates discrete contact entries.
3. **Installment & Partial Payment Plan:**
   - **Automatic Excel Re-Import Reconciliation:** When a new report is uploaded, if `Dr` balance has decreased, the difference is logged as an auto-detected payment, reducing remaining due and resetting the aggressive reminder counter.
   - **Manual Installment Recording:** User can record partial payment with UTR/mode, update the next installment due date, and automatically dispatch a payment receipt message.
   - **Installment Splitting:** Any due can be split into $N$ milestone installments; reminders reference the specific installment amount and due date.
4. **Automated Defaulter Escalation (4-5 Reminders):**
   - Reminders increment `consecutive_reminders_count`.
   - Once count hits threshold (default 4 or 5 unresponded reminders), the customer is moved to `FLAGGED` status (`is_flagged = true`).
   - Automated spamming halts to protect business relations; admin receives an escalation alert.
   - Recording a payment or re-importing a cleared balance immediately resets the flag and counter.

---

## 4. Setup & Running Instructions

```bash
# 1. Install dependencies
npm.cmd install

# 2. Setup SQLite Database & run Prisma migrations
npm.cmd run db:push

# 3. Seed initial sample data from provided Auric City / ABMATO dataset
npm.cmd run db:seed

# 4. Run automated test suites
npm.cmd test

# 5. Start development server
npm.cmd run dev
```

---

## 5. Module Build & Verification Log

| Module | Status | Unit / Integration Test | Notes |
| :--- | :--- | :--- | :--- |
| **0. Git Repo & Config** | ✅ Done | `git status` configured with `zuigo <jayesh@zuigo.ai>` | Initialized |
| **1. DB Schema & Models** | 🔄 In Progress | Schema validation & SQLite sync | Customers, Dues, Installments, Payments, Templates, Logs |
| **2. Excel / CSV Parser** | ⏳ Planned | Suffix stripper, Dr/Cr parser, Multi-contact splitter | Handles reference sample data |
| **3. Installment & Payment Engine**| ⏳ Planned | Partial payment calculation, Excel diff auto-detect | Milestone tracking & settlement |
| **4. Template & Dynamic Tag Engine**| ⏳ Planned | Tag interpolation (`{{due_amount}}`, etc.) | SMS, WhatsApp, Email previews |
| **5. Multi-channel Dispatchers** | ⏳ Planned | WhatsApp, SMS, Email senders with sandbox mocks | Delivery logs & error capture |
| **6. Automated Scheduler & Flagging**| ⏳ Planned | Defaulter trigger after 4-5 reminders, cron checker | Prevents duplicate reminders |
| **7. Web UI Dashboard & Management**| ⏳ Planned | Modern responsive Next.js frontend | Complete CRUD, modals, manual dispatch |

> **Instruction for Next Agents:** After creating or editing any function, run the corresponding test script or write a test in `src/tests/` to verify functionality before marking as completed. Keep this log updated!
