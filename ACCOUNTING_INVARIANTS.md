# Accounting Invariants

1. All monetary values MUST be stored as integers in the base currency (IRR - Rials).
2. Toman is strictly a display-layer calculation (`value / 10`).
3. Multi-asset transactions MUST correctly separate gold, silver, platinum, rials, etc.
4. "Opening Balance" (`مانده ابتدای دوره`) represents the initial setup position of an entity (cash fund, bank account, coin inventory). Each active entity has strictly one logical opening balance event. Editing an opening balance updates the original operational transaction and its corresponding double-entry journal entry in place to ensure 1:1 operational-ledger alignment without creating duplicate opening transactions (Model A: Mutable Setup Data).
5. All database updates handling balances MUST enforce positive or >= 0 constraints (e.g. Bank Balances).
