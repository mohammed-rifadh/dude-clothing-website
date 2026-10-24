import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle, RotateCw } from 'lucide-react'
import orderService from '../services/orderService'
import productService from '../services/productService'
import { getCartErrorMessage } from '../services/cartService'

const SECTIONS = [
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'variants', label: 'Variants' },
  { id: 'images', label: 'Images' },
]

const ORDER_TRANSITIONS = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
}

const emptyCategory = { categoryName: '', description: '' }
const emptyProduct = {
  categoryId: '',
  productName: '',
  description: '',
  price: '',
  imageUrl: '',
}
const emptyVariant = {
  sku: '',
  size: '',
  colour: '',
  stockQuantity: '0',
}
const emptyImage = {
  imageUrl: '',
  altText: '',
  isPrimary: false,
  sortOrder: '0',
}

function field(item, camel, pascal) {
  return item?.[camel] ?? item?.[pascal]
}

function formatPrice(price) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(price) || 0)
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

function Input({ label, name, value, onChange, type = 'text', ...props }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className="mt-2 w-full border border-neutral-300 px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black"
        {...props}
      />
    </label>
  )
}

function ActionButton({
  children,
  disabled,
  onClick,
  tone = 'dark',
  type = 'button',
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-10 px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'light'
          ? 'border border-neutral-300 hover:border-black'
          : 'bg-black text-white hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  )
}

export default function Admin() {
  const [section, setSection] = useState('orders')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [orders, setOrders] = useState([])
  const [variants, setVariants] = useState([])
  const [images, setImages] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const selectedProductIdRef = useRef('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const [message, setMessage] = useState('')
  const [messageError, setMessageError] = useState(false)

  const [categoryForm, setCategoryForm] = useState(emptyCategory)
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [productForm, setProductForm] = useState(emptyProduct)
  const [editingProductId, setEditingProductId] = useState(null)
  const [variantForm, setVariantForm] = useState(emptyVariant)
  const [editingVariantId, setEditingVariantId] = useState(null)
  const [imageForm, setImageForm] = useState(emptyImage)
  const [editingImageId, setEditingImageId] = useState(null)
  const [stockValues, setStockValues] = useState({})
  const [sortValues, setSortValues] = useState({})

  useEffect(() => {
    let active = true

    async function loadBaseData() {
      setLoading(true)

      try {
        if (section === 'orders') {
          const result = await orderService.getAll()
          if (active) setOrders(Array.isArray(result) ? result : [])
        } else {
          const [productResult, categoryResult] = await Promise.all([
            productService.getAllForAdmin({ page: 1, pageSize: 100 }),
            productService.getCategoriesForAdmin(),
          ])

          if (active) {
            const adminProducts = Array.isArray(productResult)
              ? productResult
              : []
            const adminCategories = Array.isArray(categoryResult)
              ? categoryResult
              : []

            setProducts(adminProducts)
            setCategories(adminCategories)
            const selectedProductExists = adminProducts.some(
              (product) =>
                String(field(product, 'productId', 'ProductId')) ===
                selectedProductIdRef.current,
            )
            if (!selectedProductExists && adminProducts.length) {
              const firstProduct =
                adminProducts.find(
                  (product) =>
                    field(product, 'isActive', 'IsActive') !== false,
                ) || adminProducts[0]
              const firstProductId = String(
                field(firstProduct, 'productId', 'ProductId'),
              )
              selectedProductIdRef.current = firstProductId
              setSelectedProductId(firstProductId)
            }
          }
        }
      } catch (error) {
        if (active) {
          setMessage(getCartErrorMessage(error))
          setMessageError(true)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadBaseData()

    return () => {
      active = false
    }
  }, [section, reload])

  useEffect(() => {
    if (!selectedProductId || !['variants', 'images'].includes(section)) {
      return undefined
    }

    let active = true

    async function loadProductData() {
      try {
        const response =
          section === 'variants'
            ? await productService.getVariantsForAdmin()
            : await productService.getImages(selectedProductId)

        if (active) {
          if (section === 'variants') {
            setVariants(
              Array.isArray(response)
                ? response.filter(
                    (variant) =>
                      String(field(variant, 'productId', 'ProductId')) ===
                      String(selectedProductId),
                  )
                : [],
            )
          } else {
            setImages(Array.isArray(response) ? response : [])
          }
        }
      } catch (error) {
        if (active) {
          setMessage(getCartErrorMessage(error))
          setMessageError(true)
        }
      }
    }

    loadProductData()

    return () => {
      active = false
    }
  }, [section, selectedProductId, reload])

  function changeForm(setter) {
    return (event) => {
      const { name, value, checked, type } = event.target
      setter((current) => ({
        ...current,
        [name]: type === 'checkbox' ? checked : value,
      }))
    }
  }

  async function perform(action, successMessage) {
    setSaving(true)
    setMessage('')
    setMessageError(false)

    try {
      await action()
      setMessage(successMessage)
      setReload((value) => value + 1)
    } catch (error) {
      setMessage(getCartErrorMessage(error))
      setMessageError(true)
    } finally {
      setSaving(false)
    }
  }

  function editCategory(category) {
    setEditingCategoryId(field(category, 'categoryId', 'CategoryId'))
    setCategoryForm({
      categoryName: field(category, 'categoryName', 'CategoryName') || '',
      description: field(category, 'description', 'Description') || '',
    })
  }

  function editProduct(product) {
    const categoryName = field(product, 'categoryName', 'CategoryName')
    const category = categories.find(
      (item) => field(item, 'categoryName', 'CategoryName') === categoryName,
    )

    setEditingProductId(field(product, 'productId', 'ProductId'))
    setProductForm({
      categoryId: String(field(category, 'categoryId', 'CategoryId') || ''),
      productName: field(product, 'productName', 'ProductName') || '',
      description: field(product, 'description', 'Description') || '',
      price: String(field(product, 'price', 'Price') ?? ''),
      imageUrl: field(product, 'imageUrl', 'ImageUrl') || '',
    })
  }

  function editVariant(variant) {
    setEditingVariantId(field(variant, 'variantId', 'VariantId'))
    setVariantForm({
      sku: field(variant, 'sku', 'SKU') || '',
      size: field(variant, 'size', 'Size') || '',
      colour: field(variant, 'colour', 'Colour') || '',
      stockQuantity: String(field(variant, 'stockQuantity', 'StockQuantity') ?? 0),
    })
  }

  async function saveCategory(event) {
    event.preventDefault()
    const data = {
      categoryName: categoryForm.categoryName.trim(),
      description: categoryForm.description.trim() || null,
    }

    await perform(
      async () => {
        if (editingCategoryId) {
          await productService.updateCategory(editingCategoryId, data)
        } else {
          await productService.createCategory(data)
        }
        setCategoryForm(emptyCategory)
        setEditingCategoryId(null)
      },
      editingCategoryId ? 'Category updated.' : 'Category created.',
    )
  }

  async function saveProduct(event) {
    event.preventDefault()
    const data = {
      categoryId: Number(productForm.categoryId),
      productName: productForm.productName.trim(),
      description: productForm.description.trim(),
      price: Number(productForm.price),
      imageUrl: productForm.imageUrl.trim() || null,
    }

    await perform(
      async () => {
        if (editingProductId) {
          await productService.updateProduct(editingProductId, data)
        } else {
          await productService.createProduct(data)
        }
        setProductForm(emptyProduct)
        setEditingProductId(null)
      },
      editingProductId ? 'Product updated.' : 'Product created.',
    )
  }

  async function saveVariant(event) {
    event.preventDefault()

    const selectedProduct = products.find(
      (product) =>
        String(field(product, 'productId', 'ProductId')) ===
        String(selectedProductId),
    )

    if (field(selectedProduct, 'isActive', 'IsActive') === false) {
      setMessage('Activate the parent product before adding a variant.')
      setMessageError(true)
      return
    }

    const data = {
      productId: Number(selectedProductId),
      sku: variantForm.sku.trim(),
      size: variantForm.size.trim(),
      colour: variantForm.colour.trim(),
      stockQuantity: Number(variantForm.stockQuantity),
    }

    await perform(
      async () => {
        if (editingVariantId) {
          await productService.updateVariant(editingVariantId, data)
        } else {
          await productService.createVariant(data)
        }
        setVariantForm(emptyVariant)
        setEditingVariantId(null)
      },
      editingVariantId ? 'Variant updated.' : 'Variant created.',
    )
  }

  async function saveImage(event) {
    event.preventDefault()
    const imageDetails = {
      imageUrl: imageForm.imageUrl.trim(),
      altText: imageForm.altText.trim() || null,
      sortOrder: Number(imageForm.sortOrder),
    }
    const data = editingImageId
      ? imageDetails
      : {
          productId: Number(selectedProductId),
          ...imageDetails,
          isPrimary: Boolean(imageForm.isPrimary),
        }

    await perform(
      async () => {
        if (editingImageId) {
          await productService.updateImage(editingImageId, data)
        } else {
          await productService.createImage(data)
        }
        setImageForm(emptyImage)
        setEditingImageId(null)
      },
      editingImageId ? 'Product image updated.' : 'Product image added.',
    )
  }

  async function saveStock(variant) {
    const id = field(variant, 'variantId', 'VariantId')
    const stockQuantity = Number(
      stockValues[id] ?? field(variant, 'stockQuantity', 'StockQuantity'),
    )

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      setMessage('Stock must be a non-negative whole number.')
      setMessageError(true)
      return
    }

    await perform(
      () => productService.updateVariantStock(id, stockQuantity),
      'Variant stock updated.',
    )
  }

  async function updateOrderStatus(order, nextStatus) {
    const orderId = field(order, 'orderId', 'OrderId')

    await perform(
      async () => {
        await orderService.updateStatus(orderId, nextStatus)
      },
      `Order status changed to ${nextStatus}.`,
    )
  }

  async function toggleActivation(entity, id, isActive, parentProductId) {
    const activate = isActive === false
    const names = {
      category: 'category',
      product: 'product',
      variant: 'variant',
    }
    const activationMethods = {
      category: productService.setCategoryActivation,
      product: productService.setProductActivation,
      variant: productService.setVariantActivation,
    }
    const name = names[entity]

    if (entity === 'variant' && activate) {
      const parentProduct = products.find(
        (product) =>
          String(field(product, 'productId', 'ProductId')) ===
          String(parentProductId),
      )

      if (!parentProduct || field(parentProduct, 'isActive', 'IsActive') === false) {
        setMessage('Activate the parent product before activating this variant.')
        setMessageError(true)
        return
      }
    }

    if (
      !activate &&
      !window.confirm(`Deactivate this ${name}? It will be hidden from customers.`)
    ) {
      return
    }

    await perform(
      () => activationMethods[entity](id, activate),
      `${name[0].toUpperCase()}${name.slice(1)} ${activate ? 'activated' : 'deactivated'}.`,
    )
  }

  const buttonClass =
    'border border-neutral-300 px-3 py-2 text-xs font-bold uppercase tracking-wider hover:border-black disabled:opacity-40'
  const selectedProduct = products.find(
    (product) =>
      String(field(product, 'productId', 'ProductId')) ===
      String(selectedProductId),
  )
  const selectedProductIsActive =
    field(selectedProduct, 'isActive', 'IsActive') !== false

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-neutral-200 pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
            DUDE Clothing
          </p>
          <h1 className="mt-2 text-4xl font-black uppercase">Admin</h1>
        </div>
        <Link to="/shop" className="text-xs font-bold uppercase underline underline-offset-4">
          View storefront
        </Link>
      </div>

      <nav aria-label="Admin sections" className="mt-6 flex flex-wrap gap-2 border-b border-neutral-200 pb-4">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSection(item.id)
              setMessage('')
            }}
            aria-pressed={section === item.id}
            className={`min-h-10 px-4 text-xs font-bold uppercase tracking-wider ${
              section === item.id
                ? 'bg-black text-white'
                : 'border border-neutral-300 hover:border-black'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {message && (
        <p
          role={messageError ? 'alert' : 'status'}
          className={`mt-5 border p-4 text-sm ${
            messageError
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-neutral-200 text-neutral-700'
          }`}
        >
          {message}
        </p>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-neutral-500">
          <LoaderCircle size={18} className="animate-spin" /> Loading {section}...
        </div>
      ) : (
        <div className="mt-8">
          {section === 'orders' && (
            <section>
              <h2 className="text-lg font-black uppercase">All orders</h2>
              {orders.length === 0 ? (
                <p className="mt-5 border-y border-neutral-200 py-10 text-sm text-neutral-500">No orders were returned.</p>
              ) : (
                <div className="mt-5 overflow-x-auto border-y border-neutral-200">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500">
                      <tr>
                        <th className="py-3 pr-4">Order</th>
                        <th className="py-3 pr-4">Customer</th>
                        <th className="py-3 pr-4">Placed</th>
                        <th className="py-3 pr-4">Total</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {orders.map((order) => {
                        const id = field(order, 'orderId', 'OrderId')
                        const status = field(order, 'orderStatus', 'OrderStatus')
                        const transitions = ORDER_TRANSITIONS[status] || []

                        return (
                          <tr key={id}>
                            <td className="py-4 pr-4">
                              <Link to={`/orders/${id}`} className="font-semibold underline underline-offset-4">
                                {field(order, 'orderNumber', 'OrderNumber') || `#${id}`}
                              </Link>
                            </td>
                            <td className="py-4 pr-4">{field(order, 'fullName', 'FullName')}</td>
                            <td className="py-4 pr-4">{formatDate(field(order, 'createdAt', 'CreatedAt'))}</td>
                            <td className="py-4 pr-4">{formatPrice(field(order, 'totalAmount', 'TotalAmount'))}</td>
                            <td className="py-4 pr-4">{status}</td>
                            <td className="py-4">
                              {transitions.length > 0 ? (
                                <select
                                  aria-label={`Update status for order ${id}`}
                                  value=""
                                  disabled={saving}
                                  onChange={(event) => {
                                    if (event.target.value) updateOrderStatus(order, event.target.value)
                                  }}
                                  className="border border-neutral-300 bg-white px-2 py-2 text-xs"
                                >
                                  <option value="">Update status</option>
                                  {transitions.map((statusOption) => (
                                    <option key={statusOption} value={statusOption}>{statusOption}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs text-neutral-400">No further transitions</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {section === 'categories' && (
            <section className="grid gap-10 lg:grid-cols-[minmax(260px,380px)_1fr]">
              <form onSubmit={saveCategory} className="h-fit space-y-4 border-b border-neutral-200 pb-6 lg:border-b-0 lg:border-r lg:pr-8">
                <h2 className="text-lg font-black uppercase">{editingCategoryId ? 'Edit category' : 'Add category'}</h2>
                <Input label="Category name" name="categoryName" value={categoryForm.categoryName} onChange={changeForm(setCategoryForm)} required minLength={2} maxLength={100} />
                <label className="block text-xs font-bold uppercase tracking-wider">
                  Description
                  <textarea name="description" value={categoryForm.description} onChange={changeForm(setCategoryForm)} maxLength={500} rows={3} className="mt-2 w-full border border-neutral-300 px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <ActionButton type="submit" disabled={saving}>{saving ? 'Saving...' : editingCategoryId ? 'Save category' : 'Create category'}</ActionButton>
                  {editingCategoryId && <ActionButton tone="light" onClick={() => { setEditingCategoryId(null); setCategoryForm(emptyCategory) }}>Cancel</ActionButton>}
                </div>
              </form>
              <div>
                <h2 className="text-lg font-black uppercase">Categories</h2>
                <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
                  {categories.map((category) => {
                    const id = field(category, 'categoryId', 'CategoryId')
                    const isActive = field(category, 'isActive', 'IsActive') !== false
                    return (
                      <div key={id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                        <div>
                          <p className="font-semibold">{field(category, 'categoryName', 'CategoryName')}</p>
                          <p className="mt-1 text-sm text-neutral-500">{field(category, 'description', 'Description')}</p>
                          <p className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-green-700' : 'text-neutral-500'}`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {isActive && <button type="button" className={buttonClass} onClick={() => editCategory(category)}>Edit</button>}
                          <button type="button" className={buttonClass} disabled={saving} onClick={() => toggleActivation('category', id, isActive)}>
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {section === 'products' && (
            <section className="grid gap-10 lg:grid-cols-[minmax(280px,400px)_1fr]">
              <form onSubmit={saveProduct} className="h-fit space-y-4 border-b border-neutral-200 pb-6 lg:border-b-0 lg:border-r lg:pr-8">
                <h2 className="text-lg font-black uppercase">{editingProductId ? 'Edit product' : 'Add product'}</h2>
                <label className="block text-xs font-bold uppercase tracking-wider">
                  Category
                  <select name="categoryId" required value={productForm.categoryId} onChange={changeForm(setProductForm)} className="mt-2 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal">
                    <option value="">Select category</option>
                    {categories
                      .filter((category) => field(category, 'isActive', 'IsActive') !== false)
                      .map((category) => <option key={field(category, 'categoryId', 'CategoryId')} value={field(category, 'categoryId', 'CategoryId')}>{field(category, 'categoryName', 'CategoryName')}</option>)}
                  </select>
                </label>
                <Input label="Product name" name="productName" value={productForm.productName} onChange={changeForm(setProductForm)} required minLength={1} maxLength={150} />
                <label className="block text-xs font-bold uppercase tracking-wider">
                  Description
                  <textarea name="description" value={productForm.description} onChange={changeForm(setProductForm)} rows={3} className="mt-2 w-full border border-neutral-300 px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black" />
                </label>
                <Input label="Price (LKR)" name="price" type="number" value={productForm.price} onChange={changeForm(setProductForm)} required min="0.01" max="999999999" step="0.01" />
                <Input label="Image URL (optional)" name="imageUrl" type="url" value={productForm.imageUrl} onChange={changeForm(setProductForm)} maxLength={1000} />
                <div className="flex gap-2">
                  <ActionButton type="submit" disabled={saving || categories.length === 0}>{saving ? 'Saving...' : editingProductId ? 'Save product' : 'Create product'}</ActionButton>
                  {editingProductId && <ActionButton tone="light" onClick={() => { setEditingProductId(null); setProductForm(emptyProduct) }}>Cancel</ActionButton>}
                </div>
              </form>
              <div>
                <h2 className="text-lg font-black uppercase">Products</h2>
                <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
                  {products.map((product) => {
                    const id = field(product, 'productId', 'ProductId')
                    const isActive = field(product, 'isActive', 'IsActive') !== false
                    return (
                      <div key={id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                        <div className="min-w-0">
                          <p className="font-semibold">{field(product, 'productName', 'ProductName')}</p>
                          <p className="mt-1 text-sm text-neutral-500">{field(product, 'categoryName', 'CategoryName')} / {formatPrice(field(product, 'price', 'Price'))}</p>
                          <p className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-green-700' : 'text-neutral-500'}`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {isActive && <button type="button" className={buttonClass} onClick={() => editProduct(product)}>Edit</button>}
                          <button type="button" className={buttonClass} disabled={saving} onClick={() => toggleActivation('product', id, isActive)}>
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {['variants', 'images'].includes(section) && (
            <section>
              <label className="block max-w-lg text-xs font-bold uppercase tracking-wider">
                Product
                <select
                  value={selectedProductId}
                  onChange={(event) => {
                    selectedProductIdRef.current = event.target.value
                    setSelectedProductId(event.target.value)
                  }}
                  className="mt-2 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal"
                >
                  {products.map((product) => {
                    const id = field(product, 'productId', 'ProductId')
                      const state = field(product, 'isActive', 'IsActive') === false ? 'inactive' : 'active'
                      return <option key={id} value={id}>{field(product, 'productName', 'ProductName')} (#{id}, {state})</option>
                  })}
                </select>
              </label>

              {section === 'variants' ? (
                <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(260px,380px)_1fr]">
                  <form onSubmit={saveVariant} className="h-fit space-y-4 border-b border-neutral-200 pb-6 lg:border-b-0 lg:border-r lg:pr-8">
                    <h2 className="text-lg font-black uppercase">{editingVariantId ? 'Edit variant' : 'Add variant'}</h2>
                    <Input label="SKU" name="sku" value={variantForm.sku} onChange={changeForm(setVariantForm)} required minLength={1} maxLength={50} />
                    <Input label="Size" name="size" value={variantForm.size} onChange={changeForm(setVariantForm)} required minLength={1} maxLength={20} />
                    <Input label="Colour" name="colour" value={variantForm.colour} onChange={changeForm(setVariantForm)} required minLength={1} maxLength={50} />
                    <Input label="Stock quantity" name="stockQuantity" type="number" value={variantForm.stockQuantity} onChange={changeForm(setVariantForm)} required min="0" step="1" />
                    <div className="flex gap-2">
                      <ActionButton type="submit" disabled={saving || !selectedProductId || !selectedProductIsActive}>{saving ? 'Saving...' : editingVariantId ? 'Save variant' : 'Create variant'}</ActionButton>
                      {editingVariantId && <ActionButton tone="light" onClick={() => { setEditingVariantId(null); setVariantForm(emptyVariant) }}>Cancel</ActionButton>}
                    </div>
                  </form>
                  <div>
                    <h2 className="text-lg font-black uppercase">Variants</h2>
                    <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
                      {variants.map((variant) => {
                        const id = field(variant, 'variantId', 'VariantId')
                        const isActive = field(variant, 'isActive', 'IsActive') !== false
                        const parentIsActive = field(selectedProduct, 'isActive', 'IsActive') !== false
                        return (
                          <div key={id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                            <div>
                              <p className="font-semibold">{field(variant, 'colour', 'Colour')} / {field(variant, 'size', 'Size')}</p>
                              <p className="mt-1 text-sm text-neutral-500">{field(variant, 'sku', 'SKU')} / ID {id}</p>
                              <p className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-green-700' : 'text-neutral-500'}`}>
                                {isActive ? 'Active' : 'Inactive'}
                              </p>
                              {!parentIsActive && !isActive && (
                                <p className="mt-1 text-xs text-amber-700">
                                  Activate the product before this variant.
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="text-xs font-bold uppercase tracking-wider">
                                Stock
                                <input
                                  aria-label={`Stock quantity for variant ${id}`}
                                  type="number"
                                  min="0"
                                  step="1"
                                  disabled={!isActive}
                                  value={stockValues[id] ?? field(variant, 'stockQuantity', 'StockQuantity')}
                                  onChange={(event) => setStockValues((current) => ({ ...current, [id]: event.target.value }))}
                                  className="ml-2 w-24 border border-neutral-300 px-2 py-2 text-sm font-normal"
                                />
                              </label>
                              <button type="button" className={buttonClass} disabled={saving || !isActive} onClick={() => saveStock(variant)}>Save stock</button>
                              <button type="button" className={buttonClass} onClick={() => editVariant(variant)}>Edit</button>
                              <button
                                type="button"
                                className={buttonClass}
                                disabled={saving || (!isActive && !parentIsActive)}
                                title={!isActive && !parentIsActive ? 'Activate the parent product first' : undefined}
                                onClick={() => toggleActivation(
                                  'variant',
                                  id,
                                  isActive,
                                  field(variant, 'productId', 'ProductId'),
                                )}
                              >
                                {isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(260px,380px)_1fr]">
                  <form onSubmit={saveImage} className="h-fit space-y-4 border-b border-neutral-200 pb-6 lg:border-b-0 lg:border-r lg:pr-8">
                    <h2 className="text-lg font-black uppercase">Add image URL</h2>
                    <Input label="Image URL" name="imageUrl" type="url" value={imageForm.imageUrl} onChange={changeForm(setImageForm)} required maxLength={1000} />
                    <Input label="Alt text" name="altText" value={imageForm.altText} onChange={changeForm(setImageForm)} maxLength={250} />
                    <Input label="Sort order" name="sortOrder" type="number" value={imageForm.sortOrder} onChange={changeForm(setImageForm)} min="0" step="1" />
                    <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider">
                      <input type="checkbox" name="isPrimary" checked={imageForm.isPrimary} onChange={changeForm(setImageForm)} />
                      Make primary
                    </label>
                    <ActionButton type="submit" disabled={saving || !selectedProductId}>{saving ? 'Saving...' : editingImageId ? 'Save image' : 'Add image'}</ActionButton>
                    {editingImageId && <ActionButton tone="light" onClick={() => { setEditingImageId(null); setImageForm(emptyImage) }}>Cancel</ActionButton>}
                  </form>
                  <div>
                    <h2 className="text-lg font-black uppercase">Product images</h2>
                    <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
                      {images.map((image) => {
                        const id = field(image, 'imageId', 'ImageId')
                        const sortOrder = field(image, 'sortOrder', 'SortOrder')
                        return (
                          <article key={id} className="flex flex-wrap items-center gap-4 py-4">
                            <img src={field(image, 'imageUrl', 'ImageUrl')} alt={field(image, 'altText', 'AltText') || ''} className="h-20 w-16 bg-neutral-100 object-cover" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />
                            <div className="min-w-0 flex-1">
                              <p className="break-all text-sm font-semibold">{field(image, 'imageUrl', 'ImageUrl')}</p>
                              <p className="mt-1 text-xs text-neutral-500">{field(image, 'isPrimary', 'IsPrimary') ? 'Primary' : 'Gallery'} / order {sortOrder}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button type="button" className={buttonClass} onClick={() => {
                                  setEditingImageId(id)
                                  setImageForm({
                                    imageUrl: field(image, 'imageUrl', 'ImageUrl') || '',
                                    altText: field(image, 'altText', 'AltText') || '',
                                    isPrimary: false,
                                    sortOrder: String(sortOrder ?? 0),
                                  })
                                }}>Edit</button>
                                <input
                                  aria-label={`Sort order for image ${id}`}
                                  type="number"
                                  min="0"
                                  value={sortValues[id] ?? sortOrder}
                                  onChange={(event) => setSortValues((current) => ({ ...current, [id]: event.target.value }))}
                                  className="w-24 border border-neutral-300 px-2 py-2 text-sm"
                                />
                                <button type="button" className={buttonClass} disabled={saving} onClick={() => perform(() => productService.updateImageSortOrder(id, sortValues[id] ?? sortOrder), 'Image order updated.')}>Save order</button>
                                {!field(image, 'isPrimary', 'IsPrimary') && <button type="button" className={buttonClass} disabled={saving} onClick={() => perform(() => productService.setPrimaryImage(id), 'Primary image updated.')}>Set primary</button>}
                                <button type="button" className={buttonClass} disabled={saving} onClick={() => { if (window.confirm('Delete this product image?')) perform(() => productService.deleteImage(id), 'Image deleted.') }}>Delete</button>
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <ActionButton tone="light" onClick={() => setReload((value) => value + 1)}>
          <span className="inline-flex items-center gap-2"><RotateCw size={13} /> Refresh</span>
        </ActionButton>
      </div>
    </main>
  )
}
