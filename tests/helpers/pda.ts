import { PublicKey } from "@solana/web3.js";
import { program } from "./setup";

const GLOBAL_SEED = Buffer.from("global");
const BONDING_CURVE_SEED = Buffer.from("bonding-curve");
const FEE_VAULT_SEED = Buffer.from("fee-vault");
const REFERRAL_SEED = Buffer.from("referral");

export function getGlobalPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [GLOBAL_SEED],
    program.programId
  );
  return pda;
}

export function getBondingCurvePda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [BONDING_CURVE_SEED, mint.toBuffer()],
    program.programId
  );
  return pda;
}

export function getFeeVaultPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [FEE_VAULT_SEED],
    program.programId
  );
  return pda;
}

export function getReferralPda(user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [REFERRAL_SEED, user.toBuffer()],
    program.programId
  );
  return pda;
}
