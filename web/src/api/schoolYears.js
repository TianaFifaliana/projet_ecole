import api from './client'

export async function listSchoolYears() {
  const { data } = await api.get('/school-years')
  return Array.isArray(data?.data) ? data.data : []
}

export async function createSchoolYear(payload) {
  const { data } = await api.post('/school-years', payload)
  return data
}

export async function updateSchoolYear(id, payload) {
  const { data } = await api.patch(`/school-years/${id}`, payload)
  return data
}

export async function activateSchoolYear(id) {
  const { data } = await api.post(`/school-years/${id}/activate`)
  return data
}
