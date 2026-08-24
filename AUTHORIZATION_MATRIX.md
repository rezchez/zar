# Authorization Matrix

| Role | Permissions | Limitations |
|---|---|---|
| Admin | All (`*`) | None |
| Manager | `user.*`, `customer.*`, `transaction.*`, `document.*`, `cash.*`, `bank.*`, `report.*`, `settings.view` | Cannot modify Admins, Cannot grant `user.role.change` |
| User | `*.view` only | Read-only |

## Codebase Implementation Verification

- Codebase accurately reflects `admin` has all keys natively.
- Codebase accurately reflects `manager` gets all categories except `user.role.change` and `user.delete`, `settings.manage/edit`, and `transaction.delete`, `document.delete` natively.
- Matrix statement `manager has user.*, ...` is an oversimplification. **Manager does NOT have `transaction.delete`, `document.delete`, `user.delete`, `settings.edit`, `settings.manage`.**
- Codebase accurately limits `user` role to `*.view` only.
