# JULES.md — Zarfolio Engineering & Architecture Guide

This document is the durable project-level engineering and architecture reference for Zarfolio. All future AI engineering sessions (including Jules) must adhere strictly to the invariants, architecture, conventions, and operational rules defined herein.

---

## 1. Executive Summary & Domain Scope

### What Zarfolio Is
**Zarfolio** is a specialized, multi-currency, double-entry financial accounting and inventory management system purpose-built for the gold, jewelry, bullion, and currency exchange industry in Iran.

Unlike general-purpose ERPs or simplified accounting apps, Zarfolio treats **monetary values**, **foreign currencies**, **precious metals (gold weight and purity/karat)**, and **minted coins/bullion** as primary, independent financial dimensions.

### Core Domain Capabilities
- **Chart of Accounts & General Ledger**: Standard multi-level Persian financial coding hierarchy with strict double-entry journal postings and line items.
- **Gold & Precious Metals Accounting**: Real-time tracking of fine gold weight (750 / 18-karat base), purity adjustments, scrap gold, and bullion inventory.
- **Minted Coin & Bullion Inventory**: Tracking of Bank coins (Emami, Bahar Azadi, Half, Quarter - 900/1000 purity), Parsian coins, and fine gold bars (995/1000 purity).
- **Multi-Currency Cash Vaults**: Foreign currency funds with single-fund-per-currency rules and directional transaction tracking (`in` / `out`).
- **Banking & Cheque Lifecycle**: Iranian bank accounts (with Sheba IBAN validation, 24-digit IR format), Sayad cheque issuance, clearing, collection, and return workflows.
- **Customer Ledger & Trade Relations**: Customer account balance tracking, debit/credit limits, and ledger reports.
- **Auditability & Disaster Recovery**: Event-driven activity logs, AES-256 encrypted notifications, and full database snapshot backup/restore with automated rollback.

---

## 2. Technology Stack

