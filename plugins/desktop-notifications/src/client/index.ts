/**
 * Browser half of the desktop-notifications plugin: one Session-header
 * toggle capsule in the utilities cluster (left of the open-in-app split
 * button) plus a root-scoped side-effect host in `shell.overlay` that fires
 * hidden-tab notifications on session-done and pending-interaction
 * transitions.
 *
 * This module's exports ARE the plugin: the module-table factory returns
 * `module.exports`, so `inject` and `apply` are what the browser mounts.
 */
import * as React from 'react'
import { en, NS, zh } from './locales.ts'
import { TOGGLE_CSS, STYLE_TAG } from './styles.ts'
import { DesktopNotifications } from './DesktopNotifications.ts'
import { NotificationsToggle } from './NotificationsToggle.ts'

/** Required services for locale registration and the slot contributions. */
export const inject = ['slots', 'locale']

/**
 * Inject the toggle capsule stylesheet, owned by this plugin's lifecycle.
 * @returns a disposer removing the style tag.
 */
function installStyles(): () => void {
  const tag = document.createElement('style')
  tag.dataset.pluginCss = STYLE_TAG
  tag.textContent = TOGGLE_CSS
  document.head.appendChild(tag)
  return () => { tag.remove() }
}

/**
 * Client plugin body: register the dictionaries, the capsule styles, the
 * root-scoped notification host, and the header toggle.
 * @param ctx - client root context.
 */
export function apply(ctx: {
  effect(callback: () => unknown, label?: string): () => void
  locale: {
    register(ns: string, dicts: { zh: unknown; en: unknown }): () => void
  }
  slots: {
    inject(key: string, callback: () => unknown): () => void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
}): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'desktop-notifications: dictionaries')
  ctx.effect(installStyles, 'desktop-notifications: styles')

  // Side-effect host: root-scoped, always mounted, renders nothing, and is
  // additive (fresh id, replaceRisk none) in the click-through overlay.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'desktop-notifications-host',
    locale: NS,
  }, DesktopNotifications))

  // Toggle capsule: session-header utilities, immediately left of the
  // open-in-app split button (order -10).
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'desktop-notifications-toggle',
    order: -20,
    locale: NS,
  }, NotificationsToggle))
}