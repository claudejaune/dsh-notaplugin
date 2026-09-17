# Verifying against a stock harness

The point of this page is to prove the **plugin** makes OpenCode Go work, and not a
modified harness. Do the steps in order; the control step is what makes the rest
meaningful.

## 1. Confirm the harness is stock

The OpenCode header logic must be absent from both source and build output. Stale
`lib/` from a previous patched build is the trap here — it will silently make a
broken plugin look like it works.

```sh
cd /path/to/deepseek-harness

git status --short packages/llm/llm-pi-ai     # expect: no output
grep -rn "x-opencode-session" packages/llm/llm-pi-ai/src/ || echo "src CLEAN"
grep -rn "x-opencode-session" packages/llm/llm-pi-ai/lib/ || echo "lib CLEAN"
```

Both must print `CLEAN`. If `lib/` still has hits, rebuild:

```sh
pnpm run build
grep -rn "x-opencode-session" packages/llm/llm-pi-ai/lib/ || echo "lib CLEAN"
```

## 2. Control: prove it fails without the plugin

With your OpenCode Go route configured and the plugin **not** installed, run one
task:

```sh
pnpm dsh --profile headless "say hi"
```

Expected: the request fails with `400 MissingSessionID`. This is the gateway
rejecting the missing header, and it is the baseline every later step is measured
against. **Do not skip this.** If this step succeeds, something else is already
stamping the header and the verification is void.

## 3. Install the plugin

From this repo, into the profile you are testing:

```sh
dsh plugin --profile headless add "file:$(pwd)/plugins/ocode-go"
```

Or from GitHub once published:

```sh
dsh plugin --profile headless add "@claudejaune/dsh-ocode-go"
```

Confirm the row landed:

```sh
dsh plugin --profile headless list 2>/dev/null | grep ocode-go
```

## 4. Prove the plugin fixes it

Run the same task again:

```sh
pnpm dsh --profile headless "say hi"
```

Expected: it succeeds. The only thing that changed between step 2 and step 4 is
this plugin, and the harness is still stock — so the plugin stamped the header.

## 5. Confirm the value is per-conversation

Start two separate sessions and ask each something different. The header must carry
a different value per conversation, because that is what the gateway uses for
routing and prompt-cache affinity.

To see the actual values, run a local gateway that logs headers and point
`opencode.ai` at it via `/etc/hosts`:

```sh
# /etc/hosts  (needs sudo; revert afterwards)
127.0.0.1   opencode.ai
```

```sh
# logs every x-opencode-session it receives, then 400s like the real gateway
node -e '
const h=require("http");
h.createServer((q,s)=>{console.log(q.url, "x-opencode-session:", q.headers["x-opencode-session"]??"<MISSING>");
s.writeHead(400,{"content-type":"application/json"});s.end(`{"error":"MissingSessionID"}`)}).listen(443,"127.0.0.1");
console.log("listening on :443")'
```

Two conversations must print two different ids. Revert `/etc/hosts` when done.

## 6. Check the diagnostic path

If a request ever reaches the gateway with no initiating Agent and no
session-affinity header, the plugin logs one `error` and lets the request go
unstamped. Watch for it during normal use:

```
ocode-go  request to https://opencode.ai/... has no initiating Agent and no
session-affinity header; the OpenCode gateway will reject it.
```

Seeing this **during normal conversation** is worth reporting — it means a model
request is running outside an Agent turn. Seeing it never is the expected outcome.

The most likely place for it is a background model call such as compaction or
session-title generation. If you hit it there, that is the one gap this approach
cannot close on its own, and it is worth knowing.

## 7. Confirm uninstall restores everything

```sh
dsh plugin --profile headless remove dsh-ocode-go   # or the pnpm equivalent
```

After removal, step 2's failure returns. If OpenCode still works after uninstall,
something did not clean up.

## Restoring the original harness patch

The patch this plugin replaces was preserved before removal:

- `docs/harness-original-patch.diff` — the original in-adapter change
- `docs/2026-09-10-opencode-session-header.md` — the Agent Note that recorded it

To put the harness change back:

```sh
cd /path/to/deepseek-harness
git apply /path/to/dsh-notaplugin/plugins/ocode-go/docs/harness-original-patch.diff
pnpm run build
```

You do not need this for the plugin to work. The plugin deliberately never
overwrites a header the harness already set, so both can coexist — but running the
plugin alone is the cleaner configuration.
