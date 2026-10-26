export function getDisplayName(user) {
  if (!user) {
    return 'Utilisateur'
  }

  if (user.name) {
    return user.name
  }

  if (user.nom_complet) {
    return user.nom_complet
  }

  const composedName = [user.prenom, user.nom].filter(Boolean).join(' ').trim()

  return composedName || user.email || 'Utilisateur'
}

export function getFirstName(user) {
  return getDisplayName(user).split(/\s+/)[0]
}

export function getInitials(user) {
  const words = getDisplayName(user)
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'U'
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase()
}
