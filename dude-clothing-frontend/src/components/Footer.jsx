
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="dude-footer">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-14 sm:px-8 md:grid-cols-3">
        <div>
          <Link to="/" className="dude-wordmark">
            DUDE.
          </Link>

          <p className="mt-4 max-w-xs text-sm leading-6 text-neutral-400">
            Everyday essentials. Elevated streetwear.
            Wear your own identity.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em]">
            Explore
          </h3>

          <div className="mt-5 flex flex-col items-start gap-3 text-sm text-neutral-300">
            <Link to="/" className="transition hover:text-black">Home</Link>
            <Link to="/shop" className="transition hover:text-black">Shop All</Link>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em]">
            Your account
          </h3>

          <div className="mt-5 flex flex-col items-start gap-3 text-sm text-neutral-300">
            <Link to="/login" className="transition hover:text-black">Sign in</Link>
            <Link to="/register" className="transition hover:text-black">Create account</Link>
            <Link to="/cart" className="transition hover:text-black">Shopping bag</Link>
          </div>
        </div>
      </div>

      <div className="dude-footer-bottom border-t px-5 py-5 text-center text-[10px] uppercase tracking-[0.15em]">
        © {new Date().getFullYear()} DUDE Clothing. All rights reserved.
      </div>
    </footer>
  )
}
