use anchor_lang::prelude::*;

 #[event]                                                                     
pub struct TradeEvent 
{
    pub mint: Pubkey,
    pub trader: Pubkey,
    pub is_buy: bool,
    pub sol_amount: u64,
    pub token_amount: u64,
}

#[event]
pub struct CreateEvent
{
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

#[event]
pub struct CompleteEvent
{
    pub mint:  Pubkey,
    pub real_sol_reserves:  u64,
}

#[event]
pub struct MigrateEvent
{
  pub mint: Pubkey,
  pub pool_state: Pubkey,
}