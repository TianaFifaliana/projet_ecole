export default function DashboardSkeleton() {
  return (
    <section
      className="page dashboard-skeleton"
      aria-busy="true"
      aria-label="Chargement du tableau de bord"
    >
      <header className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">Vue d’ensemble</p>
          <h1>Tableau de bord</h1>
          <p role="status">Chargement des indicateurs…</p>
        </div>
      </header>

      <div className="metrics-grid">
        {Array.from({ length: 7 }, (_, index) => (
          <div className="card metric-card" key={index}>
            <span className="skeleton metric-skeleton-icon" />
            <div className="metric-content">
              <span className="skeleton skeleton-line skeleton-line-label" />
              <span className="skeleton skeleton-line skeleton-line-value" />
              <span className="skeleton skeleton-line skeleton-line-hint" />
            </div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        {Array.from({ length: 2 }, (_, index) => (
          <div className="card chart-card" key={index}>
            <div className="card-heading">
              <div>
                <span className="skeleton skeleton-line skeleton-line-title" />
                <span className="skeleton skeleton-line skeleton-line-hint" />
              </div>
            </div>
            <span className="skeleton skeleton-chart" />
          </div>
        ))}
      </div>

      <div className="card">
        <span className="skeleton skeleton-line skeleton-line-title" />
        <div className="skeleton-list">
          {Array.from({ length: 4 }, (_, index) => (
            <span className="skeleton skeleton-line" key={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
