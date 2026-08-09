import { createHash } from 'node:crypto'

/**
 * Anonymisation de la galerie d'activités.
 *
 * Une activité est collective : la consulter depuis la fiche d'un enfant ne
 * doit pas reveler l'identité des autres enfants présents. Chaque participant
 * est donc remplace par un alias, y compris dans les textes libres (titre,
 * description, legendes de photos) ou un éducateur a pu écrire des prenoms.
 */

/**
 * Alias stable pour un enfant DANS une activité donnée.
 *
 * L'identifiant de l'activité entre dans le hachage : un même enfant n'a pas
 * le même alias d'une activité a l'autre. Sans cela, il suffirait de recouper
 * deux galeries pour re-identifier quelqu'un par elimination.
 */
export function aliasFor(activityId, childId, salt) {
  const digest = createHash('sha256').update(`${salt}:${activityId}:${childId}`).digest('hex')
  return `Enfant #${digest.slice(0, 4).toUpperCase()}`
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Motifs a masquer pour un enfant, du plus spécifique au plus général :
 * « Malik Ferrand » avant « Malik », sinon on laisserait « Enfant #1A2B Ferrand ».
 */
function namePatterns(child) {
  const parts = [
    [child.firstName, child.lastName].filter(Boolean).join(' '),
    child.firstName,
    child.lastName,
  ]

  return parts
    .filter((part) => typeof part === 'string' && part.trim().length >= 2)
    .map((part) => new RegExp(`\\b${escapeRegExp(part.trim())}\\b`, 'gi'))
}

/**
 * Remplace dans un texte libre les noms des autres enfants par leur alias.
 * Limite connue : deux enfants homonymes reçoivent l'alias du premier motif
 * applique. Le texte reste anonyme, seule l'attribution peut être imprecise.
 */
function scrubNames(text, replacements) {
  if (typeof text !== 'string' || text === '') return text

  return replacements.reduce((scrubbed, { pattern, alias }) => scrubbed.replace(pattern, alias), text)
}

/**
 * Projette une activité dans la galerie d'un enfant.
 *
 * L'enfant consulte (`subjectChildId`) garde son nom : l'éducateur ouvre sa
 * fiche, il le connait déjà. Tous les autres sont anonymises. Les champs
 * internes (auteur de la saisie, notes pédagogiques) ne sont pas exposes.
 */
export function anonymizeActivity(activity, { subjectChildId, children = [], salt } = {}) {
  const childrenById = new Map(children.map((child) => [child.id, child]))

  const roster = activity.participantIds.map((childId) => ({
    alias: aliasFor(activity.id, childId, salt),
    isSubject: childId === subjectChildId,
    child: childrenById.get(childId),
  }))

  const replacements = roster
    .filter((entry) => !entry.isSubject && entry.child)
    .flatMap((entry) =>
      namePatterns(entry.child).map((pattern) => ({ pattern, alias: entry.alias })),
    )

  const scrub = (text) => scrubNames(text, replacements)

  return {
    id: activity.id,
    title: scrub(activity.title),
    description: scrub(activity.description),
    category: activity.category,
    date: activity.date,
    group: activity.group,
    location: activity.location,
    media: (activity.media ?? []).map((item) => ({
      id: item.id,
      url: item.url,
      caption: scrub(item.caption),
    })),
    participantCount: roster.length,
    participants: roster.map(({ alias, isSubject }) => ({ alias, isSubject })),
    createdAt: activity.createdAt,
  }
}
