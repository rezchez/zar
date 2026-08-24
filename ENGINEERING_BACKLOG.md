# Engineering Backlog

1. Remove fallback secret keys and strictly enforce that secrets are provided in the environment.
2. Ensure strict IDOR checks on all API endpoints dealing with `id` params.
3. Migrate `next.config.ts` headers to a dedicated Next.js middleware for more robust protection.
4. Improve rate limiting on `/api/auth/login` and `/api/auth/bale/request`.
