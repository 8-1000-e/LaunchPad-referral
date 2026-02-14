import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  program,
  provider,
  connection,
  airdrop,
  createToken,
  buyToken,
  sellToken,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  DEFAULT_GRADUATION_THRESHOLD,
} from "./helpers";
import { getGlobalPda, getBondingCurvePda, getFeeVaultPda } from "./helpers/pda";

describe("03 - Trade", () => {
  const authority = (provider.wallet as anchor.Wallet).payer;
  let testMint: Keypair;
  let testBondingCurvePda: PublicKey;
  let testTokenAccount: PublicKey;

  // Create a shared token for trade tests
  before(async () => {
    const creator = Keypair.generate();
    await airdrop(creator.publicKey, 20 * LAMPORTS_PER_SOL);

    const result = await createToken(creator, "Trade Token", "TRD", "https://example.com/trd.json");
    testMint = result.mint;
    testBondingCurvePda = result.bondingCurvePda;
    testTokenAccount = result.tokenAccount;
  });

  describe("buy_token", () => {
    it("should buy tokens and update reserves correctly", async () => {
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey, 20 * LAMPORTS_PER_SOL);

      const bcBefore = await program.account.bondingCurve.fetch(testBondingCurvePda);
      const solAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      await buyToken(buyer, testMint.publicKey, solAmount, new anchor.BN(0));

      const bcAfter = await program.account.bondingCurve.fetch(testBondingCurvePda);

      // After fee (1%), net SOL = 0.99 SOL
      const fee = solAmount.toNumber() * 100 / 10000;
      const solAfterFee = solAmount.toNumber() - fee;

      // virtual_sol should increase
      expect(bcAfter.virtualSol.toNumber()).to.equal(
        bcBefore.virtualSol.toNumber() + solAfterFee
      );
      // real_sol_reserves should increase
      expect(bcAfter.realSolReserves.toNumber()).to.equal(
        bcBefore.realSolReserves.toNumber() + solAfterFee
      );
      // virtual_token should decrease
      expect(bcAfter.virtualToken.toNumber()).to.be.lessThan(
        bcBefore.virtualToken.toNumber()
      );
      // real_token should decrease
      expect(bcAfter.realToken.toNumber()).to.be.lessThan(
        bcBefore.realToken.toNumber()
      );

      // Verify buyer got tokens
      const buyerAta = await getAssociatedTokenAddress(testMint.publicKey, buyer.publicKey);
      const balance = await connection.getTokenAccountBalance(buyerAta);
      expect(Number(balance.value.amount)).to.be.greaterThan(0);
    });

    it("should fail with amount=0", async () => {
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey, 5 * LAMPORTS_PER_SOL);

      try {
        await buyToken(buyer, testMint.publicKey, new anchor.BN(0), new anchor.BN(0));
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("ZeroAmount") || s.includes("6003")
        );
      }
    });

    it("should fail when program is paused", async () => {
      const globalPda = getGlobalPda();

      // Pause the program
      await program.methods
        .updateConfig(null, null, null, null, null, null, null, null, null, { paused: {} })
        .accounts({ authority: authority.publicKey, global: globalPda })
        .rpc();

      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey, 5 * LAMPORTS_PER_SOL);

      try {
        await buyToken(buyer, testMint.publicKey, new anchor.BN(LAMPORTS_PER_SOL), new anchor.BN(0));
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("ProgramPaused") || s.includes("6003")
        );
      } finally {
        // Restore
        await program.methods
          .updateConfig(null, null, null, null, null, null, null, null, null, { running: {} })
          .accounts({ authority: authority.publicKey, global: globalPda })
          .rpc();
      }
    });

    it("should fail with slippage too high (min_tokens_out unreachable)", async () => {
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey, 5 * LAMPORTS_PER_SOL);

      try {
        // Request an impossibly large number of tokens
        await buyToken(
          buyer,
          testMint.publicKey,
          new anchor.BN(LAMPORTS_PER_SOL),
          new anchor.BN("999999999999999999") // impossibly high min_tokens_out
        );
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("SlippageExceeded") || s.includes("6000")
        );
      }
    });
  });

  describe("sell_token", () => {
    let seller: Keypair;
    let sellerTokens: anchor.BN;

    before(async () => {
      // Buy some tokens first so we can sell them
      seller = Keypair.generate();
      await airdrop(seller.publicKey, 20 * LAMPORTS_PER_SOL);

      await buyToken(seller, testMint.publicKey, new anchor.BN(2 * LAMPORTS_PER_SOL), new anchor.BN(0));

      const sellerAta = await getAssociatedTokenAddress(testMint.publicKey, seller.publicKey);
      const balance = await connection.getTokenAccountBalance(sellerAta);
      sellerTokens = new anchor.BN(balance.value.amount);
    });

    it("should sell tokens and receive SOL", async () => {
      const sellAmount = sellerTokens.div(new anchor.BN(2));
      const sellerBalanceBefore = await connection.getBalance(seller.publicKey);

      await sellToken(seller, testMint.publicKey, sellAmount, new anchor.BN(0));

      const sellerBalanceAfter = await connection.getBalance(seller.publicKey);
      // Seller should have received SOL (minus tx fees)
      expect(sellerBalanceAfter).to.be.greaterThan(sellerBalanceBefore - 10000); // allow for tx fee

      // Token balance should have decreased
      const sellerAta = await getAssociatedTokenAddress(testMint.publicKey, seller.publicKey);
      const balanceAfter = await connection.getTokenAccountBalance(sellerAta);
      expect(Number(balanceAfter.value.amount)).to.be.lessThan(sellerTokens.toNumber());
    });

    it("should fail with amount=0", async () => {
      try {
        await sellToken(seller, testMint.publicKey, new anchor.BN(0), new anchor.BN(0));
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("ZeroAmount") || s.includes("6003")
        );
      }
    });

    it("should fail when program is paused", async () => {
      const globalPda = getGlobalPda();

      await program.methods
        .updateConfig(null, null, null, null, null, null, null, null, null, { paused: {} })
        .accounts({ authority: authority.publicKey, global: globalPda })
        .rpc();

      try {
        await sellToken(seller, testMint.publicKey, new anchor.BN(1000000), new anchor.BN(0));
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("ProgramPaused") || s.includes("6003")
        );
      } finally {
        await program.methods
          .updateConfig(null, null, null, null, null, null, null, null, null, { running: {} })
          .accounts({ authority: authority.publicKey, global: globalPda })
          .rpc();
      }
    });

    it("should fail with slippage too high (min_sol_out unreachable)", async () => {
      try {
        await sellToken(
          seller,
          testMint.publicKey,
          new anchor.BN(1000000), // small amount of tokens
          new anchor.BN("999999999999999999") // impossibly high min_sol_out
        );
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("SlippageExceeded") || s.includes("6000")
        );
      }
    });
  });

  describe("buy/sell round-trip", () => {
    it("should complete a full buy/sell round-trip", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 20 * LAMPORTS_PER_SOL);

      const { mint, bondingCurvePda } = await createToken(
        creator,
        "Round Trip Token",
        "RND",
        "https://example.com/rnd.json"
      );

      const trader = Keypair.generate();
      await airdrop(trader.publicKey, 20 * LAMPORTS_PER_SOL);

      const solBefore = await connection.getBalance(trader.publicKey);

      // Buy
      const buyAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      await buyToken(trader, mint.publicKey, buyAmount, new anchor.BN(0));

      // Get tokens received
      const traderAta = await getAssociatedTokenAddress(mint.publicKey, trader.publicKey);
      const tokensReceived = (await connection.getTokenAccountBalance(traderAta)).value.amount;
      expect(Number(tokensReceived)).to.be.greaterThan(0);

      // Sell all tokens back
      await sellToken(trader, mint.publicKey, new anchor.BN(tokensReceived), new anchor.BN(0));

      // Verify tokens are gone
      const tokensAfter = (await connection.getTokenAccountBalance(traderAta)).value.amount;
      expect(Number(tokensAfter)).to.equal(0);

      // SOL should be less than before (fees taken on both buy and sell)
      const solAfter = await connection.getBalance(trader.publicKey);
      expect(solAfter).to.be.lessThan(solBefore);
    });
  });

  describe("graduation", () => {
    it("should mark curve as completed when threshold is reached", async () => {
      const globalPda = getGlobalPda();

      // Set a very low graduation threshold (2 SOL)
      const lowThreshold = new anchor.BN(2 * LAMPORTS_PER_SOL);
      await program.methods
        .updateConfig(null, null, null, null, null, null, null, null, lowThreshold, null)
        .accounts({ authority: authority.publicKey, global: globalPda })
        .rpc();

      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 20 * LAMPORTS_PER_SOL);

      const { mint, bondingCurvePda } = await createToken(
        creator,
        "Grad Token",
        "GRAD",
        "https://example.com/grad.json"
      );

      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey, 50 * LAMPORTS_PER_SOL);

      // Buy enough to cross the threshold (2 SOL net after fee)
      await buyToken(buyer, mint.publicKey, new anchor.BN(3 * LAMPORTS_PER_SOL), new anchor.BN(0));

      const bc = await program.account.bondingCurve.fetch(bondingCurvePda);
      expect(bc.completed).to.be.true;

      // Restore threshold
      await program.methods
        .updateConfig(null, null, null, null, null, null, null, null, DEFAULT_GRADUATION_THRESHOLD, null)
        .accounts({ authority: authority.publicKey, global: globalPda })
        .rpc();
    });

    it("should fail to buy on completed curve", async () => {
      const globalPda = getGlobalPda();
      const lowThreshold = new anchor.BN(2 * LAMPORTS_PER_SOL);
      await program.methods
        .updateConfig(null, null, null, null, null, null, null, null, lowThreshold, null)
        .accounts({ authority: authority.publicKey, global: globalPda })
        .rpc();

      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 20 * LAMPORTS_PER_SOL);

      const { mint, bondingCurvePda } = await createToken(
        creator,
        "Complete Token",
        "COMP",
        "https://example.com/comp.json"
      );

      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey, 50 * LAMPORTS_PER_SOL);

      // First buy to complete the curve
      await buyToken(buyer, mint.publicKey, new anchor.BN(3 * LAMPORTS_PER_SOL), new anchor.BN(0));

      const bc = await program.account.bondingCurve.fetch(bondingCurvePda);
      expect(bc.completed).to.be.true;

      // Try to buy again - should fail
      const buyer2 = Keypair.generate();
      await airdrop(buyer2.publicKey, 10 * LAMPORTS_PER_SOL);

      try {
        await buyToken(buyer2, mint.publicKey, new anchor.BN(LAMPORTS_PER_SOL), new anchor.BN(0));
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("CurveCompleted") || s.includes("6001")
        );
      }

      // Restore threshold
      await program.methods
        .updateConfig(null, null, null, null, null, null, null, null, DEFAULT_GRADUATION_THRESHOLD, null)
        .accounts({ authority: authority.publicKey, global: globalPda })
        .rpc();
    });

    it("should fail to sell on completed curve", async () => {
      const globalPda = getGlobalPda();
      const lowThreshold = new anchor.BN(2 * LAMPORTS_PER_SOL);
      await program.methods
        .updateConfig(null, null, null, null, null, null, null, null, lowThreshold, null)
        .accounts({ authority: authority.publicKey, global: globalPda })
        .rpc();

      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 20 * LAMPORTS_PER_SOL);

      const { mint, bondingCurvePda } = await createToken(
        creator,
        "Sell Complete Token",
        "SCOMP",
        "https://example.com/scomp.json"
      );

      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey, 50 * LAMPORTS_PER_SOL);

      // Buy to complete the curve
      await buyToken(buyer, mint.publicKey, new anchor.BN(3 * LAMPORTS_PER_SOL), new anchor.BN(0));

      const bc = await program.account.bondingCurve.fetch(bondingCurvePda);
      expect(bc.completed).to.be.true;

      // Try to sell - should fail
      const buyerAta = await getAssociatedTokenAddress(mint.publicKey, buyer.publicKey);
      const tokensHeld = (await connection.getTokenAccountBalance(buyerAta)).value.amount;

      try {
        await sellToken(buyer, mint.publicKey, new anchor.BN(tokensHeld), new anchor.BN(0));
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("CurveCompleted") || s.includes("6001")
        );
      }

      // Restore threshold
      await program.methods
        .updateConfig(null, null, null, null, null, null, null, null, DEFAULT_GRADUATION_THRESHOLD, null)
        .accounts({ authority: authority.publicKey, global: globalPda })
        .rpc();
    });
  });
});
