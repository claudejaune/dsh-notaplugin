/**
 * End-to-end tests for @claudejaune/dsh-ocode-go.
 *
 * These run the built plugin against a real Cordis context and a real HTTP
 * server that behaves like the OpenCode gateway: it answers
 * `400 MissingSessionID` for any request without `x-opencode-session` and 200
 * with it. Nothing is mocked at the layer the feature operates on, so a pass
 * means the plugin itself put a working header on the wire.
 *
 * Run with: pnpm --filter @claudejaune/dsh-ocode-go test
 */

import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import { Context } from '@deepseek-ai/cordis'
import * as plugin from '../lib/index.js'

/**
 * Node's real `fetch`, captured before any test installs a wrapper, so a test
 * transport can reach the local gateway without passing through the plugin again.
 */
const REAL_FETCH = globalThis.fetch

/** Mutable per-test view of what the `agents` service reports. */
function makeAgentsStub() {
  const state = { initiator: undefined, throws: false }
  return {
    state,
    service: {
      currentInitiator() {
        if (state.throws) throw new Error('agent initiator scope is disposed')
        return state.initiator
      },
    },
  }
}

/**
 * A gateway that rejects any request lacking the session header, exactly as the
 * real OpenCode gateway does.
 */
async function startGateway() {
  const received = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const session = req.headers['x-opencode-session']
      received.push({ url: req.url, method: req.method, session, body })
      if (session === undefined) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'MissingSessionID' }))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return {
    received,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  }
}

/**
 * Boot a real Cordis context with the plugin applied.
 *
 * @param originalFetch - what `globalThis.fetch` is when the plugin mounts. The
 *   plugin wraps this, so every request the test makes goes through the plugin.
 * @returns the fiber, the agents stub, and captured log lines.
 */
async function boot(originalFetch) {
  const ctx = new Context()
  const agents = makeAgentsStub()
  const logs = []
  ctx.provide('agents', agents.service)
  ctx.logger.exporter({ export: message => logs.push(message) })
  const previous = globalThis.fetch
  if (originalFetch !== undefined) globalThis.fetch = originalFetch
  const fiber = await ctx.plugin(plugin)
  return { ctx, fiber, agents, logs, restore: () => { globalThis.fetch = previous } }
}

/** A recording stand-in for the transport, capturing what the wrapper passed down. */
function recordingFetch() {
  const calls = []
  const fn = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    calls.push({ url, headers })
    return new Response('{}', { status: 200 })
  }
  return { fn, calls }
}

describe('host matching', () => {
  afterEach(() => { globalThis.fetch = originalGlobal })
  const originalGlobal = globalThis.fetch

  test('stamps the gateway host', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, agents, restore } = await boot(fn)
    agents.state.initiator = { session: { id: 'session-abc' } }

    await globalThis.fetch('https://opencode.ai/zen/go/v1/chat/completions', { method: 'POST' })

    assert.equal(calls[0].headers.get('x-opencode-session'), 'session-abc')
    await fiber.dispose()
    restore()
  })

  test('stamps a gateway subdomain', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, agents, restore } = await boot(fn)
    agents.state.initiator = { session: { id: 'session-sub' } }

    await globalThis.fetch('https://edge.opencode.ai/zen/v1/chat/completions', { method: 'POST' })

    assert.equal(calls[0].headers.get('x-opencode-session'), 'session-sub')
    await fiber.dispose()
    restore()
  })

  test('leaves other providers untouched', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, agents, restore } = await boot(fn)
    agents.state.initiator = { session: { id: 'session-nope' } }

    await globalThis.fetch('https://api.openai.com/v1/chat/completions', { method: 'POST' })

    assert.equal(calls[0].headers.get('x-opencode-session'), null)
    await fiber.dispose()
    restore()
  })

  test('does not treat a lookalike suffix as the gateway', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, agents, restore } = await boot(fn)
    agents.state.initiator = { session: { id: 'session-spoof' } }

    await globalThis.fetch('https://notopencode.ai/v1/chat/completions', { method: 'POST' })

    assert.equal(calls[0].headers.get('x-opencode-session'), null)
    await fiber.dispose()
    restore()
  })

  test('passes a non-absolute input through without throwing', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, restore } = await boot(fn)

    await globalThis.fetch('/relative/path', { method: 'POST' })

    assert.equal(calls[0].headers.get('x-opencode-session'), null)
    await fiber.dispose()
    restore()
  })
})

