
import { useState } from 'react'
import {
  Menu,
  X,
  Search,
  UserRound,
  ShoppingBag,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, isCustomer, isAdmin, logout } = useAuth()
  const { itemCount } = useCart()

  const closeMenu = () => setMenuOpen(false)

  function handleLogout() {
    logout()
    closeMenu()
    navigate('/', { replace: true })
  }

  const links = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop All' },
  ]

  return (
    <header className="dude-header sticky top-0 z-50 border-b">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-4 sm:px-8">
        <button
          type="button"
          className="dude-nav-action grid md:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>

        <Link
          to="/"
          onClick={closeMenu}
          className="dude-wordmark"
        >
          DUDE.
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={location.pathname === link.to ? 'page' : undefined}
              className="dude-nav-link"
            >
              {link.label}
            </Link>
          ))}
          {isAuthenticated && (
            <Link
              to="/orders"
              aria-current={location.pathname.startsWith('/orders') ? 'page' : undefined}
              className="dude-nav-link"
            >
              Orders
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              aria-current={location.pathname.startsWith('/admin') ? 'page' : undefined}
              className="dude-nav-link"
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            to="/shop"
            aria-label="Search products"
            title="Search products"
            className="dude-nav-action grid"
          >
            <Search size={20} strokeWidth={1.6} />
          </Link>

          <Link
            to={isAuthenticated ? '/account' : '/login'}
            aria-label={isAuthenticated ? 'Your account' : 'Sign in'}
            title={isAuthenticated ? 'Your account' : 'Sign in'}
            className="dude-nav-action hidden sm:grid"
          >
            <UserRound size={20} strokeWidth={1.6} />
          </Link>

          {(!isAuthenticated || isCustomer) && (
            <Link
              to="/cart"
              aria-label={`Shopping bag, ${itemCount} items`}
              title={`${itemCount} items in bag`}
              className="dude-nav-action dude-bag-action relative grid"
            >
              <ShoppingBag size={20} strokeWidth={1.6} />
              {itemCount > 0 && (
                <span className="dude-bag-count absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center px-1 text-[9px] font-bold">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <nav className="dude-mobile-menu bg-white px-5 py-6 md:hidden">
          <div className="flex flex-col gap-6">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMenu}
                className="text-xs font-semibold uppercase tracking-widest"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to={isAuthenticated ? '/account' : '/login'}
              onClick={closeMenu}
              className="text-xs font-semibold uppercase tracking-widest"
            >
              {isAuthenticated ? user?.fullName || 'My account' : 'Sign in'}
            </Link>
            {isAuthenticated && (
              <Link
                to="/orders"
                onClick={closeMenu}
                className="text-xs font-semibold uppercase tracking-widest"
              >
                Order history
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={closeMenu}
                className="text-xs font-semibold uppercase tracking-widest"
              >
                Admin
              </Link>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogout}
                className="w-fit text-left text-xs font-semibold uppercase tracking-widest text-neutral-500"
              >
                Sign out
              </button>
            )}
            {(!isAuthenticated || isCustomer) && (
              <Link
                to="/cart"
                onClick={closeMenu}
                className="text-xs font-semibold uppercase tracking-widest"
              >
                Bag ({itemCount})
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
