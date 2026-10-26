import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteClass, listClasses, listTeachers } from '../api/classes'
import { getErrorMessage } from '../api/errors'
import ClassFormDialog from '../components/classes/ClassFormDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import useSchoolYear from '../schoolYear/useSchoolYear'

export default function ClassesPage() {
  const { selectedYearId, selectedYear } = useSchoolYear()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dialogClass, setDialogClass] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const classesQuery = useQuery({
    queryKey: ['classes', { school_year_id: selectedYearId, search: debouncedSearch }],
    queryFn: () =>
      listClasses({
        school_year_id: selectedYearId,
        search: debouncedSearch || undefined,
      }),
    enabled: Boolean(selectedYearId),
  })

  const teachersQuery = useQuery({
    queryKey: ['teachers'],
    queryFn: () => listTeachers(),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteClass,
    onSuccess: () => {
      setDeleteTarget(null)
      setActionError('')
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      setActionError(
        getErrorMessage(error, 'La suppression de la classe a échoué.'),
      )
    },
  })

  const classes = classesQuery.data ?? []
  const teachers = teachersQuery.data ?? []

  function handleSaved(saved) {
    setDialogClass(null)
    queryClient.invalidateQueries({ queryKey: ['classes'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    navigate(`/classes/${saved.id}`)
  }

  return (
    <section className="page">
      <header className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">Organisation pédagogique</p>
          <h1>Classes</h1>
          <p>
            {selectedYear
              ? `Classes de l’année ${selectedYear.libelle}.`
              : 'Sélectionnez une année scolaire.'}
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={() => setDialogClass({})}
          disabled={!selectedYearId}
        >
          + Nouvelle classe
        </button>
      </header>

      {actionError ? <p className="alert alert-error">{actionError}</p> : null}

      <div className="toolbar">
        <div className="toolbar-filters">
          <label className="field field-search">
            <span className="sr-only">Rechercher une classe</span>
            <input
              type="search"
              placeholder="Rechercher une classe ou un niveau…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <span className="toolbar-count">{classes.length} classe(s)</span>
      </div>

      {!selectedYearId ? (
        <EmptyState
          title="Aucune année sélectionnée"
          description="Créez ou sélectionnez une année scolaire dans l’en-tête."
        />
      ) : classesQuery.isLoading ? (
        <p className="table-state">Chargement des classes…</p>
      ) : classesQuery.isError ? (
        <div className="table-state">
          <p className="form-error">
            {getErrorMessage(
              classesQuery.error,
              'Impossible de charger les classes.',
            )}
          </p>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => classesQuery.refetch()}
          >
            Réessayer
          </button>
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          title={
            debouncedSearch ? 'Aucune classe trouvée' : 'Aucune classe'
          }
          description={
            debouncedSearch
              ? 'Essayez un autre mot-clé.'
              : 'Créez la première classe de cette année scolaire.'
          }
          action={
            debouncedSearch ? null : (
              <button
                type="button"
                className="button button-primary"
                onClick={() => setDialogClass({})}
              >
                Créer une classe
              </button>
            )
          }
        />
      ) : (
        <div className="class-grid">
          {classes.map((schoolClass) => {
            const percent = schoolClass.taux_remplissage ?? 0
            const full = percent >= 100

            return (
              <article key={schoolClass.id} className="class-card">
                <div className="class-card-head">
                  <div>
                    <Link
                      className="class-card-title"
                      to={`/classes/${schoolClass.id}`}
                    >
                      {schoolClass.nom}
                    </Link>
                    <p className="muted-text">
                      {schoolClass.niveau || 'Niveau non précisé'}
                    </p>
                  </div>
                  <span className="badge badge-info">
                    {schoolClass.subjects_count ?? 0} matière(s)
                  </span>
                </div>

                <dl className="class-card-info">
                  <div>
                    <dt>Professeur principal</dt>
                    <dd>
                      {schoolClass.professeur_principal?.nom_complet ??
                        'Non affecté'}
                    </dd>
                  </div>
                  <div>
                    <dt>Effectif</dt>
                    <dd>
                      {schoolClass.effectif ?? 0} / {schoolClass.capacite}
                    </dd>
                  </div>
                </dl>

                <div className="progress" aria-hidden="true">
                  <span
                    className={`progress-bar ${full ? 'is-full' : ''}`}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
                <small className="progress-meta">{percent}% de remplissage</small>

                <div className="class-card-actions">
                  <Link
                    className="button button-primary button-small"
                    to={`/classes/${schoolClass.id}`}
                  >
                    Ouvrir
                  </Link>
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() => setDialogClass(schoolClass)}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="button button-danger-ghost button-small"
                    onClick={() => setDeleteTarget(schoolClass)}
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {dialogClass ? (
        <ClassFormDialog
          key={dialogClass.id ?? 'new'}
          open
          initial={dialogClass}
          schoolYearId={selectedYearId}
          teachers={teachers}
          onClose={() => setDialogClass(null)}
          onSaved={handleSaved}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Supprimer la classe"
        message={
          deleteTarget
            ? `Supprimer la classe ${deleteTarget.nom} ? Cette action est impossible si des élèves y sont encore inscrits.`
            : ''
        }
        confirmLabel="Supprimer"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </section>
  )
}
