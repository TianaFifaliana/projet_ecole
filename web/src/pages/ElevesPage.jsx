import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  archiveStudent,
  exportStudents,
  listStudents,
} from '../api/students'
import { listClasses } from '../api/classes'
import { getErrorMessage } from '../api/errors'
import { saveBlobResponse } from '../api/download'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icons'
import Pagination from '../components/Pagination'
import StudentImportDialog from '../components/students/StudentImportDialog'
import useSchoolYear from '../schoolYear/useSchoolYear'
import { formatDate, getInitials } from '../utils/format'

const STATUS_LABELS = {
  actif: 'Actif',
  inactif: 'Inactif',
  archive: 'Archivé',
}

function statusTone(status) {
  if (status === 'actif') return 'badge-success'
  if (status === 'archive') return 'badge-danger'
  return 'badge-muted'
}

export default function ElevesPage() {
  const { selectedYearId, selectedYear } = useSchoolYear()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [classId, setClassId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [importOpen, setImportOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, classId, status, selectedYearId])

  const filters = useMemo(
    () => ({
      school_year_id: selectedYearId ?? undefined,
      search: debouncedSearch || undefined,
      classe_id: classId || undefined,
      statut: status || undefined,
    }),
    [selectedYearId, debouncedSearch, classId, status],
  )

  const classesQuery = useQuery({
    queryKey: ['classes', { school_year_id: selectedYearId }],
    queryFn: () => listClasses({ school_year_id: selectedYearId }),
    enabled: Boolean(selectedYearId),
  })

  const studentsQuery = useQuery({
    queryKey: ['students', { ...filters, page }],
    queryFn: () => listStudents({ ...filters, page, per_page: 15 }),
    placeholderData: keepPreviousData,
    enabled: Boolean(selectedYearId),
  })

  const archiveMutation = useMutation({
    mutationFn: archiveStudent,
    onSuccess: (_, studentId) => {
      setArchiveTarget(null)
      setActionError('')
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['student', String(studentId)] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      setActionError(
        getErrorMessage(error, "L'archivage de l'élève a échoué."),
      )
    },
  })

  const classes = classesQuery.data ?? []
  const students = studentsQuery.data?.data ?? []
  const meta = studentsQuery.data?.meta
  const hasFilters = Boolean(debouncedSearch || classId || status)

  async function handleExport() {
    setExporting(true)
    setActionError('')

    try {
      const response = await exportStudents(filters)
      const stamp = new Date().toISOString().slice(0, 10)
      saveBlobResponse(response, `eleves-${stamp}.csv`)
    } catch (error) {
      setActionError(
        getErrorMessage(error, "L'export des élèves a échoué."),
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="page">
      <header className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">Scolarité</p>
          <h1>Élèves</h1>
          <p>
            Gérez les dossiers des élèves
            {selectedYear ? ` pour l’année ${selectedYear.libelle}` : ''}.
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={handleExport}
            disabled={exporting || !selectedYearId}
          >
            {exporting ? 'Export…' : 'Exporter CSV'}
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setImportOpen(true)}
          >
            Importer
          </button>
          <Link className="button button-primary" to="/eleves/nouveau">
            + Nouvel élève
          </Link>
        </div>
      </header>

      {actionError ? <p className="alert alert-error">{actionError}</p> : null}

      <div className="toolbar">
        <div className="toolbar-filters">
          <label className="field field-search">
            <span className="sr-only">Rechercher un élève</span>
            <input
              type="search"
              placeholder="Rechercher par nom ou matricule…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="field field-compact">
            <span className="sr-only">Classe</span>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              <option value="">Toutes les classes</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="field field-compact">
            <span className="sr-only">Statut</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Tous les statuts</option>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
              <option value="archive">Archivé</option>
            </select>
          </label>

          {hasFilters ? (
            <button
              type="button"
              className="button button-ghost button-small"
              onClick={() => {
                setSearch('')
                setClassId('')
                setStatus('')
              }}
            >
              Réinitialiser
            </button>
          ) : null}
        </div>

        <span className="toolbar-count">
          {meta ? `${meta.total} élève(s)` : '—'}
        </span>
      </div>

      <div className="table-card">
        {studentsQuery.isLoading ? (
          <p className="table-state">Chargement des élèves…</p>
        ) : studentsQuery.isError ? (
          <div className="table-state">
            <p className="form-error">
              {getErrorMessage(
                studentsQuery.error,
                'Impossible de charger les élèves.',
              )}
            </p>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => studentsQuery.refetch()}
            >
              Réessayer
            </button>
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'Aucun élève trouvé' : 'Aucun élève inscrit'}
            description={
              hasFilters
                ? 'Modifiez vos filtres pour élargir la recherche.'
                : 'Commencez par inscrire un élève dans une classe.'
            }
            action={
              hasFilters ? null : (
                <Link className="button button-primary" to="/eleves/nouveau">
                  Inscrire un élève
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Matricule</th>
                    <th>Classe</th>
                    <th>Naissance</th>
                    <th>Statut</th>
                    <th className="table-actions-head">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="student-cell">
                          {student.photo_url ? (
                            <img
                              className="avatar-thumb"
                              src={student.photo_url}
                              alt=""
                            />
                          ) : (
                            <span className="avatar-thumb avatar-fallback">
                              {getInitials(student.nom_complet ?? student.nom)}
                            </span>
                          )}
                          <div>
                            <Link
                              className="table-link"
                              to={`/eleves/${student.id}`}
                            >
                              {student.nom_complet ?? student.nom}
                            </Link>
                            <small>
                              {student.sexe === 'M'
                                ? 'Garçon'
                                : student.sexe === 'F'
                                  ? 'Fille'
                                  : '—'}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{student.matricule ?? '—'}</td>
                      <td>{student.school_class?.nom ?? 'Non affecté'}</td>
                      <td>{formatDate(student.date_naissance)}</td>
                      <td>
                        <span
                          className={`badge ${statusTone(student.statut)}`}
                        >
                          {STATUS_LABELS[student.statut] ?? student.statut}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Link
                            className="button button-ghost button-small"
                            to={`/eleves/${student.id}`}
                          >
                            Voir
                          </Link>
                          <Link
                            className="button button-ghost button-small"
                            to={`/eleves/${student.id}/modifier`}
                          >
                            Modifier
                          </Link>
                          {student.statut !== 'archive' ? (
                            <button
                              type="button"
                              className="button button-danger-ghost button-small"
                              onClick={() => setArchiveTarget(student)}
                            >
                              Archiver
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination meta={meta} onPageChange={setPage} />
          </>
        )}
      </div>

      {importOpen ? (
        <StudentImportDialog
          open
          onClose={() => setImportOpen(false)}
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ['students'] })
            queryClient.invalidateQueries({ queryKey: ['classes'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archiver l’élève"
        message={
          archiveTarget
            ? `Archiver ${archiveTarget.nom_complet ?? archiveTarget.nom} ? L’élève restera consultable mais ne sera plus compté comme actif.`
            : ''
        }
        confirmLabel="Archiver"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate(archiveTarget.id)}
        onClose={() => setArchiveTarget(null)}
      />

      {studentsQuery.isFetching && !studentsQuery.isLoading ? (
        <span className="page-refreshing" role="status">
          <Icon name="activity" size={14} /> Actualisation…
        </span>
      ) : null}
    </section>
  )
}
