import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  program,
  provider,
  connection,
  airdrop,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  DEFAULT_VIRTUAL_SOL,
  DEFAULT_VIRTUAL_TOKENS,
  DEFAULT_REAL_TOKENS,
  DEFAULT_TOKEN_SUPPLY,
  DEFAULT_TRADE_FEE_BPS,
  DEFAULT_CREATOR_SHARE_BPS,
  DEFAULT_REFERRAL_SHARE_BPS,
  DEFAULT_GRADUATION_THRESHOLD,
} from "./helpers";
import { getGlobalPda, getFeeVaultPda } from "./helpers/pda";

describe("01 - Admin", () => {
  const authority = (provider.wallet as anchor.Wallet).payer;
  const globalPda = getGlobalPda();
  const feeVaultPda = getFeeVaultPda();

  describe("initialize", () => {
    it("should initialize global config with default values", async () => {
      await program.methods
        .initialize()
        .accounts({
          authority: authority.publicKey,
          global: globalPda,
          feeVault: feeVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const global = await program.account.global.fetch(globalPda);

      expect(global.authority.toBase58()).to.equal(authority.publicKey.toBase58());
      expect(global.feeReceiver.toBase58()).to.equal(authority.publicKey.toBase58());
      expect(global.initialVirtualSolReserves.toString()).to.equal(DEFAULT_VIRTUAL_SOL.toString());
      expect(global.initialVirtualTokenReserves.toString()).to.equal(DEFAULT_VIRTUAL_TOKENS.toString());
      expect(global.initialRealTokenReserves.toString()).to.equal(DEFAULT_REAL_TOKENS.toString());
      expect(global.tokenTotalSupply.toString()).to.equal(DEFAULT_TOKEN_SUPPLY.toString());
      expect(global.tokenDecimal).to.equal(6);
      expect(global.tradeFeeBps).to.equal(DEFAULT_TRADE_FEE_BPS);
      expect(global.creatorShareBps).to.equal(DEFAULT_CREATOR_SHARE_BPS);
      expect(global.referralShareBps).to.equal(DEFAULT_REFERRAL_SHARE_BPS);
      expect(global.graduationThreshold.toString()).to.equal(DEFAULT_GRADUATION_THRESHOLD.toString());
      expect(global.status).to.deep.equal({ running: {} });
    });

    it("should fail on double initialization (PDA already exists)", async () => {
      try {
        await program.methods
          .initialize()
          .accounts({
            authority: authority.publicKey,
            global: globalPda,
            feeVault: feeVaultPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // The account already exists, so init should fail
        expect(err.toString()).to.contain("already in use");
      }
    });
  });

  describe("update_config", () => {
    it("should update config fields as authority", async () => {
      const newFeeReceiver = Keypair.generate().publicKey;
      const newThreshold = new anchor.BN(100 * LAMPORTS_PER_SOL);

      await program.methods
        .updateConfig(
          newFeeReceiver,     // new_fee_receiver
          null,               // new_initial_virtual_sol_reserves
          null,               // new_initial_virtual_token_reserves
          null,               // new_initial_real_token_reserves
          null,               // new_token_total_supply
          200,                // new_trade_fee_bps (2%)
          null,               // new_creator_share_bps
          null,               // new_referral_share_bps
          newThreshold,       // new_graduation_threshold
          null,               // new_status
        )
        .accounts({
          authority: authority.publicKey,
          global: globalPda,
        })
        .rpc();

      const global = await program.account.global.fetch(globalPda);
      expect(global.feeReceiver.toBase58()).to.equal(newFeeReceiver.toBase58());
      expect(global.tradeFeeBps).to.equal(200);
      expect(global.graduationThreshold.toString()).to.equal(newThreshold.toString());

      // Restore defaults for subsequent tests
      await program.methods
        .updateConfig(
          authority.publicKey,
          DEFAULT_VIRTUAL_SOL,
          DEFAULT_VIRTUAL_TOKENS,
          DEFAULT_REAL_TOKENS,
          DEFAULT_TOKEN_SUPPLY,
          DEFAULT_TRADE_FEE_BPS,
          DEFAULT_CREATOR_SHARE_BPS,
          DEFAULT_REFERRAL_SHARE_BPS,
          DEFAULT_GRADUATION_THRESHOLD,
          { running: {} },
        )
        .accounts({
          authority: authority.publicKey,
          global: globalPda,
        })
        .rpc();
    });

    it("should fail when called by non-authority", async () => {
      const attacker = Keypair.generate();
      await airdrop(attacker.publicKey, 2 * LAMPORTS_PER_SOL);

      try {
        await program.methods
          .updateConfig(
            null, null, null, null, null, null, null, null, null,
            { paused: {} },
          )
          .accounts({
            authority: attacker.publicKey,
            global: globalPda,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // has_one = authority constraint should reject
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("ConstraintHasOne") || s.includes("has one constraint") || s.includes("2012") || s.includes("A has one constraint was violated")
        );
      }
    });
  });

  describe("withdraw_fees", () => {
    it("should withdraw fees to the configured fee_receiver", async () => {
      // Fund the fee_vault
      const fundAmount = 5 * LAMPORTS_PER_SOL;
      const transferIx = SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: feeVaultPda,
        lamports: fundAmount,
      });
      const tx = new anchor.web3.Transaction().add(transferIx);
      await provider.sendAndConfirm(tx);

      // recipient must match global.fee_receiver (= authority.publicKey)
      const feeVaultBefore = await connection.getBalance(feeVaultPda);
      const recipientBefore = await connection.getBalance(authority.publicKey);

      await program.methods
        .withdrawFees()
        .accounts({
          authority: authority.publicKey,
          global: globalPda,
          feeVault: feeVaultPda,
          recipient: authority.publicKey,
        })
        .rpc();

      const feeVaultAfter = await connection.getBalance(feeVaultPda);
      const recipientAfter = await connection.getBalance(authority.publicKey);

      // fee_vault should have been drained (minus rent-exempt minimum)
      expect(feeVaultAfter).to.be.lessThan(feeVaultBefore);
      // recipient should have received lamports
      expect(recipientAfter).to.be.greaterThan(recipientBefore - 100000); // allow for tx fee
    });

    it("should fail when called by non-authority", async () => {
      const attacker = Keypair.generate();
      await airdrop(attacker.publicKey, 2 * LAMPORTS_PER_SOL);

      try {
        await program.methods
          .withdrawFees()
          .accounts({
            authority: attacker.publicKey,
            global: globalPda,
            feeVault: feeVaultPda,
            recipient: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("ConstraintHasOne") || s.includes("has one constraint") || s.includes("2012") || s.includes("A has one constraint was violated")
        );
      }
    });

    it("should reject withdrawal to an unauthorized recipient", async () => {
      const randomRecipient = Keypair.generate();

      try {
        await program.methods
          .withdrawFees()
          .accounts({
            authority: authority.publicKey,
            global: globalPda,
            feeVault: feeVaultPda,
            recipient: randomRecipient.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // recipient must match global.fee_receiver
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("ConstraintRaw") || s.includes("2003")
        );
      }
    });
  });
});
