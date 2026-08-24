# Accounting Invariants

1. All monetary values MUST be stored as integers in the base currency (IRR - Rials).
2. Toman is strictly a display-layer calculation (`value / 10`).
3. Multi-asset transactions MUST correctly separate gold, silver, platinum, rials, etc.
4. "Opening Balance" (`مانده ابتدای دوره`) is immutable and always strictly chronological.
5. All database updates handling balances MUST enforce positive or >= 0 constraints (e.g. Bank Balances).
