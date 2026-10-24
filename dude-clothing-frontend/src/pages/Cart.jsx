
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  LoaderCircle,
} from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=80'

function formatPrice(price) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(price) || 0)
}

export default function Cart() {
  const {
    items,
    itemCount,
    subtotal,
    loading,
    cartError,
    refreshCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useCart()

  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [busyItems, setBusyItems] = useState([])
  const [clearing, setClearing] = useState(false)

  function getCartItemId(item) {
    return item.cartItemId ?? item.CartItemId
  }

  function getProductLink(item) {
    return `/product/${encodeURIComponent(item.id)}`
  }

  async function changeQuantity(item, quantity) {
    const cartItemId = getCartItemId(item)

    if (cartItemId == null) {
      setNotice('This cart item has no database ID. Refresh your bag.')
      setNoticeError(true)
      return
    }

    setBusyItems((current) => [...current, cartItemId])
    setNotice('')

    try {
      const result = await updateQuantity(cartItemId, quantity)

      setNotice(result.message)
      setNoticeError(!result.success)
    } catch {
      setNotice('Could not update the quantity. Please try again.')
      setNoticeError(true)
    } finally {
      setBusyItems((current) =>
        current.filter((id) => id !== cartItemId),
      )
    }
  }

  async function handleRemove(item) {
    const cartItemId = getCartItemId(item)

    if (cartItemId == null) {
      setNotice('This cart item has no database ID. Refresh your bag.')
      setNoticeError(true)
      return
    }

    setBusyItems((current) => [...current, cartItemId])
    setNotice('')

    try {
      const result = await removeFromCart(cartItemId)

      setNotice(
        result.success
          ? `${item.name} removed from your bag.`
          : result.message,
      )
      setNoticeError(!result.success)
    } catch {
      setNotice('Could not remove this item. Please try again.')
      setNoticeError(true)
    } finally {
      setBusyItems((current) =>
        current.filter((id) => id !== cartItemId),
      )
    }
  }

  async function handleClearCart() {
    if (clearing || busyItems.length > 0) return

    setClearing(true)
    setNotice('')

    try {
      const result = await clearCart()
      setNotice(result.message)
      setNoticeError(!result.success)
    } catch {
      setNotice('Could not clear your bag. Please try again.')
      setNoticeError(true)
    } finally {
      setClearing(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center px-5 text-center">
        <ShoppingBag size={34} className="text-neutral-400" aria-hidden="true" />
        <h1 className="mt-5 text-3xl font-black uppercase">Sign in to view your bag</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-neutral-500">
          Your bag is saved to your DUDE Clothing account.
        </p>
        <Link
          to="/login"
          state={{ from: '/cart' }}
          className="mt-7 inline-flex min-h-12 items-center bg-black px-7 py-4 text-xs font-bold uppercase tracking-wider text-white"
        >
          Sign in
        </Link>
      </main>
    )
  }

  if (loading && items.length === 0) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-5">
        <div className="text-center">
          <LoaderCircle
            size={30}
            className="mx-auto animate-spin"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm text-neutral-500">
            Loading your shopping bag...
          </p>
        </div>
      </main>
    )
  }

  if (cartError && items.length === 0) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-7xl px-5 py-16 sm:px-8">
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

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
      <Link
        to="/shop"
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 transition-colors hover:text-black"
      >
        <ArrowLeft size={16} />
        Continue shopping
      </Link>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
            Your selection
          </p>

          <h1 className="mt-3 text-4xl font-black uppercase tracking-tight sm:text-6xl">
            Shopping bag
          </h1>
        </div>

        <p className="text-sm text-neutral-500">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>
      </div>

      {(notice || cartError) && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-5 text-sm ${
            noticeError || cartError
              ? 'text-red-700'
              : 'text-neutral-600'
          }`}
        >
          {notice || cartError}
          {cartError && !notice && (
            <button
              type="button"
              onClick={refreshCart}
              className="ml-3 font-bold underline underline-offset-4"
            >
              Retry
            </button>
          )}
        </p>
      )}

      {items.length === 0 ? (
        <section className="mt-12 border border-neutral-200 px-6 py-16 text-center">
          <ShoppingBag
            size={34}
            className="mx-auto text-neutral-400"
            aria-hidden="true"
          />

          <h2 className="mt-5 text-xl font-bold uppercase">
            Your bag is empty
          </h2>

          <p className="mt-3 text-sm text-neutral-500">
            Find your everyday essentials and add them to your bag.
          </p>

          <Link
            to="/shop"
            className="mt-7 inline-flex items-center justify-center bg-black px-7 py-4 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-neutral-700"
          >
            Explore collection
          </Link>
        </section>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_340px]">
          <section
            aria-label="Shopping bag items"
            className="divide-y divide-neutral-200 border-y border-neutral-200"
          >
            {items.map((item) => {
              const cartItemId = getCartItemId(item)
              const maxStock = Math.max(
                0,
                Number(item.stockQuantity) || 0,
              )
              const busy = busyItems.includes(cartItemId)

              return (
                <article
                  key={cartItemId}
                  className="flex gap-4 py-6 sm:gap-6"
                >
                  <Link
                    to={getProductLink(item)}
                    className="h-36 w-28 shrink-0 overflow-hidden bg-neutral-100 sm:h-44 sm:w-36"
                    aria-label={`View ${item.name}`}
                  >
                    <img
                      src={item.image || FALLBACK_IMAGE}
                      alt={item.name}
                      onError={(event) => {
                        event.currentTarget.onerror = null
                        event.currentTarget.src = FALLBACK_IMAGE
                      }}
                      className="h-full w-full object-cover"
                    />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 sm:flex-row">
                    <div className="min-w-0">
                      <Link
                        to={getProductLink(item)}
                        className="text-sm font-bold uppercase tracking-wide hover:text-neutral-500"
                      >
                        {item.name}
                      </Link>

                      {item.colour && (
                        <p className="mt-2 text-sm text-neutral-500">
                          Colour: {item.colour}
                        </p>
                      )}

                      {item.size && (
                        <p className="mt-1 text-sm text-neutral-500">
                          Size: {item.size}
                        </p>
                      )}

                      {item.sku && (
                        <p className="mt-1 text-xs text-neutral-400">
                          SKU: {item.sku}
                        </p>
                      )}

                      <p className="mt-3 text-sm text-neutral-500">
                        {formatPrice(item.price)}
                      </p>

                      <div className="mt-4 flex w-fit items-center border border-neutral-300">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${item.name}`}
                          disabled={busy || item.quantity <= 1}
                          onClick={() =>
                            changeQuantity(item, item.quantity - 1)
                          }
                          className="p-2 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Minus size={14} />
                        </button>

                        <span
                          className="min-w-9 text-center text-sm"
                          aria-live="polite"
                        >
                          {busy ? '…' : item.quantity}
                        </span>

                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.name}`}
                          disabled={busy || item.quantity >= maxStock}
                          onClick={() =>
                            changeQuantity(item, item.quantity + 1)
                          }
                          className="p-2 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <p className="mt-2 text-xs text-neutral-400">
                        {maxStock} available
                      </p>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemove(item)}
                        className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy ? (
                          <LoaderCircle
                            size={14}
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        Remove
                      </button>
                    </div>

                    <p className="shrink-0 text-sm font-semibold">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                </article>
              )
            })}
          </section>

          <aside className="h-fit border border-neutral-200 p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-black uppercase tracking-wide">
                Order summary
              </h2>
              <button
                type="button"
                disabled={clearing || busyItems.length > 0}
                onClick={handleClearCart}
                className="text-xs font-bold uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:text-red-700 disabled:opacity-40"
              >
                {clearing ? 'Clearing...' : 'Clear bag'}
              </button>
            </div>

            <div className="mt-6 flex justify-between gap-4 text-sm">
              <span className="text-neutral-500">
                Items ({itemCount})
              </span>

              <span className="font-semibold">
                {formatPrice(subtotal)}
              </span>
            </div>

            <div className="mt-4 flex justify-between gap-4 text-sm">
              <span className="text-neutral-500">Shipping</span>
              <span className="text-neutral-500">
                Calculated at checkout
              </span>
            </div>

            <p className="mt-4 text-xs leading-5 text-neutral-500">
              Shipping and any applicable charges will be calculated at
              checkout.
            </p>

            <div className="mt-6 border-t border-neutral-200 pt-5">
              <div className="flex justify-between gap-4">
                <span className="text-sm font-bold uppercase">
                  Subtotal
                </span>

                <span className="text-sm font-bold">
                  {formatPrice(subtotal)}
                </span>
              </div>

              <button
                type="button"
                disabled={loading || busyItems.length > 0}
                onClick={() => navigate('/checkout')}
                className="mt-6 flex min-h-12 w-full items-center justify-center bg-black px-5 py-4 text-xs font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Proceed to checkout
              </button>

              <Link
                to="/shop"
                className="mt-4 block text-center text-xs font-bold uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:text-black"
              >
                Continue shopping
              </Link>
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}
