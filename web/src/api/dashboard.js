import api from './client'

export async function getDashboard() {
  const { data } = await api.get('/dashboard')
  const payload = data ?? {}

  return {
    ...payload,
    activites_recentes: Array.isArray(payload.activites_recentes)
      ? payload.activites_recentes
      : [],
    eleves_par_classe: Array.isArray(payload.eleves_par_classe)
      ? payload.eleves_par_classe
      : [],
    encaissements_6_mois: Array.isArray(payload.encaissements_6_mois)
      ? payload.encaissements_6_mois
      : [],
  }
}
