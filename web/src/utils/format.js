const numberFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
})

const compactNumberFormatter = new Intl.NumberFormat('fr-FR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const monthShortFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'short',
})

const monthLongFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
})

function toMonthDate(monthKey) {
  const [year, month] = String(monthKey ?? '')
    .split('-')
    .map(Number)

  if (!year || !month) {
    return null
  }

  return new Date(year, month - 1, 1, 12)
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0)
}

export function formatAriary(value) {
  return `${formatNumber(value)} Ar`
}

export function formatCompactAriary(value) {
  const amount = Number(value) || 0

  if (amount === 0) {
    return '0 Ar'
  }

  return `${compactNumberFormatter.format(amount)} Ar`
}

export function formatMonthShort(monthKey) {
  const date = toMonthDate(monthKey)

  if (!date) {
    return monthKey
  }

  return capitalize(monthShortFormatter.format(date))
}

export function formatMonthLong(monthKey) {
  const date = toMonthDate(monthKey)

  if (!date) {
    return monthKey
  }

  return capitalize(monthLongFormatter.format(date))
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(`${value}T12:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateFormatter.format(date)
}

export function formatFileSize(bytes) {
  const value = Number(bytes)

  if (!Number.isFinite(value) || value <= 0) {
    return '—'
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} Ko`
  }

  return `${(value / (1024 * 1024)).toFixed(1)} Mo`
}

export function getInitials(value) {
  return String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

