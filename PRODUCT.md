# Settld

## Register
product

## Product Purpose
Settld is a shared-expense app for trips, roommates, couples and small groups. Core promise: unlimited splitting, receipts and payment proof as native concepts, a transparent edit trail, and easy UPI settlement. Free at the core, forever. Tagline: "Split. Prove. Settle."

The wedge use case is group trips (many expenses in a few days, mixed payers, cash + UPI, receipts scattered across WhatsApp). The differentiator is not "free Splitwise": it is evidence and accountability. Every expense can carry proof, every edit is visible, nobody argues about who changed what.

It still has to match Splitwise, or nobody moves. Since 0.6 everything Splitwise locks behind Pro is free here: repeating expenses, itemised bills, foreign currency with the day's rate, search, spending charts, comments, restoring deleted expenses, a saved default split, one-to-one expenses outside groups, and an import that brings a whole Splitwise group across with its balances intact. Still to come: push notifications, receipt scanning, and Hindi.

## Users
- Indian friend groups on trips (primary wedge). Phone-first, WhatsApp-native, UPI for everything.
- Roommates and couples tracking recurring shared costs.
- Small event organizers (birthday pools, farewell gifts).
They are young, design-aware, annoyed by Splitwise paywalls and ads. They will use this at a dim restaurant table at 10pm with the bill in one hand and the phone in the other, so legibility and large touch targets in low light matter more than density.

## Brand
- Name: Settld. Tagline: Split. Prove. Settle.
- Personality: calm, precise, quietly confident. A ledger you trust, not a bank that lectures you.
- Look: near-black surfaces, warm off-white text, and a confident coral accent. Coral marks primary action and selection, green means confirmed or receivable, and red is reserved for destructive and error states. Debt is described with words and signs, never color alone. Feels like a premium productivity tool, not a fintech app.
- UI language: One UI-inspired ergonomics with a platform-neutral Settld identity. Large collapsing headers, content sunk toward the thumb, rounded grouped lists, bottom sheets with grabbers, 48px touch targets, and a restrained floating dock. Dark is the signature theme; a full light theme supports outdoor and receipt-capture use.

## Tone
Human and direct. Short sentences. Indian-English comfortable ("Clear up", "hisab barabar"). Never corporate-finance. Never guilt-trippy about money. No em dashes anywhere in copy.

## Anti-references
- Splitwise's current UI: dated, ad-cluttered, paywalled basics.
- Generic fintech: green/blue/purple gradients, coins, wallets, handshake icons, three-person silhouettes.
- AI-slop tells: pill/eyebrow kicker labels, gradient text, identical icon-card grids, side-stripe accent borders, glassmorphism sprinkled everywhere.

## Strategic principles
1. Evidence-first: proof attachment, verification state and edit trail are first-class UI, not buried metadata.
2. Ten-second expense entry: amount, payer, participants, done. Everything else optional.
3. Money is integer paise, rounding is deterministic, history is append-only. The ledger must never feel mushy.
4. Free core forever: no limits on groups, members, expenses, splits or basic proof.
5. Offline-first: IndexedDB is the source of truth. Optional Google sign-in mirrors a personal per-UID backup to Firestore and replays an outbox after reconnecting.
6. Sharing is opt-in and free: a group only becomes multi-user when someone invites, joining is a link plus Google sign-in, and nothing in the product may require a billing account from the maker or a payment from a user.
