# Payment Follow-up Automation — Requirements Document (HLD & LLD)

| Field | Value |
|---|---|
| **Client / Project** | ZuiGO Private Limited — Payment Follow-up Automation (pilot branch: Abhiyadna Machine Tools) |
| **Prepared By** | ZuiGO |
| **Document Version** | 2.0 |
| **Date** | 02-Nov-2026 |
| **Status** | Ready for development — incorporates architect review fixes |
| **v2.0 changes from v1.0** | Composite `(branch_code, ledger_code)` key; per-customer digest messaging (not per-bill); dispatch idempotency and run-locking; inbound reply/opt-out handling (Section 5.14); WhatsApp template approval gating; partial-payment detection; proposed RBAC matrix (Section 8); vendor data-processing note (Section 5.8); DIY setup guide (Section 9); Multi-tenancy white-label design; Daily SAP export diffing. |

---

## 1. Introduction & Objective
The client currently runs SAP and tracks customer dues through standard Outstanding Receivable / Ledger Master reports. Payment follow-up today is manual — someone exports the dues, decides who to chase, and calls/messages each customer individually. This does not scale well and is easy to let slip for lower-value or less-squeaky-wheel accounts.

This document defines the requirements for an automation that:
- Ingests the client's daily SAP dues export.
- Matches each outstanding bill to the right customer contact(s) via `Ledger Code`.
- Compares today's export against yesterday's export to detect new, unchanged, partially paid, and settled entries.
- Classifies bills by aging and priority.
- Sends reminders automatically over WhatsApp, SMS, and Email to every relevant contact person as **one digest per customer per channel per day**.
- Supports Promise-to-Pay commitments when partial payments are received.
- Operates as a multi-tenant, white-label platform where different companies can be hosted with their own branding, logos, and bank details without impacting each other.

---

## 2. Scope

### In Scope
1. **Daily Ingestion of SAP Dues Export:** Outstanding Receivable / Ledger Master style report.
2. **Daily Diff & Comparison Engine:** Identifies new entries today, persistent/same entries from yesterday, balance reductions (partial payments), and entries settled in SAP.
3. **Customer Contact Master:** Maintains contact persons, designations, mobile numbers, WhatsApp numbers, emails, primary flags, and preferred languages per customer.
4. **Deterministic Key Matching:** Matches bills to contacts strictly via `Ledger Code` (composite with `Branch Code`), eliminating party name spelling mismatches.
5. **Partial Payment & Promise-to-Pay:** When ₹5,000 of ₹10,000 is received and customer commits to pay the remaining ₹5,000 next week, this commitment is automatically recorded, reminders are rescheduled, and status is visibly updated.
6. **Per-Customer Daily Digest Messaging:** Bundles all open bills for a customer into a single digest message per channel per day (not spammy bill-by-bill messages).
7. **Multi-Tenancy & White-Labeling:** Independent tenant accounts with isolated data, custom logos, company names, and bank details.
8. **Inbound Reply & Opt-out Handling:** Captures opt-outs (SMS STOP, WhatsApp block) and bounces, and logs free-text replies for accounts team review.
9. **Next-Day SAP Reconciliation & 7-Day Grace Period:** When a bill is marked paid manually, reminders stop immediately. Reconciled against subsequent SAP imports with a 7-day grace period.
10. **Configurable Cadence & Approval Queue:** Supports both Semi-Automated (approval queue review before send) and Fully-Automated modes.
11. **RBAC Security Matrix:** 4 access levels (Viewer, Accounts Executive, Accounts Manager, Admin).

### Out of Scope (This Phase)
- Online payment gateway integration (UPI deep-links / credit card payment gateways).
- Automatic write-back into SAP database via BAPI/RFC (dashboard updates our system; SAP remains source of truth).
- Automated NLP classification of inbound free-text replies.

---

## 3. High-Level Design (HLD)

### 3.1 Logical System Layers
1. **Source Layer (SAP):** Daily automated or manual export of the Outstanding Receivable report.
2. **Ingestion & Diff Service:** Detects file structure, strips SAP ALV 4-line HTML letterhead, validates rows, and calculates diff against the previous import batch.
3. **Database Layer (PostgreSQL):** Stores Tenants, Customers, Contacts, Bills, Import Batches, Diff Logs, Commitments, and Reminder Logs.
4. **Rules & Commitment Engine:** Computes Days Overdue, Aging Buckets, Priority, Promise-to-Pay commitment dates, and Next Reminder Date.
5. **Dispatch & Digest Service:** Acquires mutex run-lock, generates consolidated customer digests, checks idempotency, and dispatches via WhatsApp, SMS, and Email.
6. **Inbound Reply Handler:** Webhooks receiving opt-outs, bounces, and customer reply text.
7. **White-Label UI Dashboard:** Multi-tenant frontend with company branding, tracker, approval queue, and exceptions management.

---

## 4. Low-Level Design (LLD)

### 4.1 Data Sources & Structures
1. **SAP Dues Export:** Columns: `Ledger Code`, `Party Name`, `Station`, `Branch Name`, `Branch Code`, `Bill No`, `Bill Date`, `Due Date`, `BillAmt`, `Adjustment`, `Outstanding`, `Narration`.
2. **Customer Contact Master:** Columns: `Ledger Code`, `Party Name`, `Branch Code`, `Contact Person Name`, `Designation`, `Mobile No`, `WhatsApp No`, `Email ID`, `Primary Contact`, `Preferred Language`.

