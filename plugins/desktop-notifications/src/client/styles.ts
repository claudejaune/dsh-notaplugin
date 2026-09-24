/**
 * The Session-header toggle capsule styles. Inlined as a style-string and
 * injected by the plugin's own effect (the dynamic-plugins `styles` builtin
 * does not exist in static client bundles): same 28px pill shape as the
 * open-in-app split button, using theme tokens present in the shipped web
 * bundle.
 */
export const TOGGLE_CSS = `
.dsh-notif-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 28px;
  min-width: 28px;
  padding: 0 7px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 14px;
  background: none;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}
.dsh-notif-toggle:hover:not(:disabled),
.dsh-notif-toggle:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-notif-toggle[data-enabled='false'] {
  color: var(--dsw-alias-label-secondary);
}
`
/** Stable identifier stamped on the injected style tag for inspection. */
export const STYLE_TAG = 'desktop-notifications-toggle'