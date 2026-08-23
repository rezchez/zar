# Zarfolio

Zarfolio is a comprehensive financial and gold tracking workspace designed to help users manage customers, transactions, bank accounts, and gold market tickers. The application utilizes a modern tech stack centered around Next.js and PocketBase, providing an advanced and secure dashboard for daily financial operations.

## Features

- **Authentication & Security:** Multi-factor authentication (MFA) including Phone/Bale bot login, TOTP integration, and JWT-based session management.
- **Role-Based Access Control (RBAC):** Detailed permission management distinguishing Admin, Manager, and User roles, with support for custom grants/denies per user.
- **Dashboard & Workspaces:** Dynamic dashboards detailing market tickers, Jalali calendar integration, bank balances widgets, and overall gold/currency tracking.
- **Document Management:** Complex document entry forms for raw gold, coin sales, checks, cash, hawalas (transfers), etc. Supports printing directly to PDF with customizable templates.
- **Notification System:** End-to-end AES-256-GCM encrypted notifications with broadcast and private delivery channels.
- **Reporting & Auditing:** Activity logs and system audit features to track critical actions. Export transaction and user data to Excel and PDF.
- **Progressive Web App (PWA):** PWA support configured with a custom service worker (`sw.js`).
- **Dark / Light Mode:** Fully themed with Tailwind CSS and customizable theme variables.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Programming Language:** TypeScript
- **Runtime & Package Manager:** [Bun](https://bun.sh/)
- **UI & Styling:** React, Tailwind CSS, Framer Motion
- **Icons:** Lucide React
- **Database & Backend:** [PocketBase](https://pocketbase.io/)
- **Export & Reporting:** pdfkit (for PDF generation), xlsx (for Excel exports)
- **Testing:** Bun Test

## Architecture

Zarfolio separates the frontend and backend logically:
- **Frontend:** Built with Next.js App Router (located in `frontend/`), utilizing a mix of server and client components. API routes located in `app/api/` proxy requests securely, handle file processing, and manage sessions.
- **Backend:** PocketBase serves as the database and backend. Schema setup is managed by JavaScript migrations located in `backend/pb_migrations/` and TypeScript scripts located in `frontend/scripts/`.
- **State & Data Fetching:** Directly interacts with PocketBase APIs via `pocketbase` library integrated in the `lib` directory.

## Project Structure

```text
├── backend/
│   └── pb_migrations/        # PocketBase schema migration scripts
├── frontend/
│   ├── app/                  # Next.js App Router (Pages, Layouts, API Routes)
│   ├── components/           # Reusable React components (Dashboard, Forms, Print)
│   ├── lib/                  # Shared utilities (Auth, PocketBase services, RBAC, Crypto)
│   ├── scripts/              # Database setup and seed scripts
│   ├── tests/                # Bun test files (RBAC, Notifications, Document logic)
│   ├── next.config.ts        # Next.js configuration
│   ├── package.json          # Project dependencies and scripts
│   └── ...
└── README.md
```

## Prerequisites

To run this project locally, you will need:
- **Bun** (v1.3.14 or newer)
- **Node.js** (v20 or newer)
- **PocketBase** (Compatible with the included migrations in `backend/pb_migrations`)

## Installation and Setup

Follow these steps to set up the development environment from scratch:

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd zarfolio
   ```

2. **Install dependencies:**
   Navigate to the frontend directory and install the required packages using Bun.
   ```bash
   cd frontend
   bun install
   ```

3. **Start the Database:**
   Ensure PocketBase is running locally (defaulting to `http://127.0.0.1:8090`). Run it alongside the provided `pb_migrations/` to initialize collections.

4. **Environment Variables:**
   Create a `.env.local` or `.env` file inside the `frontend/` directory based on the variables listed in the Environment Variables section.

5. **Run Setup Scripts:**
   Initialize required configurations and collections:
   ```bash
   bun run pocketbase:ensure-bank-collection
   bun run pocketbase:ensure-notification-collections
   # Optionally, seed initial test data
   bun run seed:customers
   ```

6. **Start the Development Server:**
   ```bash
   bun run dev
   ```
   Open `http://localhost:3000` to view the application.

## Environment Variables

The following environment variables are utilized within the Next.js application (`frontend/`):

| Variable | Description | Required | Example |
|---|---|---|---|
| `POCKETBASE_URL` | URL of the running PocketBase instance. | Optional | `http://127.0.0.1:8090` |
| `POCKETBASE_SUPERUSER_EMAIL` | Superuser email used by setup scripts. | Required for scripts | `admin@example.com` |
| `POCKETBASE_SUPERUSER_PASSWORD`| Superuser password used by setup scripts. | Required for scripts | `securepassword` |
| `POCKETBASE_SUPERUSER_TOKEN` | Alternative authentication token for Superuser. | Optional | `ey...` |
| `PB_AUTH_COOKIE` | Cookie name for PocketBase authentication state. | Optional | `pb_auth` |
| `BALE_BOT_TOKEN` | API token for Bale bot integration. | Optional | `...` |
| `BALE_WEBHOOK_URL` | The public webhook URL configured for the Bale bot. | Optional | `https://example.com` |
| `BALE_WEBHOOK_SECRET` | Secret token to validate incoming webhook requests. | Optional | `my_secret` |
| `TOTP_ENCRYPTION_KEY` | Key for encrypting user TOTP secrets. | Optional | `zar-totp-auth` |
| `NOTIFICATION_ENCRYPTION_KEY` | 32-byte AES key used for encrypting notifications at rest. | Optional | `32-char-secure-key` |
| `NEXT_PUBLIC_BASE_URL` | Base public URL of the web application. | Optional | `http://localhost:3000` |
| `NEXT_DIST_DIR` | Output directory name for Next.js build. | Optional | `.next` |
| `PDF_FONT_ROOT` | Custom path to TrueType fonts for PDF generation. | Optional | `/path/to/fonts` |

*Note: Never commit secrets to the repository. Ensure `.env*` files are ignored by git.*

## Database (PocketBase)

Zarfolio relies heavily on PocketBase. The schema is configured via the `.js` scripts found in `backend/pb_migrations/`. Important collections include:
- `users` (or `_pb_users_auth_`): Holds user accounts, roles (`admin`, `manager`, `user`), and specialized `customPermissions` JSON.
- `bank_accounts`: Manages bank account names, numbers, and respective balances.
- `cash_funds`: Stores cash fund values globally.
- `app_settings` / `custom_fonts`: Contains global configurations, default karats, printing templates, and theme settings.
- `notifications` / `notification_receipts`: Secure storage for AES-encrypted notifications and tracking read status.
- `bale_login_challenges`: Authentication flow verification for bot users.

## Available Scripts

The following commands are available from within the `frontend/` directory (via `bun run <script>`):

| Script | Description |
|---|---|
| `dev` | Starts the Next.js development server. |
| `build` | Compiles and optimizes the application for production. |
| `start` | Starts the production server (requires `build` first). |
| `lint` | Runs ESLint to check for code quality and style issues. |
| `seed:customers` | Populates the database with sample customers. |
| `pocketbase:ensure-bank-collection` | Updates PocketBase schema to include proper Bank Account definitions. |
| `pocketbase:ensure-notification-collections` | Creates Notification collections in PocketBase. |

## Testing

Zarfolio utilizes **Bun Test** for its internal test runner. Tests are located inside the `frontend/tests/` directory.

- The test suite covers security RBAC boundaries, notification AES-256-GCM encryption, document logic, and math precision.
- Run tests directly using:
  ```bash
  cd frontend
  bun test
  ```

## Code Quality

- **Linting:** Execute `bun run lint` in the `frontend` folder to trigger ESLint checks.
- **Type Checking:** TypeScript compilation is evaluated during the build process (`bun run build`).

## Security

Security is deeply integrated into the codebase:
- **Authentication:** Sessions rely on PocketBase capabilities mapped securely over Next.js API Routes and stored in secure HTTP-only cookies.
- **Authorization:** `lib/authorization/` exports utilities that calculate Effective Permissions (User Role + Grants - Denies), preventing self-escalation and enforcing strict system logic across API actions.
- **Encryption:** Notifications payload uses AES-256-GCM encryption at rest before inserting them into PocketBase.
- **Security Headers:** Strict global HTTP security headers (CSP, HSTS, X-Frame-Options) are maintained within `next.config.ts`.
- **Bot Validation:** Webhook integrations strictly validate requests against a configured `BALE_WEBHOOK_SECRET`.

## Deployment

Zarfolio can be deployed in a standard Next.js environment:

1. Setup PocketBase independently on your production server.
2. Clone the repository to the production server or deploy using services like Vercel.
3. Configure all necessary environment variables in the production environment settings.
4. Run the production build command:
   ```bash
   cd frontend
   bun install
   bun run build
   bun run start
   ```
5. Note: Make sure to proxy the PocketBase instance effectively so that the server-side requests originate efficiently to it securely.
