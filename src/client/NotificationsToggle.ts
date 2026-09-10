/**
 * Session-header toggle capsule that enables/disables desktop notifications.
 * Registered into `conversation.session.header.utilities` at `order: -20`,
 * immediately left of the open-in-app split button (`order: -10`), so it is
 * a flex member of the header's 28px control row. The on/off state persists
 * in localStorage.
 */
import * as React from 'react'
import { notificationsEnabled, setNotificationsEnabled } from './notification-preference.ts'
import type { NotificationKey } from './locales.ts'

/** The synthesized translate seat this component receives. */
interface NotificationsToggleProps {
  t: (key: NotificationKey) => string
}

/** Bell glyph; struck through with a line when disabled. */
function Bell({ struck }: { struck: boolean }): React.ReactNode {
  return React.createElement(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
    },
    React.createElement('path', { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }),
    React.createElement('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' }),
    struck ? React.createElement('line', { x1: 4, y1: 4, x2: 20, y2: 20 }) : null,
  )
}

/**
 * Render the desktop-notifications toggle capsule.
 * @param props.t - translate seat owning the accessible name and tooltip.
 * @returns the toggle button.
 */
export function NotificationsToggle(props: NotificationsToggleProps): React.ReactNode {
  const { t } = props
  const [enabled, setEnabled] = React.useState<boolean>(notificationsEnabled)

  const toggle = (): void => {
    const next = !enabled
    setEnabled(next)
    setNotificationsEnabled(next)
  }

  return React.createElement(
    'button',
    {
      type: 'button',
      className: 'dsh-notif-toggle',
      'data-enabled': enabled,
      'aria-pressed': enabled,
      'aria-label': enabled ? t('toggle.disable') : t('toggle.enable'),
      title: enabled ? t('toggle.on') : t('toggle.off'),
      onClick: toggle,
    },
    React.createElement(Bell, { struck: !enabled }),
  )
}