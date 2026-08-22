import type { HttpContext } from '@adonisjs/core/http'
import {
  CnftDiplomaError,
  getDiplomaArtworkSvg,
  getDiplomaMetadataPayload,
  listStudentDiplomas,
  mintOutstandingDiploma,
  previewOutstandingDiploma,
} from '#services/cnft/cnft_diploma_service'

function institutionIdOrFail(user: { institutionId: number | null }, requestId?: string) {
  if (!user.institutionId) {
    return {
      error: {
        code: 'INSTITUTION_REQUIRED',
        message: 'User must belong to an institution',
        requestId,
      },
    }
  }
  return null
}

function diplomaErrorResponse(error: unknown, requestId?: string) {
  if (error instanceof CnftDiplomaError) {
    return {
      status: error.httpStatus,
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
        },
      },
    }
  }
  return {
    status: 500,
    body: {
      error: {
        code: 'CNFT_MINT_FAILED',
        message: error instanceof Error ? error.message : String(error),
        requestId,
      },
    },
  }
}

export default class DiplomasController {
  /**
   * GET /diplomas/preview-best — current ranking #1 and whether they already have a diploma.
   */
  async previewBest({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const missing = institutionIdOrFail(user, request.id())
    if (missing) return response.unprocessableEntity(missing)

    const payload = await previewOutstandingDiploma({
      institutionId: user.institutionId!,
      actorUserId: user.id,
    })
    return response.ok(payload)
  }

  /**
   * POST /diplomas/mint-best — mint a cNFT diploma to the current outstanding student.
   */
  async mintBest({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const missing = institutionIdOrFail(user, request.id())
    if (missing) return response.unprocessableEntity(missing)

    try {
      const result = await mintOutstandingDiploma({
        institutionId: user.institutionId!,
        actorUserId: user.id,
      })
      return response.ok(result)
    } catch (error) {
      const mapped = diplomaErrorResponse(error, request.id())
      return response.status(mapped.status).send(mapped.body)
    }
  }

  /**
   * GET /diplomas/me — diplomas minted to the authenticated student.
   */
  async me({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const missing = institutionIdOrFail(user, request.id())
    if (missing) return response.unprocessableEntity(missing)

    const diplomas = await listStudentDiplomas(user.id, user.institutionId!)
    return response.ok({ diplomas })
  }

  /**
   * GET /public/diplomas/:id — Metaplex metadata JSON (no auth).
   */
  async metadata({ params, response }: HttpContext) {
    const raw = String(params.id ?? '').replace(/\.(json|svg)$/i, '')
    const id = Number(raw)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        error: { code: 'INVALID_DIPLOMA_ID', message: 'Diploma id is invalid' },
      })
    }

    const payload = await getDiplomaMetadataPayload(id)
    if (!payload) {
      return response.notFound({
        error: { code: 'DIPLOMA_NOT_FOUND', message: 'Diploma metadata not found' },
      })
    }

    return response.json(payload)
  }

  /**
   * GET /public/diplomas/:id.svg — Personalized diploma artwork (no auth).
   */
  async artwork({ params, response }: HttpContext) {
    const raw = String(params.id ?? '').replace(/\.svg$/i, '')
    const id = Number(raw)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        error: { code: 'INVALID_DIPLOMA_ID', message: 'Diploma id is invalid' },
      })
    }

    const svg = await getDiplomaArtworkSvg(id)
    if (!svg) {
      return response.notFound({
        error: { code: 'DIPLOMA_NOT_FOUND', message: 'Diploma artwork not found' },
      })
    }

    response.header('Content-Type', 'image/svg+xml; charset=utf-8')
    response.header('Cache-Control', 'public, max-age=3600')
    return response.send(svg)
  }
}
