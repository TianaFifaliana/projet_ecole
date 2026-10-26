import api from './client'

export async function listClasses(params) {
  const { data } = await api.get('/classes', { params })
  return Array.isArray(data?.data) ? data.data : []
}

export async function getClass(id) {
  const { data } = await api.get(`/classes/${id}`)
  return data
}

export async function createClass(payload) {
  const { data } = await api.post('/classes', payload)
  return data
}

export async function updateClass(id, payload) {
  const { data } = await api.patch(`/classes/${id}`, payload)
  return data
}

export async function deleteClass(id) {
  const { data } = await api.delete(`/classes/${id}`)
  return data
}

export async function listClassStudents(id, params) {
  const { data } = await api.get(`/classes/${id}/students`, { params })
  return data
}

export async function transferStudent(classId, studentId, payload) {
  const { data } = await api.post(
    `/classes/${classId}/students/${studentId}/transfer`,
    payload,
  )
  return data
}

export async function syncClassSubjects(classId, subjectIds) {
  const { data } = await api.post(`/classes/${classId}/subjects`, {
    subject_ids: subjectIds,
  })
  return data
}

export async function detachClassSubject(classId, subjectId) {
  const { data } = await api.delete(`/classes/${classId}/subjects/${subjectId}`)
  return data
}

export async function exportClassPdf(classId) {
  const response = await api.get(`/classes/${classId}/students/export-pdf`, {
    responseType: 'blob',
  })
  return response
}

export async function listTeachers(search) {
  const { data } = await api.get('/teachers', {
    params: search ? { search } : undefined,
  })
  return Array.isArray(data?.data) ? data.data : []
}
