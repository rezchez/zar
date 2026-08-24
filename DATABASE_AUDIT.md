# Database Audit (PocketBase)

- **_pb_users_auth_**: Stores authentication, role, MFA metadata.
- **bank_accounts**: Secure balance tracking.
- **cash_funds**: Secure balance tracking.
- **transactions**: Multi-asset recording with soft-deletes (`is_deleted`).
- **customers**: Customer records with soft-deletes.
- **notifications** / **notification_receipts**: Encrypted payloads.
- **app_settings** / **custom_fonts** / **print_templates**: Configurations.
