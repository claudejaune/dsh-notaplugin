/**
 * Standalone build for @claudejaune/dsh-ocode-go.
 *
 * One artifact: `lib/index.js`, the host half the Loader imports from the
 * `cordis.patch.yml` roster row. No browser half exists — the feature wraps the
 * Node process's outbound transport, so nothing is served to the page.
 */
import { defineConfig } from 'tsdown'

export default defineConfig({
  name: '@claudejaune/dsh-ocode-go (host half)',
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})
