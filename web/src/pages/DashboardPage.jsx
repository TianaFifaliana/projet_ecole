import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../api/dashboard'
import useAuth from '../auth/useAuth'
import { getFirstName } from '../auth/user'
import DashboardError from '../components/dashboard/DashboardError'
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton'
import MetricCard from '../components/dashboard/MetricCard'
import PaymentsChart from '../components/dashboard/PaymentsChart'
import RecentActivities from '../components/dashboard/RecentActivities'
import StudentsByClassChart from '../components/dashboard/StudentsByClassChart'
import { formatAriary, formatNumber } from '../utils/format'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, error, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (isError) {
    return (
      <DashboardError
        error={error}
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )
  }

  const hasPayments = typeof data.paiements_mois === 'number'
  const metrics = [
    {
      key: 'eleves',
      label: 'Élèves',
      value: formatNumber(data.eleves_actifs),
      hint: 'Statut actif',
      icon: 'eleves',
      tone: 'blue',
    },
    {
      key: 'professeurs',
      label: 'Professeurs',
      value: formatNumber(data.professeurs),
      hint: 'Enregistrés',
      icon: 'professeurs',
      tone: 'violet',
    },
    {
      key: 'classes',
      label: 'Classes',
      value: formatNumber(data.classes),
      hint: 'Année active',
      icon: 'classes',
      tone: 'cyan',
    },
    {
      key: 'matieres',
      label: 'Matières',
      value: formatNumber(data.matieres),
      hint: 'Au programme',
      icon: 'matieres',
      tone: 'amber',
    },
    ...(hasPayments
      ? [
          {
            key: 'paiements',
            label: 'Paiements du mois',
            value: formatAriary(data.paiements_mois),
            hint: 'Encaissements validés',
            icon: 'paiements',
            tone: 'green',
          },
        ]
      : []),
    {
      key: 'presents',
      label: 'Présents aujourd’hui',
      value: formatNumber(data.presents_aujourdhui),
      hint: 'Séances du jour',
      icon: 'presence',
      tone: 'teal',
    },
    {
      key: 'groupes',
      label: 'Groupes',
      value: formatNumber(data.groupes),
      hint: 'Groupes enregistrés',
      icon: 'groupes',
      tone: 'rose',
    },
  ]

  return (
    <section className="page">
      <header className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">Vue d’ensemble</p>
          <h1>Bonjour, {getFirstName(user)}</h1>
          <p>Suivez l’activité de votre école en un coup d’œil.</p>
        </div>

        <span
          className={`dashboard-live ${isFetching ? 'is-refreshing' : ''}`}
          role="status"
          aria-live="polite"
          title="Actualisation automatique toutes les 60 secondes"
        >
          <span className="live-dot" aria-hidden="true" />
          {isFetching ? 'Actualisation…' : 'À jour'}
        </span>
      </header>

      <div className="metrics-grid">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            icon={metric.icon}
            tone={metric.tone}
          />
        ))}
      </div>

      <div className="charts-grid">
        {hasPayments && (
          <PaymentsChart data={data.encaissements_6_mois} />
        )}
        <StudentsByClassChart data={data.eleves_par_classe} />
      </div>

      <RecentActivities activities={data.activites_recentes} />
    </section>
  )
}
