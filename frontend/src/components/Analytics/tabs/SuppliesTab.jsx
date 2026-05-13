import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import KPICard from '../widgets/KPICard';
import ChartCard from '../widgets/ChartCard';
import DataTable from '../widgets/DataTable';

const COLORS = ['rgb(var(--color-primary))', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

export default function SuppliesTab({ data }) {
  const supply = data?.supply || {};

  const consumptionData = (supply.consumption_by_month || []).map(d => ({
    name: d.period,
    A4: d.a4,
    Toner: d.toner,
  }));

  const mix = supply.paper_vs_toner_mix || {};
  const mixData = [
    { name: 'Só Papel', value: mix.paper_only || 0 },
    { name: 'Só Toner', value: mix.toner_only || 0 },
    { name: 'Ambos', value: mix.both || 0 },
    { name: 'Nenhum', value: mix.neither || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KPICard label="Total A4" value={supply.total_a4 ?? 0} />
        <KPICard label="Total A3" value={supply.total_a3 ?? 0} />
        <KPICard label="Toner BK" value={supply.total_toner_bk ?? 0} />
        <KPICard label="Toner CY" value={supply.total_toner_cy ?? 0} />
        <KPICard label="Toner MG" value={supply.total_toner_mg ?? 0} />
        <KPICard label="Toner YW" value={supply.total_toner_yw ?? 0} />
        <KPICard label="Média A4/Entrega" value={supply.avg_a4_per_delivery ?? 0} />
      </div>

      {/* Consumption trend */}
      <ChartCard title="Consumo por Mês (A4 e Toner)">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={consumptionData}>
            <defs>
              <linearGradient id="colorA4" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(var(--color-primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="rgb(var(--color-primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorToner" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="A4" stroke="rgb(var(--color-primary))" fill="url(#colorA4)" />
            <Area type="monotone" dataKey="Toner" stroke="#f59e0b" fill="url(#colorToner)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Mix */}
      <ChartCard title="Mix Papel vs Toner">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={mixData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {mixData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Top 10 Equipamentos por A4">
          <DataTable
            columns={[{ key: 'serie', label: 'Série' }, { key: 'fila', label: 'Fila' }, { key: 'total_a4', label: 'A4' }]}
            rows={supply.top_equipment_a4 || []}
          />
        </ChartCard>
        <ChartCard title="Top 10 Equipamentos por Toner">
          <DataTable
            columns={[{ key: 'serie', label: 'Série' }, { key: 'fila', label: 'Fila' }, { key: 'total_toner', label: 'Toner' }]}
            rows={supply.top_equipment_toner || []}
          />
        </ChartCard>
        <ChartCard title="Top 10 Locais por A4">
          <DataTable
            columns={[{ key: 'location', label: 'Local' }, { key: 'total_a4', label: 'A4' }]}
            rows={supply.top_locations_a4 || []}
          />
        </ChartCard>
      </div>
    </div>
  );
}
