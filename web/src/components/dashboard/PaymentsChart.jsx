import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatAriary,
  formatCompactAriary,
  formatMonthLong,
  formatMonthShort,
} from '../../utils/format'
import ChartEmpty from './ChartEmpty'

export default function PaymentsChart({ data }) {
  const chartData = data.map((item) => ({
    ...item,
    label: formatMonthShort(item.mois),
    fullLabel: formatMonthLong(item.mois),
    montant: Number(item.montant) || 0,
  }))
  const hasPayments = chartData.some((item) => item.montant > 0)

  return (
    <article className="card chart-card">
      <div className="card-heading">
        <div>
          <h2>Encaissements</h2>
          <p className="card-subtitle">Six derniers mois</p>
        </div>
      </div>

      {hasPayments ? (
        <div
          className="chart-canvas"
          role="img"
          aria-label="Graphique des encaissements des six derniers mois"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="paymentsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f8ef7" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#4f8ef7" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                stroke="#e8eef6"
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                dy={8}
                tick={{ fontSize: 12, fill: '#66758a' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={74}
                tick={{ fontSize: 11, fill: '#7c8ba0' }}
                tickFormatter={formatCompactAriary}
              />
              <Tooltip
                cursor={{ stroke: '#c7d6f7', strokeDasharray: '4 4' }}
                contentStyle={{
                  border: '1px solid #e1e8f0',
                  borderRadius: 12,
                  boxShadow: '0 16px 34px -20px rgba(27, 46, 75, 0.45)',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#66758a', marginBottom: 4 }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullLabel ?? ''
                }
                formatter={(value) => [formatAriary(value), 'Encaissements']}
              />
              <Area
                type="monotone"
                dataKey="montant"
                name="Encaissements"
                stroke="#2f6fed"
                strokeWidth={2.5}
                fill="url(#paymentsGradient)"
                activeDot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty
          icon="paiements"
          title="Aucun encaissement"
          message="Aucun paiement validé n’a été enregistré sur cette période."
        />
      )}
    </article>
  )
}
