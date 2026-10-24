import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, RotateCw } from 'lucide-react'
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

export default function OrderDetails() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true

    async function loadOrder() {
      setLoading(true)
      setError('')

      try {
        const response = await orderService.getById(id)
        if (active) setOrder(response)
      } catch (requestError) {
        if (active) {
          setError(
            requestError?.response?.status === 404
              ? 'This order could not be found.'
              : getCartErrorMessage(requestError),
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    if (/^[1-9]\d*$/.test(id || '')) {
      loadOrder()
    } else {
      setError('The order ID is invalid.')
      setLoading(false)
    }

    return () => {
      active = false
    }
  }, [id, retry])

  if (loading) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-5xl px-5 py-20 sm:px-8">
        <p className="text-sm text-neutral-500">Loading order...</p>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-5xl px-5 py-16 sm:px-8">
        <p role="alert" className="text-sm text-red-700">
          {error || 'Order unavailable.'}
        </p>
        {error !== 'This order could not be found.' && (
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase underline underline-offset-4"
          >
            <RotateCw size={14} /> Try again
          </button>
        )}
        <Link to="/orders" className="mt-6 block text-xs font-bold uppercase underline underline-offset-4">
          Back to orders
        </Link>
      </main>
    )
  }

  const items = read(order, 'items', 'Items') || []
  const orderNumber = read(order, 'orderNumber', 'OrderNumber')

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <Link
        to="/orders"
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-black"
      >
        <ArrowLeft size={16} /> Orders
      </Link>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-5 border-b border-neutral-200 pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
            Order details
          </p>
          <h1 className="mt-2 break-words text-3xl font-black uppercase sm:text-4xl">
            {orderNumber || `Order #${read(order, 'orderId', 'OrderId')}`}
          </h1>
        </div>
        <p className="text-sm font-semibold">
          {read(order, 'orderStatus', 'OrderStatus')}
        </p>
      </div>

      <p className="mt-5 text-sm text-neutral-500">
        Placed {formatDate(read(order, 'createdAt', 'CreatedAt'))}
      </p>

      <section className="mt-8" aria-label="Order items">
        <h2 className="text-sm font-bold uppercase tracking-wider">Items</h2>
        <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
          {items.map((item) => {
            const itemId = read(item, 'orderItemId', 'OrderItemId')
            const quantity = Number(read(item, 'quantity', 'Quantity')) || 0
            const unitPrice = read(item, 'unitPrice', 'UnitPrice')

            return (
              <article key={itemId} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <h3 className="text-sm font-bold uppercase">
                    {read(item, 'productName', 'ProductName')}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-500">
                    {read(item, 'colour', 'Colour')} / {read(item, 'size', 'Size')}
                    {' / '}SKU {read(item, 'sku', 'SKU')}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatPrice(unitPrice)} each × {quantity}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatPrice(read(item, 'lineTotal', 'LineTotal'))}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider">Delivery</h2>
          <address className="mt-4 text-sm not-italic leading-6 text-neutral-600">
            {read(order, 'fullName', 'FullName')}<br />
            {read(order, 'addressLine1', 'AddressLine1')}<br />
            {read(order, 'addressLine2', 'AddressLine2') && <>{read(order, 'addressLine2', 'AddressLine2')}<br /></>}
            {read(order, 'city', 'City')} {read(order, 'postalCode', 'PostalCode')}<br />
            {read(order, 'country', 'Country')}
          </address>
        </section>

        <section className="h-fit border-t border-neutral-200 pt-4">
          <div className="flex justify-between gap-4 py-2 text-sm">
            <span className="text-neutral-500">Subtotal</span>
            <span>{formatPrice(read(order, 'subtotal', 'Subtotal'))}</span>
          </div>
          <div className="flex justify-between gap-4 py-2 text-sm">
            <span className="text-neutral-500">Shipping</span>
            <span>{formatPrice(read(order, 'shippingCost', 'ShippingCost'))}</span>
          </div>
          <div className="mt-2 flex justify-between gap-4 border-t border-neutral-200 pt-4 text-sm font-bold">
            <span>Total</span>
            <span>{formatPrice(read(order, 'totalAmount', 'TotalAmount'))}</span>
          </div>
        </section>
      </div>
    </main>
  )
}