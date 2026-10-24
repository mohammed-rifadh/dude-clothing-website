
import api from './api'

const productService = {
  async getAll(filters = {}) {
    const response = await api.get('/Products', {
      params: filters,
    })

    return response.data
  },

  async getAllForAdmin(filters = {}) {
    const response = await api.get('/Products/admin', {
      params: filters,
    })

    return response.data
  },

  async setProductActivation(id, isActive) {
    const response = await api.patch(
      `/Products/${encodeURIComponent(id)}/activation`,
      { isActive: Boolean(isActive) },
    )

    return response.data
  },

  async getById(id) {
    const response = await api.get(
      `/Products/${encodeURIComponent(id)}`,
    )

    return response.data
  },

  async getVariants(id) {
    const response = await api.get(
      `/ProductVariants/product/${encodeURIComponent(id)}`,
    )

    return response.data
  },

  async getVariantsForAdmin() {
    const response = await api.get('/ProductVariants/admin')
    return response.data
  },

  async setVariantActivation(id, isActive) {
    const response = await api.patch(
      `/ProductVariants/${encodeURIComponent(id)}/activation`,
      { isActive: Boolean(isActive) },
    )

    return response.data
  },

  async getImages(id) {
    const response = await api.get(
      `/ProductImages/product/${encodeURIComponent(id)}`,
    )

    return response.data
  },

  async getByCategory(categoryId, filters = {}) {
    const response = await api.get(
      `/Products/category/${encodeURIComponent(categoryId)}`,
      { params: filters },
    )

    return response.data
  },

  async search(term, filters = {}) {
    const response = await api.get('/Products/search', {
      params: { term, ...filters },
    })

    return response.data
  },

  async createProduct(data) {
    const response = await api.post('/Products', data)
    return response.data
  },

  async updateProduct(id, data) {
    await api.put(`/Products/${encodeURIComponent(id)}`, data)
  },

  async deleteProduct(id) {
    await api.delete(`/Products/${encodeURIComponent(id)}`)
  },

  async getCategories() {
    const response = await api.get('/Categories')

    return response.data
  },

  async getCategoriesForAdmin() {
    const response = await api.get('/Categories/admin')
    return response.data
  },

  async setCategoryActivation(id, isActive) {
    const response = await api.patch(
      `/Categories/${encodeURIComponent(id)}/activation`,
      { isActive: Boolean(isActive) },
    )

    return response.data
  },

  async createCategory(data) {
    const response = await api.post('/Categories', data)
    return response.data
  },

  async updateCategory(id, data) {
    await api.put(`/Categories/${encodeURIComponent(id)}`, data)
  },

  async deleteCategory(id) {
    await api.delete(`/Categories/${encodeURIComponent(id)}`)
  },

  async createVariant(data) {
    const response = await api.post('/ProductVariants', data)
    return response.data
  },

  async updateVariant(id, data) {
    await api.put(`/ProductVariants/${encodeURIComponent(id)}`, data)
  },

  async updateVariantStock(id, stockQuantity) {
    await api.patch(
      `/ProductVariants/${encodeURIComponent(id)}/stock`,
      { stockQuantity: Number(stockQuantity) },
    )
  },

  async deleteVariant(id) {
    await api.delete(`/ProductVariants/${encodeURIComponent(id)}`)
  },

  async createImage(data) {
    const response = await api.post('/ProductImages', data)
    return response.data
  },

  async updateImage(id, data) {
    await api.put(`/ProductImages/${encodeURIComponent(id)}`, data)
  },

  async setPrimaryImage(id) {
    await api.patch(
      `/ProductImages/${encodeURIComponent(id)}/primary`,
    )
  },

  async updateImageSortOrder(id, sortOrder) {
    await api.patch(
      `/ProductImages/${encodeURIComponent(id)}/sort-order`,
      { sortOrder: Number(sortOrder) },
    )
  },

  async deleteImage(id) {
    await api.delete(`/ProductImages/${encodeURIComponent(id)}`)
  },
}

export default productService
