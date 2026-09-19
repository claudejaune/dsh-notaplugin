/**
 * Standalone build for @claudejaune/dsh-desktop-notif.
 *
 * Two artifacts, mirroring the contracts the harness's client-modules node
 * half serves:
 *
 *  1. `lib/index.js` — node half (plain ESM; the `dsh.client` row imported by
 *     the Loader). Empty apply, no runtime deps.
 *
 *  2. `lib/client.js` — browser half. The client-modules node half serves the
 *     raw bytes of `exports["./client"]` to the module table, which evaluates
 *     factories wrapped in `window.__ModuleLoader__.load({ id, factory })`.
 *     The factory resolves externals through the injected `require` (the
 *     loader module table), so ONLY `react` may remain an import — `react` is
 *     a platform seed module. Everything else the bundle needs must be
 *     inlined into this one file; a `require()` the table cannot answer is a
 *     guaranteed runtime throw.
 */
import { defineConfig } from 'tsdown'

const ID = '@claudejaune/dsh-desktop-notif'

export default defineConfig([
  // ── node half: lib/index.js ────────────────────────────────────────────
  {
    name: `${ID} (node half)`,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  // ── browser half: lib/client.js ────────────────────────────────────────
  {
    name: `${ID} (client half)`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2024',
    dts: false,
    clean: false,
    deps: {
      // `react` is the only specifier the module table can answer (platform
      // seed module); everything else must inline.
      neverBundle: (specifier) => specifier === 'react',
      alwaysBundle: (specifier) => specifier !== 'react',
    },
    outputOptions: {
      entryFileNames: 'client.js',
      // The loader wrapper contract: identical shape to the shipped client
      // bundles. `module.exports` of the factory becomes the plugin (this
      // module's `inject` + `apply` exports).
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])