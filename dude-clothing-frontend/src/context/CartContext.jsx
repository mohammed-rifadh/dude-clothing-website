
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import cartService, {
  getCartErrorMessage,
} from '../services/cartService'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

function normalizeCartItem(item) {
  return {
    ...item,
    // Product ID and database cart-row ID are different.
    id: item.productId ?? item.ProductId,
    cartItemId: item.cartItemId ?? item.CartItemId,
    variantId: item.variantId ?? item.VariantId,
    name:
      item.productName ??
      item.ProductName ??
      item.name ??
      'DUDE Essential',
    price: Number(
      item.unitPrice ??
      item.UnitPrice ??
      item.price ??
      item.Price ??
      0,
    ),
    image:
      item.imageUrl ??
      item.ImageUrl ??
      item.image ??
      null,
    colour: String(
      item.colour ?? item.Colour ?? item.color ?? '',
    ).trim(),
    size: String(item.size ?? item.Size ?? '').trim(),
    sku: item.sku ?? item.SKU ?? '',
    stockQuantity: Math.max(
      0,
      Number(item.stockQuantity ?? item.StockQuantity ?? 0),
    ),
    quantity: Math.max(
      1,
      Math.floor(Number(item.quantity ?? item.Quantity) || 1),
    ),
  }
}

function normalizeCartResponse(cart) {
  const rawItems = cart?.items ?? cart?.Items ?? []

  return Array.isArray(rawItems)
    ? rawItems.map(normalizeCartItem)
    : []
}

export function CartProvider({ children }) {
  const { isCustomer, user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [cartError, setCartError] = useState('')
  const cartRequestVersion = useRef(0)

  const refreshCart = useCallback(async () => {
    const requestVersion = ++cartRequestVersion.current

    if (!isCustomer) {
      setItems([])
      setCartError('')
      setLoading(false)
      return false
    }

    setLoading(true)
    setCartError('')

    try {
      const cart = await cartService.getCart()
      if (cartRequestVersion.current === requestVersion) {
        setItems(normalizeCartResponse(cart))
      }
      return true
    } catch (error) {
      if (cartRequestVersion.current === requestVersion) {
        setCartError(getCartErrorMessage(error))
      }
      return false
    } finally {
      if (cartRequestVersion.current === requestVersion) {
        setLoading(false)
      }
    }
  }, [isCustomer])

  useEffect(() => {
    refreshCart()
  }, [refreshCart, user])

  const addToCart = useCallback(
    async (product, quantity = 1) => {
      const variantId =
        product.variantId ?? product.VariantId
      const numericVariantId = Number(variantId)

      const requestedQuantity = Math.floor(Number(quantity))

      if (!Number.isInteger(numericVariantId) || numericVariantId < 1) {
        return {
          success: false,
          message: 'Please select a valid product variant.',
        }
      }

      if (
        !Number.isFinite(requestedQuantity) ||
        requestedQuantity < 1 ||
        requestedQuantity > 100
      ) {
        return {
          success: false,
          message: 'Enter a quantity between 1 and 100.',
        }
      }

      if (!localStorage.getItem('dude-auth-token')) {
        return {
          success: false,
          message: 'Please sign in before adding items to your bag.',
          requiresLogin: true,
        }
      }

      if (!isCustomer) {
        return {
          success: false,
          message: 'A customer account is required to use the shopping bag.',
        }
      }

      try {
        await cartService.addItem(
          numericVariantId,
          requestedQuantity,
        )

        setCartError('')
        await refreshCart()

        return {
          success: true,
          message: 'Product added to your bag.',
        }
      } catch (error) {
        return {
          success: false,
          message: getCartErrorMessage(error),
        }
      }
    },
    [isCustomer, refreshCart],
  )

  const updateQuantity = useCallback(
    async (cartItemId, quantity) => {
      const requestedQuantity = Math.floor(Number(quantity))

      if (
        !Number.isFinite(requestedQuantity) ||
        requestedQuantity < 1 ||
        requestedQuantity > 100
      ) {
        return {
          success: false,
          message: 'Quantity must be between 1 and 100.',
        }
      }

      try {
        await cartService.updateItem(
          cartItemId,
          requestedQuantity,
        )

        setItems((current) =>
          current.map((item) =>
            String(item.cartItemId) === String(cartItemId)
              ? { ...item, quantity: requestedQuantity }
              : item,
          ),
        )
        setCartError('')
        await refreshCart()

        return {
          success: true,
          message: 'Quantity updated.',
        }
      } catch (error) {
        return {
          success: false,
          message: getCartErrorMessage(error),
        }
      }
    },
    [refreshCart],
  )

  const removeFromCart = useCallback(
    async (cartItemId) => {
      try {
        await cartService.removeItem(cartItemId)
        setItems((current) =>
          current.filter(
            (item) => String(item.cartItemId) !== String(cartItemId),
          ),
        )
        setCartError('')
        await refreshCart()

        return {
          success: true,
          message: 'Item removed from your bag.',
        }
      } catch (error) {
        return {
          success: false,
          message: getCartErrorMessage(error),
        }
      }
    },
    [refreshCart],
  )

  const clearCart = useCallback(async () => {
    try {
      await cartService.clearCart()
      setItems([])
      setCartError('')
      await refreshCart()

      return {
        success: true,
        message: 'Your bag has been cleared.',
      }
    } catch (error) {
      return {
        success: false,
        message: getCartErrorMessage(error),
      }
    }
  }, [refreshCart])

  const itemCount = items.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  const subtotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  )

  const value = useMemo(
    () => ({
      items,
      itemCount,
      subtotal,
      loading,
      cartError,
      refreshCart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
    }),
    [
      items,
      itemCount,
      subtotal,
      loading,
      cartError,
      refreshCart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
    ],
  )

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error(
      'useCart must be used inside a CartProvider.',
    )
  }

  return context
}
