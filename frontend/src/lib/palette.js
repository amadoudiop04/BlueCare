/** Outils de la palette de navigation (`components/layout/CommandPalette.jsx`). */

/**
 * Texte comparable : sans accents, sans casse.
 * « presences » doit trouver « Présences », et « lea » trouver « Léa ».
 */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Le raccourci s'ecrit ⌘K sur Mac, Ctrl K ailleurs. */
export const isApple =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent ?? '')

/*
 * Memoire de l'astuce annoncant le raccourci.
 *
 * Un raccourci clavier qui n'est ecrit nulle part n'existe que pour celui qui
 * l'a code. L'application l'annonce donc d'elle-même a l'arrivee — mais une
 * seule fois : une astuce qui revient a chaque connexion cesse d'être une
 * astuce pour devenir une gêne.
 *
 * Un simple drapeau d'interface, sans rien de personnel : `localStorage`
 * convient, la ou les réponses de l'API n'y ont rien a faire. Il est volontaire
 * qu'il survive a la déconnexion — le raccourci, lui, ne change pas d'un
 * utilisateur a l'autre, et sur un poste partagé du centre l'avoir vu une fois
 * suffit.
 */
const HINT_KEY = 'bluecare_shortcut_hint'

/** Navigation privee ou stockage refuse : l'astuce s'affiche, c'est tout. */
export function hasSeenShortcutHint() {
  try {
    return window.localStorage.getItem(HINT_KEY) === 'seen'
  } catch {
    return false
  }
}

export function rememberShortcutHint() {
  try {
    window.localStorage.setItem(HINT_KEY, 'seen')
  } catch {
    // Sans mémoire, l'astuce reparaitra : desagreable, jamais bloquant.
  }
}
