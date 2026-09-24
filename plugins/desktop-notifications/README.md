# @claudejaune/dsh-desktop-notif

Browser desktop notifications for the DeepSeek Harness web GUI: a hidden tab pops
a toast when a session finishes or when it is waiting on you.

Long task, tab in the background, nothing to watch. When the session stops
working — or stops again because it needs an approval, a plan review, or an
answer — this plugin raises an OS-level notification with that session's title.
Clicking it brings the harness tab back to the foreground.

## Install

```sh
dsh plugin --profile web add "@claudejaune/dsh-desktop-notif"
```

Restart `dsh` and open the web GUI. A bell appears in the session header.

Or from the plugin's source repository:

```sh
dsh plugin --profile web add "github:claudejaune/dsh-notaplugin#path:/plugins/desktop-notifications"
```

> **Note for git installs:** pnpm ≥10 blocks build scripts of GitHub-installed
> packages by default. The *first* install attempt fails and prints an
> `allowBuilds` key — paste it into the profile's `pnpm-workspace.yaml` as it
> tells you, then run the same command again. One-time, copy-paste. Registry
> installs skip this step because published tarballs ship prebuilt code.

## What fires, and when

- **Session finished** — the notification is raised on the busy→idle edge, so it
  announces work that stopped on its own. A session that is idle because it is
  waiting on you gets the interaction wording below instead, never both.
- **Session needs you** — one notification per newly pending approval, plan
  review, or question, titled by kind.

### What the notification says

The headline is the content you need to judge it by, clipped to 20 characters:

- finished session — the final assistant response of that turn
  (`pong`, `Which color do you p…`)
- question / plan review — the question text
- approval — the asker's reason, or the tool awaiting the decision
- anything without text to show — the session title

The session title follows in the body (`Done · Fix the flaky test`) so several
running sessions stay distinguishable.

Two conditions keep it quiet:

- **Only while the tab is hidden.** A visible tab already shows the change, so
  nothing is raised. Focus the harness window and notifications stop until it is
  in the background again.
- **Only while the bell is on.** The header toggle turns the feature off and back
  on.

Clicking a notification focuses the harness window. Browser permission is
requested on your first click inside the page — browsers require a user gesture
for that, so nothing is requested on load. If permission is denied, or your OS
silences the site, the plugin simply raises nothing; it never retries or nags.

The toggle preference persists in `localStorage` under `dsh-desktop-notifications`
(`'1'` enabled by default, `'0'` disabled), so it survives reloads and upgraded
installs of the plugin.

## Configuration

**None. By design.** There are no settings entries, no environment variables, and
no per-deployment tunables. On, off, and the browser's own permission and
per-site settings cover every choice a user can sensibly express here. Adding or
removing the plugin row is the install-time switch.

## How it works

The package has a host half and a browser half, both from one source tree.

- **Host half** (`lib/index.js`) is an empty `apply`. It exists so the package is
  a Loader entry: `cordis.patch.yml` inserts one `dsh.client` roster row naming
  the package, and the harness serves the browser half from
  `exports["./client"]`.
- **Browser half** (`lib/client.js`) contributes two slots: a root-scoped
  side-effect host in `shell.overlay` (always mounted, renders nothing, observes
  every session) and the bell capsule in
  `conversation.session.header.utilities`. All copy is locale-owned under the
  `desktop-notifications` namespace.
- Lifecycle facts come from the harness's unified status snapshot
  (`useSessionStatus`), which carries `running` and `pendingInteraction` per
  session. Question and approval text rides on the interaction value itself.
- The finished-session preview comes from the harness's client-visible
  `turnOutline` projection, read off each session-list row — so it is available
  for sessions this tab never opened, with no retention and no history opening.
  That projection commits a turn's response on `turn/end`, a few milliseconds
  after `running` flips false, so the completion notification reads the row once
  more after a short settle window rather than racing the commit.
- The side-effect host re-renders only when a session's id, title, or turn
  preview changes, or a status fact flips — not on every streaming-token tick.

## Development

```sh
npm install
npm run build       # tsc declarations + tsdown bundles into lib/
npm run typecheck
```

The browser half is compiled to a factory registered with the page's module
table. Two properties of that delivery format matter when working on this
package:

- **The registration id must equal the package name.** `tsdown.config.ts` holds
  that id in its `ID` constant; the harness derives each boot-graph row id from
  the package name and rejects a bundle that registers under anything else. A
  rename that misses this constant produces a bundle the boot page reports as
  *"import failed"* with the whole client refusing to start.
- **Only `react` may remain external.** The module table can answer platform seed
  modules and nothing else, so every other dependency has to be inlined into the
  single `lib/client.js` file.

`lib/` is generated and git-ignored. `prepare` and `prepack` both run the build,
so registry publishes and git installs compile from `src/` — never hand around a
checked-in output tree.

## License

MIT
