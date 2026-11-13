# Payment Follow-up Automation — System Architecture & Technical Design

> **Document:** `docs/ARCHITECTURE.md`  
> **System:** Zuigo Payment Follow-up Automation  
> **Target Deployments:** Multi-Tenant SaaS (White-label per enterprise client)  
> **Pilot Tenant:** Abhiyadna Machine Tools (`ABMATO`)

---

## 1. System Topology & Technology Stack

The platform is designed as a cloud-native, multi-tenant system built on modern web standards with strict transactional integrity:

```mermaid
flowchart TD
    subgraph ClientLayer["Clients & Tenants"]
        T1["Tenant XYZ (e.g. Abhiyadna Machine Tools)"]
        T2["Tenant ABC (e.g. Pioneer Semicon)"]
        T3["Tenant DEF (e.g. Horizon Tools)"]
    end

    subgraph EntryPoint["Application Gateway & White-Label Router"]
        DNS["DNS / Subdomain / Slug Router<br/>(tenant.zuigo.ai or header context)"]
        BrandingEngine["Tenant Branding Injector<br/>(Logo, Name, Primary Color, Bank Details)"]
    end

    subgraph AppServer["Next.js 14 App Router (Server-Side)"]
        AuthModule["Stateless Auth & RBAC Guard<br/>(scrypt + Signed Session Tokens)"]
        IngestService["Smart Ingestion & ALV Parser<br/>(File-Agnostic, HTML Table Extraction)"]
        DiffEngine["Daily SAP Diff Engine<br/>(Yesterday vs Today Reconciliation)"]
        CadenceEngine["Rules & Commitment Engine<br/>(Aging, Priority, Cadence, Promise-to-Pay)"]
        DigestService["Per-Customer Digest Aggregator<br/>({bills_list} compiler, Run-Locking)"]
        GroqService["Groq AI Inference Service<br/>(Model: qwen/qwen3.8-27b)"]
        WebhookReceiver["Inbound Webhook Receiver<br/>(SMS STOP, WhatsApp opt-out, Email bounce)"]
    end

    subgraph StorageLayer["Data & Persistence Layer"]
        PG[("PostgreSQL 18<br/>Multi-Tenant Shared Schema")]
        TenantIsolation["Tenant ID Isolation Middleware<br/>(tenant_id on all operational tables)"]
    end

    subgraph Gateways["External Delivery Channels"]
        WA["WhatsApp Business API (Meta / BSP)"]
        SMS["SMS Gateway (DLT Registered / MSG91 / Twilio)"]
        SMTP["Email Gateway (SMTP / Amazon SES / Resend)"]
        GroqAPI["Groq Cloud API (High-Speed LLM)"]
    end

    ClientLayer --> DNS
    DNS --> BrandingEngine
    BrandingEngine --> AppServer
    AppServer --> TenantIsolation
    TenantIsolation --> PG

    DigestService --> WA
    DigestService --> SMS
    DigestService --> SMTP
    CadenceEngine --> GroqService
    GroqService --> GroqAPI
    WA -. Webhooks .-> WebhookReceiver
    SMS -. Webhooks .-> WebhookReceiver
    SMTP -. Webhooks .-> WebhookReceiver
```

### Technology Matrix

| Layer | Component | Selection & Justification |
|---|---|---|
| **Frontend & SSR** | Next.js 14.2 (App Router) | High-performance React 18 SSR/CSR, built-in server actions, optimized static and dynamic routing. |
| **Styling & UI** | Tailwind CSS + Lucide Icons | Clean, responsive, enterprise-grade design with dynamic tenant theme variable support. |
| **Application Logic** | TypeScript (Strict Mode) | Type-safe business domain modeling preventing runtime financial or date errors. |
| **Database** | PostgreSQL 18 | Strict ACID guarantees, exact NUMERIC decimal precision for currency, JSONB for integration configurations, and transactional lock support. |
| **ORM** | Prisma ORM 5 | Type-safe relational modeling, migrations, connection pooling, and multi-tenant query extension. |
| **AI Engine** | Groq API (`qwen/qwen3.8-27b`) | Sub-second inference latency generating personalized, aging-adapted collection messages. |
| **Authentication** | Node.js `crypto.scrypt` | Per-user salted password hashing with secure, HTTP-only, signed session cookies. |

---

## 2. Multi-Tenancy & White-Label Architecture

The system is built from the ground up for multi-tenant white-label delivery. Shipping the application to Company XYZ displays XYZ's logo and company name; shipping to Company ABC displays ABC's branding without any cross-tenant data leakage.

