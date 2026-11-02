# Zuigo Payment Follow-up Automation Platform

> **Enterprise-Grade, Multi-Tenant B2B Accounts Receivable Recovery Engine**  
> Ingests daily SAP Outstanding Receivable exports and Customer Contact sheets, computes daily import diffs (identifying new, unchanged, partially paid, and settled bills), automates per-customer digest payment follow-ups across WhatsApp, SMS, and Email, manages Promise-to-Pay commitments, and automatically escalates chronic defaulters.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![Tests](https://img.shields.io/badge/tests-16%20passed-success)](#)
[![Next.js](https://img.shields.io/badge/Next.js-14.2%20App%20Router-black)](https://nextjs.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-18-blue)](https://www.postgresql.org/)
[![AI Engine](https://img.shields.io/badge/Groq%20AI-qwen%2Fqwen3.8--27b-orange)](https://groq.com/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](#)

---

## 📑 Official Project Documentation

All formal technical documentation and client requirements are maintained under [`docs/`](./docs/):

- 📄 **[docs/SRS_v2.0.md](./docs/SRS_v2.0.md)** — Official Software Requirements Specification (HLD & LLD v2.0).
- 🏗️ **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — End-to-end System Architecture, Multi-Tenancy Design, and Dispatch Pipeline.
- 🗄️ **[docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)** — Relational Schema, Entity-Relationship (ER) Diagram, Indexes, and Constraints.
- 📋 **[AGENT.md](./AGENT.md)** — Handover Guide for autonomous AI agents and developers.

---

## 🌟 Core System Capabilities

### 1. Multi-Tenant & White-Label Architecture
- **Complete Tenant Isolation:** Deployable across multiple companies (e.g. Abhiyadna Machine Tools, ABC Corp, XYZ Ltd) on a single unified platform.
- **Dynamic Branding:** Automatic white-label rendering of each tenant's business logo, company name, brand colors, and bank accounts (HDFC, UPI, NEFT).
- **Zero Cross-Tenant Leakage:** Queries, customer records, and bills are partitioned by `tenant_id`.

### 2. Smart Filename-Agnostic Ingestion & SAP ALV Parser
- **Filename-Agnostic Routing:** Inspects headers and content structure rather than fragile filenames.
  - Detects **SAP Dues Exports** via `Bill No`, `Bill Date`, `BillAmt`, and `Outstanding`.
  - Detects **Customer Contact Masters** via `Contact Person Name`, `Mobile No`, and `Designation`.
- **SAP ALV HTML Table Reader:** Bypasses SAP's 4-line `<h1>/<h2>/<h3>/<p>` company letterhead block by extracting directly from the `<table>` element.
- **Exclusion Filters:** Automatically tags internal accounting entries (`TDS on Sales`, `Electricity Bill`, `Sales Return`) and negative credit balances as `No Action`.
- **Deterministic Joining:** Joins bills and customer contacts strictly via **`Ledger Code`** (composite with `Branch Code`), preventing party name spelling mismatches.

### 3. Daily SAP Export Diff Engine (Yesterday vs. Today)
When a user uploads the daily SAP export, the diff engine categorizes all entries:
- 🆕 **`[NEW TODAY]`**: Bills appearing in today's export for the first time.
- 🔄 **`[PERSISTENT]`**: Unchanged bills present in both yesterday and today.
- 📉 **`[PARTIAL PAYMENT DETECTED]`**: Bills where `outstanding_amount` decreased (automatically logs partial payment and recalculates aging).
- ✅ **`[SETTLED IN SAP]`**: Bills present yesterday that disappeared today or reached zero balance (automatically marks `Closed`).

### 4. Promise-to-Pay (PTP) & Partial Payment Workflow
- When a customer pays partially (e.g., pays ₹5,000 out of ₹10,000) and commits to clear the remainder next week:
  - System updates outstanding balance to ₹5,000.
  - Automatically records the commitment date and amount (`PromiseToPayCommitment`).
  - **Pauses automated reminders** until the promised date arrives (`next_followup_date = promised_date`).
  - Surfaces real-time status in dashboard: `₹5,000 Paid • ₹5,000 Due on DD/MM/YYYY`.

### 5. Consolidated Per-Customer Digest Messaging (v2.0)
- Prevents spam by bundling all open overdue bills for a customer into **one single digest message per channel per day** (not individual messages per bill).
- Message dynamically itemizes `{bills_list}` sorted in descending overdue order.
- **Run-Locking Mutex:** Ensures no overlapping background runs via the `DispatchRuns` table.
- **Idempotency Guard:** Unique constraint `(tenant_id, branch_code, ledger_code, channel, DATE(sent_at))` guarantees at most 1 digest per customer per channel per day.

### 6. Groq AI Contextual Intelligence
- Powered by high-speed inference via **`qwen/qwen3.8-27b`**.
- Automatically modulates tone based on overdue duration:
  - **$T-3$ Days:** Courteous advance notification.
  - **Day 0:** Clear, prompt reminder for today's due date.
  - **1–30 Days Overdue:** Friendly business follow-up.
  - **31–60 Days Overdue:** Firm reminder requesting settlement.
  - **60+ Days Overdue:** Urgent notification warning of credit hold and legal escalation.
- One-click **"✨ Generate with Groq AI"** button in reminder modals.

### 7. Automated Defaulter Escalation
- Automated cadence intervals: $T-3$, $0$, $T+3$, $T+7$, $T+15$.
- If a customer leaves 4 to 5 reminders unanswered without payment, the platform automatically tags them as **`FLAGGED_DEFAULTER`** and halts reminders to prevent friction while notifying credit management.

---

## 🛠️ Technology Stack

```
Frontend:          Next.js 14.2 (App Router) + React 18 + Tailwind CSS + Lucide Icons
Backend Runtime:   Node.js (LTS) + Next.js Server Components & Route Handlers
Database:          PostgreSQL 18 (Local instance on port 5432)
ORM:               Prisma ORM 5.22
AI Engine:         Groq Cloud API (qwen/qwen3.8-27b)
Authentication:    Custom scrypt password hashing + Signed Stateless Session Cookies
Testing:           Node Test Runner (`tsx --test`) — 16 unit & integration tests
Channels:          WhatsApp Business API / Meta Cloud, SMS (DLT/MSG91/Twilio), SMTP Email
```

---

## 🏗️ Relational Database Schema Overview

```mermaid
erDiagram
    TENANTS ||--o{ USERS : "employs"
    TENANTS ||--o{ CUSTOMERS : "serves"
    TENANTS ||--o{ BILLS : "tracks"
    TENANTS ||--o{ IMPORT_BATCHES : "logs"
    TENANTS ||--o{ DISPATCH_RUNS : "executes"
    
    CUSTOMERS ||--o{ CONTACTS : "has"
    CUSTOMERS ||--o{ BILLS : "owes"
    CUSTOMERS ||--o{ REMINDER_LOG : "receives"

    BILLS ||--o{ PAYMENT_RECORDS : "receives"
    BILLS ||--o{ PROMISE_COMMITMENTS : "commits"
    BILLS ||--o{ REMINDER_LOG_BILLS : "included_in"

    REMINDER_LOG ||--o{ REMINDER_LOG_BILLS : "bundles"
    DISPATCH_RUNS ||--o{ REMINDER_LOG : "manages"
```

*For complete field-level definitions, constraints, and indexes, see [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md).*

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** v18.17+ or v20+
- **PostgreSQL:** v15+ (Running locally on port `5432`)

### 2. Environment Setup
Configure `.env` in the root directory:
```env
DATABASE_URL="postgresql://postgres:zuigo@localhost:5432/zuigo_due_reminder?schema=public"
SESSION_SECRET="zuigo-due-reminder-super-secret-key-32chars"
GROQ_API_KEY="gsk_..."
PORT=3000
```

### 3. Database Migration
```powershell
# Push Prisma schema to PostgreSQL
npx prisma db push
```

### 4. Running the Test Suite
```powershell
# Run all unit and integration tests (16 tests across 5 suites)
npx tsx --test src/tests/parser.test.ts src/tests/payment-engine.test.ts src/tests/reminder-engine.test.ts src/tests/template-renderer.test.ts src/tests/worker.test.ts
```

### 5. Running the Application
```powershell
# Development mode
npm run dev

# Production build & start
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Default Administrator Credentials:**
  - **Email:** `jayesh@zuigo.ai`
  - **Password:** `zuigo123`

---

## 📁 Repository Directory Structure

```
├── docs/                               <-- Official Project Documentation
│   ├── SRS_v2.0.md                     <-- Complete Requirements Document (HLD & LLD v2.0)
│   ├── ARCHITECTURE.md                 <-- System Topology, Multi-Tenancy & Diffing Engine
│   └── DATABASE_SCHEMA.md              <-- Full Database Schema, Constraints & Indexes
├── AGENT.md                            <-- Handover guide for autonomous agents
├── README.md                           <-- Master platform overview
├── prisma/
│   ├── schema.prisma                   <-- Database schema
│   └── seed.ts                         <-- System templates & cadence seed
├── src/
│   ├── app/
│   │   ├── page.tsx                    <-- Dashboard with KPIs & Priority Watchlist
│   │   ├── dues/page.tsx               <-- Invoices & Dues view with distinct columns
│   │   ├── customers/page.tsx          <-- Customer directory & defaulter audit
│   │   ├── templates/page.tsx          <-- Multi-channel template editor
│   │   ├── settings/page.tsx           <-- Gateway credentials & cadence config
│   │   ├── logs/page.tsx               <-- Audit history of all sent digests
│   │   ├── login/page.tsx              <-- User login screen
│   │   ├── register/page.tsx           <-- New user registration
│   │   └── api/                        <-- REST API routes (Auth, Upload, Invoices, Reminders)
│   ├── components/
│   │   └── AppShell.tsx                <-- Client shell with auth check & user profile
│   ├── lib/
│   │   ├── auth.ts                     <-- scrypt password hashing & session management
│   │   ├── db.ts                       <-- Prisma client singleton
│   │   ├── groq.ts                     <-- Groq AI client (qwen/qwen3.8-27b)
│   │   ├── parser.ts                   <-- Filename-agnostic Excel/CSV/HTML parser
│   │   ├── payment-engine.ts           <-- Installment splitting & reconciliation
│   │   ├── reminder-engine.ts          <-- Aging buckets, cadence & defaulter rules
│   │   ├── worker.ts                   <-- Automated reminder runner
│   │   └── dispatchers/                <-- WhatsApp, SMS, and Email dispatchers
│   └── tests/                          <-- 16 automated unit & integration tests
```

---

## 🔒 Security & Data Privacy

- **Strict Access Control:** Database credentials and API keys stored exclusively in server environment variables.
- **Stateless Session Tokens:** Signed with HMAC-SHA256, stored in secure `HTTP-only` cookies.
- **Telecom Compliance:** SMS uses DLT template headers; WhatsApp respects opt-out webhooks.
- **PII Protection:** Mobile numbers and emails masked in logs to maintain recipient privacy.

---

## 👥 Authors & License

- **Organization:** ZuiGO Private Limited
- **Project Lead:** `zuigo <jayesh@zuigo.ai>`
- **License:** Proprietary & Confidential — All rights reserved.
