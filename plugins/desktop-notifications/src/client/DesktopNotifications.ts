/**
 * Desktop notification side-effect component. Subscribes to the session list
 * (for titles and turn previews) and the unified Session-status snapshot and
 * fires browser Notification messages when:
 *   1. A session completes while the tab is hidden ("Done" reminder).
 *   2. A pending interaction (approval / plan-review / question) arrives.
 *
 * Each notification leads with the content the user needs to judge: the final
 * assistant response for (1), the question or approval reason for (2), clipped
 * to {@link SNIPPET_LIMIT}; the session title follows in the body so several
 * running sessions stay distinguishable. Interactions that carry no text fall
 * back to the session title alone.
 *
 * Renders nothing. The selectors stay pure and return small derived slices;
 * all side effects live in a useEffect keyed on those slices. Mounted into the
 * root-scoped `shell.overlay` slot (always mounted, click-through, additive),
 * so it observes every session — the functional equivalent of the reference
 * implementation's app-root mount.
 *
 * Lifecycle facts (running, pending interaction) come from `useSessionStatus`,
 * the harness's single source of truth for both.
 */
import * as React from 'react'
import { notificationsEnabled } from './notification-preference.ts'
import type { NotificationKey } from './locales.ts'

/** One session-list row, as this component reads it. */
interface SessionListEntryLike {
  displayTitle: string
  /**
   * Host-computed projection values. `turnOutline` is client-visible, so every
   * list row carries the session's turn previews — including sessions this tab
   * never opened — without retaining or opening them.
   */
  projectionValues?: {
    turnOutline?: readonly { response: string }[]
  }
}

/** The minimal session-list snapshot this component reads. */
interface SessionListStateLike {
  ids: string[]
  byId: Record<string, SessionListEntryLike>
}

/** One pending interaction, as this component reads it. */
interface PendingInteractionLike {
  /** Domain discriminator: `question`, `plan-review`, or `approval`. */
  kind: string
  /** `question` and `plan-review` requests carry their question list. */
  questions?: readonly { question: string }[]
  /** `approval` requests may carry the asker's human-readable reason. */
  reason?: string
  /** `approval` requests name the tool awaiting the decision. */
  toolName?: string
}

/** One session's lifecycle facts, as read from the unified status snapshot. */
interface SessionStatusLike {
  running: boolean | undefined
  pendingInteraction: PendingInteractionLike | undefined
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
  /** Unified lifecycle hook: running and pending interaction. */
  useSessionStatus: <T>(selector: (map: SessionStatusMapLike) => T) => T
  /** Synthesized translate seat over the `desktop-notifications` namespace. */
  t: (key: NotificationKey) => string
}

/** Per-session display facts read from the session list. */
interface SurfaceEntry {
  id: string
  /** Session label, used for the body and as the no-content fallback. */
  title: string
  /** Final assistant preview of the newest turn; `''` when the row carries none. */
  response: string
}

/** Notification headline budget in Unicode code points. */
const SNIPPET_LIMIT = 20

/**
 * Settle window for the completion preview. `running` flips false at `turn/end`
 * and the turn-outline projection commits that turn's response on the same
 * event a few milliseconds later, so the render carrying the idle edge can
 * still read the previous turn's preview (or none at all). Re-reading after a
 * short delay costs nothing a user can perceive; background tabs clamp timers,
 * which only makes the notification later, never wrong.
 */
const DONE_SETTLE_MS = 400

/**
 * Collapse whitespace and clip to `limit` code points, appending an ellipsis
 * when the text was longer. Slices by code point so CJK and emoji stay whole.
 */
function snippet(text: string, limit = SNIPPET_LIMIT): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const points = [...normalized]
  if (points.length <= limit) return normalized
  return `${points.slice(0, limit).join('').trimEnd()}…`
}

/**
 * Leading text for one pending interaction: the first question, the approval
 * reason, or the tool name. `undefined` when the interaction carries no text,
 * which leaves the session title as the headline.
 */
function interactionText(interaction: PendingInteractionLike): string | undefined {
  const question = interaction.questions?.[0]?.question
  if (question !== undefined && question.trim() !== '') return question
  if (interaction.reason !== undefined && interaction.reason.trim() !== '') return interaction.reason
  return interaction.toolName
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
 * id, title, and the turn response, so React re-renders on membership, rename,
 * and turn boundaries — not on every streaming-token store tick. Lifecycle
 * facts come from `useSessionStatus`, not the list. Pure: no side effects.
 */
function selectSurface(state: SessionListStateLike): SurfaceEntry[] {
  const entries: SurfaceEntry[] = []
  for (const id of state.ids) {
    const entry = state.byId[id]
    if (entry === undefined) continue
    entries.push({
      id,
      title: entry.displayTitle,
      response: entry.projectionValues?.turnOutline?.at(-1)?.response ?? '',
    })
  }
  return entries
}

/** Surface equality on the fields this component reads (re-render on a real change only). */
function sameSurface(a: SurfaceEntry[], b: SurfaceEntry[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const left = a[i]
    const right = b[i]
    if (left === undefined || right === undefined) return false
    if (left.id !== right.id || left.title !== right.title || left.response !== right.response) return false
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

  // Titles and turn previews come from the session list; lifecycle facts come
  // from the unified status snapshot.
  const surface = useSessions(selectSurface, sameSurface)
  // The status snapshot replaces its identity only when some session's running
  // or pending-interaction fact changes, so the selector needs no custom equality.
  const statuses = useSessionStatus(map => map)

  const prevStatusesRef = React.useRef(statuses)
  // Latest surface for the deferred completion read, which resolves after the
  // render that carried the idle edge.
  const surfaceRef = React.useRef(surface)
  React.useEffect(() => { surfaceRef.current = surface }, [surface])

  // One pending completion notification per session. These outlive the effect
  // run that scheduled them (the surface changing is what they wait for), so
  // they are cleared on unmount rather than in the effect cleanup.
  const doneTimers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())
  React.useEffect(() => () => {
    for (const timer of doneTimers.current.values()) clearTimeout(timer)
    doneTimers.current.clear()
  }, [])

  React.useEffect(() => {
    const prevStatuses = prevStatusesRef.current
    for (const entry of surface) {
      const status = statuses.get(entry.id)
      const prev = prevStatuses.get(entry.id)
      const nowPending = status?.pendingInteraction
      if (nowPending !== undefined && prev?.pendingInteraction === undefined) {
        const kind = t(pendingKey(nowPending.kind))
        const detail = interactionText(nowPending)
        if (detail === undefined) notify(kind, entry.title)
        else notify(snippet(detail), `${kind} · ${entry.title}`)
      }
      // "Done": a session stopped working and is not now waiting on an
      // interaction (that case is covered by the pending notification above).
      // Keys off the busy→idle edge of the unified `running` fact, then reads
      // the preview once {@link DONE_SETTLE_MS} has let the turn commit.
      if (prev?.running === true && status?.running !== true && nowPending === undefined) {
        const sessionId = entry.id
        const timers = doneTimers.current
        clearTimeout(timers.get(sessionId))
        timers.set(sessionId, setTimeout(() => {
          timers.delete(sessionId)
          const settled = surfaceRef.current.find(candidate => candidate.id === sessionId)
          const done = t('notify.done')
          if (settled === undefined || settled.response === '') {
            notify(done, entry.title)
            return
          }
          notify(snippet(settled.response), `${done} · ${settled.title}`)
        }, DONE_SETTLE_MS))
      }
    }
    prevStatusesRef.current = statuses
  }, [surface, statuses, t])

  return null
}
