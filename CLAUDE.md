# Token Launchpad — CLAUDE.md

## Context Recovery

IMPORTANT: At session start, read all .md files in the /docs/ directory to restore full project context from the previous session.

## Current State

- **Branch**: main
- **Status**: All 4 frontend pages complete (landing, token detail, create, leaderboard). Backend Phase 2-3 in progress (Emile writing).
- **Last updated**: 2026-02-11
- **Dev server**: `npx next dev --webpack --port 3001` (MUST use --webpack flag, Turbopack hangs with dual lockfiles)

## Approach

**PEDAGOGICAL MODE** — Emile writes the program code himself, the backend mentor agent guides and reviews. The mentor does NOT write program code unless explicitly asked. Errors/events are added as needed (not pre-planned).

## Task Progress — Backend (Anchor Program)

### Phase 1: Foundation ✅
- [x] Project architecture (all directories and files created)
- [x] `constants.rs` — PDA seeds, bonding curve defaults, fees, graduation
- [x] `state/global.rs` — Global config struct with InitSpace + ProgramStatus enum
- [x] `state/bonding_curve.rs` — BondingCurve struct with InitSpace
- [x] `state/referral.rs` — Referral struct with InitSpace (commented)
- [x] `state/mod.rs` — module exports
- [x] `instructions/admin/initialize.rs` — handler + Initialize accounts struct
- [x] `instructions/admin/update_config.rs` — handler with Option<T> params + UpdateConfig accounts
- [x] `instructions/admin/withdraw_fees.rs` — handler with checked_sub rent protection + WithdrawFees accounts
- [x] `errors.rs` — AdminError (NotEnoughLamports) + MathError (Overflow, DivisionByZero)
- [x] `utils/math.rs` — calculate_buy_amount with u128 checked math
- [x] Cargo.toml — anchor-spl with metadata feature, blake3 pinned to 1.5.5
- [x] All `mod.rs` files wired with `pub use *` (required by Anchor macro)
- [x] `lib.rs` — initialize, update_config, withdraw_fees, create_token wired
- [x] `anchor build` passes ✅
- [ ] `events.rs` (add events as needed)
- [ ] `01_admin.test.ts`

### Phase 2: Token Launch (IN PROGRESS)
- [x] `create_token.rs` — full handler: init bonding curve, mint_to total supply, CPI create_metadata_accounts_v3
- [x] `create_and_buy.rs` — struct done (CreateAndBuyToken), handler NOT written yet
- [ ] `create_and_buy.rs` handler — needs buy logic first
- [ ] Wire create_and_buy in lib.rs
- [ ] `02_launch.test.ts`

### Phase 3: Trading (IN PROGRESS)
- [x] `buy.rs` — struct done (Buy accounts), handler NOT written yet ← CURRENT
- [ ] `buy.rs` handler — calculate fees, transfer SOL, transfer tokens, update reserves
- [ ] `sell.rs`
- [ ] Graduation detection
- [ ] `03_trade.test.ts`

### Phase 4: Referrals
- [ ] `register_referral.rs`
- [ ] Integration into buy/sell
- [ ] `04_referral.test.ts`

### Phase 5: Migration
- [ ] `migrate_to_raydium.rs`
- [ ] `05_migration.test.ts`

### Phase 6: SDK
- [ ] `sdk/src/client.ts`, `math.ts`, `pda.ts`, `types.ts`, `constants.ts`

## Task Progress — Frontend

- [x] Landing page V10+ (hero with 3D bonding curve, token grid, scroll transitions)
- [x] Landing page polish: footer, scroll indicator in hero, floating CTA button
- [x] Token detail / trade page (`/token/[id]`) — full 2-column layout with wow effects
- [x] Token detail: banner image per token (gradient from token.color) + social links
- [x] Mobile responsive: hero compact (no 3D), 2-col token grid, no scroll effects
- [x] Desktop scroll-snap between hero and token list (proximity, smooth)
- [x] Removed trade pulse overlay (global screen flash on price change)
- [x] Create token page (`/create`) — form with color picker, banner upload, drag & drop image, buy-on-create toggle (anti-snipe), live preview card, launch flow with success state
- [x] Leaderboard page (`/leaderboard`) — 3 tabs (tokens/traders/creators), animated hero stats, CSS trophy, podium top 3, staggered tables, hall of fame, live ticker
- [x] Fixed TS error in bonding-curve-3d.tsx:837 (container possibly null)
- [x] Profile page (`/profile/[address]`) — procedural banner/identicon, stats with animated counters, GitHub-style activity heatmap, 4 tabs (portfolio/history/created/referrals), seeded mock data, links from leaderboard + token detail
- [ ] Clean up orphan files: `how-it-works.tsx`, `activity-ticker.tsx`

## Key Decisions — Backend

- **Anchor 0.32.1**: Kept the version from `anchor init` (plan said 0.30.1 but 0.32.1 is fine)
- **InitSpace over size_of**: Emile prefers `#[derive(InitSpace)]` + `Global::INIT_SPACE` — more reliable than `std::mem::size_of`
- **Errors added as-needed**: Not pre-defined. Add to `errors.rs` when writing each instruction.
- **Handler pattern**: Each instruction has its own file with `pub fn handler(ctx) -> Result<()>` + `#[derive(Accounts)]` struct. `lib.rs` delegates to handlers.
- **Program ID**: `HY3g1uQL2Zki1aFVJvJYZnMjZNveuMJhU22f9BucN3X`
- **Multiple error enums**: Emile prefers separate enums per domain (AdminError, MathError, etc.) instead of one LaunchpadError
- **create_and_buy exists for anti-snipe**: Atomic create+buy in one instruction prevents snipers from frontrunning the creator's first buy. NOT two separate instructions in one tx.
- **mpl-token-metadata via anchor-spl feature**: Do NOT add mpl-token-metadata as standalone dep. Use `anchor-spl = { version = "0.32.1", features = ["metadata"] }` + pin blake3 to 1.5.5
- **Anchor mod.rs must use glob re-exports**: `pub use module::*` (not `pub use module::StructName`). The `#[program]` macro generates internal `__client_accounts_*` modules that must be re-exported via glob.
- **PDA signer seeds pattern**: Store key in variable before building seeds to avoid temporary value drop: `let mint_key = ctx.accounts.mint.key(); let seeds = &[SEED, mint_key.as_ref(), &[bump]];`
- **Constant-product bonding curve math**: Uses u128 intermediate to avoid overflow. Formula: `tokens_out = (virtual_token * sol_amount) / (virtual_sol + sol_amount)`

## Key Decisions — Frontend

- **Vanilla Three.js over R3F**: @react-three/fiber v9 incompatible with React 19 + Next.js 16
- **--webpack flag**: Turbopack infinite-loops with dual lockfiles
- **Design system**: warm gold (#c9a84c) brand, dark theme (#0c0a09), Space Grotesk display, Geist Sans/Mono
- **No UI libraries**: Pure Tailwind CSS v4 only
- **3-layer parallax scroll (desktop only)**: bg orbs 0.3x, 3D curve 0.5x, HTML content 1x
- **lightweight-charts v5**: TradingView chart for token detail page. v5 API uses `chart.addSeries(AreaSeries, {...})` (NOT `chart.seriesType()`)
- **Next.js 16 dynamic params**: `params` is a `Promise<{id: string}>` — must unwrap with `use()` from React
- **Token color = brand identity**: Each token has a `color` field that drives banner gradient, avatar bg, sparkline color. User picks it at creation via color picker (12 presets + custom hex + native picker).
- **Mobile vs Desktop split**: `useIsMobile()` hook disables scroll effects, hides 3D canvas, shows compact hero on mobile. Desktop keeps full immersive experience.
- **Scroll snap scoped to home page only**: `snap-page` class toggled on `<html>` via useEffect. Navbar must be OUTSIDE snap-section wrappers to stay sticky.
- **Buy on create = anti-snipe**: Buy executes in same transaction as token creation. Custom toggle switch + pill amount selector + explanation text.
- **CSS color swatches**: Must use fixed `h-8 w-8` (not `w-full` in grid) with `rounded-full` to get perfect circles. `w-full` in grid columns makes ovals.

## Pentagon Pod

- Pod ID: 3C9AC32C-7212-40A6-A862-ECE7904ACA9C
- Backend Mentor: Agent 6E9A0C3D (guides Emile, reviews code, coordinates frontend agent)
- Frontend Designer: Agent 0B779A7E (builds UI, takes orders via DISCUSSION.md)
- Communication: Pod DISCUSSION.md

## Critical File Paths

### Backend (programs/token-lp/src/)
- `lib.rs:15-49` — #[program] module with 4 instructions wired (initialize, update_config, withdraw_fees, create_token)
- `constants.rs` — all PDA seeds + defaults
- `errors.rs` — AdminError + MathError enums
- `state/global.rs` — Global struct + ProgramStatus enum
- `state/bonding_curve.rs` — BondingCurve struct
- `state/referral.rs` — Referral struct
- `instructions/admin/initialize.rs` — handler + Initialize accounts
- `instructions/admin/update_config.rs` — handler with Option<T> params + UpdateConfig accounts
- `instructions/admin/withdraw_fees.rs` — handler with checked_sub + WithdrawFees accounts (global, fee_vault, recipient)
- `instructions/launch/create_token.rs:14-79` — full handler: init bonding curve state, mint_to, CPI metadata
- `instructions/launch/create_and_buy.rs` — struct only, handler TODO
- `instructions/trade/buy.rs` — struct only (Buy accounts), handler TODO ← CURRENT
- `utils/math.rs` — calculate_buy_amount (u128 checked math)

### Frontend (app/src/)
- `components/bonding-curve-3d.tsx` (~988 lines) — vanilla Three.js 3D chart
- `components/hero.tsx` (~310 lines) — desktop: immersive 3D + scroll effects; mobile: compact text-only
- `app/page.tsx` (~430 lines) — home page with scroll-snap, 2-col mobile grid, floating CTA
- `app/token/[id]/page.tsx` (~600 lines) — token detail: banner, social links, chart, trade form, graduation progress
- `app/create/page.tsx` (~900 lines) — create token form: name/symbol/desc, image drag&drop, banner upload, color picker, social links, buy-on-create toggle, live preview, launch flow
- `app/leaderboard/page.tsx` (~750 lines) — 3 tabs, hero stats, trophy, podium, tables, hall of fame, ticker
- `app/profile/[address]/page.tsx` (~700 lines) — profile: procedural banner/identicon, stats, heatmap, 4 tabs (portfolio/history/created/referrals)
- `app/globals.css` — design tokens, animations, scroll-snap rules (`.snap-page` scoped)
- `components/token-card.tsx` — token grid card with sparkline
- `components/token-chart.tsx` — TradingView lightweight-charts v5 area chart with timeframes
- `components/trade-form.tsx` — buy/sell form with particle burst
- `components/trade-history.tsx` — live simulated trade history table
- `components/ticker-price.tsx` — odometer-style digit rolling price animation
- `components/bonding-curve-mini.tsx` — SVG mini bonding curve with pulsing dot
- `components/button-particles.tsx` — canvas particle burst hook
- `components/sparkline.tsx` — inline SVG sparkline for token cards
- `components/navbar.tsx` — sticky navbar with wallet button
- `components/footer.tsx` — 4-column footer with Solana badge
