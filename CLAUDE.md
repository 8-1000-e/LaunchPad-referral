# Token Launchpad — CLAUDE.md

## Context Recovery

IMPORTANT: At session start, read all .md files in the /docs/ directory to restore full project context from the previous session.

## Current State

- **Branch**: main (+ `programs` branch = subtree of `programs/token-lp/`)
- **Status**: All instructions complete (trading, referral, migration). Events complete. Security audit fixes complete. `anchor build` passes. Next: tests, SDK, frontend integration.
- **Last updated**: 2026-02-13
- **Dev server**: `cd app/ && npx next dev --webpack --port 3001` (MUST use --webpack flag, Turbopack hangs with dual lockfiles)
- **Frontend location**: `/Users/emile/Documents/learn/Dev Journey/Launch/app/`
- **Backend location**: `/Users/emile/Documents/learn/Dev Journey/Launch/programs/token-lp/`
- **Git push**: `push-launch` alias = push main + subtree push programs (`git subtree push --prefix programs/token-lp origin programs`)

## Approach

**PEDAGOGICAL MODE** — Emile writes the program code himself, the backend mentor agent guides and reviews. The mentor does NOT write program code unless explicitly asked. Errors/events are added as needed (not pre-planned).

## Task Progress — Backend (Anchor Program)

### Phase 1: Foundation ✅
- [x] Project architecture (all directories and files created)
- [x] `constants.rs` — PDA seeds, bonding curve defaults, fees, graduation
- [x] `state/global.rs` — Global config struct with InitSpace + ProgramStatus enum
- [x] `state/bonding_curve.rs` — BondingCurve struct with InitSpace
- [x] `state/referral.rs` — Referral struct with InitSpace
- [x] `state/mod.rs` — module exports
- [x] `instructions/admin/initialize.rs` — handler + Initialize accounts struct
- [x] `instructions/admin/update_config.rs` — handler with Option<T> params + UpdateConfig accounts
- [x] `instructions/admin/withdraw_fees.rs` — handler with checked_sub rent protection + WithdrawFees accounts
- [x] `errors.rs` — AdminError (NotEnoughLamports, ProgramPaused) + MathError (Overflow, DivisionByZero) + TradeError (SlippageExceeded, CurveCompleted, ZeroAmount, ProgramPaused, NotEnoughTokens)
- [x] `utils/math.rs` — calculate_buy_amount + calculate_sell_amount with u128 checked math
- [x] Cargo.toml — anchor-spl with metadata feature, init-if-needed feature, raydium-cp-swap crate
- [x] All `mod.rs` files wired with `pub use *`
- [x] `lib.rs` — all 7 instructions wired
- [x] `anchor build` passes ✅
- [x] `events.rs` — TradeEvent, CreateEvent, CompleteEvent, MigrateEvent + emit!() in all handlers
- [ ] Tests (01_admin through 05_migration)

### Phase 2: Token Launch ✅
- [x] `create_token.rs` — full handler: init bonding curve, mint_to total supply, CPI create_metadata_accounts_v3, status check, freeze authority revoke, CreateEvent
- [x] `create_and_buy.rs` — full handler: create + atomic first buy with min_tokens_out slippage, freeze authority revoke, referral split, CreateEvent + TradeEvent + CompleteEvent

### Phase 3: Trading ✅
- [x] `buy.rs` — full handler with checked arithmetic, fee calc, SOL transfer, token transfer (PDA signs), referral split + PDA validation, graduation check, TradeEvent + CompleteEvent
- [x] `sell.rs` — full handler: sub_lamports for SOL from bonding curve, rent exemption check, referral split + PDA validation, TradeEvent

### Phase 4: Referrals ✅
- [x] `register_referral.rs` — creates Referral PDA with seeds ["referral", user.key()]
- [x] `claim_referral_fees.rs` — withdraw accumulated lamports from Referral PDA (rent-protected)
- [x] Referral integrated into buy.rs and sell.rs — `Option<Account<'info, Referral>>` replaces `UncheckedAccount`
- [x] Referral stats updated on each trade (total_earned, trade_count)

### Phase 5: Migration ✅
- [x] `migrate_to_raydium.rs` — full handler: migration fee via sub_lamports, CPI Raydium CPMM initialize, LP token burn (manual deserialization of UncheckedAccount), has_one = authority (admin-only), MigrateEvent
- [x] Raydium CPMM dependency (`raydium-cp-swap` crate), compiles with Anchor 0.32.1

