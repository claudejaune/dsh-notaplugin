# DSH Plugins

A collection of small, installable plugins for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) web GUI.

## Available plugins

### 🔔 Desktop notifications

Never miss a session finishing again. When the harness tab is in the background (or minimized), a browser notification pops up when:

- a session **finishes working**, or
- a session **asks for your input** — an approval, a plan review, or a question.

Clicking a notification brings you straight back to the harness. No more tab-watching while a long task runs.

- **Toggle:** the bell icon in the session header (top-right). Turn notifications on/off anytime — your choice sticks.
- **Permission:** the browser asks once, on your first click in the page (browsers require a user gesture before allowing notifications).
- **Tested on:** Windows and Linux, Chrome/Edge/Firefox (Chromium-compatible browsers work best).

#### Install

```sh
dsh plugin --profile web add "@claudejaune/dsh-desktop-notif"
```

Or from this repo's source (see the git-install note below):

```sh
dsh plugin --profile web add "github:claudejaune/dsh-notaplugin#path:/plugins/desktop-notifications"
```

Then restart `dsh` and open the web GUI. You'll see the bell in the session header.

> **Note for git installs:** pnpm ≥10 blocks build scripts of GitHub-installed packages by default. The *first* install attempt will fail and print an `allowBuilds` key — paste it into the profile's `pnpm-workspace.yaml` as it tells you, then run the same command again. One-time, copy-paste. The npm install above needs no such step — packages published to a registry ship prebuilt code.

### 🟢 OpenCode Go

Use your **OpenCode Go subscription** from `dsh`.

The OpenCode gateway rejects any inference request without a stable per-conversation `x-opencode-session` header (`400 MissingSessionID`). The harness knows the conversation id, but the model library it routes through never emits that header — so OpenCode routes are broken out of the box. This plugin stamps it for you.

- **Configuration:** none, deliberately. No settings entries and no toggles — adding or removing the plugin row *is* the switch.
- **Scope:** only requests to `opencode.ai` and its subdomains are touched. DeepSeek, OpenAI, Anthropic, and everything else pass through untouched.
- **Safe alongside other setups:** it never overwrites a header that is already set, so it cannot conflict with a harness that stamps it itself.

#### Install

```sh
dsh plugin --profile web add "@claudejaune/dsh-ocode-go"
```

Or, from this repo before the package is published:

```sh
dsh plugin --profile web add "file:$(pwd)/plugins/ocode-go"
```

Restart `dsh`. Details, known limits, and a stock-harness verification walkthrough live in [`plugins/ocode-go/README.md`](plugins/ocode-go/README.md).

## Coming soon

More plugins are on the way — this repo will grow as new ones land. Watch this space.

## License

MIT