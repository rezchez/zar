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
