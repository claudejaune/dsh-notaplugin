/**
 * Desktop notification side-effect component. Subscribes to the session list
 * (for titles) and the unified Session-status snapshot and fires browser
 * Notification messages when:
 *   1. A session completes while the tab is hidden ("Done" reminder).
 *   2. A pending interaction (approval / plan-review / question) arrives.
 *
 * Renders nothing. The selectors stay pure and return small derived slices;
 * all side effects live in a useEffect keyed on those slices. Mounted into the
 * root-scoped `shell.overlay` slot (always mounted, click-through, additive),
 * so it observes every session — the functional equivalent of the reference
 * implementation's app-root mount.
 *
 * Lifecycle facts (running, pending interaction) come from `useSessionStatus`,
 * the harness's single source of truth since pending interactions moved out of
 * the session list. The older `useSessionPendingInteraction` prop no longer
 * exists; reading it left the host throwing on render and inactive.
 */
import * as React from 'react'
import { notificationsEnabled } from './notification-preference.ts'
import type { NotificationKey } from './locales.ts'

/** The minimal session-list snapshot this component reads. */
interface SessionListStateLike {
  ids: string[]
  byId: Record<string, { displayTitle: string; running: boolean }>
}

/** One session's lifecycle facts, as read from the unified status snapshot. */
interface SessionStatusLike {
  running: boolean | undefined
  pendingInteraction: { kind: string } | undefined
  completionUnread: boolean
}

/** The unified session-status snapshot (session id -> status) as this component reads it. */
interface SessionStatusMapLike {
  get(id: string): SessionStatusLike | undefined
}

/** Framework standard props this component consumes. */
interface DesktopNotificationsProps {
  useSessions: <T>(
    selector: (state: SessionListStateLike) => T,
    equal?: (left: T, right: T) => boolean,
  ) => T
  /** Unified lifecycle hook: running, pending interaction, and completion reminder. */
  useSessionStatus: <T>(selector: (map: SessionStatusMapLike) => T) => T
  /** Synthesized translate seat over the `desktop-notifications` namespace. */
  t: (key: NotificationKey) => string
}

/** Per-session display facts read from the session list. */
interface SurfaceEntry {
  id: string
  /** Body text for the fired notification. */
  title: string
}

/**
 * Fire a browser notification that focuses the harness tab when clicked.
 * No-ops when the user has disabled notifications, the API is unavailable, the
 * tab is visible, or the user has not granted permission.
 */
function notify(title: string, body: string): void {
  if (!notificationsEnabled()) return
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  if (!document.hidden) return
  let notification: Notification
  try {
    notification = new Notification(title, { body })
  } catch {
    // NotAllowedError: a "granted" permission can still be overridden by
    // restrictive per-site settings (silent mode, Focus); the page cannot
    // recover, so drop this one event.
    return
  }
  // A notification click is a user-activation event, so window.focus() is
  // permitted: bring the harness tab (the document that owns this
  // notification) and its window to the foreground.
  notification.onclick = () => { window.focus() }
}

/**
 * Request notification permission off the first user gesture. Browsers require
 * a transient user activation for `Notification.requestPermission()`; calling
 * it on page load is rejected (Firefox 72+, Safari) and flagged by Lighthouse,
 * leaving permission at "default" so every later `new Notification()` throws.
 */
function useNotificationPermission(): void {
  React.useEffect(() => {
    const requestOnGesture = (): void => {
      if (typeof Notification === 'undefined') return
      if (Notification.permission === 'default') void Notification.requestPermission()
    }
    window.addEventListener('pointerdown', requestOnGesture, { passive: true, once: true })
    return () => { window.removeEventListener('pointerdown', requestOnGesture) }
  }, [])
}

/**
 * Project the per-session display surface. The custom equality compares only
 * id + title, so React re-renders only when a session appears, disappears, or
 * is renamed — not on every streaming-token store tick. Lifecycle facts come
 * from `useSessionStatus`, not the list. Pure: no side effects.
 */
function selectSurface(state: SessionListStateLike): SurfaceEntry[] {
  const entries: SurfaceEntry[] = []
  for (const id of state.ids) {
    const entry = state.byId[id]
    if (entry === undefined) continue
    entries.push({ id, title: entry.displayTitle })
  }
  return entries
}

/** Surface equality on id + title only (re-render only on a real membership/rename). */
function sameSurface(a: SurfaceEntry[], b: SurfaceEntry[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const left = a[i]
    const right = b[i]
    if (left === undefined || right === undefined) return false
    if (left.id !== right.id || left.title !== right.title) return false
  }
  return true
}

/**
 * Title dictionary key for one pending-interaction kind. ui-user-questions
 * owns `'question'` and `'plan-review'`; ui-approval owns `'approval'`;
 * unknown future kinds fall through to the approval wording.
 */
function pendingKey(kind: string): NotificationKey {
  if (kind === 'question') return 'notify.question'
  if (kind === 'plan-review') return 'notify.planReview'
  return 'notify.approval'
}

/**
 * Desktop notifications for session state transitions.
 * @param props - framework standard props (selector hooks + translate seat).
 * @returns no rendered content.
 */
export function DesktopNotifications(props: DesktopNotificationsProps): null {
  const { useSessions, useSessionStatus, t } = props

  useNotificationPermission()

  // Titles come from the session list; lifecycle facts come from the unified
  // status snapshot.
  const surface = useSessions(selectSurface, sameSurface)
  // The status snapshot replaces its identity only when some session's running,
  // pending-interaction, or completion-reminder fact changes, so the selector
  // needs no custom equality.
  const statuses = useSessionStatus(map => map)

  const prevStatusesRef = React.useRef(statuses)
  React.useEffect(() => {
    const prevStatuses = prevStatusesRef.current
    for (const entry of surface) {
      const status = statuses.get(entry.id)
      const prev = prevStatuses.get(entry.id)
      const nowPending = status?.pendingInteraction
      if (nowPending !== undefined && prev?.pendingInteraction === undefined) {
        notify(t(pendingKey(nowPending.kind)), entry.title)
      }
      // "Done": a session stopped working and is not now waiting on an
      // interaction (that case is covered by the pending notification above).
      // Keys off the busy→idle edge of the unified `running` fact.
      if (prev?.running === true && status?.running !== true && nowPending === undefined) {
        notify(t('notify.done'), entry.title)
      }
    }
    prevStatusesRef.current = statuses
  }, [surface, statuses, t])

  return null
}
