export default function Pagination({ meta, onPageChange }) {
  if (!meta || meta.total === 0) {
    return null
  }

  const from = meta.from ?? 0
  const to = meta.to ?? 0

  return (
    <div className="pagination">
      <span className="pagination-summary">
        {from}–{to} sur {meta.total}
      </span>
      <div className="pagination-actions">
        <button
          type="button"
          className="button button-ghost button-small"
          onClick={() => onPageChange(meta.current_page - 1)}
          disabled={meta.current_page <= 1}
        >
          Précédent
        </button>
        <span className="pagination-page">
          Page {meta.current_page} / {meta.last_page}
        </span>
        <button
          type="button"
          className="button button-ghost button-small"
          onClick={() => onPageChange(meta.current_page + 1)}
          disabled={meta.current_page >= meta.last_page}
        >
          Suivant
        </button>
      </div>
    </div>
  )
}
