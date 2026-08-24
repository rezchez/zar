# Agent Instructions for Zarfolio

## Architecture
- **Frontend Framework**: Next.js App Router.
- **Backend API**: Next.js Server Components and Route Handlers proxying logic to PocketBase.
- **Database**: PocketBase (SQLite).

## Security Rules & Coding Conventions
1. **Never** remove explicit `hasPermission` checks from API routes.
2. **Never** remove `isAllowed` or `canModifyTargetUser` functions. IDOR boundaries rely on these explicit checks against `getServerAuthContext()`.
3. **Always** ensure financial endpoints are idempotent. Use a `sourceKey` check before creating documents or settlements.
4. **Always** persist financial sums natively as **integers** inside `amount` fields (IRR). Converting to Toman (`IRT`) should only occur at the display layer using `Math.floor(num / 10)` or `Math.round(num * 10)`.

## Required Verification Commands
When making changes, agents MUST run:
```bash
cd frontend
bun test tests/
bun run build
```
