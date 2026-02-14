use anchor_lang::prelude::*;
use crate::constants::*;
use crate::events::*;
use crate::state::*;
use crate::errors::*;
use anchor_spl::token::{Mint, TokenAccount, Token};
use anchor_spl::associated_token::AssociatedToken;
use crate::utils::math::calculate_buy_amount;

pub fn _buy(ctx: Context<Buy>, sol_amount: u64, min_tokens_out: u64) -> Result<()>
{
    require!(sol_amount > 0, TradeError::ZeroAmount);
    require!(ctx.accounts.global.status != ProgramStatus::Paused, TradeError::ProgramPaused);
    require!(ctx.accounts.bonding_curve.completed == false, TradeError::CurveCompleted);

    let fee = (sol_amount as u128)
        .checked_mul(ctx.accounts.global.trade_fee_bps as u128)
        .ok_or(MathError::Overflow)?
        .checked_div(10_000)
        .ok_or(MathError::DivisionByZero)?;
    let fee = u64::try_from(fee).map_err(|_| MathError::CastOverflow)?;

    let sol_after_fee = sol_amount.checked_sub(fee).ok_or(MathError::Overflow)?;

    let tokens_out = calculate_buy_amount(ctx.accounts.bonding_curve.virtual_sol, ctx.accounts.bonding_curve.virtual_token, sol_after_fee)?;

    require!(tokens_out >= min_tokens_out, TradeError::SlippageExceeded);
    require!(tokens_out <= ctx.accounts.bonding_curve.real_token, TradeError::NotEnoughTokens);

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer{
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.bonding_curve.to_account_info(),
        }
    );

    anchor_lang::system_program::transfer(cpi_context, sol_after_fee)?;


    let signer_seeds: &[&[u8]] = &[
    BONDING_CURVE_SEED,
    ctx.accounts.mint.to_account_info().key.as_ref(),
    &[ctx.accounts.bonding_curve.bump],
    ];
    let binding = [signer_seeds];
    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        anchor_spl::token::Transfer{
            from:   ctx.accounts.token_account.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.bonding_curve.to_account_info(),
        },
        &binding
    );

    anchor_spl::token::transfer(cpi_context, tokens_out)?;

    // Creator fee
    let creator_fee = (fee as u128)
        .checked_mul(ctx.accounts.global.creator_share_bps as u128)
        .ok_or(MathError::Overflow)?
        .checked_div(10_000)
        .ok_or(MathError::DivisionByZero)?;
    let creator_fee = u64::try_from(creator_fee).map_err(|_| MathError::CastOverflow)?;
    let remaining_fee = fee.checked_sub(creator_fee).ok_or(MathError::Overflow)?;

    if creator_fee > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer{
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.creator_account.to_account_info(),
            }
        );
        anchor_lang::system_program::transfer(cpi_context, creator_fee)?;
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

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer{
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.fee_vault.to_account_info(),
            }
        );

        anchor_lang::system_program::transfer(cpi_context, protocol_fee)?;

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer{
                from: ctx.accounts.buyer.to_account_info(),
                to: referral.to_account_info(),
            }
        );

        anchor_lang::system_program::transfer(cpi_context, referral_fee)?;

        referral.total_earned = referral.total_earned.checked_add(referral_fee).ok_or(MathError::Overflow)?;
        referral.trade_count = referral.trade_count.checked_add(1).ok_or(MathError::Overflow)?;
    }
    else
    {
        let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer{
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                }
            );

        anchor_lang::system_program::transfer(cpi_context, remaining_fee)?;
    }

    ctx.accounts.bonding_curve.virtual_sol = ctx.accounts.bonding_curve.virtual_sol.checked_add(sol_after_fee).ok_or(MathError::Overflow)?;
    ctx.accounts.bonding_curve.virtual_token = ctx.accounts.bonding_curve.virtual_token.checked_sub(tokens_out).ok_or(MathError::Overflow)?;
    ctx.accounts.bonding_curve.real_sol_reserves = ctx.accounts.bonding_curve.real_sol_reserves.checked_add(sol_after_fee).ok_or(MathError::Overflow)?;
    ctx.accounts.bonding_curve.real_token = ctx.accounts.bonding_curve.real_token.checked_sub(tokens_out).ok_or(MathError::Overflow)?;

    if ctx.accounts.bonding_curve.real_sol_reserves >= ctx.accounts.global.graduation_threshold
    {
      ctx.accounts.bonding_curve.completed = true;
      emit!(CompleteEvent {
        mint: ctx.accounts.mint.key(),
        real_sol_reserves: ctx.accounts.bonding_curve.real_sol_reserves,
      });
    }

    emit!(TradeEvent {
        mint: ctx.accounts.mint.key(),
        trader: ctx.accounts.buyer.key(),
        is_buy: true,
        sol_amount: sol_after_fee,
        token_amount: tokens_out,
        fee,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Buy<'info>
{
    #[account(mut)]
    pub buyer: Signer<'info>,

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
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

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
