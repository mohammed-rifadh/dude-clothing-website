
import api from './api'

const cartService = {
  // Retrieve the authenticated customer's database cart.
  async getCart() {
    const response = await api.get('/Cart')
    return response.data
  },

  // Add a product variant to the database cart.
  async addItem(variantId, quantity = 1) {
    const response = await api.post('/Cart/items', {
      variantId: Number(variantId),
      quantity: Number(quantity),
    })

    return response.data
  },

  // Update a saved database cart row.
  async updateItem(cartItemId, quantity) {
    const response = await api.put(
      `/Cart/items/${encodeURIComponent(cartItemId)}`,
      { quantity: Number(quantity) },
    )

    return response.data
  },

  // Remove one saved database cart row.
  async removeItem(cartItemId) {
    await api.delete(
      `/Cart/items/${encodeURIComponent(cartItemId)}`,
    )
  },

  // Empty the authenticated customer's database cart.
  async clearCart() {
    await api.delete('/Cart')
  },

  // Create an order using the database cart and delivery details.
  async checkout(deliveryDetails) {
    const response = await api.post(
      '/Cart/checkout',
      deliveryDetails,
    )

    return response.data
  },
}

// Extract a useful message from common ASP.NET Core API errors.
export function getCartErrorMessage(error) {
  const data = error?.response?.data

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (data?.detail) return data.detail
  if (data?.message) return data.message
  if (data?.title) return data.title
  if (data?.errors) {
    return Object.values(data.errors).flat().join(' ')
  }

  if (error?.response?.status === 401) {
    return 'Your session has expired. Please sign in again.'
  }

  if (error?.response?.status === 403) {
    return 'You do not have permission to perform this action.'
  }

  if (!error?.response) {
    return 'Could not connect to the server. Check that the API is running.'
  }

  return 'Something went wrong. Please try again.'
}

export default cartService
