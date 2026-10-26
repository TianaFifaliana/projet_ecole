import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  activateSchoolYear,
  createSchoolYear,
  listSchoolYears,
  updateSchoolYear,
} from '../api/schoolYears'
import { getErrorMessage, getFieldErrors } from '../api/errors'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import useSchoolYear from '../schoolYear/useSchoolYear'
import { formatDate } from '../utils/format'

const EMPTY_YEAR = {
  libelle: '',
  debut: '',
  fin: '',
  active: false,
}

function YearFormDialog({ open, initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => initial ?? EMPTY_YEAR)
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

    if (!form.libelle.trim()) {
      validation.libelle = "Le libellé de l'année est obligatoire."
    }

    if (!form.debut) {
      validation.debut = 'La date de début est obligatoire.'
    }

    if (!form.fin) {
      validation.fin = 'La date de fin est obligatoire.'
    }

    if (form.debut && form.fin && form.fin < form.debut) {
      validation.fin = 'La date de fin doit être postérieure au début.'
    }

    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }

    setSaving(true)
    setFormError('')
    setErrors({})

    try {
      const saved = isEdit
        ? await updateSchoolYear(initial.id, form)
        : await createSchoolYear(form)

      onSaved(saved)
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      setErrors(fieldErrors)
      setFormError(
        Object.keys(fieldErrors).length > 0
          ? ''
          : getErrorMessage(error, "L'enregistrement de l'année a échoué."),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Modifier l’année scolaire' : 'Nouvelle année scolaire'}
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
            form="school-year-form"
            className="button button-primary"
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="school-year-form" className="stack-form" onSubmit={handleSubmit}>
        <label className={`field ${errors.libelle ? 'has-error' : ''}`}>
          <span>Libellé *</span>
          <input
            type="text"
            placeholder="2026-2027"
            value={form.libelle}
            onChange={(event) => updateField('libelle', event.target.value)}
          />
          {errors.libelle ? (
            <small className="field-error">{errors.libelle}</small>
          ) : null}
        </label>

        <div className="form-grid">
          <label className={`field ${errors.debut ? 'has-error' : ''}`}>
            <span>Début *</span>
            <input
              type="date"
              value={form.debut}
              onChange={(event) => updateField('debut', event.target.value)}
            />
            {errors.debut ? (
              <small className="field-error">{errors.debut}</small>
            ) : null}
          </label>

          <label className={`field ${errors.fin ? 'has-error' : ''}`}>
            <span>Fin *</span>
            <input
              type="date"
              value={form.fin}
              onChange={(event) => updateField('fin', event.target.value)}
            />
            {errors.fin ? (
              <small className="field-error">{errors.fin}</small>
            ) : null}
          </label>
        </div>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={Boolean(form.active)}
            onChange={(event) => updateField('active', event.target.checked)}
          />
          <span>Définir comme année active</span>
        </label>

        {formError ? <p className="form-error">{formError}</p> : null}
      </form>
    </Modal>
  )
}

export default function AnneesPage() {
  const queryClient = useQueryClient()
  const { setSelectedYearId } = useSchoolYear()
  const [dialog, setDialog] = useState(null)
  const [activateTarget, setActivateTarget] = useState(null)
  const [actionError, setActionError] = useState('')

  const yearsQuery = useQuery({
    queryKey: ['school-years'],
    queryFn: listSchoolYears,
  })

  const activateMutation = useMutation({
    mutationFn: activateSchoolYear,
    onSuccess: (data) => {
      setActivateTarget(null)
      setActionError('')
      setSelectedYearId(data.annee.id)
      queryClient.invalidateQueries({ queryKey: ['school-years'] })
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      setActionError(
        getErrorMessage(error, "L'activation de l'année a échoué."),
      )
    },
  })

  const years = yearsQuery.data ?? []

  function handleSaved() {
    setDialog(null)
    queryClient.invalidateQueries({ queryKey: ['school-years'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  return (
    <section className="page">
      <header className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">Paramètres</p>
          <h1>Années scolaires</h1>
          <p>
            Créez les années scolaires et désignez celle qui est active pour
            l’établissement.
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={() => setDialog({ mode: 'create' })}
        >
          + Nouvelle année
        </button>
      </header>

      {actionError ? <p className="alert alert-error">{actionError}</p> : null}

      <div className="table-card">
        {yearsQuery.isLoading ? (
          <p className="table-state">Chargement des années…</p>
        ) : yearsQuery.isError ? (
          <div className="table-state">
            <p className="form-error">
              {getErrorMessage(
                yearsQuery.error,
                'Impossible de charger les années scolaires.',
              )}
            </p>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => yearsQuery.refetch()}
            >
              Réessayer
            </button>
          </div>
        ) : years.length === 0 ? (
          <EmptyState
            title="Aucune année scolaire"
            description="Créez la première année scolaire pour commencer."
            action={
              <button
                type="button"
                className="button button-primary"
                onClick={() => setDialog({ mode: 'create' })}
              >
                Créer une année
              </button>
            }
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Année</th>
                  <th>Début</th>
                  <th>Fin</th>
                  <th>Classes</th>
                  <th>Statut</th>
                  <th className="table-actions-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {years.map((year) => (
                  <tr key={year.id}>
                    <td>
                      <strong>{year.libelle}</strong>
                    </td>
                    <td>{formatDate(year.debut)}</td>
                    <td>{formatDate(year.fin)}</td>
                    <td>{year.classes_count ?? '—'}</td>
                    <td>
                      <span
                        className={`badge ${year.active ? 'badge-success' : 'badge-muted'}`}
                      >
                        {year.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="button button-ghost button-small"
                          onClick={() =>
                            setDialog({ mode: 'edit', year })
                          }
                        >
                          Modifier
                        </button>
                        {!year.active ? (
                          <button
                            type="button"
                            className="button button-primary button-small"
                            onClick={() => setActivateTarget(year)}
                          >
                            Activer
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog ? (
        <YearFormDialog
          key={dialog.year?.id ?? 'new'}
          open
          initial={dialog.year ?? EMPTY_YEAR}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(activateTarget)}
        title="Activer l’année scolaire"
        message={
          activateTarget
            ? `Activer ${activateTarget.libelle} ? L’année actuellement active sera désactivée.`
            : ''
        }
        confirmLabel="Activer"
        tone="primary"
        loading={activateMutation.isPending}
        onConfirm={() => activateMutation.mutate(activateTarget.id)}
        onClose={() => setActivateTarget(null)}
      />
    </section>
  )
}
