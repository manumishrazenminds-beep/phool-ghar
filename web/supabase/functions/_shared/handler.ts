import { preflight } from './cors.ts'
import { EnvError } from './env.ts'
import { HttpError, fail, failFromError, newRequestId } from './http.ts'
import { ctxFromRequest, makeLogger, type Logger } from './logger.ts'

export interface HandlerCtx {
  requestId: string
  log: Logger
  setActor: (id: string) => void
}

/**
 * Wraps a function body with: CORS preflight, method allow-list, request id, uniform error
 * envelope, and structured logging of unexpected failures. Internal details never reach the client.
 */
export function createHandler(
  source: string,
  methods: string[],
  body: (req: Request, ctx: HandlerCtx) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const pre = preflight(req)
    if (pre) return pre
    const requestId = newRequestId()
    const lctx = ctxFromRequest(source, req, requestId)
    const log = makeLogger(lctx)
    const ctx: HandlerCtx = { requestId, log, setActor: (id) => { lctx.actor = id } }
    let res: Response
    try {
      if (!methods.includes(req.method)) {
        res = fail(req, 405, 'method_not_allowed', `Use ${methods.join(' or ')}`, { headers: { Allow: methods.join(', ') } })
      } else {
        res = await body(req, ctx)
      }
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.status >= 500) await log.error(e.code, e.message, { status: e.status })
        res = failFromError(req, e)
      } else if (e instanceof EnvError) {
        await log.error('not_configured', e.message, { env: e.envName })
        res = fail(req, 503, 'not_configured', 'This service is not configured yet', { retryAfterSec: 60 })
      } else {
        await log.error('internal_error', (e as Error)?.message ?? String(e), { name: (e as Error)?.name })
        res = fail(req, 500, 'internal_error', 'Something went wrong. Please try again')
      }
    }
    res.headers.set('X-Request-Id', requestId)
    return res
  }
}
