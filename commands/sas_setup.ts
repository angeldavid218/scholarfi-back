import { BaseCommand } from '@adonisjs/core/ace'
import {
  createCredentialIfNeeded,
  createMilestoneSchemaIfNeeded,
  createSchemaIfNeeded,
  createSasConnection,
  explorerAddressUrl,
  explorerTxUrl,
  getSasCredentialName,
  getSasMilestoneSchemaName,
  getSasSchemaName,
  getSasSchemaVersion,
  loadSasAuthorityKeypair,
  loadSasAuthorizedSignerKeypair,
  sasProgramId,
} from '#services/attestation/sas_attestation_client'

export default class SasSetup extends BaseCommand {
  static commandName = 'sas:setup'
  static description =
    'Create SAS Credential + achievement + milestone schemas on Devnet (idempotent)'
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
    this.logger.info(`Milestone schema: ${getSasMilestoneSchemaName()}`)

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
      this.logger.success(`Achievement schema created: ${schema.signature}`)
    } else {
      this.logger.info('Achievement schema already exists')
    }

    const milestone = await createMilestoneSchemaIfNeeded({
      connection,
      authority,
      credentialPda: cred.credentialPda,
    })
    if (milestone.created) {
      this.logger.success(`Milestone schema created: ${milestone.signature}`)
    } else {
      this.logger.info('Milestone schema already exists')
    }

    this.logger.info('--- Pin these in .env ---')
    this.logger.info(`SAS_CREDENTIAL_PDA=${cred.credentialPda}`)
    this.logger.info(`SAS_SCHEMA_PDA=${schema.schemaPda}`)
    this.logger.info(`SAS_MILESTONE_SCHEMA_PDA=${milestone.schemaPda}`)

    this.logger.info('--- Explorer ---')
    this.logger.info(`credential: ${explorerAddressUrl(cred.credentialPda)}`)
    this.logger.info(`schema: ${explorerAddressUrl(schema.schemaPda)}`)
    this.logger.info(`milestone schema: ${explorerAddressUrl(milestone.schemaPda)}`)
    if (cred.signature) this.logger.info(`credential tx: ${explorerTxUrl(cred.signature)}`)
    if (schema.signature) this.logger.info(`schema tx: ${explorerTxUrl(schema.signature)}`)
    if (milestone.signature) this.logger.info(`milestone tx: ${explorerTxUrl(milestone.signature)}`)
  }
}
