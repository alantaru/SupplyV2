import { useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import KPICard from '../widgets/KPICard';
import ChartCard from '../widgets/ChartCard';

const COLORS = ['rgb(var(--color-primary))', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

export default function DeliveriesTab({ data }) {
  const delivery = data?.delivery || {};
  const [timeView, setTimeView] = useState('month');

  const timeData = (timeView === 'month' ? delivery.by_month : delivery.by_week) || [];
  const chartData = timeData.map(d => ({ name: d.period, value: d.count }));

  const pvd = delivery.pending_vs_delivered || {};
  const pvdData = [
    { name: 'Entregues', value: pvd.delivered || 0 },
    { name: 'Pendentes', value: pvd.pending || 0 },
    { name: 'Cancelados', value: pvd.cancelled || 0 },
  ].filter(d => d.value > 0);

  const toBarData = (arr) => (arr || []).map(d => ({ name: d.name, value: d.value }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Entregas" value={delivery.total_entregas ?? 0} />
        <KPICard label="Taxa Cancelamento" value={`${delivery.cancellation_rate ?? 0}%`} />
        <KPICard label="Média Dias Entrega" value={delivery.avg_delivery_days ?? 0} />
        <KPICard label="Pendentes" value={delivery.pending_count ?? 0} />
      </div>

      {/* Volume toggle */}
      <ChartCard
        title={
          <div className="flex items-center gap-3">
            <span>Volume por {timeView === 'month' ? 'Mês' : 'Semana'}</span>
            <div className="flex gap-1">
              {['month', 'week'].map(v => (
                <button
                  key={v}
                  onClick={() => setTimeView(v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${timeView === v ? 'text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                  style={timeView === v ? { backgroundColor: 'rgb(var(--color-primary))' } : {}}
                >
                  {v === 'month' ? 'Mês' : 'Semana'}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="rgb(var(--color-primary))" name="Entregas" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Row: channel + pending vs delivered */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Por Canal de Solicitação">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={toBarData(delivery.by_channel)} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {(delivery.by_channel || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pendentes vs Entregues vs Cancelados">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pvdData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {pvdData.map((_, i) => <Cell key={i} fill={['#22c55e', '#f59e0b', '#ef4444'][i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* By city */}
      <ChartCard title="Por Cidade">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={toBarData(delivery.by_city)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
            <Tooltip />
            <Bar dataKey="value" fill="#22c55e" name="Entregas" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Grid of breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { key: 'by_empresa', title: 'Por Empresa (Top 10)' },
          { key: 'by_model', title: 'Por Modelo (Top 10)' },
          { key: 'by_solicitante', title: 'Por Solicitante (Top 10)' },
          { key: 'by_area', title: 'Por Área (Top 10)' },
          { key: 'by_competencia', title: 'Por Competência' },
          { key: 'by_contrato', title: 'Por Contrato' },
        ].map(({ key, title }) => {
          const d = toBarData(delivery[key]);
          if (!d.length) return null;
          return (
            <ChartCard key={key} title={title}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={d}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="rgb(var(--color-primary))" name="Entregas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          );
        })}
      </div>
    </div>
  );
}
