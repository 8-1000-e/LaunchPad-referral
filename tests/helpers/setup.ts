import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenLp } from "../../target/types/token_lp";
import {
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

// Re-export for convenience
export { Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram };
export { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress };

// Program setup
export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
export const program = anchor.workspace.tokenLp as Program<TokenLp>;
export const connection = provider.connection;

// Metaplex Token Metadata program ID
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Constants matching the Rust program
export const DEFAULT_VIRTUAL_SOL = new anchor.BN(30 * LAMPORTS_PER_SOL);
export const DEFAULT_VIRTUAL_TOKENS = new anchor.BN("1073000000000000"); // 1_073_000_000 * 10^6
export const DEFAULT_REAL_TOKENS = new anchor.BN("793100000000000");    // 793_100_000 * 10^6
export const DEFAULT_TOKEN_SUPPLY = new anchor.BN("1000000000000000");  // 1_000_000_000 * 10^6
export const DEFAULT_TRADE_FEE_BPS = 100;
export const DEFAULT_CREATOR_SHARE_BPS = 6500;
export const DEFAULT_REFERRAL_SHARE_BPS = 1000;
export const DEFAULT_GRADUATION_THRESHOLD = new anchor.BN(85 * LAMPORTS_PER_SOL);

/**
 * Airdrop SOL to a public key and confirm.
 */
export async function airdrop(pubkey: PublicKey, amount: number = 100 * LAMPORTS_PER_SOL): Promise<void> {
  const sig = await connection.requestAirdrop(pubkey, amount);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latestBlockhash });
}

/**
 * Get the metadata PDA for a given mint.
 */
export function getMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

/**
 * Helper to create a token via the program's create_token instruction.
 * Returns the mint keypair and relevant accounts.
 */
export async function createToken(
  creator: Keypair,
  name: string = "Test Token",
  symbol: string = "TEST",
  uri: string = "https://example.com/metadata.json"
) {
  const mint = Keypair.generate();
  const { getGlobalPda, getBondingCurvePda, getFeeVaultPda } = await import("./pda");

  const globalPda = getGlobalPda();
  const bondingCurvePda = getBondingCurvePda(mint.publicKey);
  const feeVaultPda = getFeeVaultPda();
  const tokenAccount = await getAssociatedTokenAddress(
    mint.publicKey,
    bondingCurvePda,
    true
  );
  const metadata = getMetadataPda(mint.publicKey);

  await program.methods
    .createToken(name, symbol, uri)
    .accounts({
      creator: creator.publicKey,
      global: globalPda,
      mint: mint.publicKey,
      bondingCurve: bondingCurvePda,
      tokenAccount: tokenAccount,
      metadata: metadata,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([creator, mint])
    .rpc();

  return { mint, bondingCurvePda, tokenAccount, metadata };
}

/**
 * Helper to buy tokens.
 */
export async function buyToken(
  buyer: Keypair,
  mint: PublicKey,
  solAmount: anchor.BN,
  minTokensOut: anchor.BN,
  referral?: PublicKey
) {
  const { getGlobalPda, getBondingCurvePda, getFeeVaultPda } = await import("./pda");

  const globalPda = getGlobalPda();
  const bondingCurvePda = getBondingCurvePda(mint);
  const feeVaultPda = getFeeVaultPda();
  const tokenAccount = await getAssociatedTokenAddress(mint, bondingCurvePda, true);
  const buyerTokenAccount = await getAssociatedTokenAddress(mint, buyer.publicKey);

  // Fetch the bonding curve to get the creator
  const bc = await program.account.bondingCurve.fetch(bondingCurvePda);

  const accounts: any = {
    buyer: buyer.publicKey,
    global: globalPda,
    mint: mint,
    bondingCurve: bondingCurvePda,
    buyerTokenAccount: buyerTokenAccount,
    tokenAccount: tokenAccount,
    creatorAccount: bc.creator,
    feeVault: feeVaultPda,
    referral: referral || null,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  };

  await program.methods
    .buyToken(solAmount, minTokensOut)
    .accounts(accounts)
    .signers([buyer])
    .rpc();
}

/**
 * Helper to sell tokens.
 */
export async function sellToken(
  seller: Keypair,
  mint: PublicKey,
  tokenAmount: anchor.BN,
  minSolOut: anchor.BN,
  referral?: PublicKey
) {
  const { getGlobalPda, getBondingCurvePda, getFeeVaultPda } = await import("./pda");

  const globalPda = getGlobalPda();
  const bondingCurvePda = getBondingCurvePda(mint);
  const feeVaultPda = getFeeVaultPda();
  const tokenAccount = await getAssociatedTokenAddress(mint, bondingCurvePda, true);
  const sellerTokenAccount = await getAssociatedTokenAddress(mint, seller.publicKey);

  // Fetch the bonding curve to get the creator
  const bc = await program.account.bondingCurve.fetch(bondingCurvePda);

  const accounts: any = {
    seller: seller.publicKey,
    global: globalPda,
    mint: mint,
    bondingCurve: bondingCurvePda,
    sellerTokenAccount: sellerTokenAccount,
    tokenAccount: tokenAccount,
    creatorAccount: bc.creator,
    feeVault: feeVaultPda,
    referral: referral || null,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  };

  await program.methods
    .sellToken(tokenAmount, minSolOut)
    .accounts(accounts)
    .signers([seller])
    .rpc();
}
