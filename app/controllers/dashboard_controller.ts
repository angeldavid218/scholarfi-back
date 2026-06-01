import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

export default class DashboardController {
  async summary({ response }: HttpContext) {
    const [
      totalSchoolsRow,
      totalTeachersRow,
      totalStudentsRow,
      totalTasksRedeemedRow,
      completedTasksRow,
      validatedTasksRow,
      pendingValidationsRow,
    ] = await Promise.all([
      db.from('institutions').count('* as total').first(),
      db
        .from('user_roles')
        .innerJoin('roles', 'roles.id', 'user_roles.role_id')
        .where('roles.key', 'teacher')
        .count('* as total')
        .first(),
      db
        .from('user_roles')
        .innerJoin('roles', 'roles.id', 'user_roles.role_id')
        .where('roles.key', 'student')
        .count('* as total')
        .first(),
      db.from('reward_transactions').count('* as total').first(),
      db.from('submissions').where('status', 'approved').count('* as total').first(),
      db.from('submissions').where('status', 'validated').count('* as total').first(),
      db.from('submissions').where('status', 'pending').count('* as total').first(),
    ])

    return response.ok({
      data: {
        totalSchools: Number(totalSchoolsRow?.total ?? 0),
        totalTeachers: Number(totalTeachersRow?.total ?? 0),
        totalStudents: Number(totalStudentsRow?.total ?? 0),
        totalTasksRedeemed: Number(totalTasksRedeemedRow?.total ?? 0),
        completedTasks: Number(completedTasksRow?.total ?? 0),
        validatedTasks: Number(validatedTasksRow?.total ?? 0),
        pendingValidations: Number(pendingValidationsRow?.total ?? 0),
      },
    })
  }
}
