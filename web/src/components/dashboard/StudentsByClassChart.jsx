import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNumber } from '../../utils/format'
import ChartEmpty from './ChartEmpty'

export default function StudentsByClassChart({ data }) {
  const chartData = data.map((item) => ({
    ...item,
    nombre: Number(item.nombre) || 0,
  }))
  const hasStudents = chartData.some((item) => item.nombre > 0)
  const chartHeight = Math.max(280, chartData.length * 38)

  return (
    <article className="card chart-card">
      <div className="card-heading">
        <div>
          <h2>Élèves par classe</h2>
          <p className="card-subtitle">Année scolaire active</p>
        </div>
      </div>

      {hasStudents ? (
        <div
          className="chart-canvas"
          role="img"
          aria-label="Graphique du nombre d’élèves actifs par classe"
        >
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke="#e8eef6"
                strokeDasharray="4 4"
              />
              <XAxis
                type="number"
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#7c8ba0' }}
              />
              <YAxis
                type="category"
                dataKey="classe"
                width={112}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#66758a' }}
                tickFormatter={(value) =>
                  value.length > 16 ? `${value.slice(0, 15)}…` : value
                }
              />
              <Tooltip
                cursor={{ fill: '#f3f7ff' }}
                contentStyle={{
                  border: '1px solid #e1e8f0',
                  borderRadius: 12,
                  boxShadow: '0 16px 34px -20px rgba(27, 46, 75, 0.45)',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#66758a', marginBottom: 4 }}
                formatter={(value) => [formatNumber(value), 'Élèves']}
              />
              <Bar
                dataKey="nombre"
                name="Élèves"
                fill="#4f8ef7"
                radius={[0, 8, 8, 0]}
                barSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty
          icon="classes"
          title="Aucune répartition"
          message={
            chartData.length > 0
              ? 'Aucun élève actif n’est encore réparti dans les classes.'
              : 'Aucune classe active n’est disponible pour le moment.'
          }
        />
      )}
    </article>
  )
}
