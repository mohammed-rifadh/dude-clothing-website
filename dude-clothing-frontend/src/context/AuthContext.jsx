import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import authService from '../services/authService'

const AuthContext = createContext(null)

function readSession() {
  return {
    token: authService.getToken(),
    user: authService.getUser(),
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession)
  const [isReady, setIsReady] = useState(
    () => !authService.getToken(),
  )
  const sessionCheck = useRef({ token: null, promise: null })

  const refreshAuth = useCallback(() => {
    const nextSession = readSession()
    setSession(nextSession)
    setIsReady(!nextSession.token)
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setSession({ token: null, user: null })
    setIsReady(true)
  }, [])

  useEffect(() => {
    window.addEventListener('storage', refreshAuth)
    window.addEventListener('dude:unauthorized', logout)

    return () => {
      window.removeEventListener('storage', refreshAuth)
      window.removeEventListener('dude:unauthorized', logout)
    }
  }, [refreshAuth, logout])

  useEffect(() => {
    if (!session.token) {
      setIsReady(true)
      return undefined
    }

    let active = true
    setIsReady(false)

    if (sessionCheck.current.token !== session.token) {
      sessionCheck.current = {
        token: session.token,
        promise: authService.getCurrentUser(),
      }
    }

    sessionCheck.current.promise
      .then((profile) => {
        if (active) {
          setSession((current) =>
            current.token === session.token
              ? { ...current, user: profile?.user ?? profile?.User ?? profile }
              : current,
          )
        }
      })
      .catch((error) => {
        if (active && error.response?.status === 401) {
          logout()
        }
      })
      .finally(() => {
        if (active) setIsReady(true)
      })

    return () => {
      active = false
    }
  }, [session.token, logout])

  const value = useMemo(
    () => ({
      user: session.user,
      isAuthenticated: Boolean(session.token),
      role: session.user?.role ?? session.user?.Role ?? null,
      isCustomer:
        String(session.user?.role ?? session.user?.Role).toLowerCase() ===
        'customer',
      isAdmin:
        String(session.user?.role ?? session.user?.Role).toLowerCase() ===
        'admin',
      isReady,
      refreshAuth,
      logout,
    }),
    [session, isReady, refreshAuth, logout],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.')
  }

  return context
}