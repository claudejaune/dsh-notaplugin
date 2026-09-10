/**
 * `desktop-notifications` namespace dictionaries: the Session-header toggle
 * capsule copy and the notification titles. All copy is locale-owned.
 */

/** Locale dictionary key union. */
export type NotificationKey =
  | 'toggle.enable'
  | 'toggle.disable'
  | 'toggle.on'
  | 'toggle.off'
  | 'notify.question'
  | 'notify.planReview'
  | 'notify.approval'
  | 'notify.done'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<NotificationKey, string> = {
  'toggle.enable': '开启桌面通知',
  'toggle.disable': '关闭桌面通知',
  'toggle.on': '桌面通知：开',
  'toggle.off': '桌面通知：关',
  'notify.question': '收到问题',
  'notify.planReview': '计划待审',
  'notify.approval': '等待批准',
  'notify.done': '已完成',
}

/** English dictionary, checked complete against the zh key set. */
export const en: Record<NotificationKey, string> = {
  'toggle.enable': 'Enable desktop notifications',
  'toggle.disable': 'Disable desktop notifications',
  'toggle.on': 'Desktop notifications: on',
  'toggle.off': 'Desktop notifications: off',
  'notify.question': 'Question',
  'notify.planReview': 'Plan review',
  'notify.approval': 'Waiting for approval',
  'notify.done': 'Done',
}

/** The locale namespace id this package owns. */
export const NS = 'desktop-notifications'