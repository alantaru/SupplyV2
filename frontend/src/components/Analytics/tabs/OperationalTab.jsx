import React from 'react';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ZAxis
} from 'recharts';
import KPICard from '../widgets/KPICard';
import ChartCard from '../widgets/ChartCard';

export default function OperationalTab({ data }) {
  const op = data?.operational || {};

  const slaByMonth = (op.sla_by_month || []).map(d => ({ name: d.period, SLA: d.rate }));
  const byFunc = (op.by_funcionario || []).map(d => ({ name: d.name, value: d.count }));
  const byAlm = (op.by_almoxarifado || []).map(d => ({ name: d.name, value: d.count }));
  const paperVsCounter = (op.paper_vs_counter || []).map(d => ({
    x: d.a4_total,
    y: d.counter_production,
    z: 1,
    name: d.serie,
  }));
  const tonerVsCounter = (op.toner_vs_counter || []).map(d => ({
    name: d.model,
    toner: d.toner_total,
    counter: d.avg_counter,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <KPICard label="SLA Compliance" value={`${op.sla_compliance_rate ?? 0}%`} />
        <KPICard label="Média Produção Contador" value={op.avg_counter_production ?? 0} />
      </div>

      {/* SLA trend */}
      <ChartCard title="SLA por Mês (%)">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={slaByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
            <Tooltip formatter={(v) => `${v}%`} />
            <Line type="monotone" dataKey="SLA" stroke="rgb(var(--color-primary))" strokeWidth={2} dot={{ r: 3 }} name="SLA %" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Scatter: paper vs counter */}
      <ChartCard title="Correlação: A4 vs Produção de Contador">
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="x" name="A4 (resmas)" tick={{ fontSize: 10 }} label={{ value: 'A4', position: 'insideBottom', offset: -5, fontSize: 10 }} />
            <YAxis dataKey="y" name="Produção Contador" tick={{ fontSize: 10 }} />
            <ZAxis dataKey="z" range={[40, 40]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload;
              return (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs shadow">
                  <p className="font-bold">{d?.name}</p>
                  <p>A4: {d?.x}</p>
                  <p>Contador: {d?.y}</p>
                </div>
              );
            }} />
            <Scatter data={paperVsCounter} fill="rgb(var(--color-primary))" />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Toner vs counter by model */}
      {tonerVsCounter.length > 0 && (
        <ChartCard title="Toner vs Contador por Modelo">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tonerVsCounter}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="toner" fill="#f59e0b" name="Toner Total" radius={[4, 4, 0, 0]} />
              <Bar dataKey="counter" fill="rgb(var(--color-primary))" name="Média Contador" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* By funcionario */}
      {byFunc.length > 0 && (
        <ChartCard title="Top 10 por Funcionário">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byFunc} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
              <Tooltip />
              <Bar dataKey="value" fill="#22c55e" name="Entregas" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* By almoxarifado */}
      {byAlm.length > 0 && (
        <ChartCard title="Por Almoxarifado">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byAlm}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#06b6d4" name="Entregas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
