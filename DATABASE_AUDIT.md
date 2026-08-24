# Database Audit (PocketBase)

- **_pb_users_auth_**: Stores authentication, role, MFA metadata.
- **bank_accounts**: Secure balance tracking.
- **cash_funds**: Secure balance tracking.
- **transactions**: Multi-asset recording with soft-deletes (`is_deleted`).
- **customers**: Customer records with soft-deletes.
- **notifications** / **notification_receipts**: Encrypted payloads.
- **app_settings** / **custom_fonts** / **print_templates**: Configurations.

## Collection Verification Table

| Collection | Create Rule | View Rule | Update Rule | Delete Rule | Audit / Findings |
|---|---|---|---|---|---|
| `bank_accounts` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.id != ""` | All users can mutate. Safe via UI constraints, but potentially vulnerable at API/DB level if API wrapper bypassed. We enforce via Next.js API Routes `hasPermission`. |
| `cash_funds` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.id != ""` | Same as above. Safe via Next.js API `hasPermission`. |
| `search_logs` | `@request.auth.id != ""` | `@request.auth.id != ""` | Admin (implicitly, none listed) | Admin | Read-only general use. |
| `cash_transactions` | `@request.auth.id != ""` | `@request.auth.id != ""` | None (Append Only) | None | Proper append-only structure. |
| `checks` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.id != ""` | None | Safe via Next.js API. |
| `app_settings` | `role="admin"\||"manager"` | `@request.auth.id != ""` | `role="admin"\||"manager"` | `role="admin"` | Strict RBAC enforced natively by PocketBase. |
| `custom_fonts` | `role="admin"\||"manager"` | `@request.auth.id != ""` | `role="admin"\||"manager"` | `role="admin"` | Strict RBAC enforced natively. |
| `notifications` | None (Backend Script) | `@request.auth.id != ""` | None | None | Immutable. API handles creation strictly. |
| `notification_receipts`| None (Backend Script)| `@request.auth.id != ""` | None | None | `PATCH /api/notifications` strictly enforces updating ONLY rows matching `recipient = @request.auth.id`. |
| `print_templates` | `role="admin"\||"manager"` | `@request.auth.id != ""` | `role="admin"\||"manager"` | `role="admin"\||"manager"` | Strict RBAC. |

**Observation:** Direct PocketBase API access to `transactions` or `bank_accounts` could allow any authenticated user to mutate balances if they possess the PB endpoint and their token. The Next.js API provides the strict RBAC wrapper. If PocketBase is exposed publicly, this is a vulnerability. The documentation states PocketBase must be correctly proxied, mitigating this, but it's noted as an architecture feature/constraint.
