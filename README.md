# Claujaune's DSH Plugins Set

A collection of QoL plugins for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) web GUI.

## Available plugins

### 🔔 Desktop notifications

Never miss a session finishing again. If the harness tab is in the background or minimized, a browser notification pops up when:

- a session **finishes working**, or
- a session **asks for your input** (approval, plan review, or question)

Clicking the notif brings you back to the harness tab.

1. **Toggle:** the bell icon in the session header (top-right)
2. **Permission:** the browser asks once on first run. Approve it

Tested on Windows and Linux with Firefox and Brave (and other Chromium-compatible browsers)

#### Install

If you use `npx @deepseek-ai/dsh web` to launch DSH:

```sh
npx @deepseek-ai/dsh plugin --profile web add "@claudejaune/dsh-desktop-notif"
```

If you build `dsh` manually from source using `pnpm`:

```sh
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add "@claudejaune/dsh-desktop-notif"
```

Then restart `dsh` and open the web GUI. You'll see the bell in the session header.

### OpenCode Go sub

Use your **OpenCode Go subscription** from `dsh`.

The OpenCode Go gateway rejects any inference request without a stable per-conversation `x-opencode-session` header (`400 MissingSessionID`), so it doesn't work with DSH. This plugin stamps it for you.

No need to configure anything. It Just Works™️.

#### Install

If you use `npx @deepseek-ai/dsh web` to launch DSH:

```sh
npx @deepseek-ai/dsh plugin --profile web add "@claudejaune/dsh-ocode-go"
```

If you build `dsh` manually from source using `pnpm`:

```sh
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add "@claudejaune/dsh-ocode-go"
```

Then restart `dsh` and open the web GUI.

## Coming soon

More plugins are on the way — this repo will grow as new ones land. Watch this space.

## License

MIT
