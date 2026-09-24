# @claudejaune/dsh-ocode-go

Use your **OpenCode Go subscription** from the DeepSeek Harness.

The OpenCode managed-inference gateway requires every inference request to carry a
stable per-conversation `x-opencode-session` header. Without it the gateway
answers `400 MissingSessionID` and the conversation dies immediately. The harness
knows the conversation id but the model library it routes through never emits that
header name, so OpenCode routes are broken out of the box.

This plugin fixes that. Install it and OpenCode Go works.

## Install

```sh
dsh plugin --profile web add "@claudejaune/dsh-ocode-go"
```

Restart `dsh`. That is the whole installation.

> **Note for git installs:** pnpm ≥10 blocks build scripts of GitHub-installed
> packages by default. The *first* install attempt fails and prints an
> `allowBuilds` key — paste it into the profile's `pnpm-workspace.yaml` as it
> tells you, then run the same command again. One-time, copy-paste.

## Configuration

**None. By design.**

There are no settings entries, no toggles, no environment variables. The plugin
either runs or it does not, and adding or removing the plugin row is that choice.
A header that must be present on every request to one specific gateway is not a
per-deployment tunable, so there is nothing to tune.

The plugin is inert unless you actually talk to the OpenCode gateway. Installing it
alongside DeepSeek, OpenAI, Anthropic, or anything else changes nothing for those
providers.

## How it works

For the lifetime of its plugin fiber the package wraps `globalThis.fetch` and:

1. checks whether the request targets `opencode.ai` or a subdomain of it;
2. takes the conversation id from the Agent that initiated the request;
3. adds `x-opencode-session` with that value;
4. restores the original `fetch` when the plugin stops, updates, or uninstalls.

Requests to every other host pass through byte-for-byte.

Three properties worth knowing:

- **It never overwrites.** If something already set `x-opencode-session`, that
  value is kept. This makes the plugin safe to run alongside a harness that stamps
  the header itself — no double-stamping, no conflict.
- **It has a fallback.** If no initiating Agent is reachable, the plugin mirrors a
  session-affinity header the model library already put on the request
  (`x-session-id`, `x-session-affinity`, or `session_id`), so the gateway still
  gets a stable per-conversation value.
- **It tells you when it cannot help.** If neither source yields a value, the
  request goes out unstamped and the plugin logs one `error` explaining why. It
  logs once per session, not once per request.

## Known limitations

- **WebSocket transports are not covered.** The model library routes WebSocket
  around `fetch`, so a profile that forces `transport: websocket` on an OpenCode
  route will not be stamped. The OpenCode gateway serves HTTP APIs only, so this
  does not affect normal use.
- **A gateway behind an unrelated hostname is not recognized.** Matching is by
  `opencode.ai` and its subdomains. If you proxy OpenCode through your own host,
  set the header yourself via the route's `headers` — and note that a static value
  there pins one id across all conversations, which costs you the gateway's
  routing and prompt-cache affinity.

## Missing models? That is not this plugin

A model the gateway serves but the harness's picker does not list is a **catalog
staleness** problem, and it lives in `@deepseek-ai/dsh-llm-pi-ai`, not here. This
plugin only stamps the session header; it never touches which models a route
serves.

The reason, in one paragraph: a route's served models are the installed pi-ai
catalog for that route key, *overridden* by the profile's own `models` list
(`resolveRouteModels()` in `llm-pi-ai`). Those two are the only sources. A
third-party plugin has no hook that adds a model to a route owned by another
adapter plugin, and "Fetch available models" on the Models page answers a
*catalog* route from the bundled snapshot rather than from the endpoint — so a
model newer than the installed pi-ai release cannot appear, even though
`GET https://opencode.ai/zen/go/v1/models` returns it.

Two things a user can do today:

- **Hand-declare it.** Add the id to the route's `models` list. If the installed
  catalog does not describe that id, the entry needs the route to state `api`
  and `baseURL` too. Put those models on their **own route** instead of appending
  to a catalog route: a route-level `api` wins over every catalog model's own
  protocol, so appending it to `opencode-go` silently moves `qwen3.8-flash` and
  `minimax-m3` from `anthropic-messages` to `/chat/completions`.

  ```yaml
  llm-pi-ai:
    providers:
      opencode-go: { …leave as is… }
      opencode-go-new:
        displayName: OpenCode Go · New
        apiKeyEnv: OPENCODE_GO_API_KEY
        api: openai-completions
        baseURL: https://opencode.ai/zen/go/v1
        models:
          - id: deepseek-v4.1-flash
            name: DeepSeek V4.1 Flash
            contextWindow: 1000000
            maxTokens: 384000
            input: [text, image]
            reasoningEfforts: { off: null, low: low, high: high, max: max }
  ```

- **Or fix the cause upstream.** Bump `@earendil-works/pi-ai` to a release whose
  catalog carries the id, or make catalog-route discovery probe the endpoint
  instead of short-circuiting to the snapshot. Both are `llm-pi-ai` changes.

## Why a fetch wrapper rather than a harness change

The header belongs to a request assembled deep inside the provider adapter. A
third-party package cannot reach that point without a new seam in the published
`@deepseek-ai/dsh-llm` and `@deepseek-ai/dsh-llm-pi-ai` packages. Wrapping the
transport the adapter already calls keeps the entire feature inside this package,
with nothing to wait on upstream.

The model library reads `globalThis.fetch` per request rather than capturing it at
module load, so a wrapper installed at boot is in effect for every request that
follows.

## Verify

See [`docs/VERIFY.md`](docs/VERIFY.md) for a step-by-step check against a stock
harness that proves the plugin — and not a patched harness — is doing the work.

## Develop

```sh
pnpm install
pnpm --filter @claudejaune/dsh-ocode-go typecheck
pnpm --filter @claudejaune/dsh-ocode-go test
```

The suite boots a real Cordis context and a real HTTP server that behaves like the
gateway (`400 MissingSessionID` without the header, `200` with it), so a pass
means a working header reached the wire.

## License

MIT
