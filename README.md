# Zarfolio

Zarfolio is a modern, web-based financial management workspace tailored for gold markets, coin & bullion dealers, and treasury operations. It combines Next.js App Router with PocketBase as a light, high-performance database backend to provide single-source-of-truth accounting, custom multi-currency cash funds, double-entry financial posting, and a fully customizable, widget-driven dashboard.

---

## Highlights & Key Capabilities

- **Widget-Driven Dashboard System:** Fully customizable dashboard supporting widget registration, visibility controls, order persistence, and 3 responsive sizes (`small`, `medium`, `large`).
- **Real-Time Cash Balance Widget (`cash-balance`):** Displays all configured cash funds and calculates canonical balances from `cash_funds` and `cash_transactions` without secondary balance storage.
- **Double-Entry Accounting Engine:** Enforces balancing entry invariants, Level 4 Detail Chart of Accounts (`pbc_chart_of_accounts`), and strict historical ledger tracking.
- **Coin & Bullion Inventory Management:** Master catalog of standard Iranian coins (Emami, Bahar Azadi, Nim, Rabe) and gold bars with exact purity conversions (`750` base karat equivalent).
- **Multi-Currency & Cash Funds:** Single cash fund per currency rule enforced at schema level (`idx_cash_funds_currency`), with support for USD, EUR, GBP, AED, TRY, and custom currencies.
- **Iranian Bank Integration:** Bank registry mapping over 30 Iranian banks with logo assets, IBAN (Sheba) validation (`IR` + 24 digits), checkbooks, and virtual check tracking.
- **Role-Based Access Control (RBAC):** Granular permissions for Admin, Manager, and User roles, with support for per-user custom permission overrides (`customPermissions`).
- **Security & Privacy:** Anti-enumeration login endpoints, rate-limited auth routes, AES-256-GCM encrypted notifications at rest, and HTTP-only cookie session management.
- **Bilingual Documentation & PWA:** Native Persian/RTL first-class UI experience accompanied by comprehensive English and Persian documentation and Progressive Web App capability (`sw.js`).

---

## Tech Stack

- **Frontend:** [Next.js](https://nextjs.org/) (App Router, Server & Client Components)
- **Programming Language:** TypeScript
- **Runtime & Package Manager:** [Bun](https://bun.sh/)
- **UI & Styling:** React 19, Tailwind CSS, Framer Motion, Lucide React, Morphicons
- **Database & Backend:** [PocketBase](https://pocketbase.io/)
- **PDF & Reporting:** `pdfkit` for server-side PDF generation, `xlsx` for Excel exports
- **Testing:** Bun Test (`bun test`)

---

## Architecture

Zarfolio maintains a decoupled architecture with a clear separation of concerns:

- **Frontend (`frontend/`):** Next.js App Router containing dashboard pages, financial document entry tabs, customer ledger reports, and proxy API routes (`app/api/`) that handle server-side authorization and PocketBase communication.
- **Backend & Migrations (`backend/pb_migrations/`):** PocketBase schema and migrations managed via JavaScript files. Migrations handle collection creation, field extensions, relations, unique constraints, and indexes.
- **Single Source of Truth Accounting:** Financial balances (Cash Funds, Bank Accounts, Gold Inventory) are strictly calculated by aggregating transaction records (`cash_transactions`, `bank_transactions`, `journal_entries`) and opening balances, preventing balance drift or secondary data stores.

---

## Project Structure

```text
zar/
├── backend/
│   └── pb_migrations/                   # PocketBase JavaScript migration files
├── frontend/
│   ├── app/                             # Next.js App Router
│   │   ├── api/                         # API routes (Auth, Cash, Banks, Reports, Settings)
│   │   ├── dashboard/                   # Dashboard pages (Overview, Customers, Documents, Reports)
│   │   ├── layout.tsx                   # Root layout with theme & PWA prompt
│   │   └── page.tsx                     # Login / Auth landing page
│   ├── components/                      # UI Components
│   │   ├── ui/                          # Base UI primitives (Calendar, Inputs, DatePicker)
│   │   └── ...                          # Domain components
│   ├── lib/                             # Core Domain Services & Utilities
│   │   ├── auth.ts                      # Session authentication & cookies
│   │   ├── authorization.ts             # RBAC & permission checking
│   │   ├── chart-of-accounts.ts         # Accounting tree & detail mapping
│   │   ├── dashboard-widgets.ts         # Widget registry & size mapping
│   │   ├── jalali.ts                    # Jalali/Gregorian date conversions
│   │   ├── pdf-reports.ts               # PDFKit document generator
│   │   ├── sheba.ts                     # Iranian IBAN (Sheba) validator
│   │   └── weight.ts                    # Gold weight & karat conversion helpers
│   ├── pb_migrations/                   # Mirrored migrations for frontend dev runner
│   ├── scripts/                         # Setup and database seeding utilities
│   ├── tests/                           # Bun test suite
│   ├── next.config.ts                   # Next.js configuration
│   └── package.json                     # Frontend dependencies and scripts
├── ACCOUNTING_INVARIANTS.md             # Invariant guidelines for double-entry financial logic
├── README.md                            # English Documentation
└── README.fa.md                         # Persian Documentation
```

---

## Dashboard Widget Architecture

The Zarfolio Dashboard features a widget-driven architecture:

```text
Dashboard Page
    └── DashboardWidgetContainer
            ├── Widget Registry (lib/dashboard-widgets.ts)
            │     ├── quick-actions
            │     ├── market-ticker
            │     ├── cash-balance
            │     ├── bank-balances
            │     ├── gold-trackers
            │     └── jalali-calendar
            ├── Widget Sizes (small, medium, large)
            ├── Widget Visibility & Order Controls
            └── User Preferences Persistence (dashboard_preferences collection)
```

Each widget supports 3 responsive sizes (`small`, `medium`, `large`), and user choices (visibility, size, order) are automatically persisted to the `dashboard_preferences` PocketBase collection per user.

---

## Database Collections (PocketBase)

Key collections defined in PocketBase migrations:

| Collection | Description | Primary Source of Truth |
|---|---|---|
| `users` (`_pb_users_auth_`) | User accounts, roles (`admin`, `manager`, `user`), and custom permissions | Authentication & Access |
| `currencies` | Currency definitions (Code, Name, Symbol, Decimals) | Currency Catalog |
| `cash_funds` | Cash fund definitions linked to currencies and Level 4 COA | Cash Fund Master |
| `cash_transactions` | Canonical cash movements (`direction: 'in' \| 'out'`) | **Cash Balance Calculation** |
| `bank_accounts` | Bank accounts with Sheba (IBAN), checkbook flags, and bank links | Bank Account Master |
| `bank_transactions` | Canonical bank account movements | Bank Balance Calculation |
| `pbc_chart_of_accounts` | General ledger chart of accounts (Levels 1 to 4) | Double-Entry Accounting |
| `coin_types` | Master catalog of coins and bullion bars | Gold Inventory Catalog |
| `dashboard_preferences` | User-scoped widget customization settings | Dashboard Layout |
| `app_settings` | Global organization settings, fiscal year, and print templates | App Configuration |

---

## Installation & Setup

### Prerequisites

- **Bun** (v1.2.0 or newer)
- **Node.js** (v20 or newer)
- **PocketBase** (v0.22+ instance)

### Local Development Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rezchez/zar.git
   cd zar
   ```

2. **Install dependencies:**
   ```bash
   cd frontend
   bun install
   ```

3. **Configure Environment Variables:**
   Create `.env.local` in the `frontend/` directory:
   ```env
   POCKETBASE_URL=http://127.0.0.1:8090
   POCKETBASE_SUPERUSER_EMAIL=admin@example.com
   POCKETBASE_SUPERUSER_PASSWORD=securepassword
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

4. **Run PocketBase with Migrations:**
   Start PocketBase targeting the migration folder:
   ```bash
   pocketbase serve --dir=../pb_data --migrationsDir=../backend/pb_migrations
   ```

5. **Start the Next.js Development Server:**
   ```bash
   cd frontend
   bun run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## Available Commands

Run these commands inside the `frontend/` directory:

```bash
bun run dev          # Start Next.js development server
bun run lint         # Run ESLint check
bun test             # Execute Bun test suite
```

---

## Testing & Quality Assurance

Zarfolio includes a suite of unit and integration tests powered by **Bun Test**:

```bash
cd frontend
bun test
```

Tests verify:
- Cash fund opening balance & transaction direction rules (`tests/cash-funds-opening-balance.test.ts`)
- Dashboard widget registry & preferences normalization (`tests/dashboard-widgets.test.ts`)
- Double-entry accounting posting engine & balance invariants (`tests/accounting-posting-engine.test.ts`)
- Coin and gold bar weight/purity conversions (`tests/coin-entry.test.ts`)
- Iranian bank registry and Sheba validation (`tests/bank-icons.test.ts`)
- Notification AES-256-GCM encryption & rate-limiting (`tests/notification-flow.test.ts`)

---

## Security Considerations

- **Server-Side Authorization:** All API routes evaluate authenticated context via `getServerAuthContext()` and check explicit permissions using `hasPermission()`.
- **Data Isolation:** PocketBase API rules enforce user-level filter boundaries (`user = @request.auth.id`).
- **Rate-Limiting:** Authentication endpoints prevent brute-force attempts with in-memory IP rate limiting.
- **Encrypted Payload:** Sensitive notifications are encrypted with AES-256-GCM at rest.

---

## License

This project is open-source under the MIT License.
