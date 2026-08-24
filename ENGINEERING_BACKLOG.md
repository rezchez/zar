# Engineering Backlog

1. Remove fallback secret keys and strictly enforce that secrets are provided in the environment.
2. Ensure strict IDOR checks on all API endpoints dealing with `id` params.
3. Migrate `next.config.ts` headers to a dedicated Next.js middleware for more robust protection.
4. Improve rate limiting on `/api/auth/login` and `/api/auth/bale/request`.

## Performance & Pagination Notes
- `/api/audit-logs`: Converted from `getFullList` to `getList(1, 1000)` to prevent unbounded memory usage on large deletes.
- `/api/admin/users`: Converted from `getFullList` to `getList(1, 1000)`.
- `/api/customers`: Uses `getCustomersWithBalances` which calls `getFullList` on both `customers` and `transactions` tables to compute balances in-memory. This is an $O(N)$ memory architectural constraint of the current design and is noted as a necessary refactor for large datasets (e.g., using PocketBase view collections or aggregate queries natively), but cannot be trivially paginated without breaking the current dashboard/list view expectations.

## Concurrency
- PocketBase natively uses SQLite which has `WAL` mode. Writes are serialized. While we calculate `next` balances in Node and write them back, the single-threaded nature of SQLite writes limits catastrophic data races compared to isolated microservices, but true atomic transactions or SQL-level `balance = balance - X` would be the absolute ideal state. Given the underlying PB library constraints, the current `read -> compute -> write` is accepted technical debt for balance management but should be monitored for extremely high concurrency scenarios.

## Observability & Error Handling
- Errors generally return `NextResponse.json({ message: '...' }, { status: XXX })`.
- No stack traces or sensitive internals are returned to the frontend.
- `console.error` logs specific error tags (`bank_account_update_failed`, etc.) which is suitable for standard structured log ingestion (like PM2 or Docker logs).
- Request correlation IDs could be added in the future as a Next.js middleware, but current logging is safe and adequate.
