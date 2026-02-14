use anchor_lang::prelude::*;

#[error_code]
pub enum AdminError
{
    #[msg("Not enough lamports to withdraw fees!")]
    NotEnoughLamports,
    #[msg("Program is paused!")]
    ProgramPaused,
    #[msg("Invalid config parameter")]
    InvalidConfigParam,
}

#[error_code]
pub enum MathError
{
    #[msg("Math overflow")]
    Overflow,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Cast overflow")]
    CastOverflow,
}

#[error_code]
pub enum TradeError
{
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Bonding curve already completed")]
    CurveCompleted,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Program Paused !")]
    ProgramPaused,
    #[msg("Not Enough tokens available !")]
    NotEnoughTokens,
    #[msg("Not enough SOL in reserves")]
    NotEnoughSol,
    #[msg("Insufficient reserves for rent exemption")]
    InsufficientRentExemption,
    #[msg("Invalid referral account")]
    InvalidReferral,
}
