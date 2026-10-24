import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserRound } from 'lucide-react'
import authService from '../services/authService'

function getErrorMessage(error) {
  const data = error?.response?.data

  if (typeof data === 'string' && data.trim()) return data
  if (data?.detail) return data.detail
  if (data?.message) return data.message
  if (data?.title) return data.title
  if (data?.errors) return Object.values(data.errors).flat().join(' ')
  if (!error?.response) {
    return 'Unable to connect to the server. Please try again.'
  }

  return 'Could not create your account. Check your details and try again.'
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (form.fullName.trim().length < 2) {
      setError('Enter your full name.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Enter a valid email address.')
      return
    }

    if (form.password.length < 8 || form.password.length > 128) {
      setError('Password must be between 8 and 128 characters.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      await authService.register(form)
      navigate('/login', {
        replace: true,
        state: { message: 'Account created. Sign in to continue.' },
      })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'mt-2 w-full border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-black'

  return (
    <main className="mx-auto min-h-[75vh] max-w-xl px-5 py-14 sm:px-8 sm:py-20">
      <Link
        to="/shop"
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-black"
      >
        <ArrowLeft size={16} />
        Back to shop
      </Link>

      <div className="mt-9 border border-neutral-200 p-6 sm:p-10">
        <UserRound size={23} aria-hidden="true" />
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
          DUDE Clothing
        </p>
        <h1 className="mt-2 text-3xl font-black uppercase">Create account</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-500">
          Create an account to keep your bag connected to your customer profile.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              autoComplete="name"
              maxLength={100}
              required
              value={form.fullName}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={256}
              required
              value={form.email}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={form.password}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          {error && (
            <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full bg-black px-6 py-4 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-neutral-600">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-black underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}