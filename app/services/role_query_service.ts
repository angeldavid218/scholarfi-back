import db from '@adonisjs/lucid/services/db'

export async function userHasRole(userId: number, roleKey: string): Promise<boolean> {
  const row = await db
    .from('user_roles')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .where('user_roles.user_id', userId)
    .where('roles.key', roleKey)
    .first()

  return row !== undefined && row !== null
}

export async function getUserRoleKeys(userId: number): Promise<string[]> {
  const rows = await db
    .from('user_roles')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .where('user_roles.user_id', userId)
    .select('roles.key as roleKey')
    .orderBy('roles.key', 'asc')

  return rows.map((row) => row.roleKey as string)
}
