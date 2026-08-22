import { BaseCommand } from '@adonisjs/core/ace'
import tokenConfig, { assertCnftTreeSetupConfig } from '#config/token'
import { createCnftUmi, cnftIdentityPublicKey } from '#services/cnft/umi_client'
import {
  crearArbol,
  usarArbolExistente,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_BUFFER_SIZE,
  DEFAULT_CANOPY_DEPTH,
} from '#services/cnft/cnft_funciones'

export default class CnftSetupTree extends BaseCommand {
  static commandName = 'cnft:setup-tree'
  static description =
    'Create (or validate) the Bubblegum merkle tree for outstanding-student cNFT diplomas'
  static options = {
    startApp: true,
  }

  async run() {
    assertCnftTreeSetupConfig()

    const umi = createCnftUmi()
    this.logger.info(`RPC: ${tokenConfig.solanaRpcUrl}`)
    this.logger.info(`Tree creator / payer: ${cnftIdentityPublicKey(umi)}`)
    this.logger.info(
      `Tree params: maxDepth=${DEFAULT_MAX_DEPTH} maxBufferSize=${DEFAULT_MAX_BUFFER_SIZE} canopyDepth=${DEFAULT_CANOPY_DEPTH}`
    )
    this.logger.info(
      'SOLANA_RPC_URL must support DAS (Helius or similar). api.devnet.solana.com does not.'
    )

    if (tokenConfig.cnftMerkleTree) {
      this.logger.info(`CNFT_MERKLE_TREE already set: ${tokenConfig.cnftMerkleTree}`)
      const existing = await usarArbolExistente(umi, tokenConfig.cnftMerkleTree)
      this.logger.success(
        `Tree is valid. minted=${existing.numMinted} capacity=${existing.capacity}`
      )
      return
    }

    this.logger.info('Creating Bubblegum V2 tree (this spends SOL rent on the payer)...')
    const created = await crearArbol(umi)
    this.logger.success(`Tree created. tx=${created.signature}`)
    this.logger.info('--- Pin this in .env ---')
    this.logger.info(`CNFT_MERKLE_TREE=${created.merkleTree}`)
  }
}
