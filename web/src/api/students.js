import api from './client'
import { downloadFromApi } from './download'

export async function listStudents(params) {
  const { data } = await api.get('/students', { params })
  return data
}

export async function getStudent(id) {
  const { data } = await api.get(`/students/${id}`)
  return data
}

export async function createStudent(payload) {
  const { data } = await api.post('/students', payload)
  return data
}

export async function updateStudent(id, payload) {
  const { data } = await api.patch(`/students/${id}`, payload)
  return data
}

export async function archiveStudent(id) {
  const { data } = await api.delete(`/students/${id}`)
  return data
}

export async function uploadStudentPhoto(id, file) {
  const formData = new FormData()
  formData.append('photo', file)
  const { data } = await api.post(`/students/${id}/photo`, formData)
  return data
}

export async function importStudents(file) {
  const formData = new FormData()
  formData.append('fichier', file)
  const { data } = await api.post('/students/import', formData)
  return data
}

export async function exportStudents(params) {
  const response = await api.get('/students/export', {
    params,
    responseType: 'blob',
  })

  return response
}

export async function listGuardians(search) {
  const { data } = await api.get('/guardians', {
    params: search ? { search } : undefined,
  })

  return Array.isArray(data?.data) ? data.data : []
}

export async function createGuardian(payload) {
  const { data } = await api.post('/guardians', payload)
  return data
}

export async function updateGuardian(id, payload) {
  const { data } = await api.patch(`/guardians/${id}`, payload)
  return data
}

export async function attachGuardian(studentId, payload) {
  const { data } = await api.post(`/students/${studentId}/guardians`, payload)
  return data
}

export async function detachGuardian(studentId, guardianId) {
  const { data } = await api.delete(`/students/${studentId}/guardians/${guardianId}`)
  return data
}

export async function uploadStudentDocument(studentId, type, file) {
  const formData = new FormData()
  formData.append('type', type)
  formData.append('fichier', file)
  const { data } = await api.post(`/students/${studentId}/documents`, formData)
  return data
}

export async function deleteStudentDocument(studentId, documentId) {
  const { data } = await api.delete(`/students/${studentId}/documents/${documentId}`)
  return data
}

export function downloadStudentDocument(studentId, documentId, filename) {
  return downloadFromApi(
    `/students/${studentId}/documents/${documentId}/download`,
    filename,
  )
}
