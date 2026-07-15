# Settld Design System

## Theme
Dark-first (scene: splitting a bill at a dim restaurant table at night). Light theme available via `data-theme="light"` on `<html>`. Theme choice persisted in localStorage, defaults to dark.

## Color (dark)
- Background: `#0A0A0C`
- Surface (cards, sheets): `#16171B`
- Surface-2 (inputs, nested fills): `#1F2126`
- Hairline: `#282A31`
- Text primary: `#F4F1E8` (warm off-white)
- Text secondary: `#989DA6`
- Accent: `#D7FF45` (electric lime), ink-on-accent: `#161A00`
- Receivable / settled: `#5BDB93`
- Owed: `#FF6B6B`
- Never pure #000 or #fff. Red and green are reserved for money direction only.

## Color (light)
- Background `#F2F2F7`, surface `#FFFFFF`, surface-2 `#F6F6FA`, hairline `#E7E7ED`, text `#191A1C`, secondary `#75787F`, accent unchanged, receivable `#1F9E5C`, owed `#E04A3A`.

## Typography
- Stack: `"SamsungOne", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (renders SamsungOne on Galaxy devices, native elsewhere).
- Display (screen titles): 34px / 800 / -0.03em
- Title (sheet titles, group names): 22px / 700
- Body: 15px / 450
- Caption: 13px / 500, secondary color
- Money (hero amounts): 40px / 800, tabular-nums. All numeric cells `font-variant-numeric: tabular-nums`.

## Shape and space
- One UI radii: cards/sheets 26px, inputs 18px, chips and buttons fully rounded, icon tiles 14px.
- Grouped lists: one rounded container per section, rows separated by inset hairlines, min row height 56px.
- Screen gutter 16px, section gap 24px, dock clearance at page bottom 120px.
- Touch targets >= 44px.

## Components
- Collapsing header: 34px display title in-flow; past 48px scroll a compact glass appbar fades in with the small title.
- Dock: floating pill, 3 tabs, liquid glass (SVG feDisplacementMap refraction via `backdrop-filter: url(#lg-lens)` with plain blur+saturate fallback). The ONLY glass elements in the app are the dock and collapsed appbar.
- Sheets: bottom sheets with 36x4 grabber, 28px top radii, slide-up 320ms cubic-bezier(.22,.9,.26,1), dimmed backdrop. Android back closes them.
- Buttons: 52px pill. Primary = lime fill + dark ink. Ghost = surface-2. Danger = red text, no fill.
- Chips: 40px member chips with initial avatars (deterministic color from 6-hue palette).
- Segmented control: surface-2 track, active segment surface + subtle shadow.
- Proof badge: small paperclip/receipt glyph + count on expense rows. Verified state uses check + green.
- Toggles: One UI style, 52x28 track, lime when on.

## Motion
- Ease-out quart/quint everywhere, no bounce. Sheets 320ms, screen transitions 200ms fade+8px rise, press feedback scale(.97).
- Never disable animation via prefers-reduced-motion blanket rules.

## Iconography
Inline stroke SVGs, 1.8px stroke, round caps. No coins, rupee symbols, wallets, handshakes or people silhouettes. Brand mark: split "S" in lime, two offset strokes with a diagonal gap (the split).

## Copy rules
No em dashes. Sentence case everywhere including buttons. Amounts always formatted en-IN with rupee symbol. Feature names: Proof, Trail, Smart settle, Clear up, Guest link.
