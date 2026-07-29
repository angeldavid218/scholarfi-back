import { BaseCommand } from '@adonisjs/core/ace'
import {
  createCredentialIfNeeded,
  createSchemaIfNeeded,
  createSasConnection,
  explorerAddressUrl,
  explorerTxUrl,
  getSasCredentialName,
  getSasSchemaName,
  getSasSchemaVersion,
  loadSasAuthorityKeypair,
  loadSasAuthorizedSignerKeypair,
  sasProgramId,
} from '#services/attestation/sas_attestation_client'

export default class SasSetup extends BaseCommand {
  static commandName = 'sas:setup'
  static description =
    'Create SAS Credential + scholarfi.achievement.v1 schema on Devnet (idempotent)'
  static options = {
    startApp: true,
  }

  async run() {
    const connection = createSasConnection()
    const authority = loadSasAuthorityKeypair()
    const authorizedSigner = loadSasAuthorizedSignerKeypair()

    this.logger.info(`RPC: ${connection.rpcEndpoint}`)
    this.logger.info(`SAS program: ${sasProgramId()}`)
    this.logger.info(`Authority: ${authority.publicKey.toBase58()}`)
    this.logger.info(`Authorized signer: ${authorizedSigner.publicKey.toBase58()}`)
    this.logger.info(`Credential name: ${getSasCredentialName()}`)
    this.logger.info(`Schema: ${getSasSchemaName()} v${getSasSchemaVersion()}`)

    const cred = await createCredentialIfNeeded({
      connection,
      authority,
      authorizedSigner,
    })
    if (cred.created) {
      this.logger.success(`Credential created: ${cred.signature}`)
    } else {
      this.logger.info('Credential already exists')
    }

    const schema = await createSchemaIfNeeded({
      connection,
      authority,
      credentialPda: cred.credentialPda,
    })
    if (schema.created) {
      this.logger.success(`Schema created: ${schema.signature}`)
    } else {
      this.logger.info('Schema already exists')
    }

    this.logger.info('--- Pin these in .env ---')
    this.logger.info(`SAS_CREDENTIAL_PDA=${cred.credentialPda}`)
    this.logger.info(`SAS_SCHEMA_PDA=${schema.schemaPda}`)

    this.logger.info('--- Explorer ---')
    this.logger.info(`credential: ${explorerAddressUrl(cred.credentialPda)}`)
    this.logger.info(`schema: ${explorerAddressUrl(schema.schemaPda)}`)
    if (cred.signature) this.logger.info(`credential tx: ${explorerTxUrl(cred.signature)}`)
    if (schema.signature) this.logger.info(`schema tx: ${explorerTxUrl(schema.signature)}`)
  }
}
