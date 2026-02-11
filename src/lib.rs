use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod state;
pub mod instructions;
pub mod utils;

use instructions::*;
use state::*;

declare_id!("HY3g1uQL2Zki1aFVJvJYZnMjZNveuMJhU22f9BucN3X");

#[program]
pub mod token_lp {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> 
    {
        instructions::admin::initialize::handler(ctx)
    }

    pub fn update_config(ctx: Context<UpdateConfig>, 
        new_fee_receiver: Option<Pubkey>,
        new_initial_virtual_sol_reserves: Option<u64>,
        new_initial_virtual_token_reserves: Option<u64>,
        new_initial_real_token_reserves: Option<u64>,
        new_token_total_supply: Option<u64>,
        new_trade_fee_bps: Option<u16>,
        new_creator_share_bps: Option<u16>,
        new_referral_share_bps: Option<u16>,
        new_graduation_threshold: Option<u64>,
        new_status: Option<ProgramStatus>,
    ) -> Result<()>
    {
        instructions::admin::update_config::handler(ctx, new_fee_receiver, new_initial_virtual_sol_reserves, new_initial_virtual_token_reserves, new_initial_real_token_reserves, new_token_total_supply, new_trade_fee_bps, new_creator_share_bps, new_referral_share_bps, new_graduation_threshold, new_status)
    }

    pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()>
    {
        instructions::admin::withdraw_fees::handler(ctx)
    }
}
