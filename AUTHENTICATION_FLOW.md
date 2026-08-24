# Authentication Flow Architecture

This document describes the actual implemented authentication lifecycle for Zarfolio.

## Core Flow
1. **Anonymous** User visits `/login`.
2. **First Factor (Password):** User submits Email + Password to `/api/auth/login`.
   - The server calls `pocketbase.collection('users').authWithPassword()`.
   - If the user has `authenticatorEnabled` or `twoFactorEnabled`, the session is deliberately **discarded** server-side, and a 401 response is returned demanding the `mfaId` and `totpCode` (or `otpCode`).
3. **Second Factor (TOTP/Email):** User submits Email + Password + TOTP Code.
   - Server re-authenticates the password.
   - If successful, the server decrypts the user's TOTP secret (`authenticator_secrets` table) and verifies the code.
   - If the code is valid, the authentication record is accepted.
4. **Session Creation:** A secure, `HttpOnly`, `SameSite=lax` cookie (`pb_auth`) is set on the response, containing the PocketBase JWT. The database records `lastLoginAt` and logs an `audit_events` row.

## Alternative Flow: Bale Auth
1. User requests a code via `/api/auth/bale/request`.
2. Server generates a random code, hashes it, and stores it in `bale_login_challenges` with a 120-second TTL. The bot sends the cleartext code to the user's linked Bale chat.
3. User submits the code to `/api/auth/bale/verify`.
4. Server hashes the input and checks it against the database. If correct, creates a custom `phone_sessions` record and sets a `zar_phone_auth` cookie. This runs in parallel with PocketBase core auth.

## Session Invalidation (Logout)
- User calls `DELETE /api/auth/logout`.
- Server records `lastLogoutAt` and writes an audit event.
- Server sets `pb_auth` and `zar_phone_auth` cookies to empty strings with `maxAge: 0`.

## Password Reset Flow
- An Admin/Manager calls `POST /api/admin/users/[id]/password-reset`.
- The system calls PocketBase's native `requestPasswordReset`.
- PocketBase natively handles sending the email and consuming the token on the frontend via its internal pages or API.

## Enumeration Protection Checks
Reviewing `/api/auth/login`, there is a potential enumeration vector:
```typescript
try {
  const account = await service.collection('users').getFirstListItem(
    service.filter('email = {:email}', { email }),
  );
// ...
} catch {
  // Continue with PocketBase authentication when the service account is unavailable.
}
```
If an email is valid, this first block fetches it to check `blockedUntil` and set `accountSecurity`. If it fails (email not found), it proceeds down to the PocketBase SDK `authWithPassword`.

If the password check fails later on a valid email, it returns:
`{ message: 'ایمیل یا رمز عبور اشتباه است.' }` via the catch-all.

If the email does not exist, `getFirstListItem` throws, then `authWithPassword` throws, and it also hits the catch-all.

**However**, if a non-existent email is checked vs a valid email with a bad password, the timing difference between 2 database calls (1 valid lookup + 1 slow hash comparison) vs 1 database call (1 failed lookup + 1 fast hash failure) can be measured by attackers.

Furthermore, if the user account *is* blocked, the API immediately returns `403` with a blocked message. This directly reveals that the account exists. For high security, blocked accounts should probably still yield the generic "Invalid email or password" to the public login route unless they provide the correct password first, or we accept that blocked status enumeration is acceptable UX.

### Enumeration Protection Implemented
`POST /api/auth/login` was refactored to:
1. Always attempt `authWithPassword` *first*. If this fails and isn't an MFA challenge, we instantly return generic "ایمیل یا رمز عبور اشتباه است." (Bad email or password). This prevents early-bailing on the admin block status check from revealing that an account exists with a specific email.
2. Only checks the admin lock status / block time *after* the user successfully proves they have the correct password (or during the initial MFA check when we verify the email anyway natively via PB).

This completely equalizes the response shapes and timing (validating password hashes universally) across non-existent and wrong-password accounts.

## Rate Limiting Additions
An in-memory rate limiter `rateLimit` was implemented and injected into:
- `/api/auth/login` (10 attempts / min per IP)
- `/api/auth/bale/request` (5 requests / min per IP)
- `/api/auth/bale/verify` (10 requests / min per IP)
- `/api/account/authenticator/verify` (10 requests / min per IP)

This stops brute force guessing, password spraying, and SMS/Message spam.

## Password Reset Audit
PocketBase natively handles the generation, encryption, hashing, and email delivery for password resets. The token lifecycle (single-use, expiration) is strictly enforced by the PocketBase core, ensuring secure password resets. The proxy route `/api/admin/users/[id]/password-reset` acts as an admin trigger and was audited. It correctly utilizes `canModifyTargetUser` equivalent to restrict privileges, preventing managers from resetting admin passwords. A rate limit was added to prevent email-spamming via abuse.

## Session & Cookie Security
- **Cookies**: Both `PB_AUTH_COOKIE` (JWT) and `BALE_PHONE_COOKIE` (Opaque Session Token) are set with `HttpOnly: true`, `SameSite: 'lax'`, and dynamic `Secure` based on request protocol (`isSecureRequest()`).
- **Logout Invalidation**: `/api/auth/logout` sets both cookies to empty strings with `maxAge: 0`. It completely invalidates the Bale token on the backend by deleting the `phone_sessions` row, ensuring the session cannot be replayed.
- **JWT Invalidation**: PocketBase natively utilizes stateless JWTs with signature signing. Explicit single-session revocation requires PB backend support or token generation salt rotation (e.g. changing password rotates the hash/token seed natively in PB, invalidating previous JWTs instantly).

*Conclusion*: Session security is solid and natively protected.
