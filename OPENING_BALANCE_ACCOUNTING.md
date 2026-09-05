# Opening Balance Subsystem: Accounting Architecture & Contract

## 1. Executive Summary & Concept

An **Opening Balance (موجودی اولیه)** in ZarFolio is not merely an editable field on an entity record (`bank_accounts.balance` or `cash_funds.balance`).

It represents a formal, auditable **Accounting Event** that initializes the financial position of the enterprise at the start of a fiscal period or system setup.

```
Opening Operation / Event
          │
          ▼
Opening Journal Entry (journal_entries)
          │
  ┌───────┴───────┐
  ▼               ▼
DEBIT           CREDIT
(Asset)      (Opening Equity / Capital - 3100)
  │               │
  └───────┬───────┘
          ▼
   Chart of Accounts (pbc_chart_of_accounts)
          │
          ▼
   Current Derived Balance (Opening + Sum(Posted Transactions))
```

---

## 2. Single Source of Truth Model

To prevent conflicting authoritative values, ZarFolio enforces a strict single-source-of-truth hierarchy:

1. **Accounting Truth**: `journal_entries` (Double-entry balanced accounting ledger with `sourceKey: opening:<type>:<id>`).
2. **Subsystem Physical/Transaction Truth**:
   - **Bank Accounts**: `bank_transactions` (`transaction_type: 'opening_balance'`, `direction: 'in'`).
   - **Cash Funds**: `cash_transactions` (`transaction_type: 'opening_balance'`, `direction: 'in'`).
   - **Coin & Bullion Inventory**: `coin_inventory` (`transaction_type: 'opening_balance'`, `direction: 'in'`).
3. **Derived / Cached Current State**: `bank_accounts.balance` and `cash_funds.balance` serve solely as cached, high-performance display views calculated strictly as:

$$\text{Current Balance} = \text{Opening Balance} + \sum \text{Transactions In} - \sum \text{Transactions Out}$$

Cached balance fields are **never** manually edited without an associated transaction and accounting journal update.

---

## 3. Chart of Accounts Mapping

All three opening-balance domains resolve deterministically to Level 4 Detail accounts under the Chart of Accounts (`pbc_chart_of_accounts`):

### A. Bank Opening Balance
- **Parent Account**: `1110` (`موجودی نقد و بانک`).
- **Detail Account**: Dedicated Level 4 Detail account (e.g., `111001`, `111002`) created or linked via `ensureBankAccountDetailInChart`.
- **Counter Account**: `3100` (`سرمایه / Opening Capital`).

### B. Cash Fund Opening Balance
- **Parent Account**: `1110` (`موجودی نقد و بانک`).
- **Detail Account**: Dedicated Level 4 Detail account per currency created or linked via `ensureCashFundDetailInChart`.
- **Counter Account**: `3100` (`سرمایه / Opening Capital`).

### C. Coin & Bullion Opening Inventory
- **Accounting Account**: `1130` (`موجودی کالا و طلا / Gold & Coin Inventory`).
- **Counter Account**: `3100` (`سرمایه / Opening Capital`).
- **Physical vs Financial Separation**: `coin_inventory` tracks intrinsic physical attributes (quantity, unit weight, purity, total weight, converted weight at base karat). When a monetary valuation (`totalAmount > 0`) is provided, a corresponding financial journal entry is posted to `1130` / `3100`.

---

## 4. Debit / Credit Deterministic Rules

Every opening operation produces balanced journal entries where:

$$\sum \text{Debit} = \sum \text{Credit}$$

| Operation | Debit Account | Credit Account | Amount | Currency / Basis |
|---|---|---|---|---|
| **Bank Opening** | Bank Detail Account (`1110xx`) | Opening Capital (`3100`) | positive integer | Base Currency (IRR) |
| **Cash Opening** | Cash Detail Account (`1110xx`) | Opening Capital (`3100`) | positive integer | Base Currency (IRR) / Foreign Ref |
| **Coin Opening** | Gold Inventory (`1130`) | Opening Capital (`3100`) | positive integer | Base Currency (IRR) + Weight (grams) |

---

## 5. Idempotency & Atomicity Safeguards

### Idempotency
- Every opening operation generates a unique, predictable `sourceKey`:
  - Bank: `opening:bank:<bankAccountId>`
  - Cash: `opening:cash:<fundId>`
  - Coin: `opening:coin:<inventoryId>`
- If a client or mobile app retries due to network failure, `postJournalEntry` detects the existing `sourceKey` in `journal_entries` and returns the existing entry (`alreadyExists: true`) without creating duplicate journal lines.

### Atomicity Strategy
- API endpoints (`/api/accounting/opening/bank`, `/api/accounting/opening/cash`, `/api/accounting/opening/coin`) execute database updates in strict sequence.
- If transaction or journal creation fails, newly created entities are rolled back immediately before responding with an HTTP error.

---

## 6. Precision & Monetary Invariants

1. **Monetary Precision**: Stored as positive integer Rials (`IRR`). Toman conversion is purely display-layer (`IRR / 10`).
2. **Weight Precision**: Gold, coin, and bullion unit and total weights are rounded to 3 decimal places (`0.001` grams) according to app settings (`weightDecimalPlaces`).
3. **Purity / Karat Precision**: Purity is recorded in parts-per-thousand (e.g. `750` for 18k, `900` for Bank Coins, `995` for 24k bars) and converted to base karat (default `750`) via:

$$\text{Converted Weight (750)} = \frac{\text{Total Weight} \times \text{Purity}}{\text{Base Karat}}$$

---

## 7. Correction & Auditability Strategy

Opening records are immutable financial events. Editing an existing opening balance:
1. Re-calculates current balances derived from the baseline delta.
2. Updates the existing `bank_transactions` / `cash_transactions` record in place.
3. Updates the corresponding `journal_entries` record, preserving audit timestamps (`created`, `updated`, `createdBy`, `updatedBy`).
4. Ensures historical financial logs remain accurate without silent deletion or loss of trace.
