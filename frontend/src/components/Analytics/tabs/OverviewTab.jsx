import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import KPICard from '../widgets/KPICard';
import ChartCard from '../widgets/ChartCard';
import AlertPanel from '../widgets/AlertPanel';
import { Package, Truck, Printer, AlertTriangle } from 'lucide-react';

const COLORS = ['rgb(var(--color-primary))', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

export default function OverviewTab({ data }) {
  const delivery = data?.delivery || {};
  const supply = data?.supply || {};
  const equipment = data?.equipment || {};
  const stock = data?.stock || {};
  const predictive = data?.predictive || {};

  const totalToners = (supply.total_toner_bk || 0) + (supply.total_toner_cy || 0) +
    (supply.total_toner_mg || 0) + (supply.total_toner_yw || 0);

  const byMonthData = (delivery.by_month || []).map(d => ({ name: d.period, value: d.count }));
  const statusData = (equipment.status_distribution || []).map(d => ({ name: d.name, value: d.value }));
  const top5 = (equipment.top_by_deliveries || []).slice(0, 5).map(d => ({
    name: d.serie || d.fila || '',
    value: d.count,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Total Entregas" value={delivery.total_entregas ?? 0} icon={<Truck className="w-4 h-4" />} />
        <KPICard label="Total A4 (resmas)" value={supply.total_a4 ?? 0} icon={<Package className="w-4 h-4" />} />
        <KPICard label="Total Toners" value={totalToners} icon={<Package className="w-4 h-4" />} />
        <KPICard label="Frota Total" value={equipment.fleet_size ?? 0} icon={<Printer className="w-4 h-4" />} />
        <KPICard label="Alertas Toner" value={(predictive.toner_alerts || []).length} icon={<AlertTriangle className="w-4 h-4" />} />
        <KPICard label="Estoque Zerado" value={(stock.zero_stock_items || []).length} icon={<AlertTriangle className="w-4 h-4" />} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Volume de Entregas por Mês">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={byMonthData}>
              <defs>
                <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(var(--color-primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="rgb(var(--color-primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="rgb(var(--color-primary))" fill="url(#colorPrimary)" name="Entregas" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status da Frota">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top 5 equipment */}
      <ChartCard title="Top 5 Equipamentos por Entregas">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={top5} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
            <Tooltip />
            <Bar dataKey="value" fill="rgb(var(--color-primary))" name="Entregas" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Alertas de Toner">
          <AlertPanel alerts={predictive.toner_alerts || []} type="toner" />
        </ChartCard>
        <ChartCard title="Alertas de Papel">
          <AlertPanel alerts={predictive.paper_alerts || []} type="paper" />
        </ChartCard>
      </div>
    </div>
  );
}
