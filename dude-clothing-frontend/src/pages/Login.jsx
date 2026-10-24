
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from 'lucide-react'
import { motion } from 'framer-motion'
import authService from '../services/authService'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshAuth } = useAuth()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(
    location.state?.message || '',
  )
  const [isLoading, setIsLoading] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }))

    setErrors((previous) => ({
      ...previous,
      [name]: '',
    }))

    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')

    const newErrors = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Please enter your email address.'
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      newErrors.email = 'Please enter a valid email address.'
    }

    if (!formData.password) {
      newErrors.password = 'Please enter your password.'
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) return

    setIsLoading(true)

    try {
      const user = await authService.login(formData)
      refreshAuth()

      setMessage(`Welcome back, ${user.fullName}!`)

      navigate(location.state?.from || '/shop', { replace: true })
    } catch (error) {
      const status = error.response?.status
      const apiMessage =
        error.response?.data?.message ||
        error.response?.data?.title

      if (status === 401) {
        setMessage('Invalid email or password. Please try again.')
      } else if (status === 403) {
        setMessage(
          'Access was denied. Please check your account permissions.',
        )
      } else if (status === 400) {
        setMessage(apiMessage || 'Please check your login details.')
      } else if (!error.response) {
        setMessage(
          'Cannot connect to the server. Check that your backend is running and your API URL is correct.',
        )
      } else {
        setMessage(
          apiMessage || 'Login failed. Please try again.',
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass =
    'w-full bg-transparent px-3 py-4 text-sm outline-none placeholder:text-neutral-400'

  return (
    <main className="min-h-[80vh] bg-white px-5 py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl overflow-hidden border border-neutral-200 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative flex min-h-[280px] flex-col justify-between overflow-hidden bg-neutral-950 p-8 text-white sm:p-12 lg:min-h-[620px]"
        >
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full border border-white/10" />

          <Link
            to="/"
            className="relative z-10 w-fit text-2xl font-black tracking-[0.2em]"
          >
            DUDE<span className="text-neutral-500">.</span>
          </Link>

          <div className="relative z-10 mt-12">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Welcome back
            </p>

            <h1 className="max-w-md text-4xl font-black uppercase leading-tight sm:text-5xl">
              Your style.
              <br />
              Your identity.
              <br />
              Your rules.
            </h1>

            <p className="mt-6 max-w-sm text-sm leading-7 text-neutral-400">
              Sign in to continue your journey with DUDE Clothing.
            </p>
          </div>

          <p className="relative z-10 mt-12 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500">
            Designed for everyday confidence.
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center justify-center px-6 py-12 sm:px-12 lg:py-16"
        >
          <div className="w-full max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">
              Customer account
            </p>

            <h2 className="mt-4 text-3xl font-black uppercase tracking-tight sm:text-4xl">
              Sign in
            </h2>

            <p className="mt-3 text-sm leading-6 text-neutral-500">
              Enter your details to access your account.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-9 space-y-6"
              noValidate
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-bold uppercase tracking-wider"
                >
                  Email address
                </label>

                <div className="flex items-center border border-neutral-300 px-4 transition focus-within:border-black">
                  <Mail
                    size={17}
                    className="shrink-0 text-neutral-400"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    aria-invalid={Boolean(errors.email)}
                    className={inputClass}
                  />
                </div>

                {errors.email && (
                  <p className="mt-2 text-xs text-red-600">
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-xs font-bold uppercase tracking-wider"
                >
                  Password
                </label>

                <div className="flex items-center border border-neutral-300 px-4 transition focus-within:border-black">
                  <LockKeyhole
                    size={17}
                    className="shrink-0 text-neutral-400"
                  />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    aria-invalid={Boolean(errors.password)}
                    className={inputClass}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    className="text-neutral-500 hover:text-black"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                {errors.password && (
                  <p className="mt-2 text-xs text-red-600">
                    {errors.password}
                  </p>
                )}
              </div>

              {message && (
                <p
                  role="status"
                  className="border border-neutral-200 bg-neutral-50 p-3 text-sm leading-6 text-neutral-700"
                >
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="group flex w-full items-center justify-center gap-3 bg-black px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}

                {!isLoading && (
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                )}
              </button>
            </form>

            <div className="my-8 border-t border-neutral-200" />

            <p className="text-center text-sm text-neutral-600">
              New to DUDE Clothing?{' '}
              <Link
                to="/register"
                className="font-bold text-black underline underline-offset-4 hover:text-neutral-500"
              >
                Create an account
              </Link>
            </p>

            <Link
              to="/shop"
              className="mt-7 block text-center text-xs font-semibold uppercase tracking-wider text-neutral-500 transition hover:text-black"
            >
              Continue shopping
            </Link>
          </div>
        </motion.section>
      </div>
    </main>
  )
}
