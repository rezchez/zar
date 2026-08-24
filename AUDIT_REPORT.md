# Security & Engineering Audit Report (Part 1)

## 1. Repository Audit
- **Framework:** Next.js (App Router), React, TailwindCSS, Bun
- **Backend:** PocketBase with local Node scripts for migration.
- **Project Structure:** Good separation of concerns (`app/api`, `components`, `lib`, `scripts`). Tests in `tests/`.

## 2. Security Review
- HTTP headers (CSP, HSTS) are strictly defined in `next.config.ts`.
- Environment variable handling: Keys are loaded via `process.env`.
- **Finding:** Hardcoded fallback values were used for `NOTIFICATION_ENCRYPTION_KEY` and `TOTP_ENCRYPTION_KEY`. (Fixed)

## 3. Authentication Review
- JWT sessions using HTTPOnly, Secure (on HTTPS) cookies (`PB_AUTH_COOKIE`, `BALE_PHONE_COOKIE`).
- Login route (`/api/auth/login`) securely handles MFA states without leaking existence of accounts.
- PocketBase MFA implementation leverages TOTP securely and stores secrets using AES-256-GCM.
- Register route properly validates input.

## 4. Authorization / RBAC Review
- **Roles:** `admin`, `manager`, `user`.
- Strict enforcement using `lib/authorization/*`.
- Prevents managers from escalating privileges, altering admin roles, or granting permissions they do not possess themselves.
- Centralized `requirePermission` enforcement exists.

## 5. Financial Correctness Review
- Money operations are safely structured using integer Rial (`IRR`) as the base unit.
- Conversion to Toman (`IRT`) is strictly a display-layer calculation using integer division `Math.floor(num / 10)` or `Math.round(num * 10)`.
- No floating-point operations in core balance persistence; `amount` fields are integers.

## 6. PocketBase Schema and Migration Review
- Migrations exist in `backend/pb_migrations/`.
- Properly configured default ACLs (mostly `@request.auth.id != ""`).
- Includes soft-delete capabilities for `customers` and `transactions` via boolean flags.

## 7. API Security Review
- API endpoints are protected against unauthorized access via `getServerAuthContext()`.
- Explicit `isAllowed` and `hasPermission` checks limit scope.
- IDOR checks: operations typically rely on `context.user.id` or validate targets against `canModifyTargetUser`.

## 8. Secret Leakage Audit
- **[Fixed P1 Issue]:** Hardcoded fallback key for `NOTIFICATION_ENCRYPTION_KEY` in `frontend/lib/notification-crypto.ts` (`zarfolio-notification-key-32b!!`).
- **[Fixed P1 Issue]:** `TOTP_ENCRYPTION_KEY` fallback to `zar-bale-auth` in `lib/bale.ts`.

## 9. Encryption Review
- `AES-256-GCM` used securely with 12-byte IV and 16-byte AuthTag in `lib/notification-crypto.ts` and `lib/totp.ts`.
- Validation ensures decryption only proceeds if lengths are correct.

## 10. Notification Security Review
- Notification payload (title and body) is AES-encrypted before storage.
- Receipt collections accurately map read status while restricting visibility to `@request.auth.id`.

## 11. PWA/Cache Security Review
- Caching explicitly ignores sensitive routes `/api/` and `/dashboard/`.