describe('header value resolution', () => {
  const originalGlobal = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalGlobal })

  test('mirrors an existing session-affinity header when no Agent initiated the request', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, restore } = await boot(fn)

    await globalThis.fetch('https://opencode.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'x-session-id': 'affinity-77' },
    })

    assert.equal(calls[0].headers.get('x-opencode-session'), 'affinity-77')
    await fiber.dispose()
    restore()
  })

  test('prefers the initiating Agent over an affinity header', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, agents, restore } = await boot(fn)
    agents.state.initiator = { session: { id: 'session-real' } }

    await globalThis.fetch('https://opencode.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'x-session-id': 'affinity-77' },
    })

    assert.equal(calls[0].headers.get('x-opencode-session'), 'session-real')
    await fiber.dispose()
    restore()
  })

  test('passes through and warns once when no value can be found', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, logs, restore } = await boot(fn)

    await globalThis.fetch('https://opencode.ai/v1/a', { method: 'POST' })
    await globalThis.fetch('https://opencode.ai/v1/b', { method: 'POST' })

    assert.equal(calls[0].headers.get('x-opencode-session'), null)
    assert.equal(calls[1].headers.get('x-opencode-session'), null)
    // Cordis exporters default to an INFO threshold, so the plugin reports at
    // `error` to guarantee the operator sees it.
    const diagnostics = logs.filter(message => message.type === 'error')
    assert.equal(diagnostics.length, 1, 'the diagnostic must not repeat per request')
    await fiber.dispose()
    restore()
  })

  test('survives a disposed agents registry', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, agents, restore } = await boot(fn)
    agents.state.throws = true

    await globalThis.fetch('https://opencode.ai/v1/chat/completions', { method: 'POST' })

    assert.equal(calls[0].headers.get('x-opencode-session'), null)
    await fiber.dispose()
    restore()
  })
})

describe('precedence', () => {
  const originalGlobal = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalGlobal })

  test('never clobbers a session header the caller already set', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, agents, restore } = await boot(fn)
    agents.state.initiator = { session: { id: 'session-ours' } }

    await globalThis.fetch('https://opencode.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'x-opencode-session': 'caller-value' },
    })

    assert.equal(calls[0].headers.get('x-opencode-session'), 'caller-value')
    await fiber.dispose()
    restore()
  })
})

describe('input shapes', () => {
  const originalGlobal = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalGlobal })

  test('stamps a URL object input', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, agents, restore } = await boot(fn)
    agents.state.initiator = { session: { id: 'session-url-obj' } }

    await globalThis.fetch(new URL('https://opencode.ai/v1/chat/completions'), { method: 'POST' })

    assert.equal(calls[0].headers.get('x-opencode-session'), 'session-url-obj')
    await fiber.dispose()
    restore()
  })

  test('stamps a Request input and preserves its method and body', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, agents, restore } = await boot(fn)
    agents.state.initiator = { session: { id: 'session-request' } }

    const request = new Request('https://opencode.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [] }),
    })
    await globalThis.fetch(request)

    assert.equal(calls[0].headers.get('x-opencode-session'), 'session-request')
    assert.equal(calls[0].headers.get('content-type'), 'application/json')
    await fiber.dispose()
    restore()
  })

  test('stamps a Request input that carries its own headers and no init', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, restore } = await boot(fn)

    const request = new Request('https://opencode.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'x-session-id': 'req-affinity' },
      body: '{}',
    })
    await globalThis.fetch(request)

    assert.equal(calls[0].headers.get('x-opencode-session'), 'req-affinity')
    await fiber.dispose()
    restore()
  })
})

describe('lifecycle', () => {
  const originalGlobal = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalGlobal })

  test('disposal restores the original fetch', async () => {
    const { fn } = recordingFetch()
    const { fiber, restore } = await boot(fn)

    assert.notEqual(globalThis.fetch, fn, 'the plugin must have installed its wrapper')
    await fiber.dispose()

    assert.equal(globalThis.fetch, fn, 'disposal must restore the wrapped function')
    restore()
  })

  test('a second apply does not stack a wrapper', async () => {
    const { fn, calls } = recordingFetch()
    const { fiber, restore } = await boot(fn)
    const layered = globalThis.fetch

    // Re-apply on top of the live wrapper, as a hot reload would.
    const ctx2 = new Context()
    ctx2.provide('agents', { currentInitiator: () => ({ session: { id: 'second' } }) })
    await ctx2.plugin(plugin)

    assert.equal(globalThis.fetch, layered, 'the existing layer must be kept, not wrapped again')
    await fiber.dispose()
    restore()
  })
})

describe('gateway contract over real HTTP', () => {
  const originalGlobal = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalGlobal })

  /**
   * A transport that sends any request to the local gateway while preserving the
   * URL it was given, so the plugin still sees an `opencode.ai` host and the
   * gateway still sees the real header.
   */
  function routeToGateway(baseUrl) {
    return async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const target = new URL(url)
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      const body = init?.body ?? (input instanceof Request ? await input.text() : undefined)
      return REAL_FETCH(`${baseUrl}${target.pathname}${target.search}`, {
        method: init?.method ?? 'GET',
        headers,
        body,
      })
    }
  }

  test('the gateway rejects an unstamped request and accepts a stamped one', async () => {
    const gateway = await startGateway()
    const transport = routeToGateway(gateway.baseUrl)

    // Without the plugin: the gateway answers exactly as OpenCode does.
    const bare = await transport('https://opencode.ai/zen/go/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    })
    assert.equal(bare.status, 400)
    assert.equal((await bare.json()).error, 'MissingSessionID')

    // With the plugin: the same request succeeds.
    const { fiber, agents, restore } = await boot(transport)
    agents.state.initiator = { session: { id: 'session-e2e' } }

    const ok = await globalThis.fetch('https://opencode.ai/zen/go/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    })
    assert.equal(ok.status, 200)
    assert.deepEqual(await ok.json(), { ok: true })
    assert.equal(gateway.received.at(-1).session, 'session-e2e')

    await fiber.dispose()
    await gateway.close()
    restore()
  })
})
