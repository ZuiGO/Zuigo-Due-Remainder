# Zuigo Due Remainder Platform

> **Automated & Manual B2B Payment Recovery Platform**  
> Ingests accounting ledgers (Tally / ERP) and customer contact sheets, manages installment payment plans, schedules automated multi-channel reminders (WhatsApp, SMS, Email), and flags chronic defaulters.

---

## 🌟 Key Features

1. **Smart Excel & CSV Ingestion:**
   - Automatically sanitizes ERP ledger codes (e.g. `[ ABMATO ]`).
   - Distinguishes **`Dr` (Debit Receivables)** from **`Cr` (Credit Advances)**.
   - Automatically filters out internal expense/tax ledgers (`Electricity Bill`, `TDS on Sales`, `Sales Return`).
   - Normalizes semicolon-delimited multi-contacts (`Name 1 ; Name 2`, `Phone 1 ; Phone 2`, `Email 1 ; Email 2`).

2. **Installments & Payment Tracking:**
   - **Manual Payment Recording:** Record partial payments (UPI, NEFT, Cheque) with UTR number, notes, and next installment due date.
   - **Installment Splitting:** Split dues into $N$ scheduled milestone installments with specific due dates.
   - **Automated Excel Re-Import Reconciliation:** Automatically detects reductions in ledger balances between imports and logs them as payments without manual entry.
   - **Settlement:** Marks accounts as settled when remaining balance drops to 0, clearing flags automatically.

3. **Multi-Channel Reminders:**
   - Send payment reminders via **WhatsApp**, **SMS**, and **Email**.
   - Custom & Predefined Templates with dynamic placeholders (`{{customer_name}}`, `{{due_amount}}`, `{{due_date}}`, `{{bank_details}}`).
   - Automated payment receipt messages upon recording an installment.

4. **Automated Defaulter Flagging:**
   - Configurable reminder cadence ($T-3$, Due Date, $T+3$, $T+7$, $T+15$).
   - If a customer leaves 4 or 5 reminders unanswered, the platform automatically flags them as **`FLAGGED_DEFAULTER`** and halts automated messages to prevent friction while alerting management.

5. **Settings & Customization:**
   - Configure credentials for WhatsApp (Meta Cloud API / Twilio), SMS (Twilio / MSG91), and Email (SMTP / Resend).
   - Configure global or customer-specific reminder intervals.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm.cmd install

# 2. Setup Database schema
npm.cmd run db:push

# 3. Seed demo data (with sample Auric City ABMATO dataset)
npm.cmd run db:seed

# 4. Run automated test suite
npm.cmd test

# 5. Start development server
npm.cmd run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the dashboard.
