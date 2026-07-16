# Settld

**Split. Prove. Settle.**

Settld is an offline-first shared-expense PWA for trips, homes, and groups. It keeps splits, receipt or payment proof, balances, and an append-only activity trail together without putting core use behind an account.

Production: [settld-ruddy.vercel.app](https://settld-ruddy.vercel.app)

Designed and built by [Gaurav Kumar · The Algothrim](https://thealgothrim.com).

## Status

Version 0.3.0 is a static, installable PWA with no application server or build step. IndexedDB is the source of truth, the service worker supports offline use, and every core flow also works in local mode without signing in.

The current release includes:

- Groups, members, and equal, exact, percentage, or shares-based expense splits
- Receipt and payment-proof attachments, compressed on-device
- Recomputed balances and Smart settle's simple plan of at most `members - 1` transfers
- An append-only trail for expenses, edits, deletions, and recorded payments
- Optional UPI deep links that open the user's payment app
- Dark, light, and system themes with the coral-on-void Settld design system
- Responsive layouts, keyboard focus states, accessible sheets, and 48 px minimum touch targets

Settld calculates and records suggested payments; **it does not hold funds, initiate transfers, or process payments**.

## Data and Firebase

Local mode stores the ledger and proof in IndexedDB on that device. When a user signs in with Google, Settld mirrors their data to Firebase and restores it on another signed-in device:

- Firebase project: `settld-in`
- Authentication: Google is enabled; `settld-ruddy.vercel.app` is authorized
- Firestore: `(default)` database in `asia-south1`
- Security: records live below `users/{uid}/...`; deployed rules enforce that UID, the allowed collections, document shapes, and proof-size limits
- Sync: failed writes enter a serialized offline outbox; newer mutable records win, while tombstones keep hard deletions from being resurrected by stale devices
- Proof: compressed attachments are stored as base64 in Firestore documents so the app does not depend on Firebase Storage

This Firebase layer is **personal per-UID backup and restore, not multi-user realtime collaboration**. People added to a group are ledger participants, not separate signed-in users, and there are no shared group documents or invitations yet.

The first Google account used on a device claims its local dataset. Settld blocks a different account from merging with that data until the user exports or erases it, preventing cross-account ledger and proof leakage. Erasing while signed in deletes the device copy, writes an account reset marker, and removes the Firebase mirror.

Production authentication is Google-only. Phone authentication is intentionally omitted until SMS billing and abuse controls are configured.

## Run locally

Node.js 22 is the CI version.

```sh
npm ci
npm start
```

Open `http://localhost:5173`. Any static HTTP server can serve the repository; ES modules will not work correctly by opening `index.html` through `file://`.

## Test

```sh
npm test          # ledger arithmetic and settlement invariants
npm run test:e2e  # mobile Chromium product flow via Playwright
```

Playwright starts the local server when one is not already running. GitHub Actions runs both suites for pull requests and pushes to `main`.

## Deploy

The GitHub repository is connected to Vercel. A push to `main` triggers the production deployment automatically; routine releases do not need a separate `vercel --prod` command.

Firestore rule changes are deployed explicitly:

```sh
firebase deploy --only firestore:rules --project settld-in
```

## Ledger invariants

- Money is stored as integer paise; ledger math never uses floating-point currency values.
- Split rounding uses deterministic largest-remainder distribution, with member ID as the tie-breaker.
- Balances are derived from expenses and settlements rather than stored as mutable totals.
- Deleted records are soft-deleted, while the activity trail remains append-only.

## Project map

```text
index.html                 App shell and PWA entry point
css/app.css                Coral design tokens, components, and responsive layouts
js/app.js                  Router, screens, sheets, and rendering
js/store.js                State, actions, event trail, and sample data
js/db.js                   IndexedDB persistence
js/cloud.js                Google auth and per-UID Firestore mirror
js/money.js                Deterministic currency and split math
js/settle.js               Balances, transfer plan, and UPI links
tests/ledger.test.mjs      Ledger unit tests
tests/e2e/app.spec.mjs     Playwright product-flow coverage
firestore.rules            Per-UID Firestore access policy
PRODUCT.md                 Product scope and principles
DESIGN.md                  Visual system and component rules
```

## Current limits

- INR only
- Personal backup rather than shared-account collaboration
- Google sign-in only in production
- Proof stored in Firestore is subject to the document-size guard in `js/cloud.js`
