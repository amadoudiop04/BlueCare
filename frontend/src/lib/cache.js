/**
 * Cache mémoire des réponses de l'API.
 *
 * Il ne sert qu'a une chose : revenir sur un écran déjà consulte doit afficher
 * immédiatement ce qu'on y avait vu, pendant qu'une requête discrète va
 * chercher la version a jour. Sans lui, chaque « retour » repassait par un
 * squelette de chargement, alors que la donnée etait la une seconde plus tot.
 *
 * Trois garde-fous, parce qu'un cache qui ment est pire que pas de cache :
 *
 * - il est **toujours** revalide : ce qu'il rend est un point de depart,
 *   jamais une réponse definitive ;
 * - une entrée trop vieille (`TTL_MS`) est ignoree — au dela, mieux vaut un
 *   squelette honnête qu'un chiffre de la veille affiche comme actuel ;
 * - il est **entièrement vide a chaque changement de session**. Les postes du
 *   centre sont partages : sans cela, la fiche d'un enfant consultee par
 *   l'infirmiere aurait pu apparaitre une fraction de seconde a l'educateur
 *   qui se connecte après elle.
 *
 * Il vit en memoire uniquement. Rien n'est ecrit dans `localStorage` : ces
 * données sont medicales, elles ne survivent pas a la fermeture de l'onglet.
 */

const TTL_MS = 5 * 60 * 1000

/** `clé -> { data, storedAt }` */
const entries = new Map()

/**
 * Requêtes en cours, par clé.
 *
 * Deux composants qui demandent la même chose au même instant — le mode strict
 * de React monte tout deux fois en developpement — ne doivent declencher qu'un
 * seul appel réseau.
 */
const inFlight = new Map()

/** Donnée mémorisée pour cette clé, ou `null` si absente ou périmée. */
export function readCache(key) {
  if (!key) return null

  const entry = entries.get(key)
  if (!entry) return null

  if (Date.now() - entry.storedAt > TTL_MS) {
    entries.delete(key)
    return null
  }

  return entry
}

export function writeCache(key, data) {
  if (!key) return
  entries.set(key, { data, storedAt: Date.now() })
}

/** Après une écriture : la liste concernée doit repartir du serveur. */
export function invalidateCache(prefix) {
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key)
  }
}

/** Connexion, déconnexion, session expiree : plus rien ne doit rester. */
export function clearCache() {
  entries.clear()
  inFlight.clear()
}

/**
 * Lance `run()`, ou rejoint l'appel identique déjà en vol.
 * Sans clé, aucun partage possible : on execute simplement.
 */
export function dedupe(key, run) {
  if (!key) return run()

  const pending = inFlight.get(key)
  if (pending) return pending

  const promise = run().finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key)
  })

  inFlight.set(key, promise)
  return promise
}
