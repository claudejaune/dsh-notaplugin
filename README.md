# @claudejaune/dsh-client-ui-desktop-notifications

Desktop notifications for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web GUI, as an installable DSH plugin.

When the harness tab is in the background, this plugin fires a browser notification when:

- a session **finishes working** ("Done"),
- a session **asks for an interaction** — approval, plan review, or a question.

Clicking a notification brings the harness tab and window to the foreground. A bell toggle in the session header (immediately left of the "Open In…" button) turns the feature on/off; the preference persists in `localStorage` under `dsh-desktop-notifications`. Notification permission is requested on the first click in the page (browsers require a user gesture), never on load.

This is a standalone reimplementation of the same feature the DeepSeek Harness fork `dsh-notafork` ships in-repo — identical behavior, packaged as a drop-in DSH plugin instead of a fork patch.

## Install

The package declares a `dsh.bundle` manifest (its `cordis.patch.yml` inserts the browser roster row that names the package itself), so it installs through the standard plugin command — no forking, no editing `cordis.patch.yml` by hand.

```sh
# from npm (prebuilt)
dsh plugin --profile web add @claudejaune/dsh-client-ui-desktop-notifications

# or straight from GitHub (builds on install; the first attempt asks pnpm to
# allow the build script — paste the allowBuilds key it prints, then re-run)
dsh plugin --profile web add github:claudejaune/dsh-notaplugin
```

Then restart `dsh` and open the web GUI. You'll see the bell in the session header; click once anywhere in the page to grant notification permission, then switch to another tab while a session finishes or reaches an approval/question/plan-review.

> Works with any profile whose browser surface ships `dsh-web-app` (the stock `web` profile). Install into a different profile with `--profile <name>`.
> A headless profile has no browser to notify.

## How it works

Two browser-half contributions, registered through the stock slot system:

1. **Side-effect host** — mounts into the root-scoped `shell.overlay` slot (always mounted, click-through, additive) and observes every session via the framework `useSessions` + `useSessionPendingInteraction` standard props. Fires notifications only while `document.hidden`, when disabled by the toggle, or when permission is not granted.
2. **Toggle capsule** — a bell button in `conversation.session.header.utilities` at `order: -20`, immediately left of the `open-in-app` button (`order: -10`), persisting the preference to `localStorage`.

The node half (`lib/index.js`) is an empty `apply()` — it exists so the `dsh.client` row is a Loader entry; all behavior is browser-side (`lib/client.js`).

## Development

```sh
pnpm install
pnpm build        # tsc declarations → lib/types, tsdown → lib/index.js + lib/client.js
pnpm typecheck
```

The client half is built to the module-table contract: `lib/client.js` is a single CJS file wrapped in `window.__ModuleLoader__.load({ id, factory })` with `react` as the only external (a platform seed module) — everything else is inlined into the artifact.

## Publish

```sh
pnpm login        # npm account (free)
pnpm publish      # runs prepack (build) first
```

The package is `@claudejaune/...` scoped and `publishConfig.access: public`.

## License

MIT