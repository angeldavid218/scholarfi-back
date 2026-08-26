import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import { randomBytes } from 'node:crypto'

async function ensureSuperAdminRole(): Promise<number> {
  const existing = await db.from('roles').where('key', 'super_admin').first()
  if (existing) return existing.id as number

  const inserted = await db
    .table('roles')
    .insert({
      key: 'super_admin',
      label: 'Super Admin',
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')

  const row = inserted[0] as { id: number } | number
  return typeof row === 'number' ? row : row.id
}

export default class PartnerBootstrapCloudCampus extends BaseCommand {
  static commandName = 'partner:bootstrap-cloud-campus'
  static description = 'Create or update the Cloud Campus super_admin integration account'
  static options = {
    startApp: true,
  }

  @args.string({ description: 'Service account email' })
  declare email: string

  @flags.string({ description: 'Account password (generated if omitted)' })
  declare password?: string

  async run() {
    const normalizedEmail = this.email.trim().toLowerCase()
    const password = this.password ?? randomBytes(18).toString('base64url')

    const existingUser = await User.findBy('email', normalizedEmail)
    if (existingUser) {
      existingUser.password = password
      existingUser.fullName = existingUser.fullName ?? 'Cloud Campus Integration'
      existingUser.isActive = true
      await existingUser.save()
    } else {
      await User.create({
        email: normalizedEmail,
        password,
        fullName: 'Cloud Campus Integration',
        institutionId: null,
        isActive: true,
      })
    }

    const user = await User.findByOrFail('email', normalizedEmail)
    const roleId = await ensureSuperAdminRole()

    await db
      .from('user_roles')
      .where('user_id', user.id)
      .delete()

    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: roleId,
      created_at: new Date(),
      updated_at: null,
    })

    this.logger.success('Cloud Campus integration account ready')
    this.logger.info(`Email: ${normalizedEmail}`)
    if (!this.password) {
      this.logger.warning(`Generated password (store securely): ${password}`)
    } else {
      this.logger.info('Password set from --password flag')
    }
    this.logger.info('Role: super_admin')
    this.logger.info('Use POST /api/v1/auth/login to obtain a Bearer token')
  }
}
