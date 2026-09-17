# Agent Note: Per-conversation `x-opencode-session` header for OpenCode routes

Status: implemented

English | [中文](2026-09-10-opencode-session-header.zh.md)

## Problem

The OpenCode Go managed-inference gateway began requiring a stable per-conversation `x-opencode-session` header on every inference request on 2026-09-05, answering `400 MissingSessionID` otherwise. The harness's pi-ai adapter passed the conversation id to pi-ai (`options.sessionId`), but pi-ai's session-affinity formats emit only `session_id`, `x-client-request-id`, `x-session-affinity`, or `x-session-id`; none is the required header, and the Chat Completions path emits no affinity header at all. Users on OpenCode routes therefore broke, while the direct DeepSeek adapter already sent its own conversation id as `x-deepseek-harness-session-id` (`packages/llm/llm-deepseek/src/adapter.ts`). A static `headers: { x-opencode-session: … }` profile entry unblocked the 400 but pinned one id across all conversations, defeating the gateway's routing and prompt-cache affinity.

## Decision

`dsh-llm-pi-ai` stamps `x-opencode-session` with the request's `GenerateOptions.sessionId` on every request to an OpenCode gateway. A route is an OpenCode gateway when its route key is `opencode` or starts with `opencode-` (the installed `opencode` and `opencode-go` catalog routes), or when its resolved model endpoint host is `opencode.ai` or a subdomain. The value is the harness conversation id, stable across turns, resume, compaction, and retries because the agent loop stamps it once per session (`packages/core/agent-loop/src/agent.ts`).

Header precedence in `requestHeaders()` is profile headers, then the per-conversation session header, then Harness attribution. A per-conversation value replaces a same-named static `headers` entry because a fixed value cannot identify a conversation; attribution names stay Harness-owned and win every collision. Routes outside the OpenCode gateway are unaffected, and no other provider receives the header.

The detection and injection live in the pi-ai package rather than per-deployment configuration: it normalizes a provider particularity, matching the package's role and the [mandatory attribution decision](2026-06-21-mandatory-app-attribution-headers.md) that already centralizes provider request identity. This is the pi-ai counterpart to the [DeepSeek request identity decision](../feature/2026-08-11-deepseek-request-user-id-header.md), which owns the direct adapter's conversation-id header.

## Testing

`packages/llm/llm-pi-ai/tests/adapter.spec.ts` asserts the header arrives on the wire for an `opencode-go` route carrying the conversation id, is absent on a non-OpenCode route, replaces a same-named static profile header, and that `isOpenCodeRoute` recognizes the gateway by key and by endpoint host.

## Alternatives considered

**Opt-in `sessionHeader` profile field.** A deployment-configured header name (for example `sessionHeader: x-opencode-session`) generalizes beyond OpenCode and keeps behavior explicit. It was not chosen because the requirement is an external gateway contract, not a deployment-varying tunable, and an opt-in default leaves every existing OpenCode user broken until they edit settings. The automatic rule fixes the shipped catalog routes with no configuration.

**Send the header on every route.** Rejected: `x-opencode-session` is meaningless to providers that do not recognize it, and the harness already limits provider-specific identity to the provider that documents it.

**Emit pi's native `n-session` / `n-client` headers too.** Rejected: `x-opencode-session` is the header the gateway names in its error and is sufficient on the wire; extra native headers add surface without a consumer.

**Normalize the value to a bare UUID.** Considered because some community patches extract a bare UUID from `session-<uuid>`. Rejected: the gateway accepts the harness id shape, and normalizing would couple the adapter to one id format while the harness mints `session-<n>`, `session-<uuid>`, and raw UUIDs across entry points.

## Consequences

OpenCode Go and Zen users keep working with no configuration change, and each conversation keeps its own routing and prompt-cache affinity because the header follows the conversation id. A same-named static profile header no longer takes effect on an OpenCode route, which is deliberate and documented in the package README. The detection is host- and key-based; a deployment that proxies OpenCode through an unrelated host must set the header through `headers` itself, and if OpenCode adds another required header this rule must grow.
