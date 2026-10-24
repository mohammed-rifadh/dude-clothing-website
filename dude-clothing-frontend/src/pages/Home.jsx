
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import productService from '../services/productService'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=2000&q=85'

const FALLBACK_IMAGE =
  'https://placehold.co/600x750/f2f2f2/555555?text=Image+unavailable'

function getProductFields(product) {
  const rawPrice = product.price ?? product.Price ?? null

  const parsedPrice =
    rawPrice === null || rawPrice === ''
      ? null
      : Number(rawPrice)

  const rawStock =
    product.stockQuantity ?? product.StockQuantity ?? 0

  const parsedStock = Number(rawStock)

  return {
    id: product.productId ?? product.ProductId,
    name:
      product.productName ??
      product.ProductName ??
      'DUDE Essential',
    description:
      product.description ??
      product.Description ??
      'A clean essential for your everyday wardrobe.',
    price:
      parsedPrice !== null && Number.isFinite(parsedPrice)
        ? parsedPrice
        : null,
    image:
      product.imageUrl ??
      product.ImageUrl ??
      null,
    category:
      product.categoryName ??
      product.CategoryName ??
      'DUDE COLLECTION',
    stockQuantity:
      Number.isFinite(parsedStock) ? parsedStock : 0,
  }
}

function formatPrice(price) {
  if (price === null || price === undefined) {
    return 'Price unavailable'
  }

  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(price)
}

function SectionLabel({ children, light = false }) {
  return (
    <p
      className={`text-xs font-bold uppercase tracking-[0.24em] ${
        light ? 'text-neutral-400' : 'text-neutral-500'
      }`}
    >
      {children}
    </p>
  )
}

function ProductCard({ product, index }) {
  const [imageFailed, setImageFailed] = useState(false)

  const imageSrc =
    !imageFailed && product.image
      ? product.image
      : FALLBACK_IMAGE

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.45, delay: index * 0.07 }}
      className="group min-w-0"
    >
      <Link
        to={`/product/${encodeURIComponent(String(product.id))}`}
        aria-label={`View ${product.name}`}
        className="block"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
          <img
            src={imageSrc}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />

          <span className="absolute left-3 top-3 bg-[var(--acid)] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.13em] text-neutral-900">
            {product.category}
          </span>

          <span className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center bg-white text-black transition-colors group-hover:bg-[var(--acid)]">
            <ArrowUpRight size={18} aria-hidden="true" />
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 pt-4">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              {product.category}
            </p>

            <h3 className="break-words text-sm font-semibold text-neutral-950 sm:text-base">
              {product.name}
            </h3>
          </div>

          <p className="shrink-0 text-sm font-semibold text-neutral-950">
            {formatPrice(product.price)}
          </p>
        </div>
      </Link>

      <p
        className={`mt-3 text-[10px] font-bold uppercase tracking-[0.14em] ${
          product.stockQuantity > 0
            ? 'text-neutral-600'
            : 'text-red-700'
        }`}
      >
        {product.stockQuantity > 0
          ? 'In stock'
          : 'Out of stock'}
      </p>
    </motion.article>
  )
}

