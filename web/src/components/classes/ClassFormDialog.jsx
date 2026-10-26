import { useState } from 'react'
import { createClass, updateClass } from '../../api/classes'
import { getErrorMessage, getFieldErrors } from '../../api/errors'
import Modal from '../Modal'

function buildInitial(initial, schoolYearId) {
  return {
    nom: initial?.nom ?? '',
    niveau: initial?.niveau ?? '',
    capacite: initial?.capacite ?? 40,
    teacher_id: initial?.teacher_id ?? '',
    school_year_id: initial?.school_year_id ?? schoolYearId ?? '',
  }
}

export default function ClassFormDialog({
  open,
  initial,
  schoolYearId,
  teachers = [],
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => buildInitial(initial, schoolYearId))
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

    if (!form.nom.trim()) {
      validation.nom = 'Le nom de la classe est obligatoire.'
    }

    const capacity = Number(form.capacite)

    if (!Number.isInteger(capacity) || capacity < 1) {
      validation.capacite = 'La capacité doit être un entier supérieur à 0.'
    }

    if (!form.school_year_id) {
      validation.school_year_id = 'Sélectionnez une année scolaire.'
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
        school_year_id: Number(form.school_year_id),
        teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
        nom: form.nom.trim(),
        niveau: form.niveau.trim() || null,
        capacite: capacity,
      }

      const saved = isEdit
        ? await updateClass(initial.id, payload)
        : await createClass(payload)

      onSaved(saved)
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      setErrors(fieldErrors)
      setFormError(
        Object.keys(fieldErrors).length > 0
          ? ''
          : getErrorMessage(error, "L'enregistrement de la classe a échoué."),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Modifier la classe' : 'Nouvelle classe'}
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
            form="class-form"
            className="button button-primary"
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="class-form" className="stack-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className={`field ${errors.nom ? 'has-error' : ''}`}>
            <span>Nom de la classe *</span>
            <input
              type="text"
              placeholder="6e A"
              value={form.nom}
              onChange={(event) => updateField('nom', event.target.value)}
            />
            {errors.nom ? (
              <small className="field-error">{errors.nom}</small>
            ) : null}
          </label>

          <label className={`field ${errors.niveau ? 'has-error' : ''}`}>
            <span>Niveau</span>
            <input
              type="text"
              placeholder="6e"
              value={form.niveau}
              onChange={(event) => updateField('niveau', event.target.value)}
            />
            {errors.niveau ? (
              <small className="field-error">{errors.niveau}</small>
            ) : null}
          </label>

          <label className={`field ${errors.capacite ? 'has-error' : ''}`}>
            <span>Capacité *</span>
            <input
              type="number"
              min="1"
              value={form.capacite}
              onChange={(event) =>
                updateField('capacite', event.target.value)
              }
            />
            {errors.capacite ? (
              <small className="field-error">{errors.capacite}</small>
            ) : null}
          </label>

          <label className={`field ${errors.teacher_id ? 'has-error' : ''}`}>
            <span>Professeur principal</span>
            <select
              value={form.teacher_id}
              onChange={(event) =>
                updateField('teacher_id', event.target.value)
              }
            >
              <option value="">Non affecté</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.nom_complet}
                  {teacher.statut && teacher.statut !== 'actif'
                    ? ` (${teacher.statut})`
                    : ''}
                </option>
              ))}
            </select>
            {errors.teacher_id ? (
              <small className="field-error">{errors.teacher_id}</small>
            ) : null}
          </label>
        </div>

        {errors.school_year_id ? (
          <p className="form-error">{errors.school_year_id}</p>
        ) : null}
        {formError ? <p className="form-error">{formError}</p> : null}
      </form>
    </Modal>
  )
}
