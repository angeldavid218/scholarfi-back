import tokenConfig, { assertSolanaConfig } from '#config/token'
import type { HttpContext } from '@adonisjs/core/http'

export default class TokenHealthController {
  async show({ response }: HttpContext) {
    const mode = tokenConfig.mode
    const payload: Record<string, unknown> = {
      tokenMode: mode,
      healthy: true,
      rpcReachable: null as boolean | null,
      error: null as string | null,
    }

    if (mode === 'solana') {
      try {
        assertSolanaConfig()
        const { Connection } = await import('@solana/web3.js')
        const connection = new Connection(tokenConfig.solanaRpcUrl, 'confirmed')
        await connection.getLatestBlockhash('confirmed')
        payload.rpcReachable = true
      } catch (error) {
        payload.healthy = false
        payload.rpcReachable = false
        payload.error = error instanceof Error ? error.message : String(error)
      }
    } else {
      payload.rpcReachable = null
    }

    return response.ok({ data: payload })
  }
}
