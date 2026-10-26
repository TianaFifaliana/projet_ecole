import { useRef, useState } from 'react'
import { importStudents } from '../../api/students'
import { getErrorMessage } from '../../api/errors'
import Modal from '../Modal'

export default function StudentImportDialog({ open, onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()

    if (!file) {
      setError('Sélectionnez un fichier CSV.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await importStudents(file)
      setReport(data)
      onImported()
    } catch (requestError) {
      setError(getErrorMessage(requestError, "L'import du fichier a échoué."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Importer des élèves"
      onClose={loading ? () => undefined : onClose}
      footer={
        <>
          <button
            type="button"
            className="button button-ghost"
            onClick={onClose}
            disabled={loading}
          >
            {report ? 'Fermer' : 'Annuler'}
          </button>
          {!report ? (
            <button
              type="submit"
              form="student-import-form"
              className="button button-primary"
              disabled={loading || !file}
            >
              {loading ? 'Import en cours…' : 'Importer'}
            </button>
          ) : null}
        </>
      }
    >
      <form id="student-import-form" onSubmit={handleSubmit}>
        <p className="modal-intro">
          Le fichier CSV doit contenir les colonnes suivantes :{' '}
          <code>nom, prenoms, date_naissance, sexe, classe</code>. Le séparateur
          (virgule, point-virgule ou tabulation) est détecté automatiquement.
        </p>

        <label className="field">
          <span>Fichier CSV</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setError('')
            }}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        {report ? (
          <div className="import-report">
            <div className="import-summary">
              <span>
                <strong>{report.total_lignes}</strong> lignes lues
              </span>
              <span className="badge badge-success">
                {report.importes} importé(s)
              </span>
              <span
                className={`badge ${report.erreurs?.length ? 'badge-danger' : 'badge-muted'}`}
              >
                {report.erreurs?.length ?? 0} erreur(s)
              </span>
            </div>

            {report.erreurs?.length ? (
              <ul className="import-errors">
                {report.erreurs.map((item) => (
                  <li key={`${item.ligne}-${item.raison}`}>
                    <strong>Ligne {item.ligne}</strong> : {item.raison}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="form-success">Toutes les lignes ont été importées.</p>
            )}
          </div>
        ) : null}
      </form>
    </Modal>
  )
}
