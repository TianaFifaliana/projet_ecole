export function getFieldErrors(error) {
  const errors = error?.response?.data?.errors

  if (!errors || typeof errors !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ]),
  )
}

export function getErrorMessage(error, fallback) {
  const data = error?.response?.data

  if (data?.message && typeof data.message === 'string') {
    return data.message
  }

  const fieldErrors = getFieldErrors(error)
  const firstError = Object.values(fieldErrors)[0]

  if (firstError) {
    return firstError
  }

  if (!error?.response) {
    return error?.request
      ? 'Impossible de contacter le serveur. Vérifiez votre connexion.'
      : fallback
  }

  return fallback
}
