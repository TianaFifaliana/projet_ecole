import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  detachClassSubject,
  exportClassPdf,
  getClass,
  listClasses,
  listTeachers,
  syncClassSubjects,
  transferStudent,
} from '../api/classes'
import { listSubjects } from '../api/subjects'
import { getErrorMessage } from '../api/errors'
import { saveBlobResponse } from '../api/download'
import ClassFormDialog from '../components/classes/ClassFormDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { formatDate, getInitials } from '../utils/format'

export default function ClasseDetailPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [subjectError, setSubjectError] = useState('')
  const [subjectSaving, setSubjectSaving] = useState(false)
  const [subjectToRemove, setSubjectToRemove] = useState(null)
  const [transferTarget, setTransferTarget] = useState(null)
  const [transferClassId, setTransferClassId] = useState('')
  const [transferError, setTransferError] = useState('')
  const [transferSaving, setTransferSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [actionError, setActionError] = useState('')

  const classQuery = useQuery({
    queryKey: ['class', id],
    queryFn: () => getClass(id),
  })

  const schoolClass = classQuery.data

  const teachersQuery = useQuery({
    queryKey: ['teachers'],
    queryFn: () => listTeachers(),
    enabled: editOpen,
  })

  const siblingsQuery = useQuery({
    queryKey: [
      'classes',
      { school_year_id: schoolClass?.school_year_id },
    ],
    queryFn: () =>
      listClasses({ school_year_id: schoolClass.school_year_id }),
    enabled: Boolean(schoolClass?.school_year_id),
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => listSubjects(),
  })

  function invalidateClass() {
    queryClient.invalidateQueries({ queryKey: ['class', id] })
    queryClient.invalidateQueries({ queryKey: ['classes'] })
    queryClient.invalidateQueries({ queryKey: ['students'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  async function handleAddSubject() {
    if (!selectedSubjectId) {
      return
    }

    setSubjectSaving(true)
    setSubjectError('')

    try {
      const currentIds = (schoolClass.subjects ?? []).map(
        (subject) => subject.id,
      )
      const nextIds = Array.from(
        new Set([...currentIds, Number(selectedSubjectId)]),
      )

      await syncClassSubjects(id, nextIds)
      setSelectedSubjectId('')
      invalidateClass()
    } catch (error) {
      setSubjectError(
        getErrorMessage(error, "L'ajout de la matière a échoué."),
      )
    } finally {
      setSubjectSaving(false)
    }
  }

  async function handleRemoveSubject() {
    if (!subjectToRemove) {
      return
    }

    setSubjectSaving(true)
    setSubjectError('')

    try {
      await detachClassSubject(id, subjectToRemove.id)
      setSubjectToRemove(null)
      invalidateClass()
    } catch (error) {
      setSubjectError(
        getErrorMessage(error, 'Le retrait de la matière a échoué.'),
      )
    } finally {
      setSubjectSaving(false)
    }
  }

  async function handleTransfer(event) {
    event.preventDefault()

    if (!transferClassId) {
      setTransferError('Sélectionnez la classe de destination.')
      return
    }

    setTransferSaving(true)
    setTransferError('')

    try {
      await transferStudent(id, transferTarget.id, {
        target_school_class_id: Number(transferClassId),
      })
      setTransferTarget(null)
      setTransferClassId('')
      invalidateClass()
    } catch (error) {
      setTransferError(
        getErrorMessage(error, "Le transfert de l'élève a échoué."),
      )
    } finally {
      setTransferSaving(false)
    }
  }

  async function handlePrint() {
    setPrinting(true)
    setActionError('')

    try {
      const response = await exportClassPdf(id)
      const safeName = (schoolClass.nom || 'classe')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase()
      saveBlobResponse(response, `classe-${safeName}.pdf`)
    } catch (error) {
      setActionError(
        getErrorMessage(error, "L'export PDF a échoué."),
      )
    } finally {
      setPrinting(false)
    }
  }

  function handleClassSaved() {
    setEditOpen(false)
    invalidateClass()
  }

  if (classQuery.isLoading) {
    return (
      <section className="page">
        <p className="table-state">Chargement de la classe…</p>
      </section>
    )
  }

  if (classQuery.isError) {
    return (
      <section className="page">
        <p className="alert alert-error">
          {getErrorMessage(
            classQuery.error,
            'Impossible de charger cette classe.',
          )}
        </p>
        <Link className="button button-ghost" to="/classes">
          Retour aux classes
        </Link>
      </section>
    )
  }

  const students = schoolClass.students ?? []
  const subjects = schoolClass.subjects ?? []
  const assignedIds = new Set(subjects.map((subject) => subject.id))
  const availableSubjects = (subjectsQuery.data ?? []).filter(
    (subject) => !assignedIds.has(subject.id),
  )
  const otherClasses = (siblingsQuery.data ?? []).filter(
    (item) => item.id !== schoolClass.id,
  )
  const percent = schoolClass.taux_remplissage ?? 0

  return (
    <section className="page">
      <header className="page-heading">
        <Link className="back-link" to="/classes">
          ← Retour aux classes
        </Link>
      </header>

      <div className="student-banner">
        <div className="student-banner-avatar class-avatar">
          <span>{getInitials(schoolClass.nom)}</span>
        </div>

        <div className="student-banner-info">
          <h1>{schoolClass.nom}</h1>
          <div className="student-banner-meta">
            <span>{schoolClass.niveau || 'Niveau non précisé'}</span>
            <span>{schoolClass.school_year?.libelle ?? '—'}</span>
            <span>
              {schoolClass.professeur_principal?.nom_complet ??
                'Sans professeur principal'}
            </span>
          </div>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={handlePrint}
            disabled={printing}
          >
            {printing ? 'Export…' : 'Imprimer la liste (PDF)'}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setEditOpen(true)}
          >
            Modifier
          </button>
        </div>
      </div>

      {actionError ? <p className="alert alert-error">{actionError}</p> : null}

      <div className="card">
        <div className="card-header-row">
          <h2 className="section-title">Effectif</h2>
          <span className="muted-text">
            {schoolClass.effectif ?? 0} / {schoolClass.capacite} élèves
          </span>
        </div>
        <div className="progress" aria-hidden="true">
          <span
            className={`progress-bar ${percent >= 100 ? 'is-full' : ''}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        <small className="progress-meta">{percent}% de remplissage</small>
      </div>

      <div className="card">
        <div className="card-header-row">
          <h2 className="section-title">Matières</h2>
          <span className="muted-text">{subjects.length} matière(s)</span>
        </div>

        {subjects.length === 0 ? (
          <p className="muted-text">
            Aucune matière n’est encore associée à cette classe.
          </p>
        ) : (
          <ul className="chip-list">
            {subjects.map((subject) => (
              <li key={subject.id} className="chip">
                <span>
                  {subject.intitule}
                  {subject.coefficient ? (
                    <small> · coef. {subject.coefficient}</small>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="chip-remove"
                  aria-label={`Retirer ${subject.intitule}`}
                  onClick={() => setSubjectToRemove(subject)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="inline-form">
          <label className="field field-compact">
            <span className="sr-only">Matière à ajouter</span>
            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
            >
              <option value="">Ajouter une matière…</option>
              {availableSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.intitule}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button button-primary"
            onClick={handleAddSubject}
            disabled={!selectedSubjectId || subjectSaving}
          >
            {subjectSaving ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>

        {subjectError ? <p className="form-error">{subjectError}</p> : null}
      </div>

      <div className="card">
        <div className="card-header-row">
          <h2 className="section-title">Élèves</h2>
          <span className="muted-text">{students.length} élève(s)</span>
        </div>

        {students.length === 0 ? (
          <EmptyState
            title="Aucun élève dans cette classe"
            description="Inscrivez des élèves ou affectez-les depuis leur dossier."
            action={
              <Link className="button button-primary" to="/eleves/nouveau">
                Inscrire un élève
              </Link>
            }
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Matricule</th>
                  <th>Sexe</th>
                  <th>Naissance</th>
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
                        <Link
                          className="table-link"
                          to={`/eleves/${student.id}`}
                        >
                          {student.nom_complet ?? student.nom}
                        </Link>
                      </div>
                    </td>
                    <td className="mono">{student.matricule ?? '—'}</td>
                    <td>
                      {student.sexe === 'M'
                        ? 'M'
                        : student.sexe === 'F'
                          ? 'F'
                          : '—'}
                    </td>
                    <td>{formatDate(student.date_naissance)}</td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="button button-ghost button-small"
                          to={`/eleves/${student.id}`}
                        >
                          Voir
                        </Link>
                        <button
                          type="button"
                          className="button button-ghost button-small"
                          onClick={() => {
                            setTransferTarget(student)
                            setTransferClassId('')
                            setTransferError('')
                          }}
                          disabled={otherClasses.length === 0}
                        >
                          Transférer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editOpen ? (
        <ClassFormDialog
          open
          initial={schoolClass}
          schoolYearId={schoolClass.school_year_id}
          teachers={teachersQuery.data ?? []}
          onClose={() => setEditOpen(false)}
          onSaved={handleClassSaved}
        />
      ) : null}

      <Modal
        open={Boolean(transferTarget)}
        title="Transférer l’élève"
        onClose={transferSaving ? () => undefined : () => setTransferTarget(null)}
        footer={
          <>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setTransferTarget(null)}
              disabled={transferSaving}
            >
              Annuler
            </button>
            <button
              type="submit"
              form="transfer-form"
              className="button button-primary"
              disabled={transferSaving || !transferClassId}
            >
              {transferSaving ? 'Transfert…' : 'Transférer'}
            </button>
          </>
        }
      >
        <form id="transfer-form" className="stack-form" onSubmit={handleTransfer}>
          <p className="modal-intro">
            Déplacer{' '}
            <strong>
              {transferTarget?.nom_complet ?? transferTarget?.nom}
            </strong>{' '}
            de {schoolClass.nom} vers une autre classe de la même année.
          </p>

          <label className="field">
            <span>Classe de destination</span>
            <select
              value={transferClassId}
              onChange={(event) => setTransferClassId(event.target.value)}
            >
              <option value="">Sélectionner…</option>
              {otherClasses.map((item) => {
                const full =
                  (item.effectif ?? 0) >= Number(item.capacite ?? 0)

                return (
                  <option key={item.id} value={item.id} disabled={full}>
                    {item.nom} ({item.effectif ?? 0}/{item.capacite})
                    {full ? ' · complète' : ''}
                  </option>
                )
              })}
            </select>
          </label>

          {transferError ? (
            <p className="form-error">{transferError}</p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(subjectToRemove)}
        title="Retirer la matière"
        message={
          subjectToRemove
            ? `Retirer ${subjectToRemove.intitule} de la classe ${schoolClass.nom} ?`
            : ''
        }
        confirmLabel="Retirer"
        loading={subjectSaving}
        onConfirm={handleRemoveSubject}
        onClose={() => setSubjectToRemove(null)}
      />
    </section>
  )
}
