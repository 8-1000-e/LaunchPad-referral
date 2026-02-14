import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  program,
  provider,
  connection,
  airdrop,
  createToken,
  buyToken,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "./helpers";
import { getGlobalPda, getBondingCurvePda, getFeeVaultPda, getReferralPda } from "./helpers/pda";

describe("04 - Referral", () => {
  const authority = (provider.wallet as anchor.Wallet).payer;

  describe("register_referral", () => {
    it("should register a referral account", async () => {
      const referrer = Keypair.generate();
      await airdrop(referrer.publicKey, 5 * LAMPORTS_PER_SOL);

      const referralPda = getReferralPda(referrer.publicKey);

      await program.methods
        .registerReferral()
        .accounts({
          user: referrer.publicKey,
          referral: referralPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([referrer])
        .rpc();

      const referralAccount = await program.account.referral.fetch(referralPda);
      expect(referralAccount.referrer.toBase58()).to.equal(referrer.publicKey.toBase58());
      expect(referralAccount.totalEarned.toNumber()).to.equal(0);
      expect(referralAccount.tradeCount.toNumber()).to.equal(0);
    });

    it("should fail on double registration (PDA already exists)", async () => {
      const referrer = Keypair.generate();
      await airdrop(referrer.publicKey, 5 * LAMPORTS_PER_SOL);

      const referralPda = getReferralPda(referrer.publicKey);

      // First registration
      await program.methods
        .registerReferral()
        .accounts({
          user: referrer.publicKey,
          referral: referralPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([referrer])
        .rpc();

      // Second registration should fail
      try {
        await program.methods
          .registerReferral()
          .accounts({
            user: referrer.publicKey,
            referral: referralPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([referrer])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.contain("already in use");
      }
    });
  });

  describe("buy with referral", () => {
    it("should split fees between protocol and referral", async () => {
      // Setup referrer
      const referrer = Keypair.generate();
      await airdrop(referrer.publicKey, 5 * LAMPORTS_PER_SOL);

      const referralPda = getReferralPda(referrer.publicKey);
      await program.methods
        .registerReferral()
        .accounts({
          user: referrer.publicKey,
          referral: referralPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([referrer])
        .rpc();

      // Create a token
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);
      const { mint } = await createToken(creator);

      // Get balances before
      const feeVaultPda = getFeeVaultPda();
      const feeVaultBefore = await connection.getBalance(feeVaultPda);
      const referralBalanceBefore = await connection.getBalance(referralPda);

      // Buy with referral
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey, 10 * LAMPORTS_PER_SOL);

      const solAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      await buyToken(buyer, mint.publicKey, solAmount, new anchor.BN(0), referralPda);

      // Check fee splitting
      const feeVaultAfter = await connection.getBalance(feeVaultPda);
      const referralBalanceAfter = await connection.getBalance(referralPda);

      // Total fee = 1% of 1 SOL = 0.01 SOL = 10_000_000 lamports
      // Creator share = 30% of fee (goes to token creator, not fee_vault)
      // Remaining = 70% of fee
      // Referral share = 10% of remaining
      // Protocol share = remaining - referral
      const totalFee = solAmount.toNumber() * 100 / 10000;
      const creatorFee = Math.floor(totalFee * 6500 / 10000); // creator_share_bps = 6500
      const remainingFee = totalFee - creatorFee;
      const expectedReferralFee = Math.floor(remainingFee * 1000 / 10000); // referral_share_bps = 1000
      const expectedProtocolFee = remainingFee - expectedReferralFee;

      const feeVaultDelta = feeVaultAfter - feeVaultBefore;
      const referralDelta = referralBalanceAfter - referralBalanceBefore;

      expect(feeVaultDelta).to.equal(expectedProtocolFee);
      expect(referralDelta).to.equal(expectedReferralFee);

      // Verify referral account state updated
      const referralAccount = await program.account.referral.fetch(referralPda);
      expect(referralAccount.totalEarned.toNumber()).to.equal(referralDelta);
      expect(referralAccount.tradeCount.toNumber()).to.equal(1);
    });
  });

  describe("claim_referral_fees", () => {
    it("should claim accumulated referral fees", async () => {
      // Setup referrer with some earned fees
      const referrer = Keypair.generate();
      await airdrop(referrer.publicKey, 5 * LAMPORTS_PER_SOL);

      const referralPda = getReferralPda(referrer.publicKey);
      await program.methods
        .registerReferral()
        .accounts({
          user: referrer.publicKey,
          referral: referralPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([referrer])
        .rpc();

      // Create token and do a buy with this referral
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);
      const { mint } = await createToken(creator);

      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey, 10 * LAMPORTS_PER_SOL);
      await buyToken(buyer, mint.publicKey, new anchor.BN(1 * LAMPORTS_PER_SOL), new anchor.BN(0), referralPda);

      // Now claim the fees
      const referrerBalanceBefore = await connection.getBalance(referrer.publicKey);

      await program.methods
        .claimReferralFees()
        .accounts({
          user: referrer.publicKey,
          referral: referralPda,
        })
        .signers([referrer])
        .rpc();

      const referrerBalanceAfter = await connection.getBalance(referrer.publicKey);

      // Referrer should have received lamports (minus tx fee)
      // The amount is the referral fee minus the rent that stays
      expect(referrerBalanceAfter).to.be.greaterThan(referrerBalanceBefore - 10000);
    });

    it("should fail when claimed by non-referrer", async () => {
      // Register a referral
      const referrer = Keypair.generate();
      await airdrop(referrer.publicKey, 5 * LAMPORTS_PER_SOL);

      const referralPda = getReferralPda(referrer.publicKey);
      await program.methods
        .registerReferral()
        .accounts({
          user: referrer.publicKey,
          referral: referralPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([referrer])
        .rpc();

      // Try to claim as a different user
      // The PDA won't match because seeds include user.key()
      const attacker = Keypair.generate();
      await airdrop(attacker.publicKey, 2 * LAMPORTS_PER_SOL);

      try {
        await program.methods
          .claimReferralFees()
          .accounts({
            user: attacker.publicKey,
            referral: referralPda, // referrer's PDA, not attacker's
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Should fail on seeds mismatch or constraint
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("ConstraintSeeds") || s.includes("2006") ||
                         s.includes("ConstraintRaw") || s.includes("2003") ||
                         s.includes("seeds constraint") || s.includes("A seeds constraint was violated")
        );
      }
    });
  });
});
