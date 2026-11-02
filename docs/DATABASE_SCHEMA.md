# Payment Follow-up Automation — Database Schema & Data Dictionary

> **Document:** `docs/DATABASE_SCHEMA.md`  
> **Database:** PostgreSQL 18  
> **ORM:** Prisma ORM  
> **Primary Design Constraints:** Multi-Tenant Isolation, Decimal Precision, Composite Natural Keys (`(tenant_id, branch_code, ledger_code)` and `(tenant_id, branch_code, ledger_code, bill_no)`).

---

## 1. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    TENANTS ||--o{ USERS : "has"
    TENANTS ||--o{ CUSTOMERS : "owns"
    TENANTS ||--o{ BILLS : "tracks"
    TENANTS ||--o{ IMPORT_BATCHES : "logs"
    TENANTS ||--o{ DISPATCH_RUNS : "executes"
    TENANTS ||--o{ MESSAGE_TEMPLATES : "defines"
    TENANTS ||--o{ INTEGRATION_SETTINGS : "configures"

    CUSTOMERS ||--o{ CONTACTS : "has (1-to-many)"
    CUSTOMERS ||--o{ BILLS : "owes (1-to-many)"
    CUSTOMERS ||--o{ REMINDER_LOG : "receives"

    BILLS ||--o{ PAYMENT_RECORDS : "receives (1-to-many)"
    BILLS ||--o{ PROMISE_COMMITMENTS : "commits (1-to-many)"
    BILLS ||--o{ REMINDER_LOG_BILLS : "included_in"

    IMPORT_BATCHES ||--o{ DAILY_DIFF_LOGS : "produces"
    DAILY_DIFF_LOGS ||--o| BILLS : "references"

    REMINDER_LOG ||--o{ REMINDER_LOG_BILLS : "bundles"
    DISPATCH_RUNS ||--o{ REMINDER_LOG : "manages"
    MESSAGE_TEMPLATES ||--o{ REMINDER_LOG : "formats"

    TENANTS {
        string id PK
        string slug UK
        string company_name
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
        timestamp updated_at
    }

    USERS {
        string id PK
        string tenant_id FK
        string email UK
        string password_hash
        string name
        string role "ADMIN | ACCOUNTS_MANAGER | ACCOUNTS_EXECUTIVE | VIEWER"
        timestamp created_at
        timestamp updated_at
    }

    CUSTOMERS {
        string id PK
        string tenant_id FK
        string branch_code
        string ledger_code
        string party_name
        string station
        string branch_name
        float total_outstanding
        string status "ACTIVE | FLAGGED | SETTLED | EXCLUDED"
        boolean is_flagged
        timestamp flagged_at
        string flag_reason
        int consecutive_reminders_count
        boolean reminder_enabled
        string pause_note
        string reminder_mode "SEMI_AUTOMATED | FULLY_AUTOMATED"
        string preferred_language "ENGLISH | HINDI | MARATHI"
        timestamp created_at
        timestamp updated_at
    }

    CONTACTS {
        string id PK
        string tenant_id FK
        string customer_id FK
        string contact_person_name
        string designation
        string mobile_no
        string whatsapp_no
        string email_id
        boolean is_primary
        boolean is_active
        boolean opt_out_sms
        boolean opt_out_whatsapp
        boolean email_invalid
        timestamp created_at
        timestamp updated_at
    }

    BILLS {
        string id PK
        string tenant_id FK
        string customer_id FK
        string branch_code
        string ledger_code
        string bill_no
        date bill_date
        date due_date
        decimal bill_amount
        decimal adjustment
        decimal outstanding_amount
        decimal previous_outstanding_amount
        int days_overdue
        string aging_bucket "NOT_YET_DUE | 1_30 | 31_60 | 61_90 | 90_PLUS"
        string priority "HIGH | MEDIUM | LOW"
        string action_type "FOLLOW_UP_REQUIRED | NO_ACTION"
        string status "PENDING | PARTIALLY_PAID | PROMISE_TO_PAY | PAYMENT_RECEIVED | PENDING_SAP_CONFIRMATION | SAP_CONFIRMED | DISPUTED | ESCALATED | LEGAL_NOTICE | CLOSED"
        string narration
        date last_followup_date
        date next_followup_date
        boolean manual_override
        date manual_marked_date
        string manual_marked_by
        date grace_period_expires_on
        string import_batch_id FK
        timestamp created_at
        timestamp updated_at
    }

    PAYMENT_RECORDS {
        string id PK
        string tenant_id FK
        string bill_id FK
        decimal amount_paid
        date payment_date
        string payment_mode "BANK_TRANSFER | UPI | CHEQUE | CASH | SAP_DIFF_DETECTED"
        string reference_number
        string notes
        timestamp created_at
    }

    PROMISE_COMMITMENTS {
        string id PK
        string tenant_id FK
        string bill_id FK
        decimal promised_amount
        date promised_date
        string status "ACTIVE | FULFILLED | BROKEN"
        string notes
        string recorded_by
        timestamp created_at
        timestamp updated_at
    }

    IMPORT_BATCHES {
        string id PK
        string tenant_id FK
        string file_name
        timestamp imported_at
        int row_count
        int new_entries_count
        int same_entries_count
        int partial_payments_count
        int settled_entries_count
        int excluded_count
        string status "SUCCESS | PARTIAL | FAILED"
        string error_detail
    }

    DAILY_DIFF_LOGS {
        string id PK
        string batch_id FK
        string bill_id FK
        string diff_type "NEW_ENTRY | SAME_ENTRY | PARTIAL_PAYMENT | SETTLED"
        decimal previous_balance
        decimal current_balance
        string notes
        timestamp created_at
    }

    DISPATCH_RUNS {
        string id PK
        string tenant_id FK
        date run_date
        timestamp started_at
        timestamp completed_at
        string status "RUNNING | COMPLETED | FAILED"
        int customers_processed
        int messages_sent
        int messages_failed
    }

    REMINDER_LOG {
        string id PK
        string tenant_id FK
        string run_id FK
        string customer_id FK
        string contact_id FK
        string channel "WHATSAPP | SMS | EMAIL"
        string recipient
        string trigger_type "AUTOMATIC | MANUAL | APPROVED_QUEUE"
        string delivery_status "QUEUED | SENT | DELIVERED | READ | FAILED"
        int bills_included_count
        string message_content
        string subject
        string provider_response_id
        string error_message
        timestamp dispatched_at
    }

    REMINDER_LOG_BILLS {
        string reminder_id PK, FK
        string bill_id PK, FK
    }

    MESSAGE_TEMPLATES {
        string id PK
        string tenant_id FK
        string channel "WHATSAPP | SMS | EMAIL"
        string aging_bucket "NOT_YET_DUE | 1_30 | 31_60 | 61_90 | 90_PLUS"
        string language "ENGLISH | HINDI | MARATHI"
        string name
        string subject
        string template_body
        string template_status "DRAFT | SUBMITTED | APPROVED | REJECTED"
        string provider_template_id
        boolean is_default
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    INTEGRATION_SETTINGS {
        string id PK
        string tenant_id FK
        string provider_type "WHATSAPP | SMS | EMAIL | GROQ_AI"
        string provider_name "META_CLOUD_API | TWILIO | MSG91 | SMTP | GROQ | SIMULATOR"
        string config_json
        boolean is_enabled
        boolean is_sandbox
        timestamp updated_at
    }
```

---

## 2. Key Relational Constraints & Indexes

### 2.1 Composite Natural Keys
1. **Customer Natural Key:**
   ```sql
   UNIQUE (tenant_id, branch_code, ledger_code)
   ```
   Ensures that across any tenant and branch, each `Ledger Code` references exactly one customer.

2. **Bill / Invoice Natural Key:**
   ```sql
   UNIQUE (tenant_id, branch_code, ledger_code, bill_no)
   ```
   Prevents duplicate bill generation when daily SAP exports are re-uploaded.

### 2.2 Dispatch Idempotency Index
```sql
UNIQUE (tenant_id, branch_code, ledger_code, channel, DATE(dispatched_at))
```
Enforces that a customer cannot receive more than one digest reminder per channel on any single calendar day, protecting the business relationship from duplicate messaging.

### 2.3 Performance & Query Optimization Indexes
- `CREATE INDEX idx_bills_due_status ON Bills (tenant_id, next_followup_date, status, action_type);`
- `CREATE INDEX idx_bills_customer ON Bills (tenant_id, customer_id);`
- `CREATE INDEX idx_contacts_customer ON Contacts (customer_id, is_active, is_primary);`
- `CREATE INDEX idx_diff_batch ON DailyDiffLogs (batch_id);`
- `CREATE INDEX idx_commitments_bill ON PromiseCommitments (bill_id, status);`
