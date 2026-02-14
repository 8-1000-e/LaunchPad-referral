import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  program,
  provider,
  connection,
  airdrop,
  createToken,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
  getAssociatedTokenAddress,
  getMetadataPda,
  DEFAULT_VIRTUAL_SOL,
  DEFAULT_VIRTUAL_TOKENS,
  DEFAULT_REAL_TOKENS,
  DEFAULT_TOKEN_SUPPLY,
} from "./helpers";
import { getGlobalPda, getBondingCurvePda, getFeeVaultPda } from "./helpers/pda";

describe("02 - Launch", () => {
  const authority = (provider.wallet as anchor.Wallet).payer;

  describe("create_token", () => {
    it("should create a token with correct bonding curve state", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);

      const { mint, bondingCurvePda, tokenAccount } = await createToken(
        creator,
        "My Token",
        "MTK",
        "https://example.com/mtk.json"
      );

      // Verify bonding curve state
      const bc = await program.account.bondingCurve.fetch(bondingCurvePda);
      expect(bc.mint.toBase58()).to.equal(mint.publicKey.toBase58());
      expect(bc.creator.toBase58()).to.equal(creator.publicKey.toBase58());
      expect(bc.virtualSol.toString()).to.equal(DEFAULT_VIRTUAL_SOL.toString());
      expect(bc.virtualToken.toString()).to.equal(DEFAULT_VIRTUAL_TOKENS.toString());
      expect(bc.realToken.toString()).to.equal(DEFAULT_REAL_TOKENS.toString());
      expect(bc.realSolReserves.toNumber()).to.equal(0);
      expect(bc.tokenTotalSupply.toString()).to.equal(DEFAULT_TOKEN_SUPPLY.toString());
      expect(bc.completed).to.be.false;
      expect(bc.migrated).to.be.false;

      // Verify token supply was minted to the bonding curve's token account
      const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
      expect(tokenBalance.value.amount).to.equal(DEFAULT_TOKEN_SUPPLY.toString());
    });

    it("should fail to create token when program is paused", async () => {
      const globalPda = getGlobalPda();

      // Pause the program
      await program.methods
        .updateConfig(
          null, null, null, null, null, null, null, null, null,
          { paused: {} },
        )
        .accounts({
          authority: authority.publicKey,
          global: globalPda,
        })
        .rpc();

      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);

      try {
        await createToken(creator);
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("ProgramPaused") || s.includes("6001") || s.includes("Program is paused")
        );
      } finally {
        // Restore running state
        await program.methods
          .updateConfig(
            null, null, null, null, null, null, null, null, null,
            { running: {} },
          )
          .accounts({
            authority: authority.publicKey,
            global: globalPda,
          })
          .rpc();
      }
    });
  });

  describe("create_and_buy_token", () => {
    it("should create token and execute initial buy", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 20 * LAMPORTS_PER_SOL);

      const mint = Keypair.generate();
      const globalPda = getGlobalPda();
      const bondingCurvePda = getBondingCurvePda(mint.publicKey);
      const feeVaultPda = getFeeVaultPda();
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        bondingCurvePda,
        true
      );
      const creatorTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        creator.publicKey
      );
      const metadata = getMetadataPda(mint.publicKey);

      const solAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      await program.methods
        .createAndBuyToken("Buy Token", "BUY", "https://example.com/buy.json", solAmount, new anchor.BN(0))
        .accounts({
          creator: creator.publicKey,
          global: globalPda,
          mint: mint.publicKey,
          bondingCurve: bondingCurvePda,
          creatorTokenAccount: creatorTokenAccount,
          feeVault: feeVaultPda,
          tokenAccount: tokenAccount,
          referral: null,
          metadata: metadata,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator, mint])
        .rpc();

      // Verify bonding curve was updated
      const bc = await program.account.bondingCurve.fetch(bondingCurvePda);
      expect(bc.realSolReserves.toNumber()).to.be.greaterThan(0);
      expect(bc.completed).to.be.false;

      // Verify creator received tokens
      const creatorBalance = await connection.getTokenAccountBalance(creatorTokenAccount);
      expect(Number(creatorBalance.value.amount)).to.be.greaterThan(0);
    });

    it("should fail with sol_amount=0", async () => {
      const creator = Keypair.generate();
      await airdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);

      const mint = Keypair.generate();
      const globalPda = getGlobalPda();
      const bondingCurvePda = getBondingCurvePda(mint.publicKey);
      const feeVaultPda = getFeeVaultPda();
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        bondingCurvePda,
        true
      );
      const creatorTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        creator.publicKey
      );
      const metadata = getMetadataPda(mint.publicKey);

      try {
        await program.methods
          .createAndBuyToken("Zero Token", "ZERO", "https://example.com/zero.json", new anchor.BN(0), new anchor.BN(0))
          .accounts({
            creator: creator.publicKey,
            global: globalPda,
            mint: mint.publicKey,
            bondingCurve: bondingCurvePda,
            creatorTokenAccount: creatorTokenAccount,
            feeVault: feeVaultPda,
            tokenAccount: tokenAccount,
            referral: null,
            metadata: metadata,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([creator, mint])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.toString()).to.satisfy(
          (s: string) => s.includes("ZeroAmount") || s.includes("6003") || s.includes("Amount must be greater than zero")
        );
      }
    });
  });
});
