import User from '#models/user'
import TokenTransaction from '#models/token_transaction'
import tokenConfig from '#config/token'
import db from '@adonisjs/lucid/services/db'
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js'
import bs58 from 'bs58'
import type { DbTransaction } from '#services/tokens/types'
import { decryptWalletSecret, encryptWalletSecret } from '#services/tokens/wallet_crypto'
import type {
  MintTokensParams,
  RedeemTokensParams,
  TokenLedgerRow,
  TokenService,
  TokenTransactionResult,
  WalletResult,
} from '#services/tokens/types'

function mapRow(row: TokenTransaction): TokenLedgerRow {
  return {
    id: row.id,
    institutionId: row.institutionId,
    userId: row.userId,
    achievementId: row.achievementId,
    redemptionId: row.redemptionId,
    amount: row.amount,
    type: row.type as TokenLedgerRow['type'],
    status: row.status as TokenLedgerRow['status'],
    provider: row.provider as TokenLedgerRow['provider'],
    transactionSignature: row.transactionSignature,
    tokenMint: row.tokenMint,
    walletPublicKey: row.walletPublicKey,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  }
}

function loadAuthorityKeypair(): Keypair {
  const secret = tokenConfig.mintAuthoritySecret.trim()
  if (secret.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)))
  }
  return Keypair.fromSecretKey(bs58.decode(secret))
}

/** Maps common RPC failures to operator-facing hints (wallet SOL, cluster mismatch, etc.). */
function formatSolanaMintError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes('no record of a prior credit')) {
    return `${msg} — Fund the mint authority wallet (public key from MINT_AUTHORITY_SECRET) with SOL on this cluster: it pays fees and ATA rent when creating the student's token account. On devnet use a faucet (e.g. solana airdrop 2 <authority_pubkey> --url devnet).`
  }
  if (msg.includes('insufficient funds') || msg.includes('InsufficientFunds')) {
    return `${msg} — Mint authority likely needs more SOL for fees/rent on this cluster.`
  }
  if (msg.includes('owner does not match') || msg.includes('custom program error: 0x4')) {
    return `${msg} — The signer from MINT_AUTHORITY_SECRET is not this mint's mint authority on-chain. Use the keypair that created SCHOLARFI_TOKEN_MINT (or transfer mint authority to your backend key), then retry.`
  }
  return msg
}

function loadStudentKeypair(user: User): Keypair {
  if (!user.encryptedWalletSecret) {
    throw new Error('Student custodial wallet is not initialized')
  }
  const raw = decryptWalletSecret(user.encryptedWalletSecret)
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
}

function tbl(name: string, trx?: DbTransaction) {
  const q = db.table(name)
  return trx ? q.useTransaction(trx) : q
}

function fromTbl(name: string, trx?: DbTransaction) {
  const q = db.from(name)
  return trx ? q.useTransaction(trx) : q
}

async function ensureBalanceRow(userId: number, trx?: DbTransaction) {
  await tbl('token_balances', trx)
    .insert({
      user_id: userId,
      balance: 0,
      updated_at: new Date(),
    })
    .onConflict('user_id')
    .ignore()
}

/** Create custodial wallet row if missing (e.g. students created before TOKEN_MODE=solana). */
async function ensureCustodialWallet(userId: number, trx?: DbTransaction) {
  const row = await (trx ? trx.from('users') : db.from('users')).where('id', userId).first()
  if (!row) {
    throw new Error('User not found for custodial wallet provisioning')
  }
  if (row.wallet_public_key && row.encrypted_wallet_secret) {
    await ensureBalanceRow(userId, trx)
    return
  }

  const kp = Keypair.generate()
  const secretJson = JSON.stringify(Array.from(kp.secretKey))
  const encrypted = encryptWalletSecret(secretJson)

  await (trx ? trx.from('users') : db.from('users')).where('id', userId).update({
    wallet_public_key: kp.publicKey.toBase58(),
    encrypted_wallet_secret: encrypted,
    updated_at: new Date(),
  })

  await ensureBalanceRow(userId, trx)
}

async function findUserForMint(userId: number, trx?: DbTransaction) {
  if (trx) {
    return User.query().useTransaction(trx).where('id', userId).firstOrFail()
  }
  return User.findOrFail(userId)
}

function toRawAmount(humanAmount: number, decimals: number): bigint {
  return BigInt(humanAmount) * 10n ** BigInt(decimals)
}

function fromRawAmount(raw: bigint, decimals: number): number {
  return Number(raw / 10n ** BigInt(decimals))
}

export default class SolanaTokenService implements TokenService {
  private connection: Connection

  constructor() {
    this.connection = new Connection(tokenConfig.solanaRpcUrl, 'confirmed')
  }

