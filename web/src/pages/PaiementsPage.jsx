import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { feesApi, paymentsApi } from '../api/payments'
import { listStudents } from '../api/students'
import { listClasses } from '../api/classes'
import { getErrorMessage } from '../api/errors'
import useAuth from '../auth/useAuth'
import { hasPermission } from '../auth/permissions'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { formatAriary } from '../utils/format'

const MODES = [
  { value: 'especes', label: 'Espèces' },
  { value: 'virement', label: 'Virement' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cheque', label: 'Chèque' },
]

const STATUTS = [
  { value: '', label: 'Tous' },
  { value: 'valide', label: 'Valide' },
  { value: 'annule', label: 'Annulé' },
]

export default function PaiementsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canAnnuler = hasPermission(user, 'paiements') && (user?.role?.nom === 'directeur' || user?.role?.permissions?.includes('*'))

  const [tab, setTab] = useState('paiements')
  const [filters, setFilters] = useState({
    date_debut: '',
    date_fin: '',
    classe_id: '',
    mode: '',
    statut: '',
  })
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    student_id: '',
    fee_id: '',
    montant: '',
    date_paiement: new Date().toISOString().slice(0, 10),
    mode: 'especes',
    reference: '',
  })
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [resteAPayer, setResteAPayer] = useState(null)
  const [paymentError, setPaymentError] = useState('')
  const [lastCreatedPayment, setLastCreatedPayment] = useState(null)
  const [annulerTarget, setAnnulerTarget] = useState(null)
  const [annulerMotif, setAnnulerMotif] = useState('')
  const [annulerError, setAnnulerError] = useState('')
  const [impayeFilters, setImpayeFilters] = useState({ classe_id: '', fee_id: '' })
  const [relanceMsg, setRelanceMsg] = useState('')
  const [rapportFilters, setRapportFilters] = useState({ type: 'journal', date: new Date().toISOString().slice(0, 10), mois: new Date().getMonth() + 1, annee: new Date().getFullYear() })
  const [rapportFormat, setRapportFormat] = useState('json')

  const paymentsQuery = useQuery({
    queryKey: ['payments', filters],
    queryFn: () => paymentsApi.list(filters),
  })
  const feesQuery = useQuery({
    queryKey: ['fees'],
    queryFn: () => feesApi.list(),
  })
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: listClasses,
  })
  const studentsQuery = useQuery({
    queryKey: ['students-search', studentSearch],
    queryFn: () => listStudents({ search: studentSearch, per_page: 20 }),
    enabled: paymentModalOpen && studentSearch.length >= 2,
  })
  const impayesQuery = useQuery({
    queryKey: ['impayes', impayeFilters],
    queryFn: () => paymentsApi.impayes(impayeFilters),
  })
  const rapportsQuery = useQuery({
    queryKey: ['rapports', rapportFilters, rapportFormat],
    queryFn: () => paymentsApi.rapports({ ...rapportFilters, format: rapportFormat === 'json' ? undefined : rapportFormat }),
    enabled: tab === 'rapports' && rapportFormat === 'json',
  })

  const createPaymentMutation = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['impayes'] })
      queryClient.invalidateQueries({ queryKey: ['student', paymentForm.student_id] })
      queryClient.invalidateQueries({ queryKey: ['student-payments', paymentForm.student_id] })
      setLastCreatedPayment(res.data)
      setPaymentError('')
    },
    onError: (error) => {
      setPaymentError(getErrorMessage(error, "Échec de l'enregistrement du paiement."))
    },
  })

  const annulerMutation = useMutation({
    mutationFn: ({ id, motif }) => paymentsApi.annuler(id, motif),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['impayes'] })
      setAnnulerTarget(null)
      setAnnulerMotif('')
      setAnnulerError('')
    },
    onError: (error) => {
      setAnnulerError(getErrorMessage(error, "Échec de l'annulation."))
    },
  })

  useEffect(() => {
    if (!selectedStudent || !paymentForm.fee_id) {
      setResteAPayer(null)
      return
    }
    const fee = fees.find((f) => f.id == paymentForm.fee_id)
    if (!fee) return
    const payments = (paymentsQuery.data?.data || []).filter(
      (p) => p.student?.id == selectedStudent.id && p.fee?.id == fee.id && p.statut === 'valide'
    )
    const totalPayePourCeFrais = payments.reduce((sum, p) => sum + Number(p.montant || 0), 0)
    setResteAPayer(Math.max(0, Number(fee.montant || 0) - totalPayePourCeFrais))
  }, [selectedStudent, paymentForm.fee_id, paymentsQuery.data, feesQuery.data])

  const payments = paymentsQuery.data?.data || []
  const fees = feesQuery.data || []
  const classes = classesQuery.data || []
  const impayes = impayesQuery.data || []
  const rapportData = rapportsQuery.data?.data

  function openNewPayment() {
    setPaymentForm({
      student_id: '',
      fee_id: '',
      montant: '',
      date_paiement: new Date().toISOString().slice(0, 10),
      mode: 'especes',
      reference: '',
    })
    setStudentSearch('')
    setSelectedStudent(null)
    setResteAPayer(null)
    setPaymentError('')
    setLastCreatedPayment(null)
    setPaymentModalOpen(true)
  }

  function selectStudent(student) {
    setSelectedStudent(student)
    setPaymentForm((prev) => ({ ...prev, student_id: student.id }))
    setStudentSearch(student.nom_complet || `${student.nom} ${student.prenoms || ''}`)
  }

  function handleCreatePayment(e) {
    e.preventDefault()
    setPaymentError('')
    if (!paymentForm.student_id || !paymentForm.fee_id || !paymentForm.montant) {
      setPaymentError('Veuillez renseigner tous les champs obligatoires.')
      return
    }
    createPaymentMutation.mutate({
      ...paymentForm,
      montant: Number(paymentForm.montant),
    })
  }

  function handlePrintReceipt() {
    if (!lastCreatedPayment?.id) return
    const token = localStorage.getItem('access_token')
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
    const url = baseUrl.replace('/api', '') + `/api/payments/${lastCreatedPayment.id}/recu`
    // Download via fetch with auth
    fetch(url, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/pdf',
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a')
        link.href = window.URL.createObjectURL(blob)
        link.download = `recu_${lastCreatedPayment.numero_recu}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
      })
      .catch(() => {
        window.open(url, '_blank')
      })
  }

  function handleAnnuler() {
    if (!annulerTarget || !annulerMotif) {
      setAnnulerError('Veuillez indiquer un motif.')
      return
    }
    annulerMutation.mutate({ id: annulerTarget.id, motif: annulerMotif })
  }

  function genererRelance(item) {
    const msg = `Cher(e) parent/tuteur de ${item.student.nom_complet}, nous vous rappelons que le solde dû pour ${item.student.nom_complet} s'élève à ${formatAriary(item.reste_a_payer)}. Merci de régulariser votre situation.`
    setRelanceMsg(msg)
    try {
      navigator.clipboard.writeText(msg)
    } catch (e) {
      // ignore
    }
  }

  function exportRapport(format) {
    setRapportFormat(format)
    const token = localStorage.getItem('access_token')
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
    const params = new URLSearchParams({ type: rapportFilters.type, format, date: rapportFilters.date, mois: rapportFilters.mois, annee: rapportFilters.annee })
    const url = baseUrl + '/payments/rapports?' + params.toString()
    fetch(url, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const ext = format === 'excel' ? 'xls' : 'csv'
        const link = document.createElement('a')
        link.href = window.URL.createObjectURL(blob)
        link.download = `rapport_paiements.${ext}`
        document.body.appendChild(link)
        link.click()
        link.remove()
      })
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Paiements</h1>
          <p className="page-subtitle">Gestion des frais, paiements, impayés et rapports</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openNewPayment}>
            Nouveau paiement
          </button>
        </div>
      </header>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button className={tab === 'paiements' ? 'tab active' : 'tab'} onClick={() => setTab('paiements')}>Paiements</button>
        <button className={tab === 'impayes' ? 'tab active' : 'tab'} onClick={() => setTab('impayes')}>Impayés</button>
        <button className={tab === 'rapports' ? 'tab active' : 'tab'} onClick={() => setTab('rapports')}>Rapports</button>
      </div>

      {tab === 'paiements' ? (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <label className="field">
                <span>Date début</span>
                <input type="date" value={filters.date_debut} onChange={(e) => setFilters((f) => ({ ...f, date_debut: e.target.value }))} />
              </label>
              <label className="field">
                <span>Date fin</span>
                <input type="date" value={filters.date_fin} onChange={(e) => setFilters((f) => ({ ...f, date_fin: e.target.value }))} />
              </label>
              <label className="field">
                <span>Classe</span>
                <select value={filters.classe_id} onChange={(e) => setFilters((f) => ({ ...f, classe_id: e.target.value }))}>
                  <option value="">Toutes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Mode</span>
                <select value={filters.mode} onChange={(e) => setFilters((f) => ({ ...f, mode: e.target.value }))}>
                  <option value="">Tous</option>
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Statut</span>
                <select value={filters.statut} onChange={(e) => setFilters((f) => ({ ...f, statut: e.target.value }))}>
                  {STATUTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="card">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>N° Reçu</th>
                    <th>Date</th>
                    <th>Élève</th>
                    <th>Classe</th>
                    <th>Frais</th>
                    <th>Montant</th>
                    <th>Mode</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsQuery.isLoading ? (
                    <tr><td colSpan={9} className="table-state">Chargement...</td></tr>
                  ) : payments.length === 0 ? (
                    <tr><td colSpan={9} className="table-state">Aucun paiement</td></tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.numero_recu}</td>
                        <td>{p.date_paiement}</td>
                        <td>{p.student?.nom_complet}</td>
                        <td>{p.student?.school_class?.nom}</td>
                        <td>{p.fee?.type}</td>
                        <td>{formatAriary(p.montant)}</td>
                        <td>{p.mode}</td>
                        <td>{p.statut}</td>
                        <td>
                          <button type="button" className="btn btn-ghost" onClick={() => window.open((import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api','') + `/api/payments/${p.id}/recu`, '_blank')}>Imprimer reçu</button>
                          {p.statut === 'valide' && canAnnuler ? (
                            <button type="button" className="btn btn-ghost" onClick={() => { setAnnulerTarget(p); setAnnulerMotif(''); setAnnulerError(''); }}>Annuler</button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {tab === 'impayes' ? (
        <div className="card">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <label className="field">
              <span>Classe</span>
              <select value={impayeFilters.classe_id} onChange={(e) => setImpayeFilters((f) => ({ ...f, classe_id: e.target.value }))}>
                <option value="">Toutes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Frais</span>
              <select value={impayeFilters.fee_id} onChange={(e) => setImpayeFilters((f) => ({ ...f, fee_id: e.target.value }))}>
                <option value="">Tous</option>
                {fees.map((f) => (
                  <option key={f.id} value={f.id}>{f.type} - {formatAriary(f.montant)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Matricule</th>
                  <th>Classe</th>
                  <th>Total dû</th>
                  <th>Total payé</th>
                  <th>Reste à payer</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {impayesQuery.isLoading ? (
                  <tr><td colSpan={7} className="table-state">Chargement...</td></tr>
                ) : impayes.length === 0 ? (
                  <tr><td colSpan={7} className="table-state">Aucun impayé</td></tr>
                ) : (
                  impayes.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.student?.nom_complet}</td>
                      <td>{item.student?.matricule}</td>
                      <td>{item.student?.school_class?.nom}</td>
                      <td>{formatAriary(item.total_du)}</td>
                      <td>{formatAriary(item.total_paye)}</td>
                      <td>{formatAriary(item.reste_a_payer)}</td>
                      <td>
                        <button type="button" className="btn btn-ghost" onClick={() => genererRelance(item)}>Générer message de relance (copier)</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {relanceMsg ? (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h4>Message à copier</h4>
              <textarea readOnly value={relanceMsg} style={{ width: '100%', minHeight: '80px' }} />
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'rapports' ? (
        <div className="card">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <label className="field">
              <span>Type</span>
              <select value={rapportFilters.type} onChange={(e) => setRapportFilters((f) => ({ ...f, type: e.target.value }))}>
                <option value="journal">Journal de caisse du jour</option>
                <option value="mensuel">État mensuel</option>
              </select>
            </label>
            {rapportFilters.type === 'journal' ? (
              <label className="field">
                <span>Date</span>
                <input type="date" value={rapportFilters.date} onChange={(e) => setRapportFilters((f) => ({ ...f, date: e.target.value }))} />
              </label>
            ) : (
              <>
                <label className="field">
                  <span>Mois</span>
                  <input type="number" min="1" max="12" value={rapportFilters.mois} onChange={(e) => setRapportFilters((f) => ({ ...f, mois: e.target.value }))} />
                </label>
                <label className="field">
                  <span>Année</span>
                  <input type="number" value={rapportFilters.annee} onChange={(e) => setRapportFilters((f) => ({ ...f, annee: e.target.value }))} />
                </label>
              </>
            )}
            <div className="field">
              <span>Export</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => exportRapport('csv')}>CSV</button>
                <button type="button" className="btn btn-ghost" onClick={() => exportRapport('excel')}>Excel</button>
              </div>
            </div>
          </div>
          {rapportFormat === 'json' && rapportsQuery.data ? (
            <div>
              <p><strong>Total :</strong> {formatAriary(rapportData?.total || 0)}</p>
              {rapportData?.par_mode ? (
                <p>Par mode : {Object.entries(rapportData.par_mode).map(([k,v]) => `${k}: ${formatAriary(v)}`).join(', ')}</p>
              ) : null}
              <div className="table-wrapper" style={{ marginTop: '1rem' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date/Heure</th>
                      <th>N° Reçu</th>
                      <th>Élève</th>
                      <th>Frais</th>
                      <th>Montant</th>
                      <th>Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rapportData?.paiements || []).map((p, idx) => (
                      <tr key={idx}>
                        <td>{p.date_paiement || rapportFilters.date} {p.heure ? ` ${p.heure}` : ''}</td>
                        <td>{p.numero_recu}</td>
                        <td>{p.eleve}</td>
                        <td>{p.fee}</td>
                        <td>{formatAriary(p.montant)}</td>
                        <td>{p.mode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="muted-text">Utilisez les boutons d'export CSV/Excel pour générer les rapports.</p>
          )}
        </div>
      ) : null}

      <Modal open={paymentModalOpen} title="Nouveau paiement" onClose={() => setPaymentModalOpen(false)}>
        {!lastCreatedPayment ? (
          <form className="stack-form" onSubmit={handleCreatePayment}>
            <label className="field">
              <span>Rechercher un élève *</span>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value)
                  setSelectedStudent(null)
                  setPaymentForm((prev) => ({ ...prev, student_id: '' }))
                }}
                placeholder="Nom, prénom ou matricule..."
              />
            </label>
            {studentsQuery.data?.data?.length > 0 && !selectedStudent && studentSearch.length >= 2 ? (
              <div className="card" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {studentsQuery.data.data.map((s) => (
                  <button key={s.id} type="button" className="btn btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => selectStudent(s)}>
                    {s.nom_complet} {s.matricule ? `(${s.matricule})` : ''} - {s.school_class?.nom}
                  </button>
                ))}
              </div>
            ) : null}
            {selectedStudent ? (
              <p className="muted-text">Élève sélectionné : <strong>{selectedStudent.nom_complet}</strong> {selectedStudent.school_class?.nom ? `- ${selectedStudent.school_class.nom}` : ''}</p>
            ) : null}

            <label className="field">
              <span>Frais *</span>
              <select value={paymentForm.fee_id} onChange={(e) => setPaymentForm((prev) => ({ ...prev, fee_id: e.target.value }))} required>
                <option value="">Sélectionner un frais</option>
                {fees.map((f) => (
                  <option key={f.id} value={f.id}>{f.type} - {formatAriary(f.montant)} ({f.periodicite})</option>
                ))}
              </select>
            </label>
            {resteAPayer !== null ? (
              <p className="muted-text">Reste à payer pour ce frais : <strong>{formatAriary(resteAPayer)}</strong></p>
            ) : null}

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label className="field">
                <span>Montant *</span>
                <input type="number" step="0.01" value={paymentForm.montant} onChange={(e) => setPaymentForm((prev) => ({ ...prev, montant: e.target.value }))} required />
              </label>
              <label className="field">
                <span>Date de paiement *</span>
                <input type="date" value={paymentForm.date_paiement} onChange={(e) => setPaymentForm((prev) => ({ ...prev, date_paiement: e.target.value }))} required />
              </label>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label className="field">
                <span>Mode de paiement *</span>
                <select value={paymentForm.mode} onChange={(e) => setPaymentForm((prev) => ({ ...prev, mode: e.target.value }))} required>
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Référence</span>
                <input type="text" value={paymentForm.reference} onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))} />
              </label>
            </div>

            {paymentError ? <p className="form-error">{paymentError}</p> : null}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPaymentModalOpen(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={createPaymentMutation.isPending}>Enregistrer</button>
            </div>
          </form>
        ) : (
          <div className="stack-form">
            <p><strong>Paiement enregistré avec succès</strong></p>
            <p>N° Reçu : {lastCreatedPayment.numero_recu}</p>
            <p>Montant : {formatAriary(lastCreatedPayment.montant)}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={handlePrintReceipt}>Imprimer le reçu</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setPaymentModalOpen(false); setLastCreatedPayment(null); }}>Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(annulerTarget)}
        title="Annuler un paiement"
        message="Cette action nécessite un motif. Seul le directeur peut annuler un paiement. Ce paiement ne sera pas supprimé."
        confirmLabel="Annuler le paiement"
        loading={annulerMutation.isPending}
        onConfirm={handleAnnuler}
        onClose={() => { setAnnulerTarget(null); setAnnulerMotif(''); setAnnulerError(''); }}
      >
        <label className="field" style={{ marginTop: '1rem' }}>
          <span>Motif d'annulation *</span>
          <textarea value={annulerMotif} onChange={(e) => setAnnulerMotif(e.target.value)} required />
        </label>
        {annulerError ? <p className="form-error">{annulerError}</p> : null}
      </ConfirmDialog>
    </section>
  )
}
