import api from './client'

export const groupsApi = {
  list: () => api.get('/groups'),
  create: (data) => api.post('/groups', data),
  show: (id) => api.get(`/groups/${id}`),
  update: (id, data) => api.put(`/groups/${id}`, data),
  delete: (id) => api.delete(`/groups/${id}`),
  attachStudent: (groupId, studentId) => api.post(`/groups/${groupId}/students`, { student_id: studentId }),
  detachStudent: (groupId, studentId) => api.delete(`/groups/${groupId}/students/${studentId}`),
}

export const lessonSessionsApi = {
  list: (params = {}) => api.get('/lesson-sessions', { params }),
  create: (data) => api.post('/lesson-sessions', data),
  show: (id) => api.get(`/lesson-sessions/${id}`),
  update: (id, data) => api.put(`/lesson-sessions/${id}`, data),
  delete: (id) => api.delete(`/lesson-sessions/${id}`),
  appel: (id, presences) => api.post(`/lesson-sessions/${id}/appel`, { presences }),
}

export const presencesApi = {
  statistiques: (params = {}) => api.get('/presences/statistiques', { params }),
}
