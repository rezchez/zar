# Cash Opening Balance: Accounting Architecture & Reference Foundation

## 1. Overview & Conceptual Model

The Cash Opening Balance subsystem in ZarFolio establishes the reference accounting architecture for opening financial events. It enforces a strict multi-layer separation between operational cash fund management and general ledger double-entry accounting.

```
                    Cash Opening
                         │
                         ▼
                    Transaction
                         │
                         ▼
                  Cash Transaction
                         │
                         ▼
                     Cash Fund
                         │
                         ▼
          Chart of Accounts Detail Account
                         │
                         ▼
                   Journal Entry
                         │
                         ▼
                   Journal Lines
```

### Expected Accounting Tree Hierarchy

```
دارایی‌ها (1000 - سطح ۱ گروه)
 └── دارایی‌های جاری (1100 - سطح ۲ کل)
      └── موجودی نقد و بانک (1110 - سطح ۳ معین)
           ├── صندوق تومان (111001 - سطح ۴ تفصیلی)
           ├── صندوق دلار (111002 - سطح ۴ تفصیلی)
           └── صندوق یورو (111003 - سطح ۴ تفصیلی)
```

---

## 2. Separation of Concepts

| Layer | Responsibility / Role | PocketBase Collection |
|---|---|---|
| **Transaction** | Represents the business/operational event («What happened?»). | `cash_transactions` (`transaction_type: "opening_balance"`) |
| **Cash Transaction** | Operational record of cash vault movement and direction (`in` / `out`). | `cash_transactions` |
| **Journal Entry** | Parent accounting document for double-entry financial recording («What accounting event was generated?»). | `pbc_journal_entries` (`journal_entries`) |
| **Journal Lines** | Individual debit/credit lines belonging to a parent journal entry («Which account was debited/credited?»). | `pbc_journal_lines` (`journal_lines`) |
| **Chart of Accounts** | Master financial coding hierarchy. | `pbc_chart_of_accounts` (`chart_of_accounts`) |

---

## 3. Dedicated `journal_lines` Collection Schema

The primary source of accounting truth for journal lines is the dedicated `pbc_journal_lines` collection (not a JSON string array inside parent records):

```
journal_entries (1) ───< journal_lines (N)
```

### Schema Fields
- `id` (Text, Primary Key)
- `journal_entry_id` (Relation to `journal_entries`, Required, Cascade Delete)
- `account_id` (Relation to `chart_of_accounts`, Required)
- `debit` (Number, Min: 0)
- `credit` (Number, Min: 0)
- `description` (Text, Max: 1000)
- `party_id` (Relation to `_pb_users_auth_`, Optional)
- `bank_account_id` (Text, Optional)
- `cheque_id` (Text, Optional)

---

## 4. Account Resolution & Strict Validation Rules

When resolving the Cash Fund accounting account:
1. The endpoint resolves the Level 4 detail account from `pbc_chart_of_accounts` using `ensureCashFundDetailInChart`.
2. The account MUST exist in the Chart of Accounts.
3. The account MUST be active (`isActive = true`).
4. If an account cannot be resolved or is inactive, the operation **FAILS IMMEDIATELY**.
5. No fake fallbacks, virtual objects, or fabricated accounts are permitted.

---

## 5. Debit / Credit Invariant Rules

For every Cash Opening Balance operation:

$$\sum \text{Debit} = \sum \text{Credit}$$

- **DEBIT**: Cash Fund Level 4 Detail Account under `1110` (`موجودی نقد و بانک`)
- **CREDIT**: Opening Equity / Capital Account `3100` (`سرمایه اول دوره`)

### Validation Constraints
- Negative debits or credits are rejected.
- Lines with simultaneous positive debit and credit are rejected.
- Zero-value journals are rejected.
- Unbalanced journals ($\sum \text{Debit} \neq \sum \text{Credit}$) are rejected before database creation.

---

## 6. Idempotency & Retry Strategy

Opening balance creation is strictly idempotent using deterministic source keys:

$$\text{sourceKey} = \text{opening:cash:}\langle\text{currencyRecordId}\rangle$$

- Retrying an existing opening balance request returns the previously persisted `JournalEntryResult` (`alreadyExists: true`).
- No duplicate `journal_entries` or `journal_lines` records are created on retry.
- Posted historical accounting records are **never** silently overwritten.

---

## 7. Atomicity & Rollback Policy

The Cash Opening Balance creation flow follows an all-or-nothing execution pipeline:

1. Validate payload and resolve Chart of Accounts detail account.
2. Create `cash_funds` record if missing.
3. Create `cash_transactions` record (`direction: 'in'`).
4. Create parent `journal_entries` record.
5. Create child `journal_lines` records.

If **ANY** step fails:
- Newly created `cash_transactions` records are deleted.
- Newly created `cash_funds` records are deleted.
- Partial `journal_lines` and `journal_entries` are deleted.
- The API responds with an HTTP 400 error message.

---

## 8. Cached Operational Balance

`cash_funds.balance` serves solely as a high-performance cached operational view.
The general ledger accounting truth remains:

$$\text{Accounting Truth} = \text{journal\_entries} + \text{journal\_lines}$$

Cached balances are strictly consistent with posted transactions:

$$\text{Cash Balance} = \sum \text{Cash Transactions (in)} - \sum \text{Cash Transactions (out)}$$