```mermaid
erDiagram
    TENANTS ||--o{ USERS : employs
    TENANTS ||--o{ CUSTOMERS : serves
    TENANTS ||--o{ BILLS : issues
    TENANTS ||--o{ IMPORT_BATCHES : runs
    TENANTS ||--o{ MESSAGE_TEMPLATES : customizes
    TENANTS ||--o{ INTEGRATION_SETTINGS : configures
    TENANTS ||--o{ DISPATCH_RUNS : executes

    TENANTS {
        string id PK
        string slug UK "e.g. abmato, xyz-corp"
        string company_name "e.g. Abhiyadna Machine Tools"
        string logo_url
        string brand_color
        string address
        string contact_email
        string contact_phone
        string bank_name
        string bank_account_no
        string bank_ifsc_code
        string bank_upi_id
        boolean is_active
        timestamp created_at
    }
```

### 2.1 Tenant Resolution
1. **Subdomain / Path / Header Resolution:** The tenant context is extracted from the request host (e.g., `abmato.zuigo.ai`), a query parameter, or a secure session claim.
2. **Dynamic UI Injection:**
   - Sidebar and Login pages render the active tenant's `company_name` and `logo_url`.
   - The primary brand color applies dynamically via CSS custom variables (`var(--brand-primary)`).
3. **Template Context Injection:**
   - Reminder messages automatically interpolate `{company_name}` and `{bank_details}` from the active tenant's profile.
4. **Data Isolation:**
   - Every operational query is automatically scoped with `where: { tenantId }`. Cross-tenant querying is strictly prohibited at the Prisma middleware layer.

---

## 3. Daily SAP Export Diffing Engine (Yesterday vs. Today)

Each morning, the accounts user uploads the latest SAP export. Rather than a dumb overwrite, the **Diff Engine** compares the incoming dataset against yesterday's active records:

```mermaid
flowchart TD
    StartDiff["Start Daily SAP Import"] --> FetchOld["Fetch Active Bills for Tenant from Database"]
    StartDiff --> ParseNew["Parse Incoming SAP ALV Dues (HTML/XLSX/CSV)"]
    
    ParseNew --> LoopRows{"Iterate Incoming Rows<br/>Key: (Branch Code, Ledger Code, Bill No)"}
    
    LoopRows -- "Bill No NOT in DB" --> TagNew["Tag: [NEW ENTRY TODAY]<br/>• Create Bill<br/>• Calculate Aging & Initial Cadence"]
    
    LoopRows -- "Bill No in DB, Balance EQUAL" --> TagSame["Tag: [SAME / PERSISTENT]<br/>• Update Days Overdue<br/>• Maintain existing Cadence schedule"]
    
    LoopRows -- "Bill No in DB, Balance LOWER" --> TagPartial["Tag: [PARTIAL PAYMENT DETECTED]<br/>• Record Partial Payment<br/>• Status: Partially Paid<br/>• Recalculate Priority on reduced balance"]
    
    LoopRows -- "End of File" --> CheckSettled{"Check DB Bills NOT present in New Export (or Outstanding = 0)"}
    
    CheckSettled -- "Missing in New File" --> TagSettled["Tag: [SETTLED IN SAP]<br/>• Status: Closed<br/>• Halt reminders<br/>• Clear any manual overrides"]
    
    TagNew --> WriteBatch["Write to ImportBatches & DailyDiffLog"]
    TagSame --> WriteBatch
    TagPartial --> WriteBatch
    TagSettled --> WriteBatch
    WriteBatch --> Summary["Display Daily Diff Summary to User:<br/>• X New Bills<br/>• Y Same / Persistent<br/>• Z Partial Payments<br/>• W Settled"]
```

### Diff Classification Table

| State Detected | Database Condition | System Action | UI Badge |
|---|---|---|---|
| **New Entry Today** | `bill_no` exists in incoming file, but not in DB. | Insert new `Bill`, calculate aging bucket and initial reminder cadence date. | `[NEW TODAY]` (Blue) |
| **Same / Persistent** | `bill_no` exists in both; `incoming.outstanding == db.outstanding`. | Update `days_overdue` and `aging_bucket`. Keep existing cadence schedule intact. | `[PERSISTENT]` (Slate) |
| **Partial Payment** | `bill_no` exists in both; `incoming.outstanding < db.outstanding`. | Set `previous_outstanding_amount = db.outstanding`. Update `outstanding_amount = incoming.outstanding`. Auto-create `PaymentRecord`. Set status to `Partially Paid`. | `[PARTIAL PAID]` (Amber) |
| **Settled in SAP** | `bill_no` exists in DB with balance $>0$, but is absent in new export or has balance $\le 0$. | Set `status = "Payment Received – SAP Confirmed"` / `Closed`. Cancel upcoming reminders. Unflag customer if total outstanding reaches 0. | `[SETTLED IN SAP]` (Emerald) |

