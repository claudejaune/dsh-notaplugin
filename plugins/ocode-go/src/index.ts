/**
 * @claudejaune/dsh-ocode-go — keeps an OpenCode Go subscription usable from the
 * DeepSeek Harness.
 *
 * The OpenCode managed-inference gateway rejects any inference request that does
 * not carry a stable per-conversation `x-opencode-session` header, answering
 * `400 MissingSessionID` otherwise. The harness passes the conversation id down
 * to the model layer, but the pi-ai library it routes through never emits that
 * header name, so every OpenCode route breaks unless something stamps it.
 *
 * This plugin is that something. For the lifetime of its fiber it wraps
 * `globalThis.fetch` and adds the header to requests aimed at the OpenCode
 * gateway, taking the value from the Agent that initiated the request. Requests
 * to any other host pass through untouched, and the original `fetch` is
 * restored when the plugin stops, updates, or uninstalls.
 *
 * Why a transport wrapper rather than a harness seam: the header belongs to a
 * request assembled deep inside the provider adapter, which a third-party
 * package cannot reach without a change to the published harness packages.
 * Wrapping the transport the adapter already calls keeps the whole feature in
 * this package. pi-ai reads `globalThis.fetch` per request rather than
 * capturing it at module load, so a wrapper installed at boot is in effect for
 * every request that follows.
 *
 * Known limit: pi-ai routes WebSocket transports around `fetch`, so a profile
 * that forces `transport: websocket` on an OpenCode route is not covered. The
 * OpenCode gateway serves HTTP APIs only.
 */

import type { Context } from '@deepseek-ai/cordis'

/** The managed-inference gateway whose endpoints require the session header. */
const OPENCODE_HOST = 'opencode.ai'

/** The header the gateway names in its `400 MissingSessionID` response. */
const SESSION_HEADER = 'x-opencode-session'

/**
 * Session-affinity headers pi-ai may already have placed on the request. When no
 * initiating Agent is reachable, one of these still identifies the same
 * conversation, so the gateway gets a stable per-conversation value rather than
 * nothing.
 */
const AFFINITY_HEADERS = ['x-session-id', 'x-session-affinity', 'session_id'] as const

/** Marks an already-wrapped `fetch` so a reload never stacks a second layer. */
const PATCH_MARK = Symbol.for('@claudejaune/dsh-ocode-go.patched')

/** Minimal structural view of the harness Agent, keeping this package dependency-light. */
interface AgentLike {
  readonly session?: { readonly id?: unknown }
}

/** Minimal structural view of the `agents` service this plugin reads. */
interface AgentsServiceLike {
  currentInitiator?(): AgentLike | undefined
}

type FetchFn = typeof globalThis.fetch

/** Whether `value` is a `Request`, without assuming the global exists everywhere. */
function isRequest(value: unknown): value is Request {
  return typeof Request === 'function' && value instanceof Request
}

/** The absolute URL of one `fetch` input, or `undefined` when it names none. */
function requestUrl(input: Parameters<FetchFn>[0]): string | undefined {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (isRequest(input)) return input.url
  return undefined
}

/**
 * Whether one absolute URL points at the OpenCode gateway. Subdomains count: the
 * gateway is served from more than one host behind the same domain.
 */
function isOpencodeUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname
    return host === OPENCODE_HOST || host.endsWith(`.${OPENCODE_HOST}`)
  } catch {
    // A non-absolute URL cannot name the gateway.
    return false
  }
}

/**
 * The conversation id of the Agent that initiated the current request.
 *
 * The harness carries the initiating Agent in async-local storage, so it is
 * reachable here even though the call passes through the adapter and the
 * provider library. The registry throws once its own fiber is disposed, which a
 * late in-flight request must not turn into a failure.
 */
