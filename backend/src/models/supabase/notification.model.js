import { supabase } from '../../config/supabase.js'
import { nowIso } from '../ids.js'
import { createRepository, raise, runMany, runMaybeOne } from './repository.js'

/**
 * Acquittements et abonnements push (Postgres).
 *
 * Le fil de notifications lui-même n'est pas stocke : il est recalcule a
 * chaque lecture à partir des données metier. Seuls l'acquittement et les
 * abonnements le sont, parce qu'ils ne se deduisent de rien.
 */

const subscriptions = createRepository({ table: 'push_subscriptions', prefix: 'sub' })

export const notificationModel = {
  /** Identifiants déjà acquittes par cet utilisateur, parmi ceux proposes. */
  async readIdsFor(userId, notificationIds = []) {
    if (notificationIds.length === 0) return new Set()

    const rows = await runMany(
      supabase()
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId)
        .in('notification_id', notificationIds),
      'notificationReads.list',
    )

    return new Set(rows.map((row) => row.notificationId))
  },

  async markRead(userId, notificationId) {
    const { error } = await supabase()
      .from('notification_reads')
      .upsert(
        { user_id: userId, notification_id: notificationId, read_at: nowIso() },
        { onConflict: 'user_id,notification_id' },
      )

    raise(error, 'notificationReads.markRead')
    return true
  },

  async markManyRead(userId, notificationIds = []) {
    if (notificationIds.length === 0) return 0

    const { error } = await supabase()
      .from('notification_reads')
      .upsert(
        notificationIds.map((id) => ({
          user_id: userId,
          notification_id: id,
          read_at: nowIso(),
        })),
        { onConflict: 'user_id,notification_id' },
      )

    raise(error, 'notificationReads.markManyRead')
    return notificationIds.length
  },

  listSubscriptions: (userId) =>
    runMany(subscriptions.select().eq('user_id', userId), 'pushSubscriptions.list'),

  findSubscription: (userId, endpoint) =>
    runMaybeOne(
      subscriptions.select().eq('user_id', userId).eq('endpoint', endpoint),
      'pushSubscriptions.find',
    ),

  createSubscription: (data) => subscriptions.create(data),

  async removeSubscription(userId, subscriptionId) {
    const existing = await runMaybeOne(
      subscriptions.select().eq('id', subscriptionId).eq('user_id', userId),
      'pushSubscriptions.remove',
    )
    if (!existing) return false

    return subscriptions.remove(subscriptionId)
  },
}
