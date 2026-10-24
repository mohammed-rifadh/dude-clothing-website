
import { lazy, Suspense } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'

import Navbar from './components/Navbar'
import Footer from './components/Footer'

import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetails from './pages/ProductDetails'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'

import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import { useAuth } from './context/AuthContext'

const OrderHistory = lazy(() => import('./pages/OrderHistory'))
const OrderDetails = lazy(() => import('./pages/OrderDetails'))
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'))
const Admin = lazy(() => import('./pages/Admin'))

function RequireAuth({ children }) {
  const { isAuthenticated, isReady } = useAuth()
  const location = useLocation()

  if (!isReady) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-5">
        <p className="text-sm text-neutral-500">Checking your session...</p>
      </main>
    )
  }

  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  )
}

function RequireCustomer({ children }) {
  const { isAuthenticated, isCustomer, isReady } = useAuth()
  const location = useLocation()

  if (!isReady) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-5">
        <p className="text-sm text-neutral-500">Checking your session...</p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return isCustomer ? children : <Navigate to="/account" replace />
}

function RequireAdmin({ children }) {
  const { isAuthenticated, isReady, user } = useAuth()
  const location = useLocation()

  if (!isReady) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-5">
        <p className="text-sm text-neutral-500">Checking your session...</p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const role = user?.role ?? user?.Role

  return String(role).toLowerCase() === 'admin' ? (
    children
  ) : (
    <Navigate to="/account" replace />
  )
}

function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
        DUDE Clothing
      </p>

      <h1 className="mt-4 text-5xl font-black uppercase">404</h1>

      <p className="mt-3 text-sm text-neutral-500">
        Sorry, the page you requested could not be found.
      </p>

      <Link
        to="/"
        className="mt-7 bg-black px-7 py-4 text-xs font-bold uppercase tracking-wider text-white hover:bg-neutral-700"
      >
        Back to home
      </Link>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />

            <div className="flex-1">
              <Suspense
                fallback={(
                  <main className="flex min-h-[60vh] items-center justify-center px-5">
                    <p className="text-sm text-neutral-500">Loading page...</p>
                  </main>
                )}
              >
                <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:id" element={<ProductDetails />} />
                <Route
                  path="/cart"
                  element={
                    <RequireCustomer>
                      <Cart />
                    </RequireCustomer>
                  }
                />
                <Route
                  path="/checkout"
                  element={
                    <RequireCustomer>
                      <Checkout />
                    </RequireCustomer>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <RequireAuth>
                      <Account />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <RequireAuth>
                      <OrderHistory />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders/:id"
                  element={
                    <RequireAuth>
                      <OrderDetails />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/order-confirmation"
                  element={
                    <RequireCustomer>
                      <OrderConfirmation />
                    </RequireCustomer>
                  }
                />
                <Route
                  path="/order-confirmation/:id"
                  element={
                    <RequireCustomer>
                      <OrderConfirmation />
                    </RequireCustomer>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAdmin>
                      <Admin />
                    </RequireAdmin>
                  }
                />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </div>

            <Footer />
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
