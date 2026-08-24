# Authorization Matrix

| Role | Permissions | Limitations |
|---|---|---|
| Admin | All (`*`) | None |
| Manager | `user.*`, `customer.*`, `transaction.*`, `document.*`, `cash.*`, `bank.*`, `report.*`, `settings.view` | Cannot modify Admins, Cannot grant `user.role.change` |
| User | `*.view` only | Read-only |
