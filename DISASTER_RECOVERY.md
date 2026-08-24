# Disaster Recovery & Backup Plan

## Overview
This document outlines the backup requirements and recovery processes for a production deployment of Zarfolio.

## Critical Configuration Backups
1. **Environment Secrets**: You MUST securely back up `frontend/.env.local`.
   - `NOTIFICATION_ENCRYPTION_KEY`: If lost, all previous system notifications become undecryptable.
   - `TOTP_ENCRYPTION_KEY`: If lost, all user Authenticator codes and Bale bot logins will invalidate, locking out MFA users.

## Database Backup (PocketBase)
PocketBase relies on an underlying SQLite file located at `pb_data/data.db`.

### Automatic Backup
It is recommended to run a scheduled cron job (e.g. daily) to snapshot the DB:
```bash
# PocketBase natively supports backups via REST or CLI. Example CLI:
./pocketbase admin backup create
```
*(Ensure to map the backups directory to a secure external storage server)*

### Manual Recovery
1. Shut down the Next.js frontend and PocketBase backend.
2. Replace `pb_data/data.db` with the latest backup.
3. Restart PocketBase.
4. Restart Next.js frontend.

## Architecture & Migration Considerations
If migrating servers, ensure `frontend/lib/pocketbase.ts` URL points to the internal secure port of the new database instance, and ensure the `.env.local` exactly matches the previous environment to maintain encryption consistency.
