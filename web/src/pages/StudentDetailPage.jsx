import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  attachGuardian,
  createGuardian,
  deleteStudentDocument,
  detachGuardian,
  downloadStudentDocument,
  getStudent,
  getStudentPayments,
  getStudentPresences,
  listGuardians,
  uploadStudentDocument,
  uploadStudentPhoto,
} from '../api/students'
import { getErrorMessage, getFieldErrors } from '../api/errors'
import ComingSoon from '../components/ComingSoon'
import ConfirmDialog from '../components/ConfirmDialog'
import useSchoolYear from '../schoolYear/useSchoolYear'
import {
  formatAriary,
  formatDate,
  formatFileSize,
  getInitials,
} from '../utils/format'

const STATUS_LABELS = {
  actif: 'Actif',
  inactif: 'Inactif',
  archive: 'Archivé',
}

const DOCUMENT_TYPES = {
  acte_naissance: 'Acte de naissance',
  bulletin: 'Bulletin',
  certificat_medical: 'Certificat médical',
  autre: 'Autre',
}

const TABS = [
  { key: 'informations', label: 'Informations' },
  { key: 'parents', label: 'Parents / Tuteurs' },
  { key: 'documents', label: 'Documents' },
  { key: 'paiements', label: 'Paiements' },
  { key: 'presences', label: 'Présences' },
  { key: 'certificats', label: 'Certificats' },
]

function emptyGuardianForm() {
  return {
    nom: '',
    telephone: '',
    email: '',
    profession: '',
    adresse: '',
  }
}

