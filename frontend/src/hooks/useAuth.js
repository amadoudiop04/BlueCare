import { useContext } from 'react'

import { AuthContext } from '@/features/auth/authContext.js'

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) throw new Error('useAuth doit être utilise dans <AuthProvider>')
  return context
}
