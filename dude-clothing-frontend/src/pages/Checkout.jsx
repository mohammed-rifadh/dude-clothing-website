
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useCart } from '../context/CartContext'
import cartService, {
  getCartErrorMessage,
} from '../services/cartService'

function formatPrice(price) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(price) || 0)
}

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  country: '',
}

export default function Checkout() {
  const { items, subtotal, loading, cartError, refreshCart } = useCart()
  const navigate = useNavigate()

  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    setErrors((current) => ({
      ...current,
      [name]: '',
    }))

    setNotice('')
  }

  function validateForm() {
    const nextErrors = {}

    if (!form.fullName.trim()) {
      nextErrors.fullName = 'Enter your full name.'
    } else if (form.fullName.trim().length < 2) {
      nextErrors.fullName = 'Your name must contain at least 2 characters.'
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.'
    }

    const phoneDigits = form.phone.replace(/\D/g, '')

    if (phoneDigits.length < 9 || phoneDigits.length > 15) {
      nextErrors.phone = 'Enter a valid phone number.'
    }

    if (!form.address.trim()) {
      nextErrors.address = 'Enter your delivery address.'
    } else if (form.address.trim().length < 3) {
      nextErrors.address = 'Enter at least 3 characters for your address.'
    }

    if (form.city.trim().length < 2) {
      nextErrors.city = 'Enter a city with at least 2 characters.'
    }

    if (form.country.trim().length < 2) {
      nextErrors.country = 'Enter a country with at least 2 characters.'
    }

    if (items.length === 0) {
      nextErrors.cart = 'Your shopping bag is empty.'
    }

    setErrors(nextErrors)

    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setNotice('')
    setNoticeError(false)

    if (!validateForm()) return

    setSubmitting(true)

    try {
      const response = await cartService.checkout({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phone.trim(),
        addressLine1: form.address.trim(),
        addressLine2: form.addressLine2.trim() || null,
        city: form.city.trim(),
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim(),
      })

      const orderId =
        response?.orderId ??
        response?.OrderId

      await refreshCart()
      navigate(
        orderId == null
          ? '/order-confirmation'
          : `/order-confirmation/${encodeURIComponent(String(orderId))}`,
        { replace: true, state: { order: response } },
      )
    } catch (error) {
      setNoticeError(true)
      setNotice(getCartErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
        <p className="text-sm text-neutral-500">Loading your bag...</p>
      </main>
    )
  }

  if (cartError && items.length === 0) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-7xl px-5 py-16 sm:px-8 lg:px-12">
        <h1 className="text-3xl font-black uppercase">Bag unavailable</h1>
        <p role="alert" className="mt-4 text-sm text-red-700">
          {cartError}
        </p>
        <button
          type="button"
          onClick={refreshCart}
          className="mt-6 bg-black px-6 py-4 text-xs font-bold uppercase tracking-wider text-white"
        >
          Retry
        </button>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
        <h1 className="text-3xl font-black uppercase">
          Your bag is empty
        </h1>

        <p className="mt-4 text-sm text-neutral-500">
          Add products before continuing to checkout.
        </p>

        <Link
          to="/shop"
          className="mt-7 inline-flex bg-black px-6 py-4 text-xs font-bold uppercase tracking-wider text-white"
        >
          Continue shopping
        </Link>
      </main>
    )
  }

  const inputClass =
    'mt-2 w-full border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-black'

  const labelClass =
    'block text-xs font-bold uppercase tracking-wider text-neutral-700'

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
      <Link
        to="/cart"
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-black"
      >
        <ArrowLeft size={16} />
        Back to bag
      </Link>

      <h1 className="mt-8 text-4xl font-black uppercase tracking-tight sm:text-6xl">
        Checkout
      </h1>

      <p className="mt-3 text-sm text-neutral-500">
        Enter your details for delivery.
      </p>

      {cartError && (
        <p role="alert" className="mt-5 border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {cartError}
        </p>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit} noValidate>
          <section>
            <h2 className="text-lg font-black uppercase">
              Contact and delivery
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="fullName">
                  Full name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
                {errors.fullName && (
                  <p className="mt-2 text-xs text-red-700">
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
                {errors.email && (
                  <p className="mt-2 text-xs text-red-700">
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="phone">
                  Phone number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
                {errors.phone && (
                  <p className="mt-2 text-xs text-red-700">
                    {errors.phone}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="address">
                  Address line 1
                </label>
                <textarea
                  id="address"
                  name="address"
                  autoComplete="street-address"
                  rows={3}
                  value={form.address}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
                {errors.address && (
                  <p className="mt-2 text-xs text-red-700">
                    {errors.address}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="addressLine2">
                  Address line 2 (optional)
                </label>
                <input
                  id="addressLine2"
                  name="addressLine2"
                  autoComplete="address-line2"
                  value={form.addressLine2}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
                {errors.city && (
                  <p className="mt-2 text-xs text-red-700">
                    {errors.city}
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="postalCode">
                  Postal code (optional)
                </label>
                <input
                  id="postalCode"
                  name="postalCode"
                  autoComplete="postal-code"
                  value={form.postalCode}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="country">
                  Country
                </label>
                <input
                  id="country"
                  name="country"
                  autoComplete="country-name"
                  maxLength={100}
                  value={form.country}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
                {errors.country && (
                  <p className="mt-2 text-xs text-red-700">
                    {errors.country}
                  </p>
                )}
              </div>
            </div>
          </section>

          {errors.cart && (
            <p className="mt-5 text-sm text-red-700">{errors.cart}</p>
          )}

          {notice && (
            <p role={noticeError ? 'alert' : 'status'} className={`mt-6 border p-4 text-sm leading-6 ${noticeError ? 'border-red-200 bg-red-50 text-red-800' : 'border-neutral-200'}`}>
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || loading}
            className="mt-8 min-h-12 w-full bg-black px-6 py-4 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-700 sm:w-auto"
          >
            {submitting ? 'Submitting order...' : 'Place order'}
          </button>
        </form>

        <aside className="h-fit border border-neutral-200 p-6 sm:p-7">
          <h2 className="text-lg font-black uppercase">
            Order summary
          </h2>

          <div className="mt-6 space-y-5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between gap-4 text-sm"
              >
                <span className="text-neutral-600">
                  {item.name} × {item.quantity}
                </span>

                <span className="shrink-0 font-semibold">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-5">
            <div className="flex justify-between gap-4">
              <span className="text-sm font-bold uppercase">Subtotal</span>
              <span className="text-sm font-bold">
                {formatPrice(subtotal)}
              </span>
            </div>

            <p className="mt-3 text-xs leading-5 text-neutral-500">
              Delivery charges and final prices must be confirmed by the
              server before an order is created.
            </p>
          </div>

          <div className="mt-6 flex items-start gap-3 border-t border-neutral-200 pt-5">
            <ShieldCheck size={20} className="shrink-0" />
            <p className="text-xs leading-5 text-neutral-500">
              Your order should be confirmed by the DUDE Clothing backend
              before it is considered complete.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
