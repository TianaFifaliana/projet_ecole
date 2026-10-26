export default function LoadingScreen({ label = 'Chargement…' }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <span className="spinner spinner-dark" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}
