import api from './api'

const orderService = {
  async getAll() {
    const response = await api.get('/Orders')
    return response.data
  },

  async getById(id) {
    const response = await api.get(
      `/Orders/${encodeURIComponent(id)}`,
    )
    return response.data
  },

  async updateStatus(id, orderStatus) {
    await api.patch(
      `/Orders/${encodeURIComponent(id)}/status`,
      { orderStatus },
    )
  },
}

export default orderService