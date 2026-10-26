import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listClasses } from '../api/classes'
import {
  createSubject,
  deleteSubject,
  listSubjects,
  syncSubjectClasses,
  updateSubject,
} from '../api/subjects'
import { getErrorMessage, getFieldErrors } from '../api/errors'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import useSchoolYear from '../schoolYear/useSchoolYear'

const EMPTY_SUBJECT = {
  code: '',
  intitule: '',
  coefficient: '1',
  volume_horaire: '',
}

function SubjectFormDialog({ open, initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => initial ?? EMPTY_SUBJECT)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(initial?.id)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validation = {}

    if (!form.code.trim()) {
      validation.code = 'Le code est obligatoire.'
    }

    if (!form.intitule.trim()) {
      validation.intitule = "L'intitulé est obligatoire."
    }

    const coefficient = Number(form.coefficient)

    if (!Number.isFinite(coefficient) || coefficient < 0.5) {
      validation.coefficient = 'Le coefficient doit être au moins 0,5.'
    }

    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }

    setSaving(true)
    setErrors({})
    setFormError('')

    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        intitule: form.intitule.trim(),
        coefficient,
        volume_horaire: form.volume_horaire
          ? Number(form.volume_horaire)
          : null,
      }

      const saved = isEdit
        ? await updateSubject(initial.id, payload)
        : await createSubject(payload)

      onSaved(saved)
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      setErrors(fieldErrors)
      setFormError(
        Object.keys(fieldErrors).length > 0
          ? ''
          : getErrorMessage(error, "L'enregistrement de la matière a échoué."),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Modifier la matière' : 'Nouvelle matière'}
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <button
            type="button"
            className="button button-ghost"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="subject-form"
            className="button button-primary"
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="subject-form" className="stack-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className={`field ${errors.code ? 'has-error' : ''}`}>
            <span>Code *</span>
            <input
              type="text"
              placeholder="MATH"
              value={form.code}
              onChange={(event) => updateField('code', event.target.value)}
            />
            {errors.code ? (
              <small className="field-error">{errors.code}</small>
            ) : null}
          </label>

          <label className={`field ${errors.coefficient ? 'has-error' : ''}`}>
            <span>Coefficient *</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={form.coefficient}
              onChange={(event) =>
                updateField('coefficient', event.target.value)
              }
            />
            {errors.coefficient ? (
              <small className="field-error">{errors.coefficient}</small>
            ) : null}
          </label>

          <label className={`field field-full ${errors.intitule ? 'has-error' : ''}`}>
            <span>Intitulé *</span>
            <input
              type="text"
              placeholder="Mathématiques"
              value={form.intitule}
              onChange={(event) => updateField('intitule', event.target.value)}
            />
            {errors.intitule ? (
              <small className="field-error">{errors.intitule}</small>
            ) : null}
          </label>

          <label className={`field ${errors.volume_horaire ? 'has-error' : ''}`}>
            <span>Volume horaire (heures)</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={form.volume_horaire}
              onChange={(event) =>
                updateField('volume_horaire', event.target.value)
              }
            />
            {errors.volume_horaire ? (
              <small className="field-error">{errors.volume_horaire}</small>
            ) : null}
          </label>
        </div>

        {formError ? <p className="form-error">{formError}</p> : null}
      </form>
    </Modal>
  )
}