---

## 4. Partial Payment & Promise-to-Pay (PTP) Workflow

When a customer pays partially and commits to a date for the remainder (e.g., pays ₹5,000 out of ₹10,000, promising the remaining ₹5,000 next week):

```mermaid
sequenceDiagram
    autonumber
    actor User as Accounts Executive
    participant UI as Dashboard / Dues View
    participant API as /api/payments & /api/commitments
    participant Engine as Reminder & Cadence Engine
    participant DB as PostgreSQL Database

    User->>UI: Record Partial Payment (₹5,000)<br/>& Enter Commitment: "Remaining ₹5,000 next Monday"
    UI->>API: POST /api/payments with payment + promiseToPay
    API->>DB: 1. Create PaymentRecord (amount: 5000)
    API->>DB: 2. Update Bill (outstanding: 5000, status: 'Partially Paid')
    API->>DB: 3. Create PromiseToPayCommitment (amount: 5000, promised_date: Next Monday)
    API->>Engine: Re-evaluate Next Follow-up Date
    Engine->>DB: Set next_followup_date = promised_date (Pause reminders until promised date!)
    DB-->>UI: Success confirmation
    UI-->>User: Display updated bill with badge: "₹5,000 Paid • ₹5,000 Due on [Date]"
```

1. **Commitment Tracking:** Stored in `PromiseToPayCommitment` with `promised_amount`, `promised_date`, `recorded_by`, and `notes`.
2. **Automatic Reminder Pause:** Reminders are automatically suppressed until `promised_date`.
3. **Commitment Matured:** On `promised_date`, if the balance remains unpaid, the Cadence Engine automatically resumes the digest reminder schedule.

---

## 5. Daily Per-Customer Digest Messaging Pipeline

Reminders are sent once per customer per channel per day, bundling every open bill into a single digest message.

```mermaid
flowchart TD
    Cron["Daily Dispatch Trigger (e.g. 11:00 AM IST)"] --> RunLock{"Check DispatchRuns table<br/>status == 'Running'?"}
    RunLock -- "Yes (Running)" --> SkipRun["Skip run to prevent overlapping execution"]
    RunLock -- "No" --> CreateRun["Create DispatchRuns row (status = 'Running')"]

    CreateRun --> GetEligible["Query Customers where reminder_enabled == true<br/>having Bills due today (next_followup_date <= today)"]
    
    GetEligible --> LoopCust{"Iterate Customers"}
    
    LoopCust --> CheckIdempotency{"Check ReminderLog for<br/>(tenant_id, ledger_code, channel, today)?"}
    CheckIdempotency -- "Already Sent" --> SkipDigest["Skip (Idempotency Guard)"]
    CheckIdempotency -- "Not Sent Yet" --> CompileDigest["Compile Digest:<br/>• Primary Contact Name<br/>• Itemize {bills_list} in descending overdue order<br/>• Calculate Customer Total Due<br/>• Inject Bank Details"]
    
    CompileDigest --> CheckMode{"Tenant Reminder Mode?"}
    CheckMode -- "Semi-Automated" --> Queue["Add to Dashboard Approval Queue<br/>(Await Manager 1-Click Send)"]
    CheckMode -- "Fully-Automated" --> DispatchChannel["Dispatch via WhatsApp / SMS / Email"]
    
    DispatchChannel --> LogDigest["Write ReminderLog (digest level)<br/>Write ReminderLogBills (junction rows)"]
    LogDigest --> UpdateBills["Update last_followup_date = today<br/>next_followup_date = today + cadence"]
    
    UpdateBills --> LoopCust
    LoopCust -- "All Done" --> CloseRun["Update DispatchRuns status = 'Completed'"]
```

---

## 6. Next-Day SAP Reconciliation & 7-Day Grace Period

When an accounts executive marks a bill as "Payment Received" via the dashboard, this system immediately halts reminders. The daily morning SAP export reconciles this state:

1. **Manual Mark:** `manual_override = true`, `manual_marked_date = today`, `grace_period_expires_on = today + 7 days`. Reminders halt immediately.
2. **Next SAP Import - Confirmed:** Bill disappears from export or has balance $\le 0$ $\rightarrow$ mark `Closed`, confirmed in SAP.
3. **Next SAP Import - Pending SAP Processing (Within 7 Days):** Bill still appears with balance $> 0$. Reminders remain suppressed under status `Payment Received – Pending SAP Confirmation`.
4. **Next SAP Import - Grace Period Expired (> 7 Days):** If bill remains outstanding after 7 days, it automatically escalates to the **Dashboard Exceptions View** for accounts investigation.
