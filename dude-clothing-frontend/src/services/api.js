
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.DEV
    ? '/api'
    : import.meta.env.VITE_API_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
  timeout: 15000,
})

// Attach the saved customer token to API requests.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dude-auth-token')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('DUDE Clothing API Error', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    })

    if (
      error.response?.status === 401 &&
      !/\/Auth\/(login|register)(?:\?|$)/i.test(
        error.config?.url || '',
      ) &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new Event('dude:unauthorized'))
    }

    return Promise.reject(error)
  },
)

export default api