### Phase 6: Security Audit ✅
- [x] All critical/high/medium bugs from audit fixed
- [x] Checked arithmetic everywhere (checked_add/sub/mul/div + u64::try_from with CastOverflow)
- [x] Input validation in update_config (reserves > 0, fee_bps <= 5000, combined shares <= 10000)
- [x] Referral PDA validation via find_program_address in handlers
- [x] DEPLOYER_PUBKEY constraint on initialize
- [x] Freeze authority revoked at token creation
- [x] Rent exemption check in sell
- [x] withdraw_fees uses CPI transfer with fee_vault signer seeds (not sub_lamports on SystemAccount)

### Phase 7: Post-MVP ← CURRENT
- [ ] Tests (01_admin through 05_migration)
- [ ] SDK (`sdk/src/client.ts`, `math.ts`, `pda.ts`, `types.ts`, `constants.ts`)
- [ ] Minor: `creator_share_bps` stored in Global but never used (incomplete feature)
- [ ] Minor: No `close` instruction to reclaim bonding curve rent after migration
- [ ] Minor: `open_time = now` in migrate makes Raydium pool snipable immediately

## Task Progress — Frontend

- [x] Landing page V10+ (hero with 3D bonding curve, token grid, scroll transitions)
- [x] Landing page polish: footer, scroll indicator in hero, floating CTA button
- [x] Token detail / trade page (`/token/[id]`) — full 2-column layout with wow effects
- [x] Token detail: banner image per token (gradient from token.color) + social links
- [x] Mobile responsive: hero compact (no 3D), 2-col token grid, no scroll effects
- [x] Desktop scroll-snap between hero and token list (proximity, smooth)
- [x] Create token page (`/create`) — form with color picker, banner upload, drag & drop image, buy-on-create toggle
- [x] Leaderboard page (`/leaderboard`) — 3 tabs, animated hero stats, CSS trophy, podium, hall of fame
- [x] Profile page (`/profile/[address]`) — procedural banner/identicon, stats, heatmap, 4 tabs
- [x] Solana wallet connection (Phantom + Solflare) — custom UI, devnet, auto-reconnect
- [x] Navbar: real wallet modal + connected dropdown + balance display + "My Profile" link
- [x] Profile referral dashboard: register button, referral link copy, claimable balance, claim button (own profile only)
- [x] Unicorn Studio 3D particle background for token grid section (gold-tinted, no mouse interaction)
- [x] Cross-fade transition: hero 3D bonding curve fades out → Unicorn Studio fades in on scroll
- [ ] Clean up orphan files: `how-it-works.tsx`, `activity-ticker.tsx`

## Security Audit Summary (2026-02-11)

### CRITICAL
1. **No input validation in update_config** — admin can set trade_fee_bps > 10000 (underflow), virtual_sol = 0 (divzero)
2. **Integer underflow** in `sol_amount - fee` / `sol_out - fee` — needs checked_sub

### HIGH
3. No status check in create_token/create_and_buy → FIXED
4. Sell blocked on completed curve (users locked until migration)
5. State updates after CPIs (should be checks-effects-interactions)

### MEDIUM
6. No events emitted (events.rs empty)
7. Referrer was UncheckedAccount → FIXED (now Account<Referral>)
8. No string length validation on name/symbol/uri

## Key Decisions — Backend

- **Anchor 0.32.1**: Kept the version from `anchor init`
- **InitSpace over size_of**: `#[derive(InitSpace)]` + `INIT_SPACE`
- **Handler pattern**: Each instruction has `pub fn _handler(ctx) -> Result<()>` + `#[derive(Accounts)]` struct
- **Program ID**: `HY3g1uQL2Zki1aFVJvJYZnMjZNveuMJhU22f9BucN3X`
- **Multiple error enums**: AdminError, MathError, TradeError (per domain)
- **create_and_buy for anti-snipe**: Atomic create+buy prevents snipers
- **PDA signer seeds pattern**: `let mint_key = ...; let seeds = &[SEED, mint_key.as_ref(), &[bump]]; let binding = [signer_seeds]; ... &binding`
- **Constant-product bonding curve**: `tokens_out = (virtual_token * sol_amount) / (virtual_sol + sol_amount)`
- **CPMM over AMM V4 for migration**: No OpenBook market needed, simpler
- **Referral fees accumulate in PDA**: Not sent to wallet directly. Referrer claims via `claim_referral_fees`
- **Sell fees from PDA**: In sell, ALL SOL transfers (to seller + fees) come from bonding curve PDA with `CpiContext::new_with_signer`
- **No slippage in create_and_buy**: First buyer, price is deterministic
- **raydium-cp-swap crate**: Compatible with Anchor 0.32.1 despite being built for 0.29
- **NEVER mention Claude in commits**

## Key Decisions — Frontend

