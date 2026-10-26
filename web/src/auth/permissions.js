const PERMISSIONS_PAR_ROLE = {
  directeur: ['*'],
  secretariat: [
    'eleves',
    'professeurs',
    'classes',
    'matieres',
    'paiements',
    'certificats',
    'groupes',
  ],
  comptable: ['paiements'],
  professeur: ['presences', 'groupes'],
}

const ROLE_LABELS = {
  directeur: 'Directeur',
  secretariat: 'Secrétariat',
  comptable: 'Comptable',
  professeur: 'Professeur',
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getRawRole(user) {
  if (!user) {
    return null
  }

  if (user.role) {
    return user.role
  }

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles[0]
  }

  return user.role_nom ?? user.roleName ?? null
}

export function getRoleName(user) {
  const role = getRawRole(user)

  if (typeof role === 'string') {
    return normalize(role)
  }

  if (role && typeof role === 'object') {
    return normalize(
      role.nom ?? role.name ?? role.slug ?? role.code ?? role.libelle,
    )
  }

  return ''
}

export function getRoleLabel(user) {
  const roleName = getRoleName(user)

  if (!roleName) {
    return 'Rôle non défini'
  }

  return (
    ROLE_LABELS[roleName] ??
    `${roleName.charAt(0).toUpperCase()}${roleName.slice(1)}`
  )
}

function getApiPermissions(user) {
  const role = getRawRole(user)
  const sources = [user?.permissions, role?.permissions]

  return sources
    .flatMap((source) => (Array.isArray(source) ? source : []))
    .map((permission) => {
      if (typeof permission === 'string') {
        return permission
      }

      if (permission && typeof permission === 'object') {
        return permission.nom ?? permission.name ?? permission.code ?? ''
      }

      return ''
    })
    .filter(Boolean)
}

export function hasPermission(user, permission) {
  if (!permission) {
    return true
  }

  if (!user) {
    return false
  }

  const rolePermissions = PERMISSIONS_PAR_ROLE[getRoleName(user)] ?? []
  const permissions = new Set(
    [...rolePermissions, ...getApiPermissions(user)]
      .map(normalize)
      .filter(Boolean),
  )
  const wantedPermission = normalize(permission)

  return permissions.has('*') || permissions.has(wantedPermission)
}
