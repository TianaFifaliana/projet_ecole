import api from './client'

export async function listSubjects(search) {
  const { data } = await api.get('/subjects', {
    params: search ? { search } : undefined,
  })
  return Array.isArray(data?.data) ? data.data : []
}

export async function createSubject(payload) {
  const { data } = await api.post('/subjects', payload)
  return data
}

export async function updateSubject(id, payload) {
  const { data } = await api.patch(`/subjects/${id}`, payload)
  return data
}

export async function deleteSubject(id) {
  const { data } = await api.delete(`/subjects/${id}`)
  return data
}

export async function syncSubjectClasses(id, classIds) {
  const { data } = await api.post(`/subjects/${id}/classes`, {
    class_ids: classIds,
  })
  return data
}