function ClassAssignmentDialog({
  subject,
  classes,
  schoolYearId,
  onClose,
  onSaved,
}) {
  const otherYearIds = (subject.classes ?? [])
    .filter((item) => item.school_year_id !== schoolYearId)
    .map((item) => item.id)
  const [selectedIds, setSelectedIds] = useState(() =>
    (subject.classes ?? [])
      .filter((item) => item.school_year_id === schoolYearId)
      .map((item) => item.id),
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const selected = new Set(selectedIds)

  function toggle(classId) {
    setSelectedIds((current) =>
      current.includes(classId)
        ? current.filter((id) => id !== classId)
        : [...current, classId],
    )
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')

    try {
      await syncSubjectClasses(subject.id, [
        ...new Set([...otherYearIds, ...selectedIds]),
      ])
      onSaved()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "L'affectation aux classes a échoué.",
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={`Classes · ${subject.intitule}`}
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <button
            type="button"
            className="button button-ghost"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <p className="modal-intro">
        Sélectionnez les classes de l’année active auxquelles cette matière est
        enseignée.
      </p>

      {classes.length === 0 ? (
        <p className="muted-text">
          Aucune classe n’est disponible pour l’année sélectionnée.
        </p>
      ) : (
        <div className="checkbox-list">
          {classes.map((schoolClass) => (
            <label key={schoolClass.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={selected.has(schoolClass.id)}
                onChange={() => toggle(schoolClass.id)}
              />
              <span>
                {schoolClass.nom}
                {schoolClass.niveau ? (
                  <small> · {schoolClass.niveau}</small>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      )}

      {error ? <p className="form-error">{error}</p> : null}
    </Modal>
  )
}

export default function MatieresPage() {
  const { selectedYearId, selectedYear } = useSchoolYear()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dialogSubject, setDialogSubject] = useState(null)
  const [assignSubject, setAssignSubject] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const subjectsQuery = useQuery({
    queryKey: ['subjects', { search: debouncedSearch }],
    queryFn: () => listSubjects(debouncedSearch),
  })

  const classesQuery = useQuery({
    queryKey: ['classes', { school_year_id: selectedYearId }],
    queryFn: () => listClasses({ school_year_id: selectedYearId }),
    enabled: Boolean(selectedYearId),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => {
      setDeleteTarget(null)
      setActionError('')
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
    onError: (error) => {
      setActionError(
        getErrorMessage(error, 'La suppression de la matière a échoué.'),
      )
    },
  })

  const subjects = subjectsQuery.data ?? []
  const classes = classesQuery.data ?? []

  function handleSaved() {
    setDialogSubject(null)
    queryClient.invalidateQueries({ queryKey: ['subjects'] })
    queryClient.invalidateQueries({ queryKey: ['classes'] })
  }

  function handleAssignmentSaved() {
    setAssignSubject(null)
    queryClient.invalidateQueries({ queryKey: ['subjects'] })
    queryClient.invalidateQueries({ queryKey: ['classes'] })
    queryClient.invalidateQueries({ queryKey: ['class'] })
  }

  return (
    <section className="page">
      <header className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">Programme</p>
          <h1>Matières</h1>
          <p>Gérez les matières et leur affectation aux classes.</p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={() => setDialogSubject({})}
        >
          + Nouvelle matière
        </button>
      </header>

      {actionError ? <p className="alert alert-error">{actionError}</p> : null}

      <div className="toolbar">
        <div className="toolbar-filters">
          <label className="field field-search">
            <span className="sr-only">Rechercher une matière</span>
            <input
              type="search"
              placeholder="Rechercher par code ou intitulé…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <span className="toolbar-count">{subjects.length} matière(s)</span>
      </div>

      <div className="table-card">
        {subjectsQuery.isLoading ? (
          <p className="table-state">Chargement des matières…</p>
        ) : subjectsQuery.isError ? (
          <div className="table-state">
            <p className="form-error">
              {getErrorMessage(
                subjectsQuery.error,
                'Impossible de charger les matières.',
              )}
            </p>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => subjectsQuery.refetch()}
            >
              Réessayer
            </button>
          </div>
        ) : subjects.length === 0 ? (
          <EmptyState
            title={
              debouncedSearch ? 'Aucune matière trouvée' : 'Aucune matière'
            }
            description={
              debouncedSearch
                ? 'Essayez un autre mot-clé.'
                : 'Ajoutez les matières enseignées dans l’établissement.'
            }
            action={
              debouncedSearch ? null : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setDialogSubject({})}
                >
                  Créer une matière
                </button>
              )
            }
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Matière</th>
                  <th>Coefficient</th>
                  <th>Volume horaire</th>
                  <th>Classes</th>
                  <th className="table-actions-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => {
                  const yearClasses = (subject.classes ?? []).filter(
                    (item) => item.school_year_id === selectedYearId,
                  )

                  return (
                    <tr key={subject.id}>
                      <td className="mono">{subject.code}</td>
                      <td>
                        <strong>{subject.intitule}</strong>
                      </td>
                      <td>{subject.coefficient}</td>
                      <td>
                        {subject.volume_horaire
                          ? `${subject.volume_horaire} h`
                          : '—'}
                      </td>
                      <td>
                        <span className="badge badge-info">
                          {selectedYearId
                            ? `${yearClasses.length} cette année`
                            : `${subject.classes_count ?? 0} au total`}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="button button-ghost button-small"
                            onClick={() => setAssignSubject(subject)}
                            disabled={!selectedYearId}
                          >
                            Classes
                          </button>
                          <button
                            type="button"
                            className="button button-ghost button-small"
                            onClick={() =>
                              setDialogSubject({
                                ...subject,
                                coefficient: String(subject.coefficient),
                                volume_horaire:
                                  subject.volume_horaire ?? '',
                              })
                            }
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="button button-danger-ghost button-small"
                            onClick={() => setDeleteTarget(subject)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogSubject ? (
        <SubjectFormDialog
          key={dialogSubject.id ?? 'new'}
          open
          initial={dialogSubject.id ? dialogSubject : EMPTY_SUBJECT}
          onClose={() => setDialogSubject(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {assignSubject ? (
        <ClassAssignmentDialog
          key={assignSubject.id}
          subject={assignSubject}
          classes={classes}
          schoolYearId={selectedYearId}
          onClose={() => setAssignSubject(null)}
          onSaved={handleAssignmentSaved}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Supprimer la matière"
        message={
          deleteTarget
            ? `Supprimer définitivement ${deleteTarget.intitule} ? Une matière associée à des classes ne peut pas être supprimée.`
            : ''
        }
        confirmLabel="Supprimer"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />

      {selectedYear ? (
        <p className="sr-only">
          Affectations affichées pour l’année {selectedYear.libelle}.
        </p>
      ) : null}
    </section>
  )
}
