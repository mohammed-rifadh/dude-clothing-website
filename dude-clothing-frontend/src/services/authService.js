
import api from './api'

const TOKEN_KEY = 'dude-auth-token'
const USER_KEY = 'dude-auth-user'

const authService = {
  async register(details) {
    const response = await api.post('/Auth/register', {
      fullName: details.fullName.trim(),
      email: details.email.trim(),
      password: details.password,
    })

    return response.data
  },

  async login(credentials) {
    const response = await api.post('/Auth/login', {
      email: credentials.email.trim(),
      password: credentials.password,
    })

    const data = response.data

    if (!data?.token) {
      throw new Error('The server did not return an access token.')
    }

    localStorage.setItem(TOKEN_KEY, data.token)

    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        userId: data.userId,
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        expiresAtUtc: data.expiresAtUtc,
      }),
    )

    return data
  },

  async getCurrentUser() {
    const response = await api.get('/Auth/me')
    return response.data
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY)
  },

  getUser() {
    try {
      const user = localStorage.getItem(USER_KEY)
      return user ? JSON.parse(user) : null
    } catch {
      return null
    }
  },

  isAuthenticated() {
    return Boolean(this.getToken())
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

export default authService
