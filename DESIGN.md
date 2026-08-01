# Settld Design System

## Design intent

Settld is a calm, proof-first ledger for trips and small groups. It should feel precise enough to trust with money and relaxed enough to use at a crowded dinner table. The visual identity comes from the coral Settld loop/check mark, warm paper text, restrained surfaces, and traceable records. Decoration never competes with the amount, payer, proof, or current settlement state.

Physical scene: a friend adds a restaurant bill one-handed at 10pm, then another member checks the receipt outdoors the next morning. Dark is the signature theme, but light mode is a complete high-ambient-light theme.

## Color strategy

Restrained product palette. The accent appears on primary actions, current selection, focus, and the brand mark. It is never a debt color.

The accent is user-selectable: `coral` (default), `amber`, `mint`, `azure`, `violet`, `rose`. Each is declared twice, once per theme, because a fill that carries dark ink on near-black needs to be darker to carry light ink on warm paper. Components read `--accent`, `--accent-text` (on-background, for status copy) and `--accent-ink` (on-fill) and never hard-code a hue.

Because the accent can become green, meaning never rests on it. `--pos` stays a fixed green and every balance is also stated in words (`You owe`, `owes you`, `you lent`) with a sign.

### Dark theme

- `--void`: `oklch(0.13 0.008 260)` (`#090A0B` reference)
- `--graphite`: `oklch(0.19 0.009 250)` (`#141618` reference)
- `--raised`: `oklch(0.23 0.010 250)`
- `--line`: `oklch(0.31 0.012 250)`
- `--paper`: `oklch(0.96 0.014 82)` (`#F4F1E8` reference)
- `--slate`: `oklch(0.66 0.015 250)` (`#8E9298` reference)
- `--coral`: `oklch(0.72 0.19 31)` (`#FF6F61` reference)
- `--success`: `oklch(0.78 0.16 151)` (`#55D98B` reference)
- `--danger`: `#FF6659` for AA text contrast on dark surfaces (`#E74C3C` brand reference)
- `--warning`: `oklch(0.79 0.15 78)`
- `--control-border`: `#767B82`, giving form and selection boundaries at least 3:1 against adjacent dark surfaces

### Light theme

- Background is warm grey, never pure white.
- Surfaces are warm paper and lightly tinted raised layers.
- Coral remains stable.
- Success and danger use darker variants for text contrast.
- Coral status text uses a separate darkened `--accent-text`; the brighter brand coral remains available for fills and large marks.
- Control borders use `#666C75` so default fields remain identifiable without relying on hover or focus.
- Every component has the same hierarchy and state vocabulary as dark mode.

Filled coral, success, danger, and warning controls use dark ink. Warm paper text does not meet AA on those fills. Balances include explicit `You owe`, `You get`, plus/minus signs, and icons so meaning never depends on red or green alone.

## Typography

- One family carries the interface: `Inter`, system sans fallback, for headings, controls, labels, and money. `Space Grotesk` is reserved for the Settld wordmark and never used on data or UI labels.
- Screen title: 36px / 700 / 1.05 / -0.035em.
- Section title: 22px / 650 / 1.2 / -0.02em.
- Row title: 16px / 650 / 1.3.
- Body: 15px / 450 / 1.5.
- Operational caption: 13px minimum / 550 / 1.4. Essential financial labels use 14px minimum.
- Hero amount: 40px / 700 / 1 / -0.035em.
- All money and numeric tables use tabular numerals.
- The 64px marketing display size from the identity board is not used inside task UI.

## Space, shape, and responsive layout

- 4px micro-grid and 8px macro rhythm.
- 16px mobile gutter, 24px tablet gutter, 32px large-screen gutter.
- 4-column mobile, 8-column tablet, 12-column large-screen mental model.
- Maximum task column is 720px. Wide screens use a deliberate centered workspace, not stretched rows.
- Surface radius: 24px. Sheet radius: 28px. Input radius: 16px. Small control radius: 14px.
- Primary controls are 52px high. All interactive targets are at least 48px in both axes.
- Main content reserves 120px plus safe-area space for the dock or contextual action.
- 320px width and 200% text scaling must not create horizontal page overflow.

## Elevation and glass

Records sit directly on the page surface, separated by hairlines, not stacked in cards. A card is only correct when something genuinely needs lifting off the page, and cards are never nested. Shadows are soft and low-chroma. The floating dock and the compact collapsed app bar are the only translucent surfaces. Sheets, inputs, and menus are opaque.

## Brand mark

The mark is a flat coral loop that reads as an abstract `S`, with a coral check crossing its void center. It must remain legible at 16px. App-store artwork may add restrained depth, but the in-product, favicon, and notification marks remain flat. Do not show `TM` by default.

## Core components

### App shell

- Global destinations: Groups, Friends, Activity, You.
- A group is a single scrolling screen, never tabs: identity, your position, the settle plan as `X owes you` rows, then the expense list by day. Everything else (people, invite, trip summary, history, settings) hangs off one group menu.
- `Settle up` and `Add expense` sit together directly under the balance. There is no floating action button.
- Large in-flow title collapses to a compact app bar after scrolling.

### Grouped records

- One surface per meaningful section, with inset hairline separators.
- Expense rows lead with category, description, payer, and visible proof state.
- Amounts align right and never truncate before descriptive metadata.
- Avoid nested cards. Summary content uses one composition with dividers.

### Buttons and controls

- Primary: coral fill, void ink.
- Secondary: raised neutral surface, paper text.
- Quiet: transparent, paper or slate text.
- Danger: danger text, transparent fill until final confirmation.
- Every control defines default, hover, focus-visible, active, disabled, loading, selected, and error states.
- Focus-visible uses a 3px offset coral ring.

### Sheets

- Bottom-anchored on phones, centered side/bottom hybrid on wide screens.
- 36 by 4px grabber, visible title, `aria-modal`, focus management, Escape and Android back support.
- Primary action stays reachable above the keyboard and safe area.

### Status chips

Always combine icon and text. Approved vocabulary:

- `No proof`
- `Proof attached`
- `Awaiting confirmation`
- `Confirmed by n of n`
- `Question raised`
- `Edited after confirmation`
- `Pending sync`
- `Synced`

An expense creator can attach or attest to proof, but cannot socially verify their own record.

### Proof

Proof is optional during quick entry and prominent afterward. Thumbnails use a receipt-shaped preview, descriptive alt text, upload state, failure state, remove action, and full-screen viewing. Expense rows surface proof count without opening detail.

### Smart settle

The panel says exactly what Settld calculates: a simple plan that clears current balances in at most one fewer transfer than the number of members. Actions use `Pay via UPI` when a deep link is available, then `Mark as paid` and `Attach proof`. Settld never implies that it processes or holds money.

### Trip summary

Trip spend, personal contribution, current balance, and settlement progress are separate metrics. A category chart may divide total spend. Do not combine paid, owed, receivable, and settled values in one donut because they are not parts of one total.

## Motion

- State feedback: 150 to 200ms.
- Sheet entrance: 260ms ease-out-quint.
- Route change: 180ms fade plus 6px rise.
- Press feedback: scale to 0.98.
- No bounce, decorative choreography, or layout-property animation.
- Reduced motion removes travel and scale while preserving state visibility.

## Voice

Human, brief, and factual. `Clear up`, `hisab barabar`, and familiar Indian English are welcome. Do not shame people for owing money. Do not use em dashes. Do not say `Settle now` when the product only opens an external payment app.

## Accessibility baseline

- WCAG 2.2 AA contrast.
- 48px touch targets and visible keyboard focus.
- Dialog semantics, focus trap, focus restoration, and inert background.
- Selected tabs expose `aria-selected`; toggles expose their checked state.
- Color is never the only signal.
- Errors are placed next to the relevant control and announced when needed.
- Essential actions and amounts remain legible at 200% text scaling.
