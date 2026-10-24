
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import productService from '../services/productService'

const PAGE_SIZE = 12

const SORT_OPTIONS = [
  { label: 'Default order', value: 'ProductId:asc' },
  { label: 'Highest product ID first', value: 'ProductId:desc' },
  { label: 'Name: A to Z', value: 'ProductName:asc' },
  { label: 'Name: Z to A', value: 'ProductName:desc' },
  { label: 'Price: low to high', value: 'Price:asc' },
  { label: 'Price: high to low', value: 'Price:desc' },
]

const FALLBACK_IMAGE =
  'https://placehold.co/600x800/181818/FFFFFF?text=DUDE+CLOTHING'

const getField = (item, camelCase, pascalCase) =>
  item?.[camelCase] ?? item?.[pascalCase]

const formatPrice = (price) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(price) || 0)

function getErrorMessage(error) {
  const data = error?.response?.data

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (typeof data?.message === 'string') {
    return data.message
  }

  if (typeof data?.title === 'string') {
    return data.title
  }

  if (!error?.response) {
    return 'Unable to connect to the server. Please check your connection.'
  }

  return 'Unable to load products. Please try again.'
}

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const categoryId = searchParams.get('categoryId') || ''
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('ProductId:asc')

  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  // Debounce search so we do not call the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim())
      setPage(1)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Load categories once.
  useEffect(() => {
    let cancelled = false

    async function loadCategories() {
      try {
        const data = await productService.getCategories()

        if (!cancelled) {
          const activeCategories = Array.isArray(data)
            ? data.filter(
                (category) =>
                  getField(category, 'isActive', 'IsActive') !== false,
              )
            : []

          setCategories(activeCategories)
          setCategoryError('')
        }
      } catch {
        if (!cancelled) {
          setCategoryError(
            'Categories could not be loaded. You can still browse products.',
          )
        }
      }
    }

    loadCategories()

    return () => {
      cancelled = true
    }
  }, [])

  // Fetch products using backend filters and pagination.
  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      setLoading(true)
      setError('')

      try {
        const [sortBy, sortDirection] = sort.split(':')

        const filters = {
          page,
          pageSize: PAGE_SIZE,
          sortBy,
          sortDirection,
        }

        if (searchTerm) {
          filters.term = searchTerm
        }

        if (categoryId) {
          filters.categoryId = Number(categoryId)
        }

        if (minPrice !== '') {
          filters.minPrice = Number(minPrice)
        }

        if (maxPrice !== '') {
          filters.maxPrice = Number(maxPrice)
        }

        const isDefaultSort = sort === 'ProductId:asc'
        const hasPriceFilter = minPrice !== '' || maxPrice !== ''
        const data = searchTerm && !categoryId && !hasPriceFilter && isDefaultSort
          ? await productService.search(searchTerm, { page, pageSize: PAGE_SIZE })
          : categoryId && !searchTerm && !hasPriceFilter && isDefaultSort
            ? await productService.getByCategory(categoryId, { page, pageSize: PAGE_SIZE })
            : await productService.getAll(filters)

        if (!cancelled) {
          setProducts(Array.isArray(data) ? data : [])
        }
      } catch (requestError) {
        if (!cancelled) {
          setProducts([])
          setError(getErrorMessage(requestError))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProducts()

    return () => {
      cancelled = true
    }
  }, [
    searchTerm,
    categoryId,
    minPrice,
    maxPrice,
    sort,
    page,
    retryCount,
  ])

  const invalidPriceRange =
    (minPrice !== '' &&
      (!Number.isFinite(Number(minPrice)) || Number(minPrice) < 0)) ||
    (maxPrice !== '' &&
      (!Number.isFinite(Number(maxPrice)) || Number(maxPrice) < 0)) ||
    (minPrice !== '' &&
      maxPrice !== '' &&
      Number(minPrice) > Number(maxPrice))

  function clearFilters() {
    setSearchInput('')
    setSearchTerm('')
    setCategoryId('')
    setMinPrice('')
    setMaxPrice('')
    setSort('ProductId:asc')
    setPage(1)
    setSearchParams({}, { replace: true })
  }

  function handlePriceChange(setter, value) {
    setter(value)
    setPage(1)
  }

  const hasNextPage = products.length === PAGE_SIZE

  return (
    <main className="shop-page min-h-screen text-neutral-900">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-6 border-b border-neutral-300 pb-6 sm:mb-8">
          <p className="editorial-kicker mb-2 text-neutral-600">
            DUDE CLOTHING
          </p>

          <h1 className="text-4xl font-extrabold uppercase leading-none sm:text-5xl">
            Shop All
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
            Discover everyday essentials and build your own style.
          </p>
        </div>

        <div className="shop-filter-grid mb-6">
          <div>
            <label
              htmlFor="product-search"
              className="mb-1 block"
            >
              Search products
            </label>

            <input
              id="product-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search clothing..."
              className="w-full bg-white outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="category-filter"
              className="mb-1 block"
            >
              Category
            </label>

            <select
              id="category-filter"
              value={categoryId}
              onChange={(event) => {
                setPage(1)
                if (event.target.value) {
                  setSearchParams(
                    { categoryId: event.target.value },
                    { replace: true },
                  )
                } else {
                  setSearchParams({}, { replace: true })
                }
              }}
              className="w-full bg-white outline-none"
            >
              <option value="">All categories</option>

              {categories.map((category) => (
                <option
                  key={getField(category, 'categoryId', 'CategoryId')}
                  value={getField(category, 'categoryId', 'CategoryId')}
                >
                  {getField(category, 'categoryName', 'CategoryName')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="min-price"
              className="mb-1 block"
            >
              Minimum price (LKR)
            </label>

            <input
              id="min-price"
              type="number"
              min="0"
              step="0.01"
              value={minPrice}
              onChange={(event) =>
                handlePriceChange(setMinPrice, event.target.value)
              }
              placeholder="0"
              className="w-full bg-white outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="max-price"
              className="mb-1 block"
            >
              Maximum price (LKR)
            </label>

            <input
              id="max-price"
              type="number"
              min="0"
              step="0.01"
              value={maxPrice}
              onChange={(event) =>
                handlePriceChange(setMaxPrice, event.target.value)
              }
              placeholder="No maximum"
              className="w-full bg-white outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="sort-products"
              className="mb-1 block"
            >
              Sort by
            </label>

            <select
              id="sort-products"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value)
                setPage(1)
              }}
              className="w-full bg-white outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {categoryError && (
          <p className="mb-4 text-sm text-amber-700">
            {categoryError}
          </p>
        )}

        {invalidPriceRange && (
          <p className="mb-4 text-sm text-red-600">
            Enter valid non-negative prices. The minimum cannot exceed the maximum.
          </p>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-600">
            {loading
              ? 'Loading products...'
              : `${products.length} product${products.length === 1 ? '' : 's'} on this page`}
          </p>

          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium underline underline-offset-4 hover:text-neutral-500"
          >
            Clear filters
          </button>
        </div>

        {error && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="font-medium text-red-800">
              Could not load products
            </p>

            <p className="mt-2 text-sm text-red-700">{error}</p>

            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-4 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Try again
            </button>
          </div>
        )}

        {!error && !loading && invalidPriceRange && (
          <p className="py-12 text-center text-neutral-500">
            Correct the price range to view matching products.
          </p>
        )}

        {!error && !loading && !invalidPriceRange && products.length === 0 && (
          <div className="rounded-xl border border-neutral-200 px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">
              No products found
            </h2>

            <p className="mt-2 text-sm text-neutral-600">
              Try another search term or adjust your filters.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800"
            >
              View all products
            </button>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="animate-pulse">
                <div className="aspect-[3/4] rounded-lg bg-neutral-200" />
                <div className="mt-3 h-4 w-3/4 rounded bg-neutral-200" />
                <div className="mt-2 h-4 w-1/3 rounded bg-neutral-200" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && !invalidPriceRange && products.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            {products.map((product) => {
              const id = getField(product, 'productId', 'ProductId')
              const name = getField(product, 'productName', 'ProductName')
              const category = getField(
                product,
                'categoryName',
                'CategoryName',
              )
              const imageUrl = getField(product, 'imageUrl', 'ImageUrl')
              const price = getField(product, 'price', 'Price')
              const stock = Number(
                getField(product, 'stockQuantity', 'StockQuantity') ?? 0,
              )

              return (
                <article key={id} className="shop-product-card group min-w-0">
                  <Link
                    to={`/product/${encodeURIComponent(String(id))}`}
                    className="block"
                  >
                    <div className="shop-product-image aspect-[4/5]">
                      <img
                        src={imageUrl || FALLBACK_IMAGE}
                        alt={name || 'Clothing product'}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null
                          event.currentTarget.src = FALLBACK_IMAGE
                        }}
                        className="h-full w-full object-cover"
                      />

                      {stock <= 0 && (
                        <span className="absolute left-2 top-2 bg-[var(--acid)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-neutral-900">
                          Out of stock
                        </span>
                      )}
                    </div>

                    <div className="shop-product-copy">
                      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-neutral-500">
                        {category || 'Clothing'}
                      </p>

                      <h2 className="mt-1 line-clamp-2 text-lg font-bold uppercase leading-[1.05] group-hover:underline">
                        {name || 'Unnamed product'}
                      </h2>

                      <p className="mt-2 font-semibold">
                        {formatPrice(price)}
                      </p>
                    </div>
                  </Link>
                </article>
              )
            })}
          </div>
        )}

        {!loading && !error && !invalidPriceRange && (
          <nav
            aria-label="Product pagination"
            className="mt-10 flex items-center justify-center gap-4"
          >
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-sm text-neutral-600">
              Page {page}
            </span>

            <button
              type="button"
              disabled={!hasNextPage}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </main>
  )
}
