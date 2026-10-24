
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  ShoppingBag,
} from 'lucide-react'
import productService from '../services/productService'
import { useCart } from '../context/CartContext'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'

const field = (item, ...keys) => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item[key] !== null) {
      return item[key]
    }
  }

  return undefined
}

function formatPrice(price) {
  if (price == null || !Number.isFinite(Number(price))) {
    return 'Price unavailable'
  }

  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(price))
}

function normalizeProduct(data) {
  return {
    id: field(data, 'productId', 'ProductId', 'id', 'Id'),
    name:
      field(data, 'productName', 'ProductName', 'name', 'Name') ||
      'DUDE Essential',
    description:
      field(data, 'description', 'Description') ||
      'A clean essential for your everyday wardrobe.',
    price: field(data, 'price', 'Price'),
    image:
      field(data, 'imageUrl', 'ImageUrl', 'image', 'Image') ||
      FALLBACK_IMAGE,
    category:
      field(data, 'categoryName', 'CategoryName') ||
      'DUDE COLLECTION',
    stock: Math.max(
      0,
      Number(field(data, 'stockQuantity', 'StockQuantity') ?? 0) || 0,
    ),
  }
}

function normalizeVariant(item) {
  const rawStock = field(
    item,
    'stockQuantity',
    'StockQuantity',
    'availableStock',
    'AvailableStock',
    'quantity',
    'Quantity',
  )

  return {
    id: field(item, 'variantId', 'VariantId', 'id', 'Id'),
    size: String(
      field(item, 'size', 'Size', 'sizeName', 'SizeName') ?? '',
    ).trim(),
    colour: String(
      field(
        item,
        'colour',
        'Colour',
        'color',
        'Color',
        'colorName',
        'ColorName',
        'colourName',
        'ColourName',
      ) ?? '',
    ).trim(),
    stock: Math.max(0, Number(rawStock ?? 0) || 0),
    sku: field(item, 'sku', 'SKU', 'Sku') ?? '',
    price: field(item, 'price', 'Price'),
    isActive: field(item, 'isActive', 'IsActive') !== false,
    image:
      field(item, 'imageUrl', 'ImageUrl', 'image', 'Image') || '',
  }
}

function normalizeImage(item, index) {
  if (typeof item === 'string') {
    return {
      id: index,
      url: item,
      primary: false,
      sortOrder: index,
    }
  }

  return {
    id:
      field(
        item,
        'productImageId',
        'ProductImageId',
        'imageId',
        'ImageId',
        'id',
        'Id',
      ) ?? index,
    url:
      field(
        item,
        'imageUrl',
        'ImageUrl',
        'imageURL',
        'ImageURL',
        'url',
        'Url',
      ) || '',
    primary: Boolean(
      field(item, 'isPrimary', 'IsPrimary', 'primary', 'Primary'),
    ),
    sortOrder: Number(
      field(item, 'sortOrder', 'SortOrder') ?? index,
    ),
  }
}

function colourSwatch(colour) {
  const normalized = colour.trim().toLowerCase()

  const knownColours = {
    black: '#171717',
    white: '#ffffff',
    grey: '#808080',
    gray: '#808080',
    'light grey': '#d3d3d3',
    'dark grey': '#555555',
    red: '#dc2626',
    blue: '#2563eb',
    navy: '#1e3a5f',
    green: '#15803d',
    olive: '#65733b',
    beige: '#d6c2a1',
    cream: '#fffdd0',
    brown: '#854d27',
    pink: '#f9a8d4',
    purple: '#9333ea',
    yellow: '#facc15',
    orange: '#ea580c',
  }

  return knownColours[normalized] || '#a3a3a3'
}

