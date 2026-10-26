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
