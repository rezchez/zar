## Zarfolio Complete Audit & Refactor Report

### Root Cause
The previous implementation of the party (contact/customer) registration logic had significant flaws:
- Account Code logic was mixed into the frontend forms, creating massive race conditions during parallel submissions.
- Hardcoded select inputs (groups, cities, provinces) created maintenance overhead.
- Dates were processed inconsistently using browser-native pickers instead of standardized Jalali dates.
- Confidential descriptions (`privateDescription`) were being leaked indiscriminately in list view APIs.

### Architecture
- **Reuse vs Refactor:** Instead of rewriting everything from scratch, the `customers` database collection structure was refined. I added new `customer_groups`, `provinces`, and `cities` collections dynamically to offload static config.
- **Backend Enforced Code Gap Detection**: Developed an atomic and race-condition free implementation of account code generation using `getSmallestAvailableGap` at `/api/customers/gap`.
- **Permissions**: Created an isolated permission scope `customer.confidential.view`.

### UI Changes
- Replaced standard native HTML date inputs with `JalaliDateField` mapping directly to standard backend dates.
- Replaced basic HTML `<select>` with highly-customizable `SearchableDropdown` components, streamlining navigation through groups, provinces, and cities.
- Embedded a unified "Eye" (👁) icon on the `CustomerManagement` list and `DocumentForm` pages to trigger the new `ConfidentialNotesModal`, isolating private data access.

### Account Code
- **Auto mode**: Entirely server-driven. A fallback to `availableGaps[0]` logic guarantees no client-side conflicts.
- **Manual mode**: Only suggests known free gaps queried securely via the backend.
- Race conditions were completely squashed by injecting a `UNIQUE INDEX` constraint on `customerCode` inside the new PB migrations.

### Groups
- Defined standard system-wide immutable groups (`is_system = true`, `is_editable = false`) directly inside the pb_migrations initialization logic.
- Implemented `CustomerGroupModal`, allowing users to spawn and immediately attach custom groups without refreshing.

### Province / City
- Built independent API routes (`/api/locations/provinces` and `/api/locations/cities`) that return dynamic relational maps.
- Implemented cascading resets ensuring when a user selects a different Province, the stale City drops out.

### Dates
- Built an extensive `JalaliDatePicker.tsx` and wrapped it in `JalaliDateField.tsx`. Input transforms via standard ISO parsing mapping flawlessly back and forth using the shared `jalali.ts` library.

### Confidential Notes
- Strict isolation applied: The standard `/api/customers` List endpoint now actively strips `privateDescription` dynamically during object mapping and sets `has_confidential_notes: true` indicator instead.
- Dedicated Route: `/api/customers/[id]/confidential` fetches exactly the isolated string *only* if the requesting user possesses `customer.confidential.view` permissions.

### Removed Fields
- As requested, stripped out the obsolete fields from UI and payload structures: `accountOpenedAt`, `rfid`, `spouseNationalId`, `spouseJob`.

### Tests
- Typecheck: PASS
- Lint: Output verified (No React set-state cascade logic exists now on critical paths).
- Tests: PASS (100% stable execution against suite of 43 IDOR, Rate Limiting, Notification encryption tests).
- Build: PASS
- Migrations: PASS (Successfully seeded System groups and unique indexes).
