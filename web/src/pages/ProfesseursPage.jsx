import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTeacher,
  createTeacherAccount,
  deleteTeacher,
  getTeacher,
  listTeachers,
  syncTeacherSubjects,
  assignTeacherAsMain,
  updateTeacher,
} from '../api/teachers'
import { listSubjects } from '../api/subjects'
import { listClasses } from '../api/classes'
import { getErrorMessage, getFieldErrors } from '../api/errors'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icons'
import Modal from '../components/Modal'
import useSchoolYear from '../schoolYear/useSchoolYear'

const EMPTY_TEACHER = {
  nom: '',
  prenoms: '',
  contact: '',
  email: '',
  diplomes: '',
  date_embauche: '',
  statut: 'actif',
}

const STATUT_LABELS = {
  actif: 'Actif',
  inactif: 'Inactif',
  archive: 'Archivé',
}

function statusTone(statut) {
  if (statut === 'actif') return 'badge-success'
  if (statut === 'archive') return 'badge-danger'
  return 'badge-muted'
}

function TeacherFormDialog({ open, initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => initial ?? EMPTY_TEACHER)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(initial?.id)

  useEffect(() => {
    if (open) {
      setForm(initial ?? EMPTY_TEACHER)
      setErrors({})
      setFormError('')
    }
  }, [initial, open])

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

    if (!form.nom?.trim()) {
      validation.nom = 'Le nom est obligatoire.'
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
        nom: form.nom.trim(),
        prenoms: form.prenoms?.trim() || null,
        contact: form.contact?.trim() || null,
        email: form.email?.trim() || null,
        diplomes: form.diplomes?.trim() || null,
        date_embauche: form.date_embauche || null,
        statut: form.statut || 'actif',
      }

      const saved = isEdit ? await updateTeacher(initial.id, payload) : await createTeacher(payload)
      onSaved(saved)
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      setErrors(fieldErrors)
      setFormError(
        Object.keys(fieldErrors).length > 0
          ? ''
          : getErrorMessage(error, "L'enregistrement du professeur a échoué."),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Modifier le professeur' : 'Nouveau professeur'}
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" form="teacher-form" className="button button-primary" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="teacher-form" className="stack-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className={`field ${errors.nom ? 'has-error' : ''}`}>
            <span>Nom *</span>
            <input value={form.nom} onChange={(event) => updateField('nom', event.target.value)} />
            {errors.nom ? <small className="field-error">{errors.nom}</small> : null}
          </label>
          <label className="field">
            <span>Prénoms</span>
            <input value={form.prenoms} onChange={(event) => updateField('prenoms', event.target.value)} />
          </label>
          <label className="field">
            <span>Contact</span>
            <input value={form.contact} onChange={(event) => updateField('contact', event.target.value)} />
          </label>
          <label className={`field ${errors.email ? 'has-error' : ''}`}>
            <span>Email</span>
            <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
            {errors.email ? <small className="field-error">{errors.email}</small> : null}
          </label>
          <label className="field">
            <span>Date d'embauche</span>
            <input type="date" value={form.date_embauche || ''} onChange={(event) => updateField('date_embauche', event.target.value)} />
          </label>
          <label className="field">
            <span>Statut</span>
            <select value={form.statut} onChange={(event) => updateField('statut', event.target.value)}>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
              <option value="archive">Archivé</option>
            </select>
          </label>
          <label className="field field-full">
            <span>Diplômes</span>
            <textarea rows={3} value={form.diplomes || ''} onChange={(event) => updateField('diplomes', event.target.value)} />
          </label>
        </div>
        {formError ? <p className="form-error">{formError}</p> : null}
      </form>
    </Modal>
  )
}

function TeacherDetailDialog({ open, teacherId, onClose, onChanged }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('infos')
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')

  const teacherQuery = useQuery({
    queryKey: ['teacher', String(teacherId)],
    queryFn: () => getTeacher(teacherId),
    enabled: open && Boolean(teacherId),
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects-all'],
    queryFn: () => listSubjects(),
    enabled: open,
  })

  const classesQuery = useQuery({
    queryKey: ['classes-all'],
    queryFn: () => listClasses(),
    enabled: open,
  })

  const teacher = teacherQuery.data
  const subjects = subjectsQuery.data ?? []
  const classes = classesQuery.data ?? []

  useEffect(() => {
    if (open && teacher) {
      setSelectedSubjects((teacher.subjects || []).map((s) => s.id))
      setSelectedClass('')
      setAccountEmail(teacher.email || '')
      setTempPassword('')
      setActionError('')
      setMessage('')
      setActiveTab('infos')
    }
  }, [open, teacher])

  const syncSubjectsMutation = useMutation({
    mutationFn: (subjectIds) => syncTeacherSubjects(teacherId, subjectIds),
    onSuccess: (res) => {
      setActionError('')
      setMessage(res.message || 'Matières mises à jour.')
      queryClient.invalidateQueries({ queryKey: ['teacher', String(teacherId)] })
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      onChanged?.()
    },
    onError: (error) => setActionError(getErrorMessage(error, 'Échec de la mise à jour des matières.')),
  })

  const assignMainMutation = useMutation({
    mutationFn: (classId) => assignTeacherAsMain(teacherId, classId),
    onSuccess: (res) => {
      setActionError('')
      setMessage(res.message || 'Professeur principal désigné.')
      queryClient.invalidateQueries({ queryKey: ['teacher', String(teacherId)] })
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      onChanged?.()
    },
    onError: (error) => setActionError(getErrorMessage(error, "Échec de la désignation comme professeur principal.")),
  })

  const createAccountMutation = useMutation({
    mutationFn: () => createTeacherAccount(teacherId, accountEmail ? { email: accountEmail } : {}),
    onSuccess: (res) => {
      setActionError('')
      setTempPassword(res.temporary_password || '')
      setMessage(res.message || 'Compte créé.')
      queryClient.invalidateQueries({ queryKey: ['teacher', String(teacherId)] })
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      onChanged?.()
    },
    onError: (error) => setActionError(getErrorMessage(error, 'Échec de la création du compte.')),
  })

  if (!open) return null

  const planning = teacher?.planning || []

  return (
    <Modal
      open={open}
      title={teacher?.nom_complet || 'Fiche professeur'}
      onClose={onClose}
      footer={
        <button type="button" className="button button-ghost" onClick={onClose}>
          Fermer
        </button>
      }
    >
      <div className="tab-bar">
        <button type="button" className={`tab-button ${activeTab === 'infos' ? 'is-active' : ''}`} onClick={() => setActiveTab('infos')}>
          Informations
        </button>
        <button type="button" className={`tab-button ${activeTab === 'matieres' ? 'is-active' : ''}`} onClick={() => setActiveTab('matieres')}>
          Matières
        </button>
        <button type="button" className={`tab-button ${activeTab === 'classes' ? 'is-active' : ''}`} onClick={() => setActiveTab('classes')}>
          Classes
        </button>
        <button type="button" className={`tab-button ${activeTab === 'compte' ? 'is-active' : ''}`} onClick={() => setActiveTab('compte')}>
          Compte
        </button>
        <button type="button" className={`tab-button ${activeTab === 'planning' ? 'is-active' : ''}`} onClick={() => setActiveTab('planning')}>
          Planning
        </button>
      </div>

      {actionError ? <p className="form-error">{actionError}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      {activeTab === 'infos' ? (
        <div className="stack-form">
          <div className="detail-grid">
            <div><span className="detail-label">Nom complet</span><p>{teacher?.nom_complet || '-'}</p></div>
            <div><span className="detail-label">Contact</span><p>{teacher?.contact || '-'}</p></div>
            <div><span className="detail-label">Email</span><p>{teacher?.email || '-'}</p></div>
            <div><span className="detail-label">Date d'embauche</span><p>{teacher?.date_embauche || '-'}</p></div>
            <div><span className="detail-label">Statut</span><p>{STATUT_LABELS[teacher?.statut] || teacher?.statut || '-'}</p></div>
            <div className="detail-grid-full"><span className="detail-label">Diplômes</span><p>{teacher?.diplomes || '-'}</p></div>
          </div>
        </div>
      ) : null}

      {activeTab === 'matieres' ? (
        <div className="stack-form">
          <div className="form-grid">
            {subjects.map((subject) => {
              const checked = selectedSubjects.includes(subject.id)
              return (
                <label key={subject.id} className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedSubjects((current) => [...current, subject.id])
                      } else {
                        setSelectedSubjects((current) => current.filter((id) => id !== subject.id))
                      }
                    }}
                  />
                  <span>{subject.code} - {subject.intitule}</span>
                </label>
              )
            })}
          </div>
          <div className="modal-footer">
            <button type="button" className="button button-primary" onClick={() => syncSubjectsMutation.mutate(selectedSubjects)} disabled={syncSubjectsMutation.isPending}>
              {syncSubjectsMutation.isPending ? 'Enregistrement...' : 'Enregistrer les matières'}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'classes' ? (
        <div className="stack-form">
          <div className="list-card">
            <div className="list-card-header">
              <h3>Classes dont il est professeur principal</h3>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Classe</th>
                  </tr>
                </thead>
                <tbody>
                  {(teacher?.classes_principales || []).length === 0 ? (
                    <tr>
                      <td>Aucune classe</td>
                    </tr>
                  ) : (
                    (teacher?.classes_principales || []).map((classe) => (
                      <tr key={classe.id}>
                        <td>{classe.nom}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="form-grid">
            <label className="field field-full">
              <span>Désigner comme professeur principal d'une classe</span>
              <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
                <option value="">Sélectionner une classe</option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.nom}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="button button-primary"
              disabled={!selectedClass || assignMainMutation.isPending}
              onClick={() => assignMainMutation.mutate(Number(selectedClass))}
            >
              {assignMainMutation.isPending ? 'Désignation...' : 'Désigner'}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'compte' ? (
        <div className="stack-form">
          {teacher?.has_account ? (
            <p>Ce professeur possède déjà un compte de connexion ({teacher?.user?.email || teacher?.email}).</p>
          ) : (
            <>
              <label className="field field-full">
                <span>Email pour le compte</span>
                <input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} />
              </label>
              <div className="modal-footer">
                <button type="button" className="button button-primary" disabled={createAccountMutation.isPending} onClick={() => createAccountMutation.mutate()}>
                  {createAccountMutation.isPending ? 'Création...' : 'Créer un compte de connexion'}
                </button>
              </div>
              {tempPassword ? (
                <div className="alert alert-warning">
                  <strong>Mot de passe temporaire (affiché une seule fois) :</strong> <code>{tempPassword}</code>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {activeTab === 'planning' ? (
        <div className="stack-form">
          <p>Charge horaire (séances à venir) : {teacher?.planning ? 'voir ci-dessous' : '-'} heures</p>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Horaire</th>
                  <th>Matière</th>
                  <th>Groupe/Classe</th>
                  <th>Durée</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {planning.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Aucune séance à venir</td>
                  </tr>
                ) : (
                  planning.map((session) => (
                    <tr key={session.id}>
                      <td>{session.date}</td>
                      <td>{session.heure_debut} - {session.heure_fin}</td>
                      <td>{session.subject ? `${session.subject.code} - ${session.subject.intitule}` : '-'}</td>
                      <td>{session.group?.nom || '-'}</td>
                      <td>{session.duree_heures || '-'}</td>
                      <td>{session.statut || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

export default function ProfesseursPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const subjectsQuery = useQuery({
    queryKey: ['subjects-all'],
    queryFn: () => listSubjects(),
  })

  const teachersQuery = useQuery({
    queryKey: ['teachers', { search: debouncedSearch, subject_id: subjectFilter || undefined }],
    queryFn: () => listTeachers({ search: debouncedSearch || undefined, subject_id: subjectFilter || undefined }),
  })

  const archiveMutation = useMutation({
    mutationFn: deleteTeacher,
    onSuccess: () => {
      setArchiveTarget(null)
      setActionError('')
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
    onError: (error) => setActionError(getErrorMessage(error, "L'archivage du professeur a échoué.")),
  })

  const subjects = subjectsQuery.data ?? []
  const teachers = teachersQuery.data ?? []

  function openCreate() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(teacher) {
    setEditTarget(teacher)
    setFormOpen(true)
  }

  function handleSaved() {
    setFormOpen(false)
    setEditTarget(null)
    queryClient.invalidateQueries({ queryKey: ['teachers'] })
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Professeurs</h1>
          <p>Gérer les professeurs, leurs matières, leurs classes et leurs comptes.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="button button-primary" onClick={openCreate}>
            <Icon name="plus" size={16} />
            Nouveau professeur
          </button>
        </div>
      </header>

      <section className="filter-bar">
        <div className="filter-group">
          <label className="filter-field">
            <span>Rechercher</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, prénom, email, contact" />
          </label>
          <label className="filter-field">
            <span>Filtrer par matière</span>
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="">Toutes les matières</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} - {subject.intitule}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {actionError ? <p className="form-error">{actionError}</p> : null}

      <section className="list-card">
        <div className="list-card-header">
          <h2>Liste des professeurs</h2>
          <span className="list-card-count">{teachers.length} professeur(s)</span>
        </div>
        {teachers.length === 0 ? (
          <EmptyState title="Aucun professeur" description="Créez un premier professeur pour commencer." actionLabel="Nouveau professeur" onAction={openCreate} />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom complet</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Matières</th>
                  <th>Statut</th>
                  <th>Compte</th>
                  <th className="table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>
                      <button type="button" className="link-button" onClick={() => setDetailTarget(teacher.id)}>
                        {teacher.nom_complet}
                      </button>
                    </td>
                    <td>{teacher.contact || '-'}</td>
                    <td>{teacher.email || '-'}</td>
                    <td>{(teacher.subjects || []).map((s) => s.code).join(', ') || '-'}</td>
                    <td>
                      <span className={`badge ${statusTone(teacher.statut)}`}>{STATUT_LABELS[teacher.statut] || teacher.statut}</span>
                    </td>
                    <td>{teacher.has_account ? 'Oui' : 'Non'}</td>
                    <td className="table-actions">
                      <button type="button" className="icon-button" onClick={() => setDetailTarget(teacher.id)} title="Fiche">
                        <Icon name="view" size={16} />
                      </button>
                      <button type="button" className="icon-button" onClick={() => openEdit(teacher)} title="Modifier">
                        <Icon name="edit" size={16} />
                      </button>
                      <button type="button" className="icon-button icon-button-danger" onClick={() => setArchiveTarget(teacher)} title="Archiver">
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TeacherFormDialog open={formOpen} initial={editTarget} onClose={() => { setFormOpen(false); setEditTarget(null) }} onSaved={handleSaved} />
      <TeacherDetailDialog open={Boolean(detailTarget)} teacherId={detailTarget} onClose={() => setDetailTarget(null)} onChanged={() => queryClient.invalidateQueries({ queryKey: ['teachers'] })} />
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archiver le professeur"
        description={`Voulez-vous archiver ${archiveTarget?.nom_complet || 'ce professeur'} ? L'archivage est utilisé plutôt que la suppression.`}
        confirmLabel="Archiver"
        tone="danger"
        loading={archiveMutation.isPending}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => archiveMutation.mutate(archiveTarget.id)}
      />
    </div>
  )
}