### 4.2 File Parsing & Letterhead Handling
- SAP exports saved as `.xls` are actually HTML tables containing a 4-line letterhead outside the `<table>`.
- Ingestion algorithm parses the `<table>` element directly, ignoring `<h1>/<h2>/<h3>/<p>` tags.
- Discards `Grand Total` row.
- Flags non-customer ledgers (`TDS on Sales`, `Electricity Bill`, `Sales Return`) and negative balances as `action_type = "No Action"`.

### 4.3 Daily Import Diffing Logic (Yesterday vs. Today)
On each daily import, the system compares the incoming bill set against the existing active bill set for that tenant:
- **New Entries (Today Only):** `bill_no` not present in yesterday's batch $\rightarrow$ tag `[NEW ENTRY]`, calculate aging and initial cadence date.
- **Unchanged / Same Entries:** `bill_no` present in both batches with equal `outstanding_amount` $\rightarrow$ tag `[SAME / PERSISTENT]`, update `days_overdue`.
- **Partial Payment Detected:** `outstanding_amount < previous_outstanding_amount` $\rightarrow$ tag `[PARTIAL PAYMENT DETECTED]`, auto-generate payment log, set status `Partially Paid`, recalculate priority on reduced balance.
- **Settled in SAP:** Bill present yesterday but missing today or with `outstanding_amount <= 0` $\rightarrow$ tag `[SETTLED IN SAP]`, mark status `Closed`, clear reminder schedule.

### 4.4 Promise-to-Pay (PTP) & Partial Payment Workflow
When a partial payment is recorded (e.g., ₹5,000 paid out of ₹10,000) and customer commits to pay the remaining ₹5,000 next week:
1. `outstanding_amount` is updated to ₹5,000.
2. A `PromiseToPayCommitment` record is created:
   - `promised_amount = 5000`
   - `promised_date = <next week date>`
   - `notes = "Customer promised remaining ₹5,000 next week"`
3. The invoice status is set to `Partially Paid / Promise to Pay`.
4. Automated reminders are **automatically paused** until `promised_date` arrives (`next_followup_date = promised_date`).
5. Dashboard prominently surfaces the commitment badge: `₹5,000 Paid • ₹5,000 Due on DD/MM/YYYY`.

### 4.5 Per-Customer Digest Messaging
- Bundles all due bills for a customer into **one consolidated digest message** per channel per day.
- Message interpolates `{contact_name}`, `{branch_name}`, dynamic `{bills_list}` (each bill's number, amount, due date, and overdue days in descending order), and total customer outstanding.
- Enforces dispatch run-locking via `DispatchRuns` table and channel idempotency via `(tenant_id, branch_code, ledger_code, channel, DATE(sent_at))`.

### 4.6 Multi-Tenancy & White-Label Architecture
- Multi-tenant architecture with shared database and isolated schemas/row-level tenant keys (`tenant_id`).
- Each tenant has:
  - `name`, `slug` (subdomain or route context), `logo_url`, `brand_color`.
  - `address`, `contact_email`, `contact_phone`.
  - `bank_name`, `account_number`, `ifsc_code`, `upi_id`.
- Complete data separation: Tenant XYZ never sees Tenant ABC's customers, bills, or logs.
- Dynamic branding: UI header, login page, and outgoing reminder messages automatically reflect the active tenant's logo, business name, and bank details.

### 4.7 Next-Day SAP Reconciliation & 7-Day Grace Period
When marked "Payment Received" manually from dashboard:
1. Sets `manual_override = true`, `manual_marked_date = today`, halts reminders.
2. If confirmed in next SAP import (missing or zero) $\rightarrow$ marks `Closed`.
3. If still present in SAP with balance $>0$ $\rightarrow$ marks `Payment Received – Pending SAP Confirmation` and suppresses reminders for 7 days.
4. If still unpaid after 7 days $\rightarrow$ escalates to Dashboard Exceptions View for review.

---

## 5. Dashboard, RBAC & DIY Control Panel

### 5.1 Role-Based Access Control (RBAC) Matrix

| Permission | Viewer | Accounts Executive | Accounts Manager | Admin |
|---|:---:|:---:|:---:|:---:|
| View Dashboard & Reports | Yes | Yes | Yes | Yes |
| Approve & Send (Semi-Automated) | No | No | Yes | Yes |
| Edit Contact Master | No | Yes | Yes | Yes |
| Record Payment & Promise-to-Pay | No | Yes | Yes | Yes |
| Mark Bill as Paid | No | Yes | Yes | Yes |
| Edit Configuration & Cadence | No | No | No | Yes |
| Edit Message Templates | No | No | No | Yes |
| Manage Tenants & Users | No | No | No | Yes |

### 5.2 Dashboard Views
1. **Follow-up Tracker:** Bill-wise view with aging buckets, priority, status, and Promise-to-Pay commitments.
2. **Import Diff & Comparison:** Displays today's import summary (New today, Same/Persistent, Partial payment detected, Settled in SAP).
3. **Customer Master:** Customer directory, contacts, pause/resume toggles, preferred language.
4. **Approval Queue:** For Semi-Automated mode — daily reminder digest review and bulk send.
5. **Exceptions View:** Grace period expired bills, unmapped contacts, failed dispatches.
6. **Audit & Reminder History:** Complete timeline of sent digests, delivery receipts, and opt-outs.