## 12. IDOR / Resource Ownership Audit
All API routes containing `[id]` parameters were individually reviewed.
- `GET /api/notifications/[id]` - Validates ownership checking either the receiver via `notification_receipts` or the original sender. IDOR protected.
- `PATCH /api/notifications/[id]/read` - Only allows updating receipts bound to `context.user.id`. IDOR protected.
- `PATCH / DELETE /api/banks/[id]` - Validates permissions. Applies globally without user isolation (as banks are shared resource). `ensureBankAccountsCollection` is used.
- `GET / PATCH /api/checks/[id]` - Checks are global financial entities. Does not require user scoping, just RBAC.
- `GET / POST /api/customers/[id]/transactions` - Authenticated but relies on RBAC (`customer.view` implicit via UI, but the API endpoint itself only checks `getServerAuthContext()`). Wait, `GET /api/customers/[id]/transactions` ONLY checks `getServerAuthContext()`. It doesn't explicitly call `hasPermission('transaction.view')`. **[P2 Issue - Missing explicit RBAC check on API layer]**
- `PATCH / DELETE /api/customers/[id]` - Uses `hasPermission(context.user, 'customer.edit')` and `'customer.delete'`. IDOR safe globally.
- `GET /api/admin/users/[id]/*` - Protected using `canModifyTargetUser` helper (e.g. manager can't view admin events). IDOR protected.
- `DELETE /api/documents/[id]` - Uses `context.user.role === 'admin' || manager`. IDOR protected globally.
- `DELETE /api/settings/fonts/[id]` and `PUT / DELETE /api/settings/print-templates/[id]` - Scoped to admin/manager. IDOR safe.

## 13. Financial Integrity Audit
All mutator routes were checked for ACID properties, atomicity, idempotency, and floating point errors.
- **Rial/Toman Operations:** Display conversions occur explicitly in `lib/money.ts`. Form data is expected to be Rial internally or explicitly converted prior to the payload creation.
- **Idempotency:**
  - `POST /api/documents`: Provides idempotency via the `sourceKey` and `documentId`. Checks for existing documents first.
  - `POST /api/settlements`: Provides `idempotencyKey` via `sourceKey`. Checks for existing document first. **Good.**
  - `POST /api/cash-vault`: Implements `sourceKey` and checks `cash_transactions` to provide idempotency. **Good.**
  - `POST /api/customers/[id]/transactions`: Uses `sourceKey`. **Good.**
  - `POST /api/banks/transfer`: Generates a random `documentId` but does *not* accept a client-provided idempotency key for retries. Transfers aren't idempotent out of the box and might be duplicated on network failure. **[P2 Issue - Missing client idempotencyKey in transfer]**
- **Atomicity:**
  - `POST /api/documents`: Creates lines inside a loop sequentially. If one fails, it tries to delete the previous ones manually. **This is a manual rollback implementation.** In PocketBase (SQLite under the hood), there are no explicit transaction blocks over REST APIs. The manual rollback is the known pattern but theoretically could fail midway, leaving partial documents. Given the tech stack, it is "best effort" and acceptable, but documented as a potential edge case.
  - `POST /api/banks/transfer`: Does a sequential update of source bank, destination bank, and then creates transactions. If a transaction creation fails, it explicitly attempts to rollback transactions, but does *not* reverse the bank balance updates due to "reconciliation safety." This leaves the application state inconsistent if the request fails after the bank update. **[P1 Issue - Inconsistent manual rollback in /api/banks/transfer]**
  - `POST /api/settlements`: Vault/Bank update occurs before transaction creation. If transaction fails, Vault/Bank is NOT rolled back. **[P1 Issue - Inconsistent partial state in /api/settlements]**

## 14. Rate Limiting / Authentication Flows Audit
- `/api/auth/login`: Handles login securely but rate limiting is implicit via PocketBase configuration. The custom TOTP flow uses PocketBase auth for password validation first, so standard rate limiting applies to password attacks. However, if an attacker bypasses PB limits, the application doesn't impose explicit limits here.
- `/api/auth/bale/request`: Manually implements a rate limit using a 120-second expiration logic and `bale_login_challenges` collection, preventing rapid SMS/Bale flooding.
- `/api/auth/bale/verify`: Manually limits attempts by updating `attempts = Number(challenge.attempts ?? 0) + 1` and blocking after 5 attempts.
- TOTP Setup / Verification: Standard implementation, relies on PB `authWithPassword` before generating/verifying secrets, avoiding untargeted enumeration.

*Conclusion:* The endpoints are generally protected against brute force through PocketBase mechanisms or explicit 5-attempt blocks (in Bale). However, moving these rules to edge middleware is highly recommended as a P2 backlog item.

## 15. Final Secret Search
A repository-wide search was conducted for any remaining fallback secrets, hardcoded encryption keys, tokens, or passwords (`grep -rnE "(secret|key|password|token)"`).
- The removed `FALLBACK_DEFAULT_KEY` for `NOTIFICATION_ENCRYPTION_KEY` and the fallback `zar-bale-auth` for `TOTP_ENCRYPTION_KEY` were successfully eliminated from the main logic.
- The only remaining mention of `zarfolio-notification-key-32b!!` is strictly inside the test suite (`tests/notification-flow.test.ts`) where it correctly mocks the required environment variable for unit testing.
- No other hardcoded sensitive keys or private secrets were found.
