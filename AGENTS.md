# AGENTS.md

Multi-plugin pnpm workspace for DeepSeek Harness (dsh) plugins.

## Layout & rules

- Every plugin is a standalone npm package in its own folder: `plugins/<name>/`.
- The workspace (`pnpm-workspace.yaml`, `packages: plugins/*`) picks new folders up automatically — no registry change needed.
- Each plugin package must carry its own `package.json`, `src/`, build config, and `cordis.patch.yml`.
- Plugins are installed by users via `dsh plugin add`, never cloned-and-run in place.

## Add a plugin

1. Create `plugins/<name>/` as a copy of an existing plugin's structure (e.g. `plugins/desktop-notifications/`).
2. Write the package: `package.json` (with `dsh.bundle`/`dsh.client` fields, `exports["./client"]`), `cordis.patch.yml`, `src/`, `tsdown.config.ts`, `tsconfig.json`.
   - The `dsh.bundle` field is the install marker; the `cordis.patch.yml` inserts the browser roster row that names the package itself.
   - Add `"prepare": "npm run build"` — git installs build from source via pnpm and need it.
3. Run `pnpm install` and `pnpm build` at the root to verify.
4. Commit with a clear message; push to `main`.

## Conventions worth keeping

- Keep the README's "Available plugins" list in sync.
- Keep plugin code dependency-light: the browser half's only external should be `react` (module-table seed), everything else inlined.
- No credentials, tokens, or local machine info (names/paths) in commits — check before pushing.