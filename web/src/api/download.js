import api from './client'

export function saveBlobResponse(response, fallbackName) {
  const disposition = response.headers?.['content-disposition'] ?? ''
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition)
  const filename = match ? decodeURIComponent(match[1]) : fallbackName
  const blob = new Blob([response.data], {
    type: response.headers?.['content-type'] ?? 'application/octet-stream',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function downloadFromApi(path, fallbackName) {
  const response = await api.get(path, { responseType: 'blob' })
  saveBlobResponse(response, fallbackName)
}