export default function ProductDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()

  const [product, setProduct] = useState(null)
  const [variants, setVariants] = useState([])
  const [images, setImages] = useState([])
  const [selectedVariantId, setSelectedVariantId] = useState(null)
  const [selectedImage, setSelectedImage] = useState('')
  const [quantity, setQuantity] = useState(1)

  const [loading, setLoading] = useState(true)
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [variantError, setVariantError] = useState('')
  const [error, setError] = useState('')
  const [imageFailed, setImageFailed] = useState(false)
  const [cartMessage, setCartMessage] = useState('')
  const [cartError, setCartError] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)

  useEffect(() => {
    let active = true

    async function loadProduct() {
      setLoading(true)
      setVariantsLoading(true)
      setError('')
      setVariantError('')
      setProduct(null)
      setVariants([])
      setImages([])
      setSelectedVariantId(null)
      setSelectedImage('')
      setQuantity(1)
      setImageFailed(false)
      setCartMessage('')
      setCartError(false)

      try {
        const data = await productService.getById(id)

        if (!data || Array.isArray(data)) {
          throw new Error('The API returned an invalid product response.')
        }

        const normalizedProduct = normalizeProduct(data)

        if (normalizedProduct.id == null) {
          throw new Error('The product ID is missing from the API response.')
        }

        if (!active) return

        setProduct(normalizedProduct)
        setSelectedImage(normalizedProduct.image)

        const [variantResult, imageResult] = await Promise.allSettled([
          productService.getVariants(id),
          productService.getImages(id),
        ])

        if (!active) return

        if (variantResult.status === 'fulfilled') {
          const rawVariants = variantResult.value

          if (Array.isArray(rawVariants)) {
            const normalizedVariants = rawVariants
              .map(normalizeVariant)
              .filter(
                (variant) =>
                  variant.id != null &&
                  Number.isFinite(Number(variant.id)) &&
                  Number(variant.id) > 0 &&
                  variant.isActive &&
                  (variant.size !== '' || variant.colour !== ''),
              )

            setVariants(normalizedVariants)

            const firstVariant =
              normalizedVariants.find((variant) => variant.stock > 0) ||
              normalizedVariants[0] ||
              null

            if (firstVariant) {
              setSelectedVariantId(firstVariant.id)
            }
          } else {
            setVariantError(
              'The variants API did not return a list. Please check its response format.',
            )
          }
        } else {
          console.error(
            'Unable to load product variants:',
            variantResult.reason?.message || 'Request failed',
          )

          setVariantError(
            'Sizes and colours could not be loaded. Please try again later.',
          )
        }

        if (imageResult.status === 'fulfilled') {
          const rawImages = imageResult.value

          if (Array.isArray(rawImages)) {
            const normalizedImages = rawImages
              .map(normalizeImage)
              .filter((image) => image.url !== '')
              .sort(
                (a, b) =>
                  Number(b.primary) - Number(a.primary) ||
                  a.sortOrder - b.sortOrder,
              )

            setImages(normalizedImages)

            if (normalizedImages.length > 0) {
              setSelectedImage(normalizedImages[0].url)
            }
          }
        } else {
          console.error(
            'Unable to load product images:',
            imageResult.reason?.message || 'Request failed',
          )
        }
      } catch (err) {
        if (active) {
          console.error('Unable to load product:', err.message)

          setError(
            err.response?.status === 404
              ? 'This product could not be found.'
              : err.message || 'Unable to load this product.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
          setVariantsLoading(false)
        }
      }
    }

    if (id) {
      loadProduct()
    } else {
      setError('A product ID was not provided.')
      setLoading(false)
      setVariantsLoading(false)
    }

    return () => {
      active = false
    }
  }, [id])

  const colours = useMemo(
    () => [
      ...new Set(
        variants
          .map((variant) => variant.colour)
          .filter(Boolean),
      ),
    ],
    [variants],
  )

  const selectedVariant = useMemo(
    () =>
      variants.find(
        (variant) => String(variant.id) === String(selectedVariantId),
      ) || null,
    [variants, selectedVariantId],
  )

  const selectedColour = selectedVariant?.colour || ''
  const selectedSize = selectedVariant?.size || ''

  const availableSizes = useMemo(() => {
    const matchingVariants = selectedColour
      ? variants.filter(
          (variant) => variant.colour === selectedColour,
        )
      : variants

    return [
      ...new Map(
        matchingVariants
          .filter((variant) => variant.size)
          .map((variant) => [variant.size, variant]),
      ).values(),
    ]
  }, [variants, selectedColour])

  if (loading) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-7xl px-5 py-20 sm:px-8">
        <p className="text-sm text-neutral-500">
          Loading product details...
        </p>
      </main>
    )
  }

  if (error || !product) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-7xl px-5 py-20 sm:px-8">
        <h1 className="text-2xl font-black uppercase">
          Product unavailable
        </h1>

        <p className="mt-3 text-sm text-neutral-500">
          {error || 'We could not find this product.'}
        </p>

        <Link
          to="/shop"
          className="mt-6 inline-flex items-center gap-2 bg-black px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
        >
          <ArrowLeft size={16} />
          Back to shop
        </Link>
      </main>
    )
  }

  const stock = selectedVariant?.stock ?? 0
  const displayedPrice = selectedVariant?.price ?? product.price

  const imageSrc = imageFailed
    ? FALLBACK_IMAGE
    : selectedImage || product.image || FALLBACK_IMAGE

  function chooseColour(colour) {
    const matchingVariants = variants.filter(
      (variant) => variant.colour === colour,
    )

    const nextVariant =
      matchingVariants.find(
        (variant) =>
          variant.size === selectedSize && variant.stock > 0,
      ) ||
      matchingVariants.find((variant) => variant.stock > 0) ||
      matchingVariants.find(
        (variant) => variant.size === selectedSize,
      ) ||
      matchingVariants[0]

    if (nextVariant) {
      setSelectedVariantId(nextVariant.id)
      setQuantity(1)
      setCartMessage('')

      if (nextVariant.image) {
        setSelectedImage(nextVariant.image)
        setImageFailed(false)
      }
    }
  }

  function chooseSize(size) {
    const matchingVariants = variants.filter(
      (variant) =>
        variant.size === size &&
        (!selectedColour || variant.colour === selectedColour),
    )

    const nextVariant =
      matchingVariants.find((variant) => variant.stock > 0) ||
      matchingVariants[0]

    if (nextVariant) {
      setSelectedVariantId(nextVariant.id)
      setQuantity(1)
      setCartMessage('')

      if (nextVariant.image) {
        setSelectedImage(nextVariant.image)
        setImageFailed(false)
      }
    }
  }

  async function handleAddToCart() {
    if (addingToCart) return

    setCartMessage('')
    setCartError(false)

    if (variantsLoading) {
      setCartError(true)
      setCartMessage('Please wait while product options load.')
      return
    }

    if (!selectedVariant || !Number.isFinite(Number(selectedVariant.id))) {
      setCartError(true)
      setCartMessage(
        variantError ||
          'No valid product variant is available. Please check the product options.',
      )
      return
    }

    if (stock <= 0) {
      setCartError(true)
      setCartMessage('Sorry, this selection is out of stock.')
      return
    }

    if (quantity < 1 || quantity > stock) {
      setCartError(true)
      setCartMessage(
        `Please select a quantity between 1 and ${stock}.`,
      )
      return
    }

    setAddingToCart(true)

    try {
      const result = await addToCart(
        {
          ...product,
          variantId: selectedVariant.id,
          size: selectedVariant.size,
          colour: selectedVariant.colour,
          color: selectedVariant.colour,
          sku: selectedVariant.sku,
          price: displayedPrice,
          stockQuantity: stock,
        },
        quantity,
      )

      setCartError(!result.success)
      setCartMessage(result.message)

      if (result.requiresLogin) {
        navigate('/login', {
          state: { from: `/product/${id}` },
        })
      }
    } catch (err) {
      console.error('Unable to add product to cart:', err.message)
      setCartError(true)
      setCartMessage(
        'Unable to add this product to your bag. Please try again.',
      )
    } finally {
      setAddingToCart(false)
    }
  }

  return (
    <main className="product-details-page mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
      <Link
        to="/shop"
        className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-black"
      >
        <ArrowLeft size={16} />
        Back to shop
      </Link>

      <div className="grid gap-8 md:grid-cols-[1.08fr_0.92fr] md:gap-12 lg:gap-16">
        <div>
          <div className="product-gallery-frame aspect-[4/5] overflow-hidden">
            <img
              src={imageSrc}
              alt={product.name}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          </div>

          {images.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
              {images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => {
                    setSelectedImage(image.url)
                    setImageFailed(false)
                  }}
                  aria-label="View product image"
                  aria-pressed={selectedImage === image.url}
                  className={`aspect-[4/5] overflow-hidden border ${
                    selectedImage === image.url
                      ? 'border-black'
                      : 'border-neutral-300'
                  }`}
                >
                  <img
                    src={image.url}
                    alt={`${product.name} view`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <section className="product-detail-copy flex flex-col justify-center">
          <p className="editorial-kicker text-neutral-600">
            {product.category}
          </p>

          <h1 className="mt-4 text-5xl font-extrabold uppercase leading-[0.92] sm:text-6xl">
            {product.name}
          </h1>

          <p className="product-detail-price mt-5">
            {formatPrice(displayedPrice)}
          </p>

          <p className="mt-6 text-sm leading-7 text-neutral-600">
            {product.description}
          </p>

          {variantsLoading ? (
            <p className="mt-8 text-sm text-neutral-500">
              Loading colours and sizes...
            </p>
          ) : variants.length > 0 ? (
            <div className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-bold uppercase tracking-wider">
                  Colour
                </label>

                {selectedColour && (
                  <span className="text-sm text-neutral-600">
                    {selectedColour}
                  </span>
                )}
              </div>

              {colours.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  {colours.map((colour) => {
                    const isSelected = selectedColour === colour
                    const swatch = colourSwatch(colour)

                    return (
                      <button
                        key={colour}
                        type="button"
                        onClick={() => chooseColour(colour)}
                        aria-label={`Select ${colour}`}
                        aria-pressed={isSelected}
                        title={colour}
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                          isSelected
                            ? 'border-black ring-2 ring-neutral-300 ring-offset-2'
                            : 'border-neutral-200 hover:border-neutral-500'
                        }`}
                      >
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10"
                          style={{ backgroundColor: swatch }}
                        >
                          {isSelected && (
                            <Check
                              size={15}
                              className={
                                [
                                  'white',
                                  'cream',
                                  'beige',
                                  'yellow',
                                  'light grey',
                                ].includes(colour.toLowerCase())
                                  ? 'text-black'
                                  : 'text-white'
                              }
                            />
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">
                  No colour options were supplied for this product.
                </p>
              )}

              <div className="mt-8">
                <label className="text-xs font-bold uppercase tracking-wider">
                  Size
                </label>

                {availableSizes.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {availableSizes.map((variant) => {
                      const isSelected =
                        selectedVariant?.size === variant.size

                      const isAvailable = variants.some(
                        (item) =>
                          item.size === variant.size &&
                          (!selectedColour ||
                            item.colour === selectedColour) &&
                          item.stock > 0,
                      )

                      return (
                        <button
                          key={variant.size}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => chooseSize(variant.size)}
                          aria-pressed={isSelected}
                          className={`min-w-14 border px-4 py-3 text-sm font-bold transition-colors ${
                            isSelected
                              ? 'border-black bg-black text-white'
                              : 'border-neutral-300 text-black hover:border-black'
                          } disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300 disabled:line-through`}
                        >
                          {variant.size}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-neutral-500">
                    No size options were supplied for this product.
                  </p>
                )}
              </div>

              {selectedVariant && (
                <p className="mt-5 text-xs font-bold uppercase tracking-wider">
                  {stock > 0 ? (
                    <span className="text-neutral-600">
                      {stock} available
                    </span>
                  ) : (
                    <span className="text-red-700">
                      This selection is out of stock
                    </span>
                  )}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-8">
              <p role="status" className="text-sm text-amber-700">
                {variantError ||
                  'No product variants are configured for this product.'}
              </p>

              <p className="mt-3 text-xs text-neutral-500">
                A valid database variant is required before this product
                can be added to your bag.
              </p>
            </div>
          )}

          <div className="mt-8">
            <label className="text-xs font-bold uppercase tracking-wider">
              Quantity
            </label>

            <div className="mt-3 flex w-fit items-center border border-neutral-300">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1 || stock <= 0}
                onClick={() => {
                  setQuantity((value) => Math.max(1, value - 1))
                  setCartMessage('')
                }}
                className="p-3 disabled:opacity-30"
              >
                <Minus size={16} />
              </button>

              <span className="min-w-10 text-center text-sm">
                {quantity}
              </span>

              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= stock || stock <= 0}
                onClick={() => {
                  setQuantity((value) =>
                    Math.min(stock, value + 1),
                  )
                  setCartMessage('')
                }}
                className="p-3 disabled:opacity-30"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={
              addingToCart ||
              stock < 1 ||
              variantsLoading ||
              !selectedVariant
            }
            onClick={handleAddToCart}
            className="product-add-button mt-8 inline-flex w-full items-center justify-center gap-3 px-7 py-4 text-xs font-bold uppercase tracking-[0.15em] disabled:cursor-not-allowed sm:max-w-md"
          >
            <ShoppingBag size={17} />
            {addingToCart
              ? 'Adding...'
              : stock > 0
                ? 'Add to bag'
                : 'Out of stock'}
          </button>

          {cartMessage && (
            <p
              role="status"
              aria-live="polite"
              className={`mt-4 text-sm ${
                cartError ? 'text-red-700' : 'text-green-700'
              }`}
            >
              {cartMessage}
            </p>
          )}

          <Link
            to="/cart"
            className="mt-4 w-fit text-xs font-bold uppercase tracking-wider underline underline-offset-4 hover:text-neutral-500"
          >
            View your bag
          </Link>

          <p className="mt-4 text-xs leading-5 text-neutral-500">
            Availability and final order details are verified by the
            server before checkout.
          </p>
        </section>
      </div>
    </main>
  )
}
