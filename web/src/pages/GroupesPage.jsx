import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { groupsApi } from '../api/groups'
import { lessonSessionsApi, presencesApi } from '../api/groups'
import { listTeachers } from '../api/teachers'
import { listSubjects } from '../api/subjects'
import { listStudents } from '../api/students'
import { getErrorMessage } from '../api/errors'
import Modal from '../components/Modal'
import { hasPermission } from '../auth/permissions'
import useAuth from '../auth/useAuth'

const TYPES = [
  { value: 'soutien', label: 'Soutien' },
  { value: 'club', label: 'Club' },
  { value: 'atelier', label: 'Atelier' },
  { value: 'TD', label: 'TD' },
]

function getWeekDays(date) {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day + 1)
  const days = []
  for (let i = 0; i < 7; i++) {
    const nd = new Date(d)
    nd.setDate(d.getDate() + i)
    days.push(nd)
  }
  return days
}

export default function GroupesPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isProf = user?.role?.nom === 'professeur'

  const [tab, setTab] = useState('groupes')
  const [groupModal, setGroupModal] = useState(false)
  const [groupForm, setGroupForm] = useState({ nom: '', type: 'soutien', capacite: '', teacher_id: '' })
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [groupError, setGroupError] = useState('')

  const [weekOffset, setWeekOffset] = useState(0)
  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() + weekOffset * 7)
  const weekDays = getWeekDays(baseDate)
  const start = weekDays[0].toISOString().slice(0, 10)
  const end = weekDays[6].toISOString().slice(0, 10)

  const [sessionModal, setSessionModal] = useState(false)
  const [sessionForm, setSessionForm] = useState({
    group_id: '',
    subject_id: '',
    teacher_id: '',
    date: new Date().toISOString().slice(0, 10),
    heure_debut: '08:00',
    heure_fin: '09:00',
    salle: '',
  })
  const [sessionError, setSessionError] = useState('')

  const [appelModal, setAppelModal] = useState(false)
  const [appelSession, setAppelSession] = useState(null)
  const [presences, setPresences] = useState({})

  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: () => listTeachers() })
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => listSubjects() })
  const studentsQuery = useQuery({
    queryKey: ['students-search-group', memberSearch],
    queryFn: () => listStudents({ search: memberSearch, per_page: 15 }),
    enabled: Boolean(selectedGroup) && memberSearch.length >= 2,
  })
  const sessionsQuery = useQuery({
    queryKey: ['lesson-sessions', start, end],
    queryFn: () => lessonSessionsApi.list({ date_debut: start, date_fin: end }),
  })
  const absentsDepasseQuery = useQuery({
    queryKey: ['presences-absents-depasse'],
    queryFn: () => presencesApi.statistiques(),
  })

  const createGroup = useMutation({
    mutationFn: groupsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setGroupModal(false)
      setGroupForm({ nom: '', type: 'soutien', capacite: '', teacher_id: '' })
      setGroupError('')
    },
    onError: (e) => setGroupError(getErrorMessage(e, 'Erreur lors de la création')),
  })
  const attachStudent = useMutation({
    mutationFn: ({ groupId, studentId }) => groupsApi.attachStudent(groupId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setMemberSearch('')
    },
    onError: (e) => alert(getErrorMessage(e, "Erreur lors de l'ajout")),
  })
  const detachStudent = useMutation({
    mutationFn: ({ groupId, studentId }) => groupsApi.detachStudent(groupId, studentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  })
  const createSession = useMutation({
    mutationFn: lessonSessionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-sessions'] })
      setSessionModal(false)
      setSessionError('')
    },
    onError: (e) => setSessionError(getErrorMessage(e, 'Conflit ou erreur')),
  })
  const appelMutation = useMutation({
    mutationFn: ({ id, presences: p }) => lessonSessionsApi.appel(id, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-sessions'] })
      setAppelModal(false)
      setAppelSession(null)
      setPresences({})
    },
    onError: (e) => alert(getErrorMessage(e, "Erreur lors de l'enregistrement de l'appel")),
  })

  const groups = groupsQuery.data?.data || groupsQuery.data || []
  const teachers = teachersQuery.data || []
  const subjects = subjectsQuery.data || []
  const sessions = sessionsQuery.data?.data || sessionsQuery.data || []
  const studentsSearch = studentsQuery.data?.data || []
  const absentsDepasse = Array.isArray(absentsDepasseQuery.data) ? absentsDepasseQuery.data : []

  function openCreateGroup() {
    setGroupForm({ nom: '', type: 'soutien', capacite: '', teacher_id: '' })
    setGroupError('')
    setGroupModal(true)
  }
  function submitGroup(e) {
    e.preventDefault()
    const payload = { ...groupForm }
    if (!payload.capacite) delete payload.capacite
    if (!payload.teacher_id) delete payload.teacher_id
    createGroup.mutate(payload)
  }
  function openSessionCreate() {
    setSessionForm({
      group_id: selectedGroup?.id || '',
      subject_id: '',
      teacher_id: selectedGroup?.teacher_id || '',
      date: new Date().toISOString().slice(0, 10),
      heure_debut: '08:00',
      heure_fin: '09:00',
      salle: '',
    })
    setSessionError('')
    setSessionModal(true)
  }
  function submitSession(e) {
    e.preventDefault()
    createSession.mutate(sessionForm)
  }
  async function openAppel(session) {
    const res = await lessonSessionsApi.show(session.id)
    setAppelSession(res.data)
    const initial = {}
    ;(res.data.students || []).forEach((s) => {
      initial[s.id] = s.statut || 'present'
    })
    setPresences(initial)
    setAppelModal(true)
  }
  function setAllPresent() {
    if (!appelSession) return
    const updated = {}
    ;(appelSession.students || []).forEach((s) => {
      updated[s.id] = 'present'
    })
    setPresences(updated)
  }
  function submitAppel() {
    if (!appelSession) return
    appelMutation.mutate({ id: appelSession.id, presences })
  }

  const sessionsByDay = {}
  weekDays.forEach((d) => {
    const key = d.toISOString().slice(0, 10)
    sessionsByDay[key] = sessions.filter((s) => s.date === key)
  })

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Groupes & Séances</h1>
          <p className="page-subtitle">Gestion des groupes, planning et appel</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={openCreateGroup}>Nouveau groupe</button>
          <button type="button" className="btn btn-primary" onClick={openSessionCreate}>Planifier une séance</button>
        </div>
      </header>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button className={tab === 'groupes' ? 'tab active' : 'tab'} onClick={() => setTab('groupes')}>Groupes</button>
        <button className={tab === 'seances' ? 'tab active' : 'tab'} onClick={() => setTab('seances')}>Séances (calendrier)</button>
        <button className={tab === 'suivi' ? 'tab active' : 'tab'} onClick={() => setTab('suivi')}>Suivi absences</button>
      </div>

      {tab === 'groupes' ? (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="card">
            <div className="card-header-row">
              <h2 className="section-title">Liste des groupes</h2>
            </div>
            <div className="stack">
              {(Array.isArray(groups) ? groups : []).map((g) => (
                <button key={g.id} type="button" className="card" style={{ textAlign: 'left' }} onClick={() => setSelectedGroup(g)}>
                  <strong>{g.nom}</strong> <span className="muted-text">({g.type})</span>
                  <div className="muted-text">Capacité: {g.capacite || '∞'} - Membres: {g.students_count || g.students?.length || 0}</div>
                  {g.teacher ? <div className="muted-text">Responsable: {g.teacher.nom} {g.teacher.prenoms || ''}</div> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header-row">
              <h2 className="section-title">Membres du groupe</h2>
            </div>
            {!selectedGroup ? (
              <p className="muted-text">Sélectionnez un groupe</p>
            ) : (
              <>
                <p><strong>{selectedGroup.nom}</strong></p>
                <label className="field">
                  <span>Rechercher un élève à ajouter</span>
                  <input type="text" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Nom, prénom ou matricule..." />
                </label>
                {studentsSearch.length > 0 && memberSearch.length >= 2 ? (
                  <div className="card" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {studentsSearch.map((s) => (
                      <button key={s.id} type="button" className="btn btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => attachStudent.mutate({ groupId: selectedGroup.id, studentId: s.id })}>
                        {s.nom_complet}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="table-wrapper" style={{ marginTop: '1rem' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Élève</th>
                        <th>Matricule</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedGroup.students || []).map((s) => (
                        <tr key={s.id}>
                          <td>{s.nom_complet}</td>
                          <td>{s.matricule}</td>
                          <td><button type="button" className="btn btn-ghost" onClick={() => detachStudent.mutate({ groupId: selectedGroup.id, studentId: s.id })}>Retirer</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'seances' ? (
        <div className="card">
          <div className="card-header-row">
            <h2 className="section-title">Calendrier de la semaine</h2>
            <div>
              <button type="button" className="btn btn-ghost" onClick={() => setWeekOffset((o) => o - 1)}>← Semaine précédente</button>
              <button type="button" className="btn btn-ghost" onClick={() => setWeekOffset(0)}>Cette semaine</button>
              <button type="button" className="btn btn-ghost" onClick={() => setWeekOffset((o) => o + 1)}>Semaine suivante →</button>
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
            {weekDays.map((d) => {
              const key = d.toISOString().slice(0, 10)
              return (
                <div key={key} className="card">
                  <strong>{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' })}</strong>
                  <div className="stack" style={{ marginTop: '0.5rem' }}>
                    {(sessionsByDay[key] || []).map((s) => (
                      <button key={s.id} type="button" className="card" style={{ textAlign: 'left' }} onClick={() => openAppel(s)}>
                        <div><strong>{s.heure_debut}-{s.heure_fin}</strong></div>
                        <div>{s.group?.nom}</div>
                        <div className="muted-text">{s.subject?.nom || ''} {s.salle ? `| ${s.salle}` : ''}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {tab === 'suivi' ? (
        <div className="card">
          <div className="card-header-row">
            <h2 className="section-title">Élèves dont le nombre d'absences dépasse le seuil</h2>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Matricule</th>
                  <th>Classe</th>
                  <th>Nb absences</th>
                  <th>Seuil</th>
                </tr>
              </thead>
              <tbody>
                {absentsDepasse.length === 0 ? (
                  <tr><td colSpan={5} className="table-state">Aucun élève au-dessus du seuil</td></tr>
                ) : (
                  absentsDepasse.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.student?.nom_complet}</td>
                      <td>{item.student?.matricule}</td>
                      <td>{item.student?.school_class?.nom}</td>
                      <td>{item.nb_absences}</td>
                      <td>{item.seuil}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Modal open={groupModal} title="Nouveau groupe" onClose={() => setGroupModal(false)}>
        <form className="stack-form" onSubmit={submitGroup}>
          <label className="field">
            <span>Nom du groupe *</span>
            <input type="text" value={groupForm.nom} onChange={(e) => setGroupForm((f) => ({ ...f, nom: e.target.value }))} required />
          </label>
          <label className="field">
            <span>Type *</span>
            <select value={groupForm.type} onChange={(e) => setGroupForm((f) => ({ ...f, type: e.target.value }))}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Capacité</span>
            <input type="number" value={groupForm.capacite} onChange={(e) => setGroupForm((f) => ({ ...f, capacite: e.target.value }))} />
          </label>
          <label className="field">
            <span>Responsable (professeur)</span>
            <select value={groupForm.teacher_id} onChange={(e) => setGroupForm((f) => ({ ...f, teacher_id: e.target.value }))}>
              <option value="">Aucun</option>
              {(Array.isArray(teachers) ? teachers : []).map((t) => (
                <option key={t.id} value={t.id}>{t.nom} {t.prenoms || ''}</option>
              ))}
            </select>
          </label>
          {groupError ? <p className="form-error">{groupError}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setGroupModal(false)}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={createGroup.isPending}>Créer</button>
          </div>
        </form>
      </Modal>

      <Modal open={sessionModal} title="Planifier une séance" onClose={() => setSessionModal(false)}>
        <form className="stack-form" onSubmit={submitSession}>
          <label className="field">
            <span>Groupe *</span>
            <select value={sessionForm.group_id} onChange={(e) => setSessionForm((f) => ({ ...f, group_id: e.target.value }))} required>
              <option value="">Sélectionner</option>
              {(Array.isArray(groups) ? groups : []).map((g) => (
                <option key={g.id} value={g.id}>{g.nom}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Matière</span>
            <select value={sessionForm.subject_id} onChange={(e) => setSessionForm((f) => ({ ...f, subject_id: e.target.value }))}>
              <option value="">Aucune</option>
              {(Array.isArray(subjects) ? subjects : []).map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Professeur</span>
            <select value={sessionForm.teacher_id} onChange={(e) => setSessionForm((f) => ({ ...f, teacher_id: e.target.value }))}>
              <option value="">Aucun</option>
              {(Array.isArray(teachers) ? teachers : []).map((t) => (
                <option key={t.id} value={t.id}>{t.nom} {t.prenoms || ''}</option>
              ))}
            </select>
          </label>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <label className="field">
              <span>Date *</span>
              <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm((f) => ({ ...f, date: e.target.value }))} required />
            </label>
            <label className="field">
              <span>Début *</span>
              <input type="time" value={sessionForm.heure_debut} onChange={(e) => setSessionForm((f) => ({ ...f, heure_debut: e.target.value }))} required />
            </label>
            <label className="field">
              <span>Fin *</span>
              <input type="time" value={sessionForm.heure_fin} onChange={(e) => setSessionForm((f) => ({ ...f, heure_fin: e.target.value }))} required />
            </label>
          </div>
          <label className="field">
            <span>Salle</span>
            <input type="text" value={sessionForm.salle} onChange={(e) => setSessionForm((f) => ({ ...f, salle: e.target.value }))} />
          </label>
          {sessionError ? <p className="form-error">{sessionError}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setSessionModal(false)}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={createSession.isPending}>Planifier</button>
          </div>
        </form>
      </Modal>

      <Modal open={appelModal} title={`Appel - ${appelSession?.group?.nom || ''} ${appelSession?.date || ''}`} onClose={() => setAppelModal(false)}>
        {appelSession ? (
          <div className="stack-form">
            <button type="button" className="btn btn-primary" onClick={setAllPresent}>Tous présents</button>
            <div className="stack">
              {(appelSession.students || []).map((s) => (
                <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong>{s.nom_complet}</strong>
                    <div className="muted-text">{s.matricule}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <button type="button" className={presences[s.id] === 'present' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setPresences((p) => ({ ...p, [s.id]: 'present' }))}>Présent</button>
                    <button type="button" className={presences[s.id] === 'absent' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setPresences((p) => ({ ...p, [s.id]: 'absent' }))}>Absent</button>
                    <button type="button" className={presences[s.id] === 'retard' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setPresences((p) => ({ ...p, [s.id]: 'retard' }))}>Retard</button>
                    <button type="button" className={presences[s.id] === 'justifie' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setPresences((p) => ({ ...p, [s.id]: 'justifie' }))}>Justifié</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAppelModal(false)}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={submitAppel} disabled={appelMutation.isPending}>Enregistrer en un clic</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
