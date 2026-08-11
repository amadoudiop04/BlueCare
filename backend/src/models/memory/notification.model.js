import { newId, nowIso } from '../ids.js'
import { db, snapshot } from './store.js'

/**
 * Acquittements et abonnements push (mémoire).
 *
 * Le fil de notifications n'est pas stocke : il est recalcule à chaque lecture
 * à partir des données metier. Seuls l'acquittement et les abonnements le
 * sont, parce qu'ils ne se deduisent de rien.
 */

const readKey = (userId, notificationId) => `${userId}:${notificationId}`

export const notificationModel = {
  async readIdsFor(userId, notificationIds = []) {
    return new Set(notificationIds.filter((id) => db.notificationReads.has(readKey(userId, id))))
  },

  async markRead(userId, notificationId) {
    db.notificationReads.add(readKey(userId, notificationId))
    return true
  },

  async markManyRead(userId, notificationIds = []) {
    for (const id of notificationIds) db.notificationReads.add(readKey(userId, id))
    return notificationIds.length
  },

  async listSubscriptions(userId) {
    return [...db.pushSubscriptions.values()]
      .filter((entry) => entry.userId === userId)
      .map(snapshot)
  },

  async findSubscription(userId, endpoint) {
    return snapshot(
      [...db.pushSubscriptions.values()].find(
        (entry) => entry.userId === userId && entry.endpoint === endpoint,
      ),
    )
  },

  async createSubscription(data) {
    const timestamp = nowIso()
    const subscription = { id: newId('sub'), ...data, createdAt: timestamp, updatedAt: timestamp }

    db.pushSubscriptions.set(subscription.id, subscription)
    return snapshot(subscription)
  },

  async removeSubscription(userId, subscriptionId) {
    const subscription = db.pushSubscriptions.get(subscriptionId)
    if (!subscription || subscription.userId !== userId) return false

    db.pushSubscriptions.delete(subscriptionId)
    return true
  },
}
