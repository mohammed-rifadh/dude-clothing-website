import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, RotateCw } from 'lucide-react'
import orderService from '../services/orderService'
import { getCartErrorMessage } from '../services/cartService'

function read(order, camel, pascal) {
  return order?.[camel] ?? order?.[pascal]
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-LK', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

export default function OrderHistory() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true

    async function loadOrders() {
      setLoading(true)
      setError('')

      try {
        const response = await orderService.getAll()
        if (active) {
          setOrders(Array.isArray(response) ? response : [])
        }
      } catch (requestError) {
        if (active) setError(getCartErrorMessage(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }

    loadOrders()

    return () => {
      active = false
    }
  }, [retry])

  return (
    <main className="mx-auto min-h-[65vh] max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
        Customer account
      </p>
      <h1 className="mt-3 text-4xl font-black uppercase">Your orders</h1>
      <p className="mt-3 text-sm text-neutral-500">
        Orders placed through your DUDE Clothing account.
      </p>

      {loading ? (
        <p className="mt-10 text-sm text-neutral-500">Loading orders...</p>
      ) : error ? (
        <section className="mt-8 border border-red-200 bg-red-50 p-6">
          <p role="alert" className="text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider underline underline-offset-4"
          >
            <RotateCw size={14} /> Try again
          </button>
        </section>
      ) : orders.length === 0 ? (
        <section className="mt-10 border-y border-neutral-200 py-14 text-center">
          <h2 className="text-xl font-bold uppercase">No orders yet</h2>
          <p className="mt-3 text-sm text-neutral-500">
            Completed orders will appear here.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex min-h-11 items-center bg-black px-6 py-3 text-xs font-bold uppercase tracking-wider text-white"
          >
            Browse products
          </Link>
        </section>
      ) : (
        <div className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
          {orders.map((order) => {
            const id = read(order, 'orderId', 'OrderId')
            const orderNumber = read(order, 'orderNumber', 'OrderNumber')
            const status = read(order, 'orderStatus', 'OrderStatus')
            const items = read(order, 'items', 'Items') || []
            const total = read(order, 'totalAmount', 'TotalAmount')
            const createdAt = read(order, 'createdAt', 'CreatedAt')

            return (
              <article
                key={id}
                className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    {formatDate(createdAt)}
                  </p>
                  <h2 className="mt-2 text-lg font-bold">
                    Order {orderNumber || `#${id}`}
                  </h2>
                  <p className="mt-2 text-sm text-neutral-600">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                    {' / '}
                    {status || 'Status unavailable'}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <p className="text-sm font-semibold">{formatPrice(total)}</p>
                  <Link
                    to={`/orders/${encodeURIComponent(String(id))}`}
                    aria-label={`View order ${orderNumber || id}`}
                    title="View order details"
                    className="inline-flex h-10 w-10 items-center justify-center border border-neutral-300 hover:border-black"
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}