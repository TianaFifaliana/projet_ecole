import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createStudent,
  getStudent,
  updateStudent,
} from '../api/students'
import { listClasses } from '../api/classes'
import { getErrorMessage, getFieldErrors } from '../api/errors'
import useSchoolYear from '../schoolYear/useSchoolYear'

const EMPTY_FORM = {
  matricule: '',
  nom: '',
  prenoms: '',
  date_naissance: '',
  sexe: '',
  lieu_naissance: '',
  adresse: '',
  school_class_id: '',
  statut: 'actif',
}

export default function StudentFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { selectedYearId } = useSchoolYear()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(!isEdit)

  const studentQuery = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudent(id),
    enabled: isEdit,
  })

  const student = studentQuery.data
  const classesYearId = student?.school_class?.school_year_id ?? selectedYearId

  const classesQuery = useQuery({
    queryKey: ['classes', { school_year_id: classesYearId }],
    queryFn: () => listClasses({ school_year_id: classesYearId }),
    enabled: Boolean(classesYearId),
  })

  useEffect(() => {
    if (!student || initialized) {
      return
    }

    setForm({
      matricule: student.matricule ?? '',
      nom: student.nom ?? '',
      prenoms: student.prenoms ?? '',
      date_naissance: student.date_naissance ?? '',
      sexe: student.sexe ?? '',
      lieu_naissance: student.lieu_naissance ?? '',
      adresse: student.adresse ?? '',
      school_class_id: student.school_class_id ?? '',
      statut: student.statut ?? 'actif',
    })
    setInitialized(true)
  }, [student, initialized])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) {
        return current
      }

      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validation = {}

    if (!form.nom.trim()) {
      validation.nom = 'Le nom est obligatoire.'
    }

    if (form.date_naissance) {
      const selected = new Date(`${form.date_naissance}T00:00:00`)
      if (selected.getTime() > Date.now()) {
        validation.date_naissance =
          'La date de naissance ne peut pas être dans le futur.'
      }
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
        ...form,
        school_class_id: form.school_class_id || null,
        date_naissance: form.date_naissance || null,
        sexe: form.sexe || null,
        statut: form.statut || 'actif',
      }

      const saved = isEdit
        ? await updateStudent(id, payload)
        : await createStudent(payload)

      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.setQueryData(['student', String(saved.id)], saved)

      navigate(`/eleves/${saved.id}`, { replace: true })
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      setErrors(fieldErrors)
      setFormError(
        Object.keys(fieldErrors).length > 0
          ? ''
          : getErrorMessage(error, "L'enregistrement de l'élève a échoué."),
      )
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && studentQuery.isLoading) {
    return (
      <section className="page">
        <p className="table-state">Chargement de l’élève…</p>
      </section>
    )
  }

  if (isEdit && studentQuery.isError) {
    return (
      <section className="page">
        <p className="alert alert-error">
          {getErrorMessage(
            studentQuery.error,
            "Impossible de charger cet élève.",
          )}
        </p>
        <Link className="button button-ghost" to="/eleves">
          Retour à la liste
        </Link>
      </section>
    )
  }

  return (
    <section className="page">
      <header className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">Scolarité</p>
          <h1>{isEdit ? 'Modifier l’élève' : 'Nouvel élève'}</h1>
          <p>
            {isEdit
              ? 'Mettez à jour les informations du dossier.'
              : 'Renseignez les informations de l’élève et affectez-le à une classe.'}
          </p>
        </div>

        <Link className="button button-ghost" to={isEdit ? `/eleves/${id}` : '/eleves'}>
          Retour
        </Link>
      </header>

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        {formError ? <p className="alert alert-error">{formError}</p> : null}

        <div className="form-grid">
          <label className={`field ${errors.matricule ? 'has-error' : ''}`}>
            <span>Matricule</span>
            <input
              type="text"
              value={form.matricule}
              onChange={(event) => updateField('matricule', event.target.value)}
              placeholder="Généré automatiquement"
            />
            {errors.matricule ? (
              <small className="field-error">{errors.matricule}</small>
            ) : (
              <small className="field-help">
                Laissez vide pour générer un matricule automatiquement.
              </small>
            )}
          </label>

          <label className={`field ${errors.statut ? 'has-error' : ''}`}>
            <span>Statut</span>
            <select
              value={form.statut}
              onChange={(event) => updateField('statut', event.target.value)}
            >
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
              <option value="archive">Archivé</option>
            </select>
            {errors.statut ? (
              <small className="field-error">{errors.statut}</small>
            ) : null}
          </label>

          <label className={`field ${errors.nom ? 'has-error' : ''}`}>
            <span>Nom *</span>
            <input
              type="text"
              value={form.nom}
              onChange={(event) => updateField('nom', event.target.value)}
              autoComplete="off"
            />
            {errors.nom ? (
              <small className="field-error">{errors.nom}</small>
            ) : null}
          </label>

          <label className={`field ${errors.prenoms ? 'has-error' : ''}`}>
            <span>Prénoms</span>
            <input
              type="text"
              value={form.prenoms}
              onChange={(event) => updateField('prenoms', event.target.value)}
              autoComplete="off"
            />
            {errors.prenoms ? (
              <small className="field-error">{errors.prenoms}</small>
            ) : null}
          </label>

          <label className={`field ${errors.date_naissance ? 'has-error' : ''}`}>
            <span>Date de naissance</span>
            <input
              type="date"
              value={form.date_naissance}
              onChange={(event) =>
                updateField('date_naissance', event.target.value)
              }
            />
            {errors.date_naissance ? (
              <small className="field-error">{errors.date_naissance}</small>
            ) : null}
          </label>

          <label className={`field ${errors.sexe ? 'has-error' : ''}`}>
            <span>Sexe</span>
            <select
              value={form.sexe}
              onChange={(event) => updateField('sexe', event.target.value)}
            >
              <option value="">Non renseigné</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
            {errors.sexe ? (
              <small className="field-error">{errors.sexe}</small>
            ) : null}
          </label>

          <label className={`field ${errors.lieu_naissance ? 'has-error' : ''}`}>
            <span>Lieu de naissance</span>
            <input
              type="text"
              value={form.lieu_naissance}
              onChange={(event) =>
                updateField('lieu_naissance', event.target.value)
              }
            />
            {errors.lieu_naissance ? (
              <small className="field-error">{errors.lieu_naissance}</small>
            ) : null}
          </label>

          <label className={`field ${errors.school_class_id ? 'has-error' : ''}`}>
            <span>Classe</span>
            <select
              value={form.school_class_id}
              onChange={(event) =>
                updateField('school_class_id', event.target.value)
              }
            >
              <option value="">Non affecté</option>
              {(classesQuery.data ?? []).map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.nom}
                </option>
              ))}
            </select>
            {errors.school_class_id ? (
              <small className="field-error">{errors.school_class_id}</small>
            ) : (
              <small className="field-help">
                Les classes proposées correspondent à l’année sélectionnée.
              </small>
            )}
          </label>

          <label className={`field field-full ${errors.adresse ? 'has-error' : ''}`}>
            <span>Adresse</span>
            <textarea
              rows={3}
              value={form.adresse}
              onChange={(event) => updateField('adresse', event.target.value)}
            />
            {errors.adresse ? (
              <small className="field-error">{errors.adresse}</small>
            ) : null}
          </label>
        </div>

        <div className="form-actions">
          <Link
            className="button button-ghost"
            to={isEdit ? `/eleves/${id}` : '/eleves'}
          >
            Annuler
          </Link>
          <button
            type="submit"
            className="button button-primary"
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : "Créer l'élève"}
          </button>
        </div>
      </form>
    </section>
  )
}
