import User from '#models/user'
import { userHasRole } from '#services/role_query_service'
import { normalizeRegistrationNumber } from '#services/group_upsert_service'
import { registerStudentValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'

const CLAIM_FAILURE = {
  error: {
    code: 'STUDENT_REGISTRATION_INVALID',
    message: 'Unable to complete student registration with the provided details',
  },
}

export default class StudentRegistrationController {
  async store({ request, response, serialize }: HttpContext) {
    const { email, registrationNumber, password } =
      await request.validateUsing(registerStudentValidator)

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedRegistration = normalizeRegistrationNumber(registrationNumber)
    const requestId = request.id()

    const failurePayload = {
      ...CLAIM_FAILURE,
      error: { ...CLAIM_FAILURE.error, requestId },
    }

    if (!normalizedRegistration) {
      return response.badRequest(failurePayload)
    }

    const user = await User.query().whereRaw('LOWER(email) = ?', [normalizedEmail]).first()
    if (!user) {
      return response.badRequest(failurePayload)
    }

    const isStudent = await userHasRole(user.id, 'student')
    if (!isStudent) {
      return response.badRequest(failurePayload)
    }

    if (user.accountStatus !== 'pending') {
      return response.badRequest(failurePayload)
    }

    const storedRegistration = normalizeRegistrationNumber(user.registrationNumber)
    if (
      !storedRegistration ||
      storedRegistration.toLowerCase() !== normalizedRegistration.toLowerCase()
    ) {
      return response.badRequest(failurePayload)
    }

    user.password = password
    user.accountStatus = 'active'
    user.isActive = true
    await user.save()

    const token = await User.accessTokens.create(user)

    return serialize({
      user: UserTransformer.transform(user),
      token: token.value!.release(),
    })
  }
}