export default function Home() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const payload = await productService.getAll()

      // Your API returns a direct JSON array.
      if (!Array.isArray(payload)) {
        throw new Error(
          'The Products API did not return a JSON array. Check its response in the browser console.',
        )
      }

      const mappedProducts = payload
        .map(getProductFields)
        .filter((product) => product.id != null)

      setProducts(mappedProducts)
    } catch (error) {
      console.error('Could not load DUDE products:', error)

      setProducts([])

      if (error.response) {
        setErrorMessage(
          `The Products API returned HTTP ${error.response.status}. Check the API response and backend logs.`,
        )
      } else if (error.code === 'ECONNABORTED') {
        setErrorMessage(
          'The request timed out. Check whether the backend is running.',
        )
      } else {
        setErrorMessage(
          error.message ||
            'Could not connect to the Products API. Check the API URL, HTTPS certificate, and CORS settings.',
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    let active = true

    productService
      .getCategories()
      .then((data) => {
        if (active && Array.isArray(data)) {
          setCategories(
            data.filter(
              (category) =>
                (category.isActive ?? category.IsActive) !== false &&
                (category.categoryId ?? category.CategoryId) != null,
            ),
          )
        }
      })
      .catch((error) => {
        console.error('Could not load DUDE categories:', error.message)
      })

    return () => {
      active = false
    }
  }, [])

  const featuredProducts = products.slice(0, 4)

  return (
    <main className="bg-white text-neutral-950">
      {/* HERO */}
      <section className="home-hero relative min-h-[620px] overflow-hidden bg-neutral-900 sm:min-h-[700px]">
        <img
          src={HERO_IMAGE}
          alt="Contemporary casual clothing collection"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />

        <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-5 py-20 sm:min-h-[700px] sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl"
          >
            <p className="editorial-kicker mb-6 text-white/80">
              DUDE CLOTHING · EVERYDAY ESSENTIALS
            </p>

            <h1 className="text-6xl font-black uppercase leading-[0.82] text-white sm:text-8xl lg:text-9xl">
              Wear your
              <br />
              own rules.
            </h1>

            <p className="mt-7 max-w-md text-sm leading-7 text-white/80 sm:text-base">
              Everyday essentials. Confident fits. Timeless style.
              Discover the pieces that make your look your own.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/shop"
                className="inline-flex min-h-12 items-center justify-center gap-3 bg-white px-7 py-4 text-xs font-bold uppercase tracking-[0.15em] text-black transition-colors hover:bg-neutral-200"
              >
                Shop collection
                <ArrowRight size={16} aria-hidden="true" />
              </Link>

              <Link
                to="#featured"
                className="inline-flex min-h-12 items-center justify-center border border-white/70 bg-transparent px-7 py-4 text-xs font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-white hover:text-black"
              >
                Explore
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-6 right-6 hidden text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 sm:block">
          <p>Made for everyday</p>
          <p className="mt-1">Built around you</p>
        </div>
      </section>

      {/* BRAND VALUES */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-neutral-200 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-12">
          <div className="py-7 sm:px-6 sm:py-9">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-950">
              01 / Everyday comfort
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Easy-to-wear pieces for your daily rotation.
            </p>
          </div>

          <div className="py-7 sm:px-6 sm:py-9">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-950">
              02 / Effortless style
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Clean designs that work with your own style.
            </p>
          </div>

          <div className="py-7 sm:px-6 sm:py-9">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-950">
              03 / Made to move
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Versatile essentials for wherever the day goes.
            </p>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="border-y border-neutral-200 bg-neutral-50">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em]">
              Shop by category
            </h2>
            <nav
              aria-label="Product categories"
              className="flex flex-wrap gap-x-6 gap-y-3"
            >
              {categories.map((category) => {
                const categoryId =
                  category.categoryId ?? category.CategoryId
                const categoryName =
                  category.categoryName ?? category.CategoryName

                return (
                  <Link
                    key={categoryId}
                    to={`/shop?categoryId=${encodeURIComponent(categoryId)}`}
                    className="text-sm font-semibold underline underline-offset-4 transition-colors hover:text-neutral-500"
                  >
                    {categoryName}
                  </Link>
                )
              })}
            </nav>
          </div>
        </section>
      )}

      {/* FEATURED PRODUCTS */}
      <section
        id="featured"
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
      >
        <div className="mb-10 flex flex-col justify-between gap-5 sm:mb-12 sm:flex-row sm:items-end">
          <div>
            <SectionLabel>Selected for you</SectionLabel>

            <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-neutral-950 sm:text-5xl">
              Featured pieces
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-500">
              Explore our latest essentials.
            </p>
          </div>

          <Link
            to="/shop"
            className="inline-flex w-fit items-center gap-2 border-b border-black pb-2 text-xs font-bold uppercase tracking-[0.14em] text-black transition-colors hover:text-neutral-500"
          >
            View all products
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div
            className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4"
            aria-label="Loading products"
            aria-busy="true"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index}>
                <div className="aspect-[4/5] animate-pulse bg-neutral-100" />
                <div className="mt-4 h-3 w-1/3 animate-pulse bg-neutral-100" />
                <div className="mt-3 h-4 w-3/4 animate-pulse bg-neutral-100" />
                <div className="mt-3 h-3 w-1/4 animate-pulse bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : errorMessage ? (
          <div className="border border-neutral-200 px-6 py-12 text-center">
            <p className="text-base font-bold text-neutral-950">
              Products could not be loaded
            </p>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-600">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={loadProducts}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 bg-black px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-neutral-700"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="border border-neutral-200 px-6 py-12 text-center">
            <ShoppingBag
              size={28}
              className="mx-auto text-neutral-400"
              aria-hidden="true"
            />

            <p className="mt-4 text-base font-bold text-neutral-950">
              No products available yet
            </p>

            <p className="mt-2 text-sm text-neutral-500">
              The API returned an empty product list.
            </p>

            <button
              type="button"
              onClick={loadProducts}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 border border-black bg-white px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-black transition-colors hover:bg-black hover:text-white"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Refresh products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">
            {featuredProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
              />
            ))}
          </div>
        )}
      </section>

      {/* BRAND STATEMENT */}
      <section className="bg-black text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-12">
          <div>
            <SectionLabel light>Our philosophy</SectionLabel>

            <h2 className="mt-4 text-4xl font-black uppercase leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl">
              Less noise.
              <br />
              More you.
            </h2>
          </div>

          <div>
            <p className="max-w-xl text-sm leading-7 text-neutral-300 sm:text-base">
              Style does not need to be complicated. DUDE Clothing is about
              building a wardrobe around confidence, comfort, and simplicity.
              Choose your essentials and make them your own.
            </p>

            <Link
              to="/shop"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 bg-white px-7 py-4 text-xs font-bold uppercase tracking-[0.15em] text-black transition-colors hover:bg-neutral-200"
            >
              Discover DUDE
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 py-20 text-center sm:px-8 sm:py-28">
        <SectionLabel>Find your everyday uniform</SectionLabel>

        <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black uppercase tracking-[-0.045em] text-neutral-950 sm:text-6xl">
          Your style.
          <br />
          Your standards.
        </h2>

        <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-neutral-500">
          Start with the essentials. Build a look that feels like you.
        </p>

        <Link
          to="/shop"
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 bg-black px-8 py-4 text-xs font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-neutral-700"
        >
          Shop now
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </main>
  )
}
