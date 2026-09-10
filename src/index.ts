/**
 * Node half of the desktop-notifications plugin. The feature is entirely
 * browser-side, but this empty apply exists so the package is a Loader entry:
 * the `dsh.client` row inserted by `cordis.patch.yml` names this same
 * package, and the client-modules node half serves the built browser half
 * from `exports["./client"]`.
 */
export function apply(): void {
  // No host-side behavior for this surface plugin.
}