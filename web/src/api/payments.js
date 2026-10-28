import api from './client'

export const feesApi = {
  list: (params = {}) => api.get('/fees', { params }),
  create: (data) => api.post('/fees', data),
  show: (id) => api.get(`/fees/${id}`),
  update: (id, data) => api.put(`/fees/${id}`, data),
  delete: (id) => api.delete(`/fees/${id}`),
}

export const paymentsApi = {
  list: (params = {}) => api.get('/payments', { params }),
  create: (data) => api.post('/payments', data),
  show: (id) => api.get(`/payments/${id}`),
  annuler: (id, motif) => api.post(`/payments/${id}/annuler`, { motif }),
  recuUrl: (id) => `/payments/${id}/recu`,
  impayes: (params = {}) => api.get('/payments/impayes', { params }),
  rapports: (params = {}) => api.get('/payments/rapports', { params }),
}
