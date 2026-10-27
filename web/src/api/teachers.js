import api from './client'

export async function listTeachers(params = {}) {
  const { data } = await api.get('/teachers', { params })
  return Array.isArray(data?.data) ? data.data : []
}

export async function getTeacher(id) {
  const { data } = await api.get(`/teachers/${id}`)
  return data
}

export async function createTeacher(payload) {
  const { data } = await api.post('/teachers', payload)
  return data
}

export async function updateTeacher(id, payload) {
  const { data } = await api.patch(`/teachers/${id}`, payload)
  return data
}

export async function deleteTeacher(id) {
  const { data } = await api.delete(`/teachers/${id}`)
  return data
}

export async function syncTeacherSubjects(id, subjectIds) {
  const { data } = await api.post(`/teachers/${id}/subjects`, {
    subject_ids: subjectIds,
  })
  return data
}

export async function assignTeacherAsMain(id, schoolClassId) {
  const { data } = await api.post(`/teachers/${id}/assign-main`, {
    school_class_id: schoolClassId,
  })
  return data
}

export async function createTeacherAccount(id, payload = {}) {
  const { data } = await api.post(`/teachers/${id}/create-account`, payload)
  return data
}

export async function getTeacherPlanning(id) {
  const { data } = await api.get(`/teachers/${id}/planning`)
  return data
}