  async createWallet(userId: string): Promise<WalletResult> {
    const id = Number(userId)
    const existing = await User.find(id)
    if (existing?.walletPublicKey && existing.encryptedWalletSecret) {
      await ensureBalanceRow(id)
      return {
        userId,
        walletPublicKey: existing.walletPublicKey,
        encryptedSecretStored: true,
      }
    }

    const kp = Keypair.generate()
    const secretJson = JSON.stringify(Array.from(kp.secretKey))
    const encrypted = encryptWalletSecret(secretJson)

    await User.query().where('id', id).update({
      walletPublicKey: kp.publicKey.toBase58(),
      encryptedWalletSecret: encrypted,
    })

    await ensureBalanceRow(id)
    return {
      userId,
      walletPublicKey: kp.publicKey.toBase58(),
      encryptedSecretStored: true,
    }
  }

  async mintTokens(params: MintTokensParams): Promise<TokenTransactionResult> {
    const trx = params.client

    if (params.achievementId) {
      const existing = await fromTbl('token_transactions', trx)
        .where({ achievement_id: params.achievementId, type: 'mint' })
        .first()
      if (existing) {
        return {
          transactionId: existing.id as number,
          amount: Number(existing.amount),
          status: 'confirmed' as const,
          transactionSignature: existing.transaction_signature as string | null,
          idempotent: true,
        }
      }
    }

    await ensureCustodialWallet(params.userId, trx)
    const user = await findUserForMint(params.userId, trx)

    const authority = loadAuthorityKeypair()
    const studentKp = loadStudentKeypair(user)
    const mint = new PublicKey(tokenConfig.tokenMint)
    const mintInfo = await getMint(this.connection, mint)

    if (!mintInfo.mintAuthority) {
      throw new Error(
        'This SPL mint has no mint authority on-chain (mint is immutable). Create a new mint with a mint authority, or SCHOLARFI_TOKEN_MINT must point to a mint you can still mint from.'
      )
    }
    if (!authority.publicKey.equals(mintInfo.mintAuthority)) {
      throw new Error(
        `MINT_AUTHORITY_SECRET pubkey ${authority.publicKey.toBase58()} does not match mint authority ${mintInfo.mintAuthority.toBase58()} for mint ${tokenConfig.tokenMint}. Use the keypair that owns that authority, or set SCHOLARFI_TOKEN_MINT to a mint your backend key controls.`
      )
    }

    const rawAmount = toRawAmount(params.amount, mintInfo.decimals)

    const ata = await getAssociatedTokenAddress(mint, studentKp.publicKey, false, TOKEN_PROGRAM_ID)
    const info = await this.connection.getAccountInfo(ata)

    const tx = new Transaction()
    if (!info) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          ata,
          studentKp.publicKey,
          mint,
          TOKEN_PROGRAM_ID
        )
      )
    }
    tx.add(createMintToInstruction(mint, ata, authority.publicKey, rawAmount, [], TOKEN_PROGRAM_ID))

    let signature: string
    try {
      signature = await sendAndConfirmTransaction(this.connection, tx, [authority], {
        commitment: 'confirmed',
      })
    } catch (error) {
      const detailed = formatSolanaMintError(error)
      await tbl('token_transactions', trx)
        .insert({
          institution_id: params.institutionId,
          user_id: params.userId,
          achievement_id: params.achievementId ?? null,
          redemption_id: null,
          amount: params.amount,
          type: 'mint',
          status: 'failed',
          provider: 'solana',
          transaction_signature: null,
          token_mint: tokenConfig.tokenMint,
          wallet_public_key: user.walletPublicKey,
          error_message: detailed.slice(0, 2000),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')
      // Fail the surrounding DB transaction so admin approval is not committed without on-chain mint.
      throw new Error(`Solana mint failed: ${detailed}`)
    }

    const persist = async (trx?: DbTransaction) => {
      await ensureBalanceRow(params.userId, trx)
      const inserted = await tbl('token_transactions', trx)
        .insert({
          institution_id: params.institutionId,
          user_id: params.userId,
          achievement_id: params.achievementId ?? null,
          redemption_id: null,
          amount: params.amount,
          type: 'mint',
          status: 'confirmed',
          provider: 'solana',
          transaction_signature: signature,
          token_mint: tokenConfig.tokenMint,
          wallet_public_key: user.walletPublicKey,
          error_message: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')
      const row = inserted[0] as { id: number } | number
      const txId = typeof row === 'number' ? row : row.id

      await fromTbl('token_balances', trx)
        .where('user_id', params.userId)
        .update({
          balance: db.raw('token_balances.balance + ?', [params.amount]),
          updated_at: new Date(),
        })

      return {
        transactionId: txId,
        amount: params.amount,
        status: 'confirmed' as const,
        transactionSignature: signature,
        idempotent: false,
      }
    }

    if (params.client) {
      return persist(params.client)
    }
    return db.transaction(async (trx) => persist(trx))
  }

  async getBalance(userId: string): Promise<number> {
    const user = await User.query().where('id', Number(userId)).first()
    if (!user?.walletPublicKey) {
      return 0
    }
    const mint = new PublicKey(tokenConfig.tokenMint)
    const owner = new PublicKey(user.walletPublicKey)
    const mintInfo = await getMint(this.connection, mint)
    const ata = await getAssociatedTokenAddress(mint, owner, false, TOKEN_PROGRAM_ID)
    try {
      const acc = await getAccount(this.connection, ata)
      return fromRawAmount(acc.amount, mintInfo.decimals)
    } catch {
      return 0
    }
  }

  async redeemTokens(params: RedeemTokensParams): Promise<TokenTransactionResult> {
    const user = await User.findOrFail(params.userId)
    if (!user.walletPublicKey || !user.encryptedWalletSecret) {
      throw new Error('Student wallet must exist before redeeming')
    }

    const authority = loadAuthorityKeypair()
    const studentKp = loadStudentKeypair(user)
    const mint = new PublicKey(tokenConfig.tokenMint)
    const treasury = new PublicKey(tokenConfig.treasuryPublicKey)
    const mintInfo = await getMint(this.connection, mint)
    const rawAmount = toRawAmount(params.amount, mintInfo.decimals)

    const sourceAta = await getAssociatedTokenAddress(
      mint,
      studentKp.publicKey,
      false,
      TOKEN_PROGRAM_ID
    )
    const destAta = await getAssociatedTokenAddress(mint, treasury, false, TOKEN_PROGRAM_ID)

    let sourceAcc
    try {
      sourceAcc = await getAccount(this.connection, sourceAta)
    } catch {
      sourceAcc = null
    }
    const humanBal = sourceAcc ? fromRawAmount(sourceAcc.amount, mintInfo.decimals) : 0
    if (humanBal < params.amount) {
      const inserted = await tbl('token_transactions')
        .insert({
          institution_id: params.institutionId,
          user_id: params.userId,
          achievement_id: null,
          redemption_id: params.redemptionId,
          amount: params.amount,
          type: 'redeem',
          status: 'failed',
          provider: 'solana',
          transaction_signature: null,
          token_mint: tokenConfig.tokenMint,
          wallet_public_key: user.walletPublicKey,
          error_message: 'INSUFFICIENT_BALANCE',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')
      const row = inserted[0] as { id: number } | number
      const txId = typeof row === 'number' ? row : row.id
      return {
        transactionId: txId,
        amount: params.amount,
        status: 'failed' as const,
        transactionSignature: null,
      }
    }

    const destInfo = await this.connection.getAccountInfo(destAta)
    const tx = new Transaction()
    if (!destInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          destAta,
          treasury,
          mint,
          TOKEN_PROGRAM_ID
        )
      )
    }
    tx.add(
      createTransferInstruction(
        sourceAta,
        destAta,
        studentKp.publicKey,
        rawAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    )

    let signature: string
    try {
      signature = await sendAndConfirmTransaction(this.connection, tx, [authority, studentKp], {
        commitment: 'confirmed',
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const inserted = await tbl('token_transactions')
        .insert({
          institution_id: params.institutionId,
          user_id: params.userId,
          achievement_id: null,
          redemption_id: params.redemptionId,
          amount: params.amount,
          type: 'redeem',
          status: 'failed',
          provider: 'solana',
          transaction_signature: null,
          token_mint: tokenConfig.tokenMint,
          wallet_public_key: user.walletPublicKey,
          error_message: msg.slice(0, 2000),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')
      const row = inserted[0] as { id: number } | number
      const txId = typeof row === 'number' ? row : row.id
      return {
        transactionId: txId,
        amount: params.amount,
        status: 'failed' as const,
        transactionSignature: null,
      }
    }

    const persist = async (trx?: DbTransaction) => {
      await ensureBalanceRow(params.userId, trx)
      const inserted = await tbl('token_transactions', trx)
        .insert({
          institution_id: params.institutionId,
          user_id: params.userId,
          achievement_id: null,
          redemption_id: params.redemptionId,
          amount: params.amount,
          type: 'redeem',
          status: 'confirmed',
          provider: 'solana',
          transaction_signature: signature,
          token_mint: tokenConfig.tokenMint,
          wallet_public_key: user.walletPublicKey,
          error_message: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')
      const row = inserted[0] as { id: number } | number
      const txId = typeof row === 'number' ? row : row.id

      await fromTbl('token_balances', trx)
        .where('user_id', params.userId)
        .update({
          balance: db.raw('token_balances.balance - ?', [params.amount]),
          updated_at: new Date(),
        })

      return {
        transactionId: txId,
        amount: params.amount,
        status: 'confirmed' as const,
        transactionSignature: signature,
      }
    }

    if (params.client) {
      return persist(params.client)
    }
    return db.transaction(async (trx) => persist(trx))
  }

  async getTransactionHistory(userId: string, institutionId: number): Promise<TokenLedgerRow[]> {
    const rows = await TokenTransaction.query()
      .where('user_id', Number(userId))
      .andWhere('institution_id', institutionId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
    return rows.map(mapRow)
  }

  async getInstitutionTransactionHistory(
    institutionId: number,
    options?: { page?: number; perPage?: number }
  ) {
    const page = options?.page ?? 1
    const perPage = Math.min(options?.perPage ?? 10, 100)
    const rewards = await TokenTransaction.query()
      .where('institution_id', institutionId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)

    return {
      items: rewards.all().map(mapRow),
      meta: rewards.getMeta() as unknown as Record<string, unknown>,
    }
  }
}
