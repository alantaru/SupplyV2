import React from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import ChartCard from '../widgets/ChartCard';
import DataTable from '../widgets/DataTable';

const COLORS = ['rgb(var(--color-primary))', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];
const TONER_COLORS = { bk: '#334155', cy: '#06b6d4', mg: '#ec4899', yw: '#eab308' };

export default function EquipmentTab({ data }) {
  const equipment = data?.equipment || {};

  const statusData = (equipment.status_distribution || []).map(d => ({ name: d.name, value: d.value }));
  const modelData = (equipment.model_distribution || []).map(d => ({ name: d.name, value: d.value }));

  const cvmData = [
    { name: 'Colorido', value: equipment.color_vs_mono?.color || 0 },
    { name: 'Mono', value: equipment.color_vs_mono?.mono || 0 },
  ].filter(d => d.value > 0);

  // Toner distribution grouped bar
  const tonerDist = equipment.toner_level_distribution || {};
  const ranges = ['0-20', '21-50', '51-80', '81-100'];
  const tonerBarData = ranges.map(range => {
    const entry = { range };
    ['bk', 'cy', 'mg', 'yw'].forEach(color => {
      const bucket = (tonerDist[color] || []).find(b => b.range === range);
      entry[color.toUpperCase()] = bucket?.count || 0;
    });
    return entry;
  });

  return (
    <div className="space-y-6">
      {/* Fleet health + color vs mono */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Status da Frota">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" nameKey="name" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Colorido vs Mono">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={cvmData} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                <Cell fill="rgb(var(--color-primary))" />
                <Cell fill="#94a3b8" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuição por Modelo (Top 10)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={modelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
              <Tooltip />
              <Bar dataKey="value" fill="rgb(var(--color-primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Toner level distribution */}
      <ChartCard title="Distribuição de Nível de Toner por Faixa">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={tonerBarData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="range" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            {['BK', 'CY', 'MG', 'YW'].map(c => (
              <Bar key={c} dataKey={c} fill={TONER_COLORS[c.toLowerCase()]} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top 10 por Entregas">
          <DataTable
            columns={[{ key: 'serie', label: 'Série' }, { key: 'fila', label: 'Fila' }, { key: 'modelo', label: 'Modelo' }, { key: 'count', label: 'Entregas' }]}
            rows={equipment.top_by_deliveries || []}
          />
        </ChartCard>
        <ChartCard title="Top 10 por A4">
          <DataTable
            columns={[{ key: 'serie', label: 'Série' }, { key: 'fila', label: 'Fila' }, { key: 'total_a4', label: 'A4' }]}
            rows={equipment.top_by_a4 || []}
          />
        </ChartCard>
        <ChartCard title="Top 10 por Incidentes">
          <DataTable
            columns={[{ key: 'serie', label: 'Série' }, { key: 'fila', label: 'Fila' }, { key: 'count', label: 'Incidentes' }]}
            rows={equipment.top_by_incidents || []}
          />
        </ChartCard>
        <ChartCard title="Top 10 por Recolhas">
          <DataTable
            columns={[{ key: 'serie', label: 'Série' }, { key: 'fila', label: 'Fila' }, { key: 'count', label: 'Recolhas' }]}
            rows={equipment.top_by_recolhas || []}
          />
        </ChartCard>
      </div>

      {/* Days since delivery + counter production */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Dias desde Última Entrega (desc)">
          <DataTable
            columns={[{ key: 'serie', label: 'Série' }, { key: 'modelo', label: 'Modelo' }, { key: 'last_delivery', label: 'Última Entrega' }, { key: 'days', label: 'Dias' }]}
            rows={equipment.days_since_delivery || []}
          />
        </ChartCard>
        <ChartCard title="Produção de Contador por Equipamento">
          <DataTable
            columns={[{ key: 'serie', label: 'Série' }, { key: 'total_production', label: 'Produção Total' }]}
            rows={equipment.counter_production || []}
          />
        </ChartCard>
      </div>
    </div>
  );
}
