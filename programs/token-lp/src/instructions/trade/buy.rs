use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use anchor_spl::token::{Mint, TokenAccount, Token};
use anchor_spl::associated_token::AssociatedToken;
use crate::utils::math::calculate_buy_amount;

pub fn handler(ctx: Context<Buy>, sol_amount: u64, min_tokens_out: u64) -> Result<()>
{
    require!(sol_amount > 0, TradeError::ZeroAmount);
    require!(ctx.accounts.global.status != ProgramStatus::Paused, TradeError::ProgramPaused);
    require!(ctx.accounts.bonding_curve.completed == false, TradeError::CurveCompleted);

    let fee = (sol_amount as u128)
        .checked_mul(ctx.accounts.global.trade_fee_bps as u128)
        .ok_or(MathError::Overflow)?
        .checked_div(10_000)
        .ok_or(MathError::DivisionByZero)? as u64;

    let sol_after_fee = sol_amount - fee;

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
    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        anchor_spl::token::Transfer{
            from:   ctx.accounts.token_account.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.bonding_curve.to_account_info(),
        },
        &[signer_seeds]
    );

    anchor_spl::token::transfer(cpi_context, tokens_out)?;

    if let Some(referrer) = &ctx.accounts.referrer 
    {
    // 1. referral_fee = fee * referral_share_bps / 10_000           
    // 2. Calcule protocol_fee = fee - referral_fee
    // 3. Transfer protocol_fee → fee_vault                                  
    // 4. Transfer referral_fee → referrer                                   
    } 
    else 
    { 
    
    }
      // ── 5. TRANSFERT SOL : buyer → fee_vault ──
      // system_program::transfer de fee

      // ── 6. TRANSFERT TOKENS : bonding_curve → buyer ──
      // token::transfer avec signer seeds du bonding_curve PDA

      // ── 7. UPDATE STATE ──
      // bonding_curve.virtual_sol += sol_after_fee
      // bonding_curve.virtual_token -= tokens_out
      // bonding_curve.real_sol_reserves += sol_after_fee
      // bonding_curve.real_token -= tokens_out

      // ── 8. CHECK GRADUATION ──
      // si real_sol_reserves >= graduation_threshold → completed = true

    Ok(())
}

#[derive(Accounts)]
pub struct Buy<'info>
{
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
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

    #[account(
        mut,
        seeds = [FEE_VAULT_SEED],
        bump,        
    )]
    pub fee_vault: SystemAccount<'info>,
  
    /// CHECK: referrer wallet, optional
    pub referrer: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}