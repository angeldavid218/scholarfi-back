import FundingProgram from '#models/funding_program'
import NgoInstitution from '#models/ngo_institution'
import User from '#models/user'

export type NgoScopeResult =
  | { ok: true; ngo: NgoInstitution }
  | { ok: false; status: number; code: string; message: string }

export type OwnedProgramResult =
  | { ok: true; program: FundingProgram; ngo: NgoInstitution }
  | { ok: false; status: number; code: string; message: string }

export async function resolveNgoScope(user: User): Promise<NgoScopeResult> {
  if (!user.ngoInstitutionId) {
    return {
      ok: false,
      status: 403,
      code: 'NGO_SCOPE_REQUIRED',
      message: 'NGO admin must belong to an NGO institution',
    }
  }

  const ngo = await NgoInstitution.find(user.ngoInstitutionId)
  if (!ngo) {
    return {
      ok: false,
      status: 404,
      code: 'NGO_INSTITUTION_NOT_FOUND',
      message: 'NGO institution not found',
    }
  }

  if (!ngo.status) {
    return {
      ok: false,
      status: 403,
      code: 'NGO_INSTITUTION_INACTIVE',
      message: 'NGO institution must be active',
    }
  }

  return { ok: true, ngo }
}

export async function resolveOwnedProgram(
  user: User,
  programId: number
): Promise<OwnedProgramResult> {
  const scope = await resolveNgoScope(user)
  if (!scope.ok) {
    return scope
  }

  const program = await FundingProgram.find(programId)
  if (!program || program.ngoInstitutionId !== scope.ngo.id) {
    return {
      ok: false,
      status: 404,
      code: 'FUNDING_PROGRAM_NOT_FOUND',
      message: 'Funding program not found',
    }
  }

  return { ok: true, program, ngo: scope.ngo }
}

export function sendScopeError(
  response: { status: (code: number) => { send: (body: unknown) => unknown } },
  scope: { status: number; code: string; message: string },
  requestId: string | undefined
) {
  return response.status(scope.status).send({
    error: {
      code: scope.code,
      message: scope.message,
      requestId: requestId ?? '',
    },
  })
}
