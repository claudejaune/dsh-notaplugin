# Publishing to npm

Both plugins are publish-ready. This page is the exact command sequence.

**There is no separate "pnpm account".** `pnpm publish` pushes to the **npm
registry** and reads credentials from `~/.npmrc`. You log in to npm; pnpm just
uses that.

---

## 1. Prerequisites (check these first — they cause most failures)

### The `@claudejaune` scope must be yours

npm enforces that a scoped package's scope matches either your **username** or an
**organization you own**.

- If your npm username is exactly `claudejaune` → the user scope already works.
- If it is anything else → create an organization named `claudejaune` at
  <https://www.npmjs.com/org/create> before publishing. Otherwise publish fails
  with `E402` / "scope of package is not your own".

### 2FA is required to publish

npm requires two-factor auth for publishing. You need one of:

- **An authenticator app** — you will be prompted for a 6-digit OTP during
  publish. Fine for manual publishing.
- **A programmatic access token** — create a token at
  <https://www.npmjs.com/settings/tokens> with the **Publish** scope, then:

  ```sh
  echo "//registry.npmjs.org/:_authToken=<YOUR_TOKEN>" >> ~/.npmrc
  ```

  This skips the OTP prompt. Useful if you publish often or from a script.

---

## 2. Log in

```sh
pnpm login --scope @claudejaune
```

This opens the npm web login flow. Verify it took:

```sh
npm whoami
```

Should print your npm username. (Right now it returns `401 Unauthorized` — you are
not logged in yet.)

---

## 3. Build and check before publishing

```sh
pnpm install          # make sure deps are current
pnpm run build        # build both plugins
pnpm run typecheck    # must pass
```

### Inspect exactly what would ship

```sh
pnpm run publish:dry
```

Or per package, for the full file listing:

```sh
cd plugins/ocode-go && npm pack --dry-run
cd plugins/desktop-notifications && npm pack --dry-run
```

Expected tarball contents:

| Package | Files |
|---|---|
| `@claudejaune/dsh-ocode-go` | `lib/index.js`, `lib/types/index.d.ts`, `cordis.patch.yml`, `LICENSE`, `README.md`, `package.json` |
| `@claudejaune/dsh-client-ui-desktop-notifications` | `lib/index.js`, `lib/client.js`, `lib/types/**`, `cordis.patch.yml`, `LICENSE`, `README.md`, `package.json` |

Neither ships `src/`, `tests/`, `docs/`, or `node_modules/`. Confirm that before
publishing — **anything you publish to npm is permanent**, even after unpublishing
it stays in caches and mirrors.

---

## 4. Commit first

pnpm refuses to publish from a dirty working tree:

```
[ERR_PNPM_GIT_UNCLEAN] Unclean working tree. Commit or stash changes first.
```

Commit your version bump and any changes, then publish. If you genuinely need to
publish from a dirty tree, pass `--no-git-checks` — but prefer committing.

---

## 5. Publish

### Both packages at once

```sh
cd /path/to/dsh-notaplugin
pnpm run publish
```

Equivalent to `pnpm -r publish`. The root package is `private: true`, so pnpm
skips it and publishes only the two plugins.

### One package at a time

```sh
cd /path/to/dsh-notaplugin/plugins/ocode-go
pnpm publish
```

`publishConfig.access: "public"` is already set on both, so you do **not** need
`--access public`. Without it, scoped packages default to restricted and your
install would fail with 404.

### Publish a prerelease

```sh
pnpm publish --tag next
```

Users then get it only by asking: `npm i @claudejaune/dsh-ocode-go@next`. The
`latest` tag stays on the stable version.

---

## 6. Verify it landed

```sh
npm view @claudejaune/dsh-ocode-go version
npm view @claudejaune/dsh-client-ui-desktop-notifications version
```

Then install it the plain way:

```sh
dsh plugin --profile web add "@claudejaune/dsh-ocode-go"
```

---

## 7. Releasing an update

You **cannot republish over an existing version**. Bump first:

```sh
cd /path/to/dsh-notaplugin/plugins/ocode-go
npm version patch          # 0.1.0 -> 0.1.1, creates a git tag
# or: npm version patch --no-git-tag-version   (if you prefer to tag yourself)
pnpm publish
```

Then push the tag:

```sh
git push && git push --tags
```

---

## 8. Undoing a bad publish

npm's unpublish window is **7 minutes**. After that, deprecate instead:

```sh
npm deprecate "@claudejaune/dsh-ocode-go@0.1.0" "broken: <reason>"
```

Deprecation warns installers without removing the version. Prefer it over
unpublishing anything older than a few minutes.

---

## Optional: provenance

`--provenance` attaches a signed, verifiable build attestation so users can check
which commit produced the tarball. It is designed for CI — publishing locally
with `--provenance` generally requires npm ≥9 plus a reproducible build setup.
Worth adding later via a GitHub Actions workflow, not worth blocking a manual
publish on.

---

## Quick reference

```sh
# one-time setup
pnpm login --scope @claudejaune
npm whoami

# every release
cd /path/to/dsh-notaplugin
pnpm install && pnpm run build && pnpm run typecheck
pnpm run publish:dry          # inspect, change nothing
# commit the version bump
pnpm run publish              # publish both plugins
npm view @claudejaune/dsh-ocode-go version
```
