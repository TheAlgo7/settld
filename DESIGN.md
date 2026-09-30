# Settld Design System

## Design intent

Since 0.5 (September 2026) Settld shares Dueline's design family: the same warm near-black surfaces, Inter type scale, rows led by 42px glyph tiles, pill buttons, bottom sheets, dark toasts, and a liquid-glass dock with one solid action beside it. Settld keeps its own mark, its coral default and the accent choices, and its light theme.

Since 0.6 every tile draws a Lucide line icon, the same set Dueline uses (`js/icons.js`, generated from lucide-react, ISC). There are no emoji anywhere in the interface: categories, group icons, the icon picker and the summary legend all use line icons in a neutral tile (`--raised` fill, `--text-2` stroke). Colour stays for meaning (accent for action and selection, green for money coming to you), so category tiles are not tinted. Old groups saved with an emoji keep working: `groupIconId()` maps each old emoji to its line icon.

Settld is a calm, proof-first ledger for trips and small groups. It should feel precise enough to trust with money and relaxed enough to use at a crowded dinner table. The visual identity comes from the coral Settld loop/check mark, warm paper text, restrained surfaces, and traceable records. Decoration never competes with the amount, payer, proof, or current settlement state.

Physical scene: a friend adds a restaurant bill one-handed at 10pm, then another member checks the receipt outdoors the next morning. Dark is the signature theme, but light mode is a complete high-ambient-light theme.

## Color strategy

Restrained product palette. The accent appears on primary actions, current selection, focus, and the brand mark. It is never a debt color.

The accent is user-selectable: `coral` (default), `amber`, `mint`, `azure`, `violet`, `rose`. Each is declared twice, once per theme, because a fill that carries dark ink on near-black needs to be darker to carry light ink on warm paper. Components read `--accent`, `--accent-text` (on-background, for status copy) and `--accent-ink` (on-fill) and never hard-code a hue.

Because the accent can become green, meaning never rests on it. `--pos` stays a fixed green and every balance is also stated in words (`You owe`, `owes you`, `you lent`) with a sign.

### Dark theme

Surfaces and text follow Dueline, warm by a hair (hue 70 to 85), not the cool blue-greys of 0.4:

- `--bg` (page): `oklch(0.135 0.003 70)`
- `--bg-2` (sheets): `oklch(0.172 0.004 70)`
- `--raised` (fields, tiles): `oklch(0.205 0.005 70)`; `--raised-2` (pressed, selected): `oklch(0.25 0.006 70)`
- `--line`: `oklch(0.215 0.004 70)`
- `--text`: `oklch(0.965 0.006 85)`; `--text-2`: `oklch(0.76 0.009 80)`; `--text-3` (meta, the lowest readable level): `oklch(0.62 0.01 78)`
- `--pos`: `oklch(0.8 0.13 156)`, Dueline's calmer green
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
- Hero amount: 48 to 64px / 660 / 0.95 / -0.045em, with the rupee sign at half size in `--text-3`. The number is ink; the label above it carries the meaning (`You get back` in green, `You owe` in ink).
- Section and day headings: 15px / 640, sentence case. No uppercase letter-spaced captions.
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

Records sit directly on the page surface, separated by hairlines that start after the row's tile, not stacked in cards. A card is only correct when something genuinely needs lifting off the page, and cards are never nested. Shadows are soft and low-chroma. The dock (a pill of icon tabs where the current one opens into icon and label) and the compact collapsed app bar are the only translucent surfaces; on Chromium the dock refracts like thick glass (`js/glass.js`, an SVG displacement map, the same as Dueline). Sheets, inputs, and menus are opaque.

## Brand mark

The mark is a flat coral loop that reads as an abstract `S`, with a coral check crossing its void center. It must remain legible at 16px. App-store artwork may add restrained depth, but the in-product, favicon, and notification marks remain flat. Do not show `TM` by default.

## Core components

### App shell

- Global destinations: Groups, Friends, Activity, You.
- A group is a single scrolling screen, never tabs: identity, your position, the settle plan as `X owes you` rows, then the expense list by day. Everything else (people, invite, trip summary, history, settings) hangs off one group menu.
- On a group, `Settle up` and `Add expense` sit together directly under the balance and the dock steps aside.
- Everywhere else the dock carries one solid `+` (Add expense): it starts a group when there is none, adds straight into the only group, or asks which group.
- Large in-flow title collapses to a compact app bar after scrolling.

### Grouped records

- One surface per meaningful section, with inset hairline separators.
- Expense rows lead with category, description, payer, and visible proof state.
- Amounts align right and never truncate before descriptive metadata.
- Avoid nested cards. Summary content uses one composition with dividers.

### Buttons and controls

- Every button is a pill (radius 999px), 52px high.
- Primary: accent fill, dark ink, a soft accent glow.
- Google sign-in: the one bright white pill; other ways in stay quiet.
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

### Summary and charts

Spend, personal contribution, current balance, and settlement progress are separate metrics. A category chart may divide total spend. Do not combine paid, owed, receivable, and settled values in one donut because they are not parts of one total.

- A segmented control switches every chart between the whole group and your own share.
- The donut shows the six largest categories in chart colours; anything beyond is grouped. Its centre shows whole rupees, and lakhs past ₹1,00,000, so it never spills out of the ring.
- Spend over time is a bar per day for anything up to a month, a bar per month beyond that. The highest bar takes the solid accent and is named in the line below.
- "Who paid, and whose share it was" is one track per person: the bar is what they paid, the tick is their share, on the same scale.

### Expense entry additions (0.6)

- The currency symbol beside the amount is the button that changes currency. A foreign currency shows its code on an accent tile, and one line below gives the rupee value and the rate, with "Change rate" to type another.
- The description field is led by the category tile it was read as, which updates as the words are typed and opens the category list.
- Items is the fifth split method: one row per item (name, amount, who had it), with the tax, service or discount explained in a line under the list.
- Repeats sits with the other details as chips (Never, Weekly, Fortnightly, Monthly, Yearly), with the next date spelled out.
- "Use this split for new expenses" is a plain checkbox under the split, shown only when there is something worth saving.

## Motion

- State feedback: 150 to 200ms.
- Sheet entrance: 260ms ease-out-quint.
- Route change: 180ms fade plus 6px rise.
- Press feedback: scale to 0.98.
- No bounce, decorative choreography, or layout-property animation.
- Motion stays on for everyone. There is deliberately no reduced-motion override: the movement is short and small, and switching it all off made the app feel broken to the people who asked for it.

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