- **Runtime & Package Manager**: [Bun](https://bun.sh/) `v1.3.14`
- **Framework**: [Next.js](https://nextjs.org/) `v16.3.3` (App Router architecture)
- **UI & Rendering**: [React](https://react.dev/) `v19.2.8` (Server Components by default, Client Components where required)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) `v4` with dynamic dark/light theme CSS variables
- **Icons & Animation**: [Lucide React](https://lucide.dev/), `@persianlabs/icons`, [Morphicons](https://github.com/morphicons/morphicons) (`morphicons/react`), [Framer Motion](https://www.framer.com/motion/)
- **Backend & Database**: [PocketBase](https://pocketbase.io/) `v0.27.1` (SQLite embedded/standalone backend with REST API and JavaScript migrations)
- **Date Engine**: Persian Jalali dates via `date-fns-jalali` and native `Intl.DateTimeFormat` (`en-US-u-ca-persian`)
- **PDF Generation**: `pdfkit` for server-side generation; browser print templates for client-side invoice/report rendering

---

## 3. Conceptual Accounting Architecture

The accounting subsystem is the single source of truth for all financial movements across Zarfolio. Operational domains do not maintain independent accounting truth; they create operational transactions that emit balanced journal entries.

```
Chart of Accounts
       │
       ▼
Accounting Document / Event
       │
       ▼
Document Lines / Postings (pbc_journal_lines)
       │
       ▼
General Ledger (journal_entries + journal_lines)
       │
       ▼
Financial Reports (Ledger, Trial Balance, Balance Sheet)
```

### The Chart of Accounts is a First-Class Domain
The Chart of Accounts is **NOT** a settings page or auxiliary configuration module. It is a first-class domain located in `frontend/features/accounting/chart-of-accounts/`.

### Account Hierarchy & Levels
Zarfolio enforces a 4-level Persian accounting code structure:

1. **Level 1 — Group (`گروه`)**: 1-digit code (e.g., `1` for Assets - دارایی‌ها, `2` for Liabilities - بدهی‌ها, `3` for Equity - سرمایه).
2. **Level 2 — General Account (`کل`)**: 2-digit code (e.g., `11` for Current Assets - دارایی‌های جاری).
3. **Level 3 — Subsidiary Account (`معین`)**: 4-digit code (e.g., `1110` for Cash and Bank - موجودی نقد و بانک, `1120` for Notes Receivable - اسناد دریافتنی, `1130` for Gold Inventory - موجودی کالا و طلا, `2110` for Notes Payable - اسناد پرداختنی, `2120` for Counterparty Liabilities - بدهی به طرف حساب‌ها, `3100` for Opening Capital - سرمایه اول دوره).
4. **Level 4 — Detail Account (`تفصیلی`)**: Multi-digit code linked to specific operational entities (e.g., specific bank accounts, cash funds, or customer accounts).

### Account Types
- **Asset (`asset`)**: Debits increase balance, credits decrease balance.
- **Liability (`liability`)**: Credits increase balance, debits decrease balance.
- **Equity (`equity`)**: Credits increase balance, debits decrease balance.
- **Revenue (`income`)**: Credits increase balance.
- **Expense (`expense`)**: Debits increase balance.

---

## 4. Double-Entry Posting Engine (`posting-engine.ts`)

Located at `frontend/features/accounting/posting/posting-engine.ts`.

### Core Accounting Invariants
1. **Double-Entry Balance Invariant**:
   $$\sum \text{Debit} = \sum \text{Credit}$$
   Every journal entry must contain at least 2 lines. Unbalanced entries are rejected before database insertion.
2. **Non-Negativity Constraint**: Debit and credit line values must be positive integers ($\ge 0$). Simultaneous non-zero debit and credit on a single line is illegal.
3. **Idempotency Invariant**: Each posting uses a unique, deterministic `sourceKey` (e.g., `opening:cash:<fundId>`, `opening:bank:<bankAccountId>`, `cheque:issue:<chequeId>`). Attempting to post an entry with an existing `sourceKey` returns the existing `journal_entry` without creating duplicate records.
4. **Normalized Journal Lines**: The primary database source of ledger truth is the dedicated collection `pbc_journal_lines` (`journal_lines`), linked to `journal_entries` via `journal_entry_id` with cascading delete.

---

## 5. Operational Domains & Accounting Relationships

### Operational Ownership Matrix

| Domain | Primary Responsibilities | Main Collections | Accounting Linkage |
|---|---|---|---|
| **Accounting** | Coding hierarchy, journal entries, posting engine, ledger reports | `chart_of_accounts`, `journal_entries`, `journal_lines` | General Ledger Source of Truth |
| **Cash** | Foreign currency cash vaults, cash opening balance | `cash_funds`, `cash_transactions` | Detail account under `1110` (`موجودی نقد و بانک`) |
| **Banks** | Bank account registry, Sheba validation, bank balances | `bank_accounts`, `bank_transactions`, `banks` | Detail account under `1110` (`موجودی نقد و بانک`) |
| **Customers** | Customer profiles, group categorization, account codes | `customers`, `customer_groups` | Detail accounts under `1120` / `2120` |
| **Currencies** | Currency definitions (IRT, IRR, USD, EUR, etc.), decimal precision | `currencies` | Currency reference on funds, transactions, accounts |
| **Metals** | Scrap gold, melted gold, raw weight and purity accounting | System settings, document lines | Level 3 account `1130` (`موجودی کالا و طلا`) |
| **Coins** | Master catalog of coins/bars, opening coin inventory | `coin_types`, `coin_inventory` | Level 3 account `1130` (`موجودی کالا و طلا`) |
| **Checks** | Sayad cheques, lifecycle states (received, issued, cleared, collected, returned) | `cheques` | Level 3 accounts `1120` (`اسناد دریافتنی`) & `2110` (`اسناد پرداختنی`) |
| **Documents** | Entry documents (buy, sell, exchange, settlement) | `documents`, `document_lines` | Posts journal entries to General Ledger |

---

## 6. Opening Balance Architecture & Invariants

### Architectural Requirement
Every opening balance event in Zarfolio must adhere to the single-effect principle:

$$\text{One Opening Event} \longrightarrow \text{One Source Transaction} \longrightarrow \text{One Double-Entry Accounting Effect}$$

### Operational Invariant
- **Strictly One Active Opening Balance Record per Cash Fund / Currency or Bank Account**:
  Editing an existing opening balance must **UPDATE** the existing opening balance transaction record rather than appending duplicate `opening_balance` records.

### Current Implementation Audit & Status

#### 1. Cash Opening Balance (`/api/accounting/opening/cash`)
- **Current Behavior**:
  - `GET /api/accounting/opening/cash` lists funds and matches opening transactions from `cash_transactions` where `is_opening_balance = true || transaction_type = "opening_balance"`.
  - `POST` / `PUT` / `PATCH`:
    - When `fundId` is provided (edit mode), it locates the existing `cash_transactions` record for that fund and **UPDATES** its `amount`, `date`, and `description`.
    - It does **NOT** append duplicate `cash_transactions` records for the same vault.
    - If no fund exists for a currency, creating a fund creates one `cash_funds` record and one `cash_transactions` record (`is_opening_balance: true`, `direction: "in"`). Duplicate fund creation for the same currency is rejected.
- **Accounting Posting Behavior & Known Issue**:
  - Editing an opening balance invokes `postCashOpeningBalance(..., sourceKey: "opening:cash:<currencyId>")`.
  - Because `postJournalEntry` enforces idempotency via `sourceKey`, if a `journal_entries` record already exists for `opening:cash:<currencyId>`, `postJournalEntry` returns the existing journal entry without error, but **does not currently update the existing journal entry lines or amount**.
  - **Status**: *Current Behavior / Known Nuance*. The operational transaction record (`cash_transactions`) is correctly updated without duplicates, but updating historical double-entry `journal_lines` on opening balance edits requires explicit line-update logic in future accounting revisions.

#### 2. Bank Opening Balance (`/api/accounting/opening/bank`)
- **Current Behavior**:
  - Locates existing `bank_transactions` record where `is_opening_balance = true` and **UPDATES** amount, date, and description.
  - Updates `bank_accounts.balance` and `bank_accounts.currentBalance`.
  - Emits `postBankOpeningBalance(..., sourceKey: "opening:bank:<accountId>")`.

#### 3. Coin Opening Inventory (`/api/accounting/opening/coin`)
- **Current Behavior**:
  - Updates existing `coin_inventory` record if `recordId` is supplied; creates a new record if missing.
  - Generates journal entry via `postCoinOpeningInventory` if monetary valuation is non-zero.

---

## 7. Cash Vault Architecture & Rules

1. **One Cash Fund per Currency**: Enforced at both API route (`POST /api/accounting/opening/cash`) and database schema level via index `idx_cash_funds_currency`.
2. **Direction Field (`direction`)**:
   - Every `cash_transactions` record explicitly stores `direction`: `'in'` or `'out'`.
   - `opening_balance` transactions always use `direction = 'in'` and positive amounts (`amount > 0`).
   - Current fund balance is strictly calculated as:
     $$\text{Fund Balance} = \sum \text{amount where direction = 'in'} - \sum \text{amount where direction = 'out'}$$
3. **Automatic Chart of Accounts Mapping**:
   - Creating or updating a cash fund invokes `ensureCashFundDetailInChart`, which creates/links a Level 4 detail account under `1110` (`موجودی نقد و بانک`) in `pbc_chart_of_accounts`.
   - The fund stores this reference in `accountId`.

---

## 8. Gold and Jewelry Domain Rules

Zarfolio implements specialized domain rules for gold and precious metals that must never be flattened into ordinary fiat monetary accounting:

1. **Dual-Unit Financial Dimensions**:
   Every gold trade line carries both a **monetary value (fiat currency)** and a **fine weight value (grams at base purity)**.
2. **Standard Base Karat / Purity**:
   - Default base purity in Iran: **750 / 1000** (18 Karat).
   - Equivalent weight calculation:
     $$\text{Converted Weight (750)} = \frac{\text{Raw Weight} \times \text{Purity}}{750}$$
3. **Minted Coin & Bullion Categories**:
   - **Bank Coins (سکه بانکی)**: Standard 900/1000 purity (Emami / Full Bahar Azadi: 8.133g, Half Bahar Azadi: 4.066g, Quarter Bahar Azadi: 2.033g).
   - **Parsian Coins (سکه پارسیان)**: Variable weight, 750/1000 purity.
   - **Bullion / Gold Bars (شمش طلا)**: Fine gold bars, typically 995/1000 or 999.9/1000 purity.

---

## 9. Frontend Architecture & Boundaries

The frontend repository structure follows a clean, domain-partitioned architecture:

```
frontend/
├── app/                  # Next.js App Router routes & API endpoints
│   ├── (auth)/           # Authentication page layouts and routes
│   ├── dashboard/        # Dashboard feature pages
│   └── api/              # Server-side REST API handlers
├── features/             # Feature domain modules
│   ├── accounting/       # Chart of Accounts, Journal Entries, Posting
│   ├── cash/             # Cash funds & vault management
│   ├── banks/            # Bank accounts & transactions
│   ├── customers/        # Customer profiles & account codes
│   ├── currencies/       # Currency definitions
│   ├── metals/           # Scrap & raw gold domain
│   ├── coins/            # Coin catalog & initial inventory
│   ├── checks/           # Sayad cheque management
│   ├── reports/          # Financial & customer reports
│   ├── settings/         # Application settings
│   └── activity-log/     # Audit & activity logging
├── components/           # Shared UI & design system components
│   ├── ui/               # Core atomic UI elements (buttons, inputs, modals)
│   ├── layout/           # Sidebar, topbar, navigation shell
│   ├── forms/            # Shared form elements & date pickers
│   └── shared/           # Common domain-agnostic helpers
├── hooks/                # Custom React hooks (useAuth, useSettings, etc.)
├── lib/                  # Infrastructure, utilities, server-side services
│   ├── pocketbase/       # PocketBase client & service instances
│   ├── auth/             # Session & permission validation
│   ├── security/         # Audit logs, rate limiting, backup service
│   ├── dates/            # Jalali calendar & date conversion
│   ├── numbers/          # Weight & money formatting
│   └── utils/            # General helpers, Iran cities, Sheba validator
├── types/                # Shared TypeScript definitions
├── tests/                # Domain-partitioned unit & integration tests
├── scripts/              # Database seeding & collection initialization
└── public/               # Static assets & font files
```

### Intended Dependency Direction
To avoid circular dependencies and tight coupling:

$$\text{app} \longrightarrow \text{features} \longrightarrow \text{lib}$$

- `lib/` must never import from `features/` or `app/`.
- `features/` must contain domain-specific UI components, hooks, and services.
- Shared atomic UI belongs in `components/ui/`.

---

## 10. Next.js App Router Rules

1. **Server Components by Default**: Pages and layout components in `app/` are React Server Components unless interaction state requires `"use client"`.
2. **Server/Client Boundaries**: Keep `"use client"` directives as low in the component tree as possible. Do not mark entire page components as client components if only a child button or modal requires client state.
3. **API Route Handlers**: Endpoint handlers in `app/api/.../route.ts` must validate authentication using `getServerAuthContext()` and verify permissions using `hasPermission()`.
4. **No Legacy Directory Artifacts**: The legacy `frontend/src/` folder has been completely migrated and removed. All code resides in `frontend/app`, `frontend/features`, `frontend/components`, and `frontend/lib`.

---

## 11. PocketBase Backend & Schema Rules

1. **Collection Naming**: Primary collections use clean snake_case (`cash_funds`, `cash_transactions`, `bank_accounts`, `bank_transactions`, `customers`, `currencies`, `coin_types`, `coin_inventory`, `journal_entries`, `journal_lines`, `chart_of_accounts`, `app_settings`, `app_backups`).
2. **Migrations as Source of Truth**: All PocketBase schema changes and initial seed data are defined as JavaScript migration scripts in `frontend/pb_migrations/`.
3. **No Unintentional Schema Modifications**: Never alter PocketBase collections, fields, or migration scripts unless explicitly requested by the user.
4. **Resilient Query Execution**: API routes querying PocketBase must handle missing relations gracefully (e.g., fallback lists on expand failures) to prevent page crashes.

---

## 12. Security & Authorization Matrix

1. **Authentication Context**: All protected API routes verify session credentials using `getServerAuthContext()`.
2. **Permission Checks**: Granular permission checks are enforced via `hasPermission(context.user, 'permission.name')` (e.g., `cash.view`, `cash.create`, `cash.manage`, `bank.view`, `bank.edit`, `customers.manage`).
3. **Private Customer Fields**: Sensitive customer fields (such as `privateDescription` / confidential notes) are stripped from list endpoint responses and fetched only via authorized detail endpoints (`GET /api/customers/[id]/private-note`).
4. **Audit Logging**: Sensitive operations (login, backup restore, cash/bank modifications, activity cleanup) record structured audit events in `auth_events`.

---

## 13. Reporting & Aggregation Architecture

Future accounting reports (Trial Balance, General Ledger, Balance Sheet) must respect the Chart of Accounts parent-child code hierarchy:

```
Group (e.g. 1 - Assets)
└── General Account (e.g. 11 - Current Assets)
    └── Subsidiary Account (e.g. 1110 - Cash & Bank)
        └── Detail Account (e.g. 1110001 - Melli Bank Account)
```

### Report Aggregation Rule
When rendering reports at parent levels (Group, General, or Subsidiary), the system must aggregate total debits, credits, and balances from all descendant Detail accounts (`pbc_journal_lines.account_id`).

---

## 14. Refactoring & Engineering Directives for Future Sessions

All future AI engineering agents (including Jules) must follow these strict directives:

1. **Audit Before Modifying**: Inspect the actual codebase, existing files, and tests before writing new code.
2. **Preserve Business Logic & API Contracts**: Never change existing API response structures, field names, calculation formulas, or route URLs unless explicitly instructed.
3. **Complete Unedited Code Blocks**: Provide complete, unedited code blocks when modifying files. Do not use placeholders like `// rest of code` or `// ...`.
4. **No Direct Artifact Modification**: Never edit generated build output files in `dist/`, `.next/`, or `build/`. Always edit the source file.
5. **No Silent Bug Fixes**: If a bug or inconsistency is discovered in an unrelated area during a task, document it or report it to the user. Do not silently attempt to fix unrelated code.
6. **Practice Test Verification**: Always run `bun test` in `frontend/` to verify changes before completing tasks. Never claim tests passed without executing the test command.

---

## 15. Testing Suite & Verification

The project includes an extensive test suite in `frontend/tests/` covering:
- Accounting posting engine & double-entry balance invariants (`accounting-posting-engine.test.ts`).
- Cash fund opening balance & directional balance calculations (`cash-funds-opening-balance.test.ts`, `cash-opening-balance-foundation.test.ts`).
- Bank account opening balance & Chart of Accounts detail linkage (`bank-accounts-opening-balance.test.ts`, `bank-account-detail-coa.test.ts`).
- Iranian Sheba validation & Bank registry (`sheba-and-coa-integration.test.ts`, `bank-icons.test.ts`).
- Coin catalog & initial inventory calculations (`coin-initial-inventory.test.ts`, `coin-entry.test.ts`).
- Sayad cheque lifecycle transitions (`cheque-lifecycle.test.ts`).
- Database backup snapshot integrity & SHA-256 checksums (`backup-service.test.ts`, `backup-restore-validation.test.ts`).

### Test Execution Command
To execute the test suite:
```bash
cd frontend && bun test
```
