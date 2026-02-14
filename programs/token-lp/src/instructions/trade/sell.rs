use anchor_lang::prelude::*;
use crate::constants::*;
use crate::events::*;
use crate::state::*;
use crate::errors::*;
use anchor_spl::token::{Mint, TokenAccount, Token};
use anchor_spl::associated_token::AssociatedToken;
use crate::utils::math::calculate_sell_amount;

pub fn _sell(ctx: Context<Sell>, token_amount: u64, min_sol_out: u64) -> Result<()>
{
    require!(token_amount > 0, TradeError::ZeroAmount);
    require!(ctx.accounts.global.status != ProgramStatus::Paused, TradeError::ProgramPaused);
    require!(ctx.accounts.bonding_curve.completed == false, TradeError::CurveCompleted);
    let sol_out = calculate_sell_amount(ctx.accounts.bonding_curve.virtual_sol, ctx.accounts.bonding_curve.virtual_token, token_amount)?;

    let fee = (sol_out as u128)
        .checked_mul(ctx.accounts.global.trade_fee_bps as u128)
        .ok_or(MathError::Overflow)?
        .checked_div(10_000)
        .ok_or(MathError::DivisionByZero)?;
    let fee = u64::try_from(fee).map_err(|_| MathError::CastOverflow)?;

    let sol_after_fee = sol_out.checked_sub(fee).ok_or(MathError::Overflow)?;

    require!(sol_after_fee >= min_sol_out, TradeError::SlippageExceeded);
    require!(sol_out <= ctx.accounts.bonding_curve.real_sol_reserves, TradeError::NotEnoughSol);

    // Check bonding curve retains enough for rent exemption
    let bc_lamports = ctx.accounts.bonding_curve.to_account_info().lamports();
    let rent = Rent::get()?.minimum_balance(8 + BondingCurve::INIT_SPACE);
    require!(bc_lamports.checked_sub(sol_out).ok_or(MathError::Overflow)? >= rent, TradeError::InsufficientRentExemption);

    //send tokens from seller to bonding curve
    let cpi_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        anchor_spl::token::Transfer{
            authority: ctx.accounts.seller.to_account_info(),
            from: ctx.accounts.seller_token_account.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
        }
    );

    anchor_spl::token::transfer(cpi_context, token_amount)?;

    //send sol from bonding curve to seller
    ctx.accounts.bonding_curve.sub_lamports(sol_after_fee)?;
    ctx.accounts.seller.add_lamports(sol_after_fee)?;

    // Creator fee
    let creator_fee = (fee as u128)
        .checked_mul(ctx.accounts.global.creator_share_bps as u128)
        .ok_or(MathError::Overflow)?
        .checked_div(10_000)
        .ok_or(MathError::DivisionByZero)?;
    let creator_fee = u64::try_from(creator_fee).map_err(|_| MathError::CastOverflow)?;
    let remaining_fee = fee.checked_sub(creator_fee).ok_or(MathError::Overflow)?;

    if creator_fee > 0 {
        ctx.accounts.bonding_curve.sub_lamports(creator_fee)?;
        ctx.accounts.creator_account.add_lamports(creator_fee)?;
    }

    if let Some(referral) = &mut ctx.accounts.referral
    {
        // Validate referral PDA
        let (expected_pda, _) = Pubkey::find_program_address(
            &[REFERRAL_SEED, referral.referrer.as_ref()],
            ctx.program_id,
        );
        require!(referral.key() == expected_pda, TradeError::InvalidReferral);

        let referral_fee = (remaining_fee as u128)
            .checked_mul(ctx.accounts.global.referral_share_bps as u128)
            .ok_or(MathError::Overflow)?
            .checked_div(10_000)
            .ok_or(MathError::DivisionByZero)?;
        let referral_fee = u64::try_from(referral_fee).map_err(|_| MathError::CastOverflow)?;

        let protocol_fee = remaining_fee.checked_sub(referral_fee).ok_or(MathError::Overflow)?;

        ctx.accounts.bonding_curve.sub_lamports(protocol_fee)?;
        ctx.accounts.fee_vault.add_lamports(protocol_fee)?;

        ctx.accounts.bonding_curve.sub_lamports(referral_fee)?;
        referral.add_lamports(referral_fee)?;

        referral.total_earned = referral.total_earned.checked_add(referral_fee).ok_or(MathError::Overflow)?;
        referral.trade_count = referral.trade_count.checked_add(1).ok_or(MathError::Overflow)?;
    }
    else
    {
        ctx.accounts.bonding_curve.sub_lamports(remaining_fee)?;
        ctx.accounts.fee_vault.add_lamports(remaining_fee)?;
    }

    ctx.accounts.bonding_curve.virtual_sol = ctx.accounts.bonding_curve.virtual_sol.checked_sub(sol_out).ok_or(MathError::Overflow)?;
    ctx.accounts.bonding_curve.virtual_token = ctx.accounts.bonding_curve.virtual_token.checked_add(token_amount).ok_or(MathError::Overflow)?;
    ctx.accounts.bonding_curve.real_sol_reserves = ctx.accounts.bonding_curve.real_sol_reserves.checked_sub(sol_out).ok_or(MathError::Overflow)?;
    ctx.accounts.bonding_curve.real_token = ctx.accounts.bonding_curve.real_token.checked_add(token_amount).ok_or(MathError::Overflow)?;

    emit!(TradeEvent {
        mint: ctx.accounts.mint.key(),
        trader: ctx.accounts.seller.key(),
        is_buy: false,
        sol_amount: sol_after_fee,
        token_amount: token_amount,
        fee,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Sell<'info>
{
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [GLOBAL_SEED],
        bump
    )]
    pub global: Account<'info, Global>,

    #[account()]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [BONDING_CURVE_SEED, mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK: the token creator, receives creator_share_bps of fees
    #[account(
        mut,
        constraint = creator_account.key() == bonding_curve.creator,
    )]
    pub creator_account: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [FEE_VAULT_SEED],
        bump,
    )]
    pub fee_vault: SystemAccount<'info>,

    #[account(mut)]
    pub referral: Option<Account<'info, Referral>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
