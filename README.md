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

Each plugin lives in its own folder under [`plugins/`](plugins/):

```sh
# desktop notifications (this package lives in plugins/desktop-notifications)
dsh plugin --profile web add "github:claudejaune/dsh-notaplugin#path:/plugins/desktop-notifications"
```

Then restart `dsh` and open the web GUI. You'll see the bell in the session header.

> **Note for git installs:** pnpm ≥10 blocks build scripts of GitHub-installed packages by default. The *first* install attempt will fail and print an `allowBuilds` key — paste it into the profile's `pnpm-workspace.yaml` as it tells you, then run the same command again. One-time, copy-paste.

## Coming soon

More plugins are on the way — this repo will grow as new ones land. Watch this space.

## License

MIT