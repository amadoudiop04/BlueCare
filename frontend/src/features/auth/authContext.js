import { createContext } from 'react'

/**
 * Contexte de session, isole dans son propre module : un fichier qui exporte
 * a la fois un contexte et un composant casse le Fast Refresh.
 */
export const AuthContext = createContext(null)