export default function StudentDetailPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { years } = useSchoolYear()
  const [tab, setTab] = useState('informations')
  const [photoError, setPhotoError] = useState('')
  const [photoSaving, setPhotoSaving] = useState(false)
  const photoInputRef = useRef(null)

  const [parentMode, setParentMode] = useState('existing')
  const [selectedGuardianId, setSelectedGuardianId] = useState('')
  const [lienParente, setLienParente] = useState('')
  const [newGuardian, setNewGuardian] = useState(emptyGuardianForm)
  const [parentError, setParentError] = useState('')
  const [parentSaving, setParentSaving] = useState(false)
  const [detachTarget, setDetachTarget] = useState(null)

  const [documentType, setDocumentType] = useState('acte_naissance')
  const [documentFile, setDocumentFile] = useState(null)
  const [documentError, setDocumentError] = useState('')
  const [documentSaving, setDocumentSaving] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState(null)
  const documentInputRef = useRef(null)

  const studentQuery = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudent(id),
  })

  const studentPaymentsQuery = useQuery({
    queryKey: ['student-payments', id],
    queryFn: () => getStudentPayments(id),
    enabled: tab === 'paiements',
  })

  const guardiansQuery = useQuery({
    queryKey: ['guardians'],
    queryFn: () => listGuardians(),
    enabled: tab === 'parents',
  })

  const student = studentQuery.data
  const schoolYear = years.find(
    (year) => year.id === student?.school_class?.school_year_id,
  )

  const presencesQuery = useQuery({
    queryKey: ['student-presences', id],
    queryFn: () => getStudentPresences(id),
    enabled: tab === 'presences',
  })

  function invalidateStudent() {
    queryClient.invalidateQueries({ queryKey: ['student', id] })
    queryClient.invalidateQueries({ queryKey: ['students'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setPhotoError('Sélectionnez une image (JPG, PNG ou WebP).')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('La photo ne doit pas dépasser 2 Mo.')
      return
    }

    setPhotoSaving(true)
    setPhotoError('')

    try {
      await uploadStudentPhoto(id, file)
      invalidateStudent()
    } catch (error) {
      setPhotoError(
        getErrorMessage(error, "L'envoi de la photo a échoué."),
      )
    } finally {
      setPhotoSaving(false)

      if (photoInputRef.current) {
        photoInputRef.current.value = ''
      }
    }
  }

  async function handleAddParent(event) {
    event.preventDefault()
    setParentError('')

    if (parentMode === 'existing' && !selectedGuardianId) {
      setParentError('Sélectionnez un parent existant.')
      return
    }

    if (parentMode === 'new' && !newGuardian.nom.trim()) {
      setParentError('Le nom du parent est obligatoire.')
      return
    }

    setParentSaving(true)

    try {
      let guardianId = Number(selectedGuardianId)

      if (parentMode === 'new') {
        const created = await createGuardian(newGuardian)
        guardianId = created.id
      }

      await attachGuardian(id, {
        guardian_id: guardianId,
        lien_parente: lienParente || null,
      })

      setSelectedGuardianId('')
      setLienParente('')
      setNewGuardian(emptyGuardianForm())
      queryClient.invalidateQueries({ queryKey: ['guardians'] })
      invalidateStudent()
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      setParentError(
        fieldErrors.nom ||
          fieldErrors.guardian_id ||
          getErrorMessage(error, "L'ajout du parent a échoué."),
      )
    } finally {
      setParentSaving(false)
    }
  }

  async function handleDetachParent() {
    if (!detachTarget) {
      return
    }

    setParentSaving(true)
    setParentError('')

    try {
      await detachGuardian(id, detachTarget.id)
      setDetachTarget(null)
      invalidateStudent()
      queryClient.invalidateQueries({ queryKey: ['guardians'] })
    } catch (error) {
      setParentError(
        getErrorMessage(error, 'Le détachement du parent a échoué.'),
      )
    } finally {
      setParentSaving(false)
    }
  }

  async function handleDocumentUpload(event) {
    event.preventDefault()

    if (!documentFile) {
      setDocumentError('Sélectionnez un fichier.')
      return
    }

    if (documentFile.size > 5 * 1024 * 1024) {
      setDocumentError('Le document ne doit pas dépasser 5 Mo.')
      return
    }

    setDocumentSaving(true)
    setDocumentError('')

    try {
      await uploadStudentDocument(id, documentType, documentFile)
      setDocumentFile(null)
      invalidateStudent()

      if (documentInputRef.current) {
        documentInputRef.current.value = ''
      }
    } catch (error) {
      setDocumentError(
        getErrorMessage(error, "L'envoi du document a échoué."),
      )
    } finally {
      setDocumentSaving(false)
    }
  }

  async function handleDocumentDownload(document) {
    setDocumentError('')

    try {
      await downloadStudentDocument(id, document.id, document.nom)
    } catch (error) {
      setDocumentError(
        getErrorMessage(error, 'Le téléchargement a échoué.'),
      )
    }
  }

  async function handleDocumentDelete() {
    if (!documentToDelete) {
      return
    }

    setDocumentSaving(true)
    setDocumentError('')

    try {
      await deleteStudentDocument(id, documentToDelete.id)
      setDocumentToDelete(null)
      invalidateStudent()
    } catch (error) {
      setDocumentError(
        getErrorMessage(error, 'La suppression du document a échoué.'),
      )
    } finally {
      setDocumentSaving(false)
    }
  }

  if (studentQuery.isLoading) {
    return (
      <section className="page">
        <p className="table-state">Chargement du dossier…</p>
      </section>
    )
  }

  if (studentQuery.isError) {
    return (
      <section className="page">
        <p className="alert alert-error">
          {getErrorMessage(
            studentQuery.error,
            'Impossible de charger cet élève.',
          )}
        </p>
        <Link className="button button-ghost" to="/eleves">
          Retour à la liste
        </Link>
      </section>
    )
  }

  const guardians = student.guardians ?? []
  const documents = student.documents ?? []
  const paiements = student.paiements ?? {}
  const attachedIds = new Set(guardians.map((guardian) => guardian.id))
  const availableGuardians = (guardiansQuery.data ?? []).filter(
    (guardian) => !attachedIds.has(guardian.id),
  )

  return (
    <section className="page">
      <header className="page-heading">
        <Link className="back-link" to="/eleves">
          ← Retour aux élèves
        </Link>
      </header>

      <div className="student-banner">
        <div className="student-banner-avatar">
          {student.photo_url ? (
            <img src={student.photo_url} alt={student.nom_complet} />
          ) : (
            <span>{getInitials(student.nom_complet ?? student.nom)}</span>
          )}
        </div>

        <div className="student-banner-info">
          <h1>{student.nom_complet ?? student.nom}</h1>
          <div className="student-banner-meta">
            <span className="mono">{student.matricule ?? 'Sans matricule'}</span>
            <span>{student.school_class?.nom ?? 'Non affecté'}</span>
            {schoolYear ? <span>{schoolYear.libelle}</span> : null}
            <span
              className={`badge ${student.statut === 'actif' ? 'badge-success' : student.statut === 'archive' ? 'badge-danger' : 'badge-muted'}`}
            >
              {STATUS_LABELS[student.statut] ?? student.statut}
            </span>
          </div>
        </div>

        <div className="page-actions">
          <Link className="button button-primary" to={`/eleves/${id}/modifier`}>
            Modifier
          </Link>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Dossier élève">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`tab ${tab === item.key ? 'is-active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'informations' ? (
        <div className="detail-columns">
          <div className="card">
            <h2 className="section-title">Informations personnelles</h2>
            <dl className="info-grid">
              <div className="info-item">
                <dt>Nom</dt>
                <dd>{student.nom}</dd>
              </div>
              <div className="info-item">
                <dt>Prénoms</dt>
                <dd>{student.prenoms || '—'}</dd>
              </div>
              <div className="info-item">
                <dt>Date de naissance</dt>
                <dd>{formatDate(student.date_naissance)}</dd>
              </div>
              <div className="info-item">
                <dt>Lieu de naissance</dt>
                <dd>{student.lieu_naissance || '—'}</dd>
              </div>
              <div className="info-item">
                <dt>Sexe</dt>
                <dd>
                  {student.sexe === 'M'
                    ? 'Masculin'
                    : student.sexe === 'F'
                      ? 'Féminin'
                      : '—'}
                </dd>
              </div>
              <div className="info-item">
                <dt>Classe</dt>
                <dd>{student.school_class?.nom ?? 'Non affecté'}</dd>
              </div>
              <div className="info-item info-item-full">
                <dt>Adresse</dt>
                <dd>{student.adresse || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h2 className="section-title">Photo de l’élève</h2>
            <div className="photo-panel">
              <div className="photo-preview">
                {student.photo_url ? (
                  <img src={student.photo_url} alt={student.nom_complet} />
                ) : (
                  <span>{getInitials(student.nom_complet ?? student.nom)}</span>
                )}
              </div>
              <div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="file-input"
                />
                <p className="field-help">
                  JPG, PNG ou WebP, 2 Mo maximum. La photo est redimensionnée
                  automatiquement.
                </p>
                {photoSaving ? (
                  <p className="field-help">Envoi de la photo…</p>
                ) : null}
                {photoError ? (
                  <p className="form-error">{photoError}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'parents' ? (
        <div className="detail-columns">
          <div className="card">
            <h2 className="section-title">Parents / Tuteurs</h2>
            {guardians.length === 0 ? (
              <p className="muted-text">Aucun parent rattaché pour le moment.</p>
            ) : (
              <ul className="entity-list">
                {guardians.map((guardian) => (
                  <li key={guardian.id} className="entity-item">
                    <div className="entity-main">
                      <strong>{guardian.nom}</strong>
                      <span className="badge badge-info">
                        {guardian.lien_parente || 'Tuteur'}
                      </span>
                      <div className="entity-meta">
                        {guardian.telephone ? (
                          <span>{guardian.telephone}</span>
                        ) : null}
                        {guardian.email ? <span>{guardian.email}</span> : null}
                        {guardian.profession ? (
                          <span>{guardian.profession}</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button button-danger-ghost button-small"
                      onClick={() => setDetachTarget(guardian)}
                    >
                      Détacher
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Ajouter un parent</h2>
            <div className="segmented">
              <button
                type="button"
                className={parentMode === 'existing' ? 'is-active' : ''}
                onClick={() => setParentMode('existing')}
              >
                Parent existant
              </button>
              <button
                type="button"
                className={parentMode === 'new' ? 'is-active' : ''}
                onClick={() => setParentMode('new')}
              >
                Nouveau parent
              </button>
            </div>

            <form className="stack-form" onSubmit={handleAddParent}>
              {parentMode === 'existing' ? (
                <label className="field">
                  <span>Parent</span>
                  <select
                    value={selectedGuardianId}
                    onChange={(event) =>
                      setSelectedGuardianId(event.target.value)
                    }
                  >
                    <option value="">Sélectionner…</option>
                    {availableGuardians.map((guardian) => (
                      <option key={guardian.id} value={guardian.id}>
                        {guardian.nom}
                        {guardian.telephone ? ` · ${guardian.telephone}` : ''}
                      </option>
                    ))}
                  </select>
                  {guardiansQuery.isLoading ? (
                    <small className="field-help">Chargement…</small>
                  ) : null}
                </label>
              ) : (
                <>
                  <label className="field">
                    <span>Nom *</span>
                    <input
                      type="text"
                      value={newGuardian.nom}
                      onChange={(event) =>
                        setNewGuardian((current) => ({
                          ...current,
                          nom: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Téléphone</span>
                    <input
                      type="tel"
                      value={newGuardian.telephone}
                      onChange={(event) =>
                        setNewGuardian((current) => ({
                          ...current,
                          telephone: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={newGuardian.email}
                      onChange={(event) =>
                        setNewGuardian((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Profession</span>
                    <input
                      type="text"
                      value={newGuardian.profession}
                      onChange={(event) =>
                        setNewGuardian((current) => ({
                          ...current,
                          profession: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Adresse</span>
                    <input
                      type="text"
                      value={newGuardian.adresse}
                      onChange={(event) =>
                        setNewGuardian((current) => ({
                          ...current,
                          adresse: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              )}

              <label className="field">
                <span>Lien de parenté</span>
                <input
                  type="text"
                  placeholder="Père, mère, tuteur…"
                  value={lienParente}
                  onChange={(event) => setLienParente(event.target.value)}
                />
              </label>

              {parentError ? <p className="form-error">{parentError}</p> : null}

              <button
                type="submit"
                className="button button-primary"
                disabled={parentSaving}
              >
                {parentSaving ? 'Enregistrement…' : 'Rattacher le parent'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {tab === 'documents' ? (
        <div className="detail-columns">
          <div className="card">
            <h2 className="section-title">Documents</h2>
            {documents.length === 0 ? (
              <p className="muted-text">Aucun document pour le moment.</p>
            ) : (
              <ul className="entity-list">
                {documents.map((document) => (
                  <li key={document.id} className="entity-item">
                    <div className="entity-main">
                      <strong>{document.nom}</strong>
                      <div className="entity-meta">
                        <span>
                          {DOCUMENT_TYPES[document.type] ?? document.type}
                        </span>
                        <span>{formatFileSize(document.taille)}</span>
                        <span>{formatDate(document.date_ajout)}</span>
                      </div>
                    </div>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => handleDocumentDownload(document)}
                      >
                        Télécharger
                      </button>
                      <button
                        type="button"
                        className="button button-danger-ghost button-small"
                        onClick={() => setDocumentToDelete(document)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Ajouter un document</h2>
            <form className="stack-form" onSubmit={handleDocumentUpload}>
              <label className="field">
                <span>Type de document</span>
                <select
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                >
                  {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Fichier</span>
                <input
                  ref={documentInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setDocumentFile(event.target.files?.[0] ?? null)
                    setDocumentError('')
                  }}
                />
                <small className="field-help">
                  PDF ou image, 5 Mo maximum.
                </small>
              </label>

              {documentError ? (
                <p className="form-error">{documentError}</p>
              ) : null}

              <button
                type="submit"
                className="button button-primary"
                disabled={documentSaving || !documentFile}
              >
                {documentSaving ? 'Envoi…' : 'Téléverser'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {tab === 'paiements' ? (
        <div className="card">
          <div className="card-header-row">
            <h2 className="section-title">Résumé des paiements</h2>
            <span className="muted-text">
              {paiements.nombre_paiements ?? studentPaymentsQuery.data?.data?.length ?? 0} paiement(s) validé(s)
            </span>
          </div>
          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Total dû</span>
              <strong className="summary-value">
                {formatAriary(paiements.total_du ?? 0)}
              </strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total payé</span>
              <strong className="summary-value">
                {formatAriary(paiements.total_paye ?? 0)}
              </strong>
            </div>
            <div className="summary-card summary-card-alert">
              <span className="summary-label">Reste à payer</span>
              <strong className="summary-value">
                {formatAriary(paiements.reste_a_payer ?? 0)}
              </strong>
            </div>
          </div>

          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>N° Reçu</th>
                  <th>Date</th>
                  <th>Frais</th>
                  <th>Montant</th>
                  <th>Mode</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {studentPaymentsQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="table-state">Chargement...</td>
                  </tr>
                ) : (studentPaymentsQuery.data?.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-state">Aucun paiement</td>
                  </tr>
                ) : (
                  (studentPaymentsQuery.data?.data ?? []).map((p) => (
                    <tr key={p.id}>
                      <td>{p.numero_recu}</td>
                      <td>{p.date_paiement}</td>
                      <td>{p.fee?.type}</td>
                      <td>{formatAriary(p.montant)}</td>
                      <td>{p.mode}</td>
                      <td>{p.statut}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'presences' ? (
        <div className="card">
          <div className="card-header-row">
            <h2 className="section-title">Présences</h2>
            <span className="muted-text">Taux de présence et absences</span>
          </div>
          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Total séances</span>
              <strong className="summary-value">{presencesQuery.data?.total ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Présents / Justifiés</span>
              <strong className="summary-value">{presencesQuery.data?.presents ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Absents</span>
              <strong className="summary-value">{presencesQuery.data?.absents ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Retards</span>
              <strong className="summary-value">{presencesQuery.data?.retards ?? 0}</strong>
            </div>
            <div className="summary-card summary-card-alert">
              <span className="summary-label">Taux de présence</span>
              <strong className="summary-value">{presencesQuery.data?.taux_presence ?? 100}%</strong>
            </div>
          </div>
          {presencesQuery.data?.depasse_seuil ? (
            <p className="alert alert-warning" style={{ marginTop: '1rem' }}>
              Nombre d'absences ({presencesQuery.data?.absents}) supérieur ou égal au seuil ({presencesQuery.data?.seuil_absences}).
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'certificats' ? (
        <ComingSoon
          title="Certificats"
          description="Les certificats de scolarité et de radiation seront gérés dans une prochaine étape."
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(detachTarget)}
        title="Détacher le parent"
        message={
          detachTarget
            ? `Détacher ${detachTarget.nom} de cet élève ?`
            : ''
        }
        confirmLabel="Détacher"
        loading={parentSaving}
        onConfirm={handleDetachParent}
        onClose={() => setDetachTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(documentToDelete)}
        title="Supprimer le document"
        message={
          documentToDelete
            ? `Supprimer définitivement « ${documentToDelete.nom} » ?`
            : ''
        }
        confirmLabel="Supprimer"
        loading={documentSaving}
        onConfirm={handleDocumentDelete}
        onClose={() => setDocumentToDelete(null)}
      />

      <span className="sr-only" aria-live="polite">
        {photoError || parentError || documentError}
      </span>
    </section>
  )
}