- **Vanilla Three.js over R3F**: @react-three/fiber v9 incompatible with React 19 + Next.js 16
- **--webpack flag**: Turbopack infinite-loops with dual lockfiles
- **Design system**: warm gold (#c9a84c) brand, dark theme (#0c0a09), Space Grotesk display, Geist Sans/Mono
- **No UI libraries**: Pure Tailwind CSS v4 only
- **Wallet adapter with custom UI**: `@solana/wallet-adapter-react` for logic, NO `@solana/wallet-adapter-react-ui` (too generic/blue). Custom wallet modal + connected dropdown matching gold/dark DA.
- **Direct import for client components in layout.tsx**: Do NOT use `next/dynamic` with `{ ssr: false }` in Server Components (Next.js 16 error). Just import `"use client"` components directly — Next.js handles the boundary.
- **Unicorn Studio for token section background**: `data-us-project="cqcLtDwfoHqqRPttBbQE"` with `data-us-disablemouse` to disable cursor interaction. Gold-tinted via CSS filter `sepia(1) saturate(2) hue-rotate(5deg) brightness(0.85)`.
- **Cross-fade between hero and token section**: Hero (Three.js bonding curve) fades out with `Math.pow` ease + blur. Unicorn Studio fades in overlapping at `scrollProgress > 0.2`.

## Pentagon Pod

- Pod ID: 3C9AC32C-7212-40A6-A862-ECE7904ACA9C
- Backend Mentor: Agent 6E9A0C3D (guides Emile, reviews code, coordinates frontend agent)
- Frontend Designer: Agent 0B779A7E (builds UI, takes orders via DISCUSSION.md)
- Communication: Pod DISCUSSION.md

## Critical File Paths

### Backend (token-lp/programs/token-lp/src/)
- `lib.rs:15-69` — #[program] module with 7 instructions wired
- `constants.rs` — all PDA seeds + defaults (MIGRATION_FEE = 0.5 SOL)
- `errors.rs` — AdminError + MathError + TradeError enums
- `state/global.rs` — Global struct + ProgramStatus enum
- `state/bonding_curve.rs` — BondingCurve struct (virtual_sol/token, real_sol/token, completed, migrated)
- `state/referral.rs` — Referral struct (referrer, total_earned, trade_count, bump)
- `instructions/admin/initialize.rs` — handler + Initialize accounts
- `instructions/admin/update_config.rs` — handler with Option<T> params
- `instructions/admin/withdraw_fees.rs` — handler with checked_sub rent protection
- `instructions/launch/create_token.rs` — full handler with status check
- `instructions/launch/create_and_buy.rs` — full handler: create + atomic buy
- `instructions/trade/buy.rs` — full handler with referral integration (Option<Account<Referral>>)
- `instructions/trade/sell.rs` — full handler: mirror of buy, PDA signs all SOL transfers
- `instructions/referral/register_referral.rs` — creates Referral PDA
- `instructions/referral/claim_fees.rs` — withdraw from Referral PDA
- `instructions/migration/migrate_to_raydium.rs` — struct partially written ← CURRENT
- `utils/math.rs` — calculate_buy_amount + calculate_sell_amount

### Frontend (Launch/app/src/)
- `components/wallet-provider.tsx` — Solana wallet ConnectionProvider + WalletProvider (Phantom, Solflare, devnet)
- `components/bonding-curve-3d.tsx` — vanilla Three.js 3D chart
- `components/hero.tsx` — desktop: immersive 3D + scroll fade/blur/zoom; mobile: compact text-only
- `components/navbar.tsx` — sticky navbar with real wallet connection (modal + dropdown + balance)
- `components/footer.tsx` — 4-column footer with Solana badge
- `components/token-card.tsx` — token grid card with sparkline
- `components/token-chart.tsx` — TradingView lightweight-charts v5 area chart with timeframes
- `components/trade-form.tsx` — buy/sell form with particle burst
- `components/trade-history.tsx` — live simulated trade history table
- `components/ticker-price.tsx` — odometer-style digit rolling price animation
- `components/bonding-curve-mini.tsx` — SVG mini bonding curve with pulsing dot
- `components/button-particles.tsx` — canvas particle burst hook
- `components/sparkline.tsx` — inline SVG sparkline for token cards
- `app/layout.tsx` — fonts, metadata, WalletProviderWrapper wrapping children
- `app/page.tsx` — home page with scroll-snap, Unicorn Studio background, cross-fade
- `app/token/[id]/page.tsx` — token detail + trade
- `app/create/page.tsx` — create token form
- `app/leaderboard/page.tsx` — 3 tabs, podium, tables
- `app/profile/[address]/page.tsx` — profile with heatmap, 4 tabs, referral dashboard (own profile)
