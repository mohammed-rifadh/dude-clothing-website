import { Link, useNavigate } from 'react-router-dom'
import { LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function getProfileFields(data) {
  const profile = data?.user ?? data?.User ?? data

  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return []
  }

  return Object.entries(profile).filter(([key, value]) =>
    !/token|password|secret/i.test(key) &&
    value !== null &&
    ['string', 'number', 'boolean'].includes(typeof value),
  )
}

function formatLabel(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase())
}

export default function Account() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const profileFields = getProfileFields(user)

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <main className="mx-auto min-h-[65vh] max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
        Customer account
      </p>
      <h1 className="mt-3 text-4xl font-black uppercase">Your profile</h1>

      <section className="mt-8 border-y border-neutral-200">
        {profileFields.length ? (
          <dl className="divide-y divide-neutral-200">
            {profileFields.map(([key, value]) => (
              <div key={key} className="grid gap-1 py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
                <dt className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {formatLabel(key)}
                </dt>
                <dd className="break-words text-sm">{String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="py-8 text-sm text-neutral-500">
            The server did not return profile details.
          </p>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/cart"
          className="inline-flex min-h-11 items-center gap-2 bg-black px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
        >
          <UserRound size={16} />
          View bag
        </Link>
        <Link
          to="/orders"
          className="inline-flex min-h-11 items-center border border-neutral-300 px-5 py-3 text-xs font-bold uppercase tracking-wider"
        >
          Order history
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex min-h-11 items-center gap-2 border border-neutral-300 px-5 py-3 text-xs font-bold uppercase tracking-wider"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </main>
  )
}