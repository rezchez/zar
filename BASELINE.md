# Baseline Architecture

- Next.js frontend (App Router) running with Bun.
- PocketBase backend (port 8090).
- Users authenticate via PocketBase SDK; token is saved in a secure HTTP-Only cookie.
- Roles and permissions are applied server-side dynamically via PocketBase JSON field.
- Custom AES-256-GCM encryption is used for TOTP secrets and Notifications to protect data at rest.