function initiatorSessionId(ctx: Context): string | undefined {
  const agents = ctx.get('agents') as AgentsServiceLike | undefined
  if (typeof agents?.currentInitiator !== 'function') return undefined
  let agent: AgentLike | undefined
  try {
    agent = agents.currentInitiator()
  } catch {
    return undefined
  }
  const id = agent?.session?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/** A conversation-identifying value already on the request, if any affinity header carries one. */
function mirrorAffinity(headers: Headers): string | undefined {
  for (const name of AFFINITY_HEADERS) {
    const value = headers.get(name)
    if (value !== null && value.length > 0) return value
  }
  return undefined
}

/** The headers a request will carry, from whichever places `fetch` accepts them. */
function headersFor(
  input: Parameters<FetchFn>[0],
  init: Parameters<FetchFn>[1],
): Headers {
  if (init?.headers !== undefined) return new Headers(init.headers)
  if (isRequest(input)) return new Headers(input.headers)
  return new Headers()
}

/**
 * Build the wrapped `fetch`.
 *
 * @param original - the `fetch` this plugin replaces, called for every request.
 * @param ctx - this plugin's context, source of the initiating Agent.
 * @param warnOnce - emits at most one diagnostic for the whole fiber.
 */
function wrapFetch(
  original: FetchFn,
  ctx: Context,
  warnOnce: (message: string) => void,
): FetchFn {
  function patched(
    this: unknown,
    input: Parameters<FetchFn>[0],
    init?: Parameters<FetchFn>[1],
  ): ReturnType<FetchFn> {
    const call = (
      nextInput: Parameters<FetchFn>[0],
      nextInit: Parameters<FetchFn>[1],
    ): ReturnType<FetchFn> =>
      Reflect.apply(original, this ?? globalThis, [nextInput, nextInit]) as ReturnType<FetchFn>

    const url = requestUrl(input)
    if (url === undefined || !isOpencodeUrl(url)) return call(input, init)

    const headers = headersFor(input, init)
    // Never clobber: a host that already stamps this header keeps its own value.
    if (headers.has(SESSION_HEADER)) return call(input, init)

    const value = initiatorSessionId(ctx) ?? mirrorAffinity(headers)
    if (value === undefined) {
      warnOnce(
        `request to ${url} has no initiating Agent and no session-affinity header; `
        + 'the OpenCode gateway will reject it. This means the request was made outside '
        + 'an Agent turn — report it if you see it during normal conversation.',
      )
      return call(input, init)
    }

    headers.set(SESSION_HEADER, value)
    // A Request input carries method, body, and its own headers; rebuilding it
    // with the merged headers is the only way to add one without losing the rest.
    if (isRequest(input)) return call(new Request(input, { ...init, headers }), init)
    return call(input, { ...init, headers })
  }

  Object.defineProperty(patched, PATCH_MARK, { value: true, enumerable: false })
  return patched as FetchFn
}

export const name = 'ocode-go'

/** The conversation id comes from the Agent registry, so this plugin cannot work without it. */
export const inject = ['agents']

export function apply(ctx: Context): void {
  const logger = ctx.logger('ocode-go')
  const original = globalThis.fetch

  if (typeof original !== 'function') {
    // `error` rather than `warn`: Cordis exporters default to an INFO threshold,
    // so a warn never reaches the operator. This condition means the plugin
    // cannot do its job at all.
    logger.error('globalThis.fetch is unavailable; OpenCode routes will not be stamped')
    return
  }

  if ((original as { [PATCH_MARK]?: boolean })[PATCH_MARK] === true) {
    // A hot reload landed on top of this plugin's own wrapper. Keeping the
    // existing layer avoids stacking one wrapper per reload.
    return
  }

  let warned = false
  const warnOnce = (message: string): void => {
    if (warned) return
    warned = true
    logger.error(message)
  }

  const patched = wrapFetch(original, ctx, warnOnce)

  ctx.effect(() => {
    globalThis.fetch = patched
    return () => {
      // Restore only our own layer, so a wrapper installed above us during this
      // fiber's life is left in place rather than silently removed.
      if (globalThis.fetch === patched) globalThis.fetch = original
    }
  }, 'ocode-go.fetch-interceptor')

  logger.info('stamping x-opencode-session on requests to the OpenCode gateway')
}
