# Settld

## Register
product

## Product Purpose
Settld is a shared-expense app for trips, roommates, couples and small groups. Core promise: unlimited splitting, receipts and payment proof as native concepts, a transparent edit trail, and easy UPI settlement. Free at the core, forever. Tagline: "Split. Prove. Settle."

The wedge use case is group trips (many expenses in a few days, mixed payers, cash + UPI, receipts scattered across WhatsApp). The differentiator is not "free Splitwise": it is evidence and accountability. Every expense can carry proof, every edit is visible, nobody argues about who changed what.

## Users
- Indian friend groups on trips (primary wedge). Phone-first, WhatsApp-native, UPI for everything.
- Roommates and couples tracking recurring shared costs.
- Small event organizers (birthday pools, farewell gifts).
They are young, design-aware, annoyed by Splitwise paywalls and ads. They will use this at a dim restaurant table at 10pm with the bill in one hand and the phone in the other, so legibility and large touch targets in low light matter more than density.

## Brand
- Name: Settld. Tagline: Split. Prove. Settle.
- Personality: calm, precise, quietly confident. A ledger you trust, not a bank that lectures you.
- Look: near-black surfaces, warm off-white text, one electric lime accent. Red strictly for amounts owed, green strictly for amounts receivable or settled. Feels like a premium productivity tool, not a fintech app.
- UI language: Samsung One UI 9 physicality. Large collapsing headers with content sunk toward the thumb, chunky rounded grouped lists, pill buttons, bottom sheets with grabbers, generous touch targets. One purposeful liquid-glass element: the floating bottom dock (SVG refraction, not flat blur).

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
5. Local-first: works offline on a trip, syncs later (Firebase adapter planned: Firestore + Storage + Auth; v1 is on-device IndexedDB).
