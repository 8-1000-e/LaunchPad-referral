use anchor_lang::prelude::*;

#[error_code]
pub enum AdminError
{
    #[msg("Not enough lamports to withdraw fees!")]
    NotEnoughLamports
}