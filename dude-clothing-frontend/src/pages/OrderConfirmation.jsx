import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import orderService from '../services/orderService'
import { getCartErrorMessage } from '../services/cartService'

export default function OrderConfirmation() {
  const { id } = useParams()
  const location = useLocation()
  const initialOrder = location.state?.order ?? null
  const [order, setOrder] = useState(initialOrder)
  const [loading, setLoading] = useState(!initialOrder)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialOrder) return undefined

    let active = true

    async function loadOrder() {
      try {
        const response = await orderService.getById(id)
        if (active) setOrder(response)
      } catch (requestError) {
        if (active) setError(getCartErrorMessage(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }

    if (/^[1-9]\d*$/.test(id || '')) {
      loadOrder()
    } else {
      setError('The order reference is invalid.')
      setLoading(false)
    }

    return () => {
      active = false
    }
  }, [id, initialOrder])

  if (loading) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-20 text-center">
        <p className="text-sm text-neutral-500">Confirming your order...</p>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-20 text-center">
        <p role="alert" className="text-sm text-red-700">
          {error || 'Order confirmation could not be loaded.'}
        </p>
        <Link to="/orders" className="mt-6 inline-block text-xs font-bold uppercase underline underline-offset-4">
          View your orders
        </Link>
      </main>
    )
  }

  const orderNumber = order.orderNumber ?? order.OrderNumber ?? id

  return (
    <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-16 text-center sm:px-8 sm:py-24">
      <span className="mx-auto flex h-14 w-14 items-center justify-center border border-neutral-300">
        <Check size={25} aria-hidden="true" />
      </span>
      <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
        DUDE Clothing
      </p>
      <h1 className="mt-3 text-4xl font-black uppercase">Order confirmed</h1>
      <p className="mt-4 text-sm leading-6 text-neutral-600">
        Your order has been accepted by the backend.
      </p>
      <p className="mt-3 text-sm font-semibold">Order {orderNumber}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to={`/orders/${encodeURIComponent(String(order.orderId ?? order.OrderId ?? id))}`}
          className="inline-flex min-h-12 items-center bg-black px-6 py-4 text-xs font-bold uppercase tracking-wider text-white"
        >
          Order details
        </Link>
        <Link
          to="/shop"
          className="inline-flex min-h-12 items-center border border-neutral-300 px-6 py-4 text-xs font-bold uppercase tracking-wider"
        >
          Continue shopping
        </Link>
      </div>
    </main>
  )
}