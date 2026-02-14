use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::*;

pub fn _withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()>
{
    let rent = Rent::get()?.minimum_balance(0);
    let amount = ctx.accounts.fee_vault.lamports()                      
        .checked_sub(rent)                                              
        .ok_or(AdminError::NotEnoughLamports)?; 

    let seeds = &[FEE_VAULT_SEED, &[ctx.bumps.fee_vault]];
    let signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.fee_vault.to_account_info(),
            to: ctx.accounts.recipient.to_account_info(),
        },
        signer,
    );
    anchor_lang::system_program::transfer(cpi_ctx, amount)?;
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawFees<'info>
{
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
        seeds = [GLOBAL_SEED],
        bump
    )]
    pub global: Account<'info, Global>,

    #[account(
        mut,
        seeds = [FEE_VAULT_SEED],
        bump
    )]
    pub fee_vault: SystemAccount<'info>,
    
    /// CHECK: just receives lamports
    #[account(
        mut,
        constraint = recipient.key() == global.fee_receiver
    )]
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}