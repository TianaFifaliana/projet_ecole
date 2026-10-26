export const NAVIGATION = [
  {
    to: '/',
    label: 'Tableau de bord',
    icon: 'dashboard',
    end: true,
  },
  {
    to: '/eleves',
    label: 'Élèves',
    icon: 'eleves',
    permission: 'eleves',
  },
  {
    to: '/annees',
    label: 'Années scolaires',
    icon: 'calendar',
    permission: 'parametres',
  },
  {
    to: '/professeurs',
    label: 'Professeurs',
    icon: 'professeurs',
    permission: 'professeurs',
  },
  {
    to: '/classes',
    label: 'Classes',
    icon: 'classes',
    permission: 'classes',
  },
  {
    to: '/matieres',
    label: 'Matières',
    icon: 'matieres',
    permission: 'matieres',
  },
  {
    to: '/paiements',
    label: 'Paiements',
    icon: 'paiements',
    permission: 'paiements',
  },
  {
    to: '/groupes',
    label: 'Groupes & Séances',
    icon: 'groupes',
    permission: 'groupes',
  },
  {
    to: '/certificats',
    label: 'Certificats',
    icon: 'certificats',
    permission: 'certificats',
  },
  {
    to: '/parametres',
    label: 'Paramètres',
    icon: 'parametres',
    permission: 'parametres',
  },
]
