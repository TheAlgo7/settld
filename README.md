# Settld

Split. Prove. Settle.

A shared-expense app for trips, roommates and groups. The difference from Splitwise and friends: every expense can carry proof (receipts, UPI screenshots), every edit lands on an append-only trail, and settlement is one tap into your UPI app. Free at the core, forever.

## Status: v0.1.0, local-first prototype

Fully working on-device app. No accounts, no server, no build step. All data lives in IndexedDB on your phone (receipts included as blobs). Firebase sync (Firestore + Storage + Auth) is the planned next layer; the data layer is pure and event-based so it bolts on without a rewrite.

## Run it

```
cd Settld
npm start        # serves on http://localhost:5173 (npx serve)
```

Any static server works (ES modules need http, so don't open index.html from file://). On your phone: serve on your LAN and open the IP, or deploy the folder as-is to Vercel/Netlify and install it as a PWA.

```
npm test         # ledger math tests (split rounding, balances, smart settle)
```

## What's inside

- Groups with members, emoji, per-member UPI IDs
- Expenses: equal / exact / percent / shares splits, multiple payers, categories, dates, notes
- Proof: attach receipt photos and payment screenshots to any expense or settlement, stored on-device
- Trail: append-only activity log per group; edits log what changed, deletes stay visible
- Balances: your position, per-member nets, Smart settle (minimum transfers), share summary to WhatsApp
- Clear up: UPI deep link (`upi://pay`) prefilled with amount and payee, mark settled with proof
- Sample trip seeder to feel the app instantly
- PWA: installable, offline via service worker, dark/light/system themes

## Ledger rules (do not break these)

- Money is integer paise everywhere. No floats.
- Splits use deterministic largest-remainder distribution (ties broken by member id), so every device computes identical shares. Tests in `tests/ledger.test.mjs` pin this down.
- Balances are recomputed from records, never stored. Deleted records are soft-deleted and excluded.
- The events store is append-only.

## Structure

```
index.html            shell, liquid-glass SVG filter, appbar/dock mounts
css/app.css           One UI 9 design language, dark-first tokens
js/money.js           paise math, formatting, split distribution (pure)
js/settle.js          balances, min-transfer plan, UPI links (pure)
js/db.js              IndexedDB wrapper
js/store.js           state + actions + event trail + demo seed
js/app.js             router, screens, sheets, rendering
sw.js                 precache + stale-while-revalidate
tests/ledger.test.mjs node-runnable math tests
PRODUCT.md            product context (users, brand, principles)
DESIGN.md             design tokens and component rules
```

## Design language

Samsung One UI 9 physicality: large collapsing headers, content sunk toward the thumb, 26px grouped list cards, pill buttons, bottom sheets with grabbers, a floating liquid-glass dock (SVG feDisplacementMap refraction with blur fallback). Dark `#0A0A0C` base, warm off-white text, electric lime `#D7FF45` reserved for primary actions. Red and green mean money direction only.

## Roadmap

1. Firebase sync adapter: Firestore for records, Storage for proof images, Auth phone/Google; guest links for joining without an account
2. Capacitor wrap for the Play Store build (PWA stays the iOS path first)
3. PNG icons for iOS install (SVG manifest icons cover Android/desktop)
4. Receipt OCR assist (amount/merchant detection, item-wise tap-to-assign)
5. Verified-by-members state on expenses
6. Multi-currency groups

## Known v1 limits

- Single device, single "you": other members are names you track, not logged-in users (sync changes this)
- INR only
- JSON export excludes image blobs (receipts stay on the device)
