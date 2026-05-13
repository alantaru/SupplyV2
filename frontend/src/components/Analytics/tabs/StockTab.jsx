import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import ChartCard from '../widgets/ChartCard';
import DataTable from '../widgets/DataTable';
import AlertPanel from '../widgets/AlertPanel';

const COLORS = ['rgb(var(--color-primary))', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

export default function StockTab({ data }) {
  const stock = data?.stock || {};

  const catData = (stock.by_category || []).map(d => ({ name: d.name, value: d.value }));
  const movData = (stock.movements_by_month || []).map(d => ({ name: d.period, Entrada: d.entrada, Saída: d.saida }));
  const typeData = (stock.movements_by_type || []).map(d => ({ name: d.name, value: d.value }));

  const zeroAlerts = (stock.zero_stock_items || []).map(item => ({
    serie: item.tipo_modelo,
    fila: item.categoria,
    estoque_atual: item.estoque_atual,
  }));

  return (
    <div className="space-y-6">
      {/* Zero stock alerts */}
      {zeroAlerts.length > 0 && (
        <ChartCard title={`⚠️ Itens com Estoque Zerado (${zeroAlerts.length})`}>
          <AlertPanel alerts={zeroAlerts} type="stock" />
        </ChartCard>
      )}

      {/* Stock items table */}
      <ChartCard title="Posição Atual do Estoque">
        <DataTable
          columns={[
            { key: 'tipo_modelo', label: 'Item' },
            { key: 'categoria', label: 'Categoria' },
            { key: 'estoque_atual', label: 'Estoque Atual' },
            { key: 'ultima_alteracao', label: 'Última Alteração' },
          ]}
          rows={stock.items || []}
          maxRows={20}
        />
      </ChartCard>

      {/* By category */}
      <ChartCard title="Estoque por Categoria">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={catData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="rgb(var(--color-primary))" name="Estoque" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Movimentações por Mês">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={movData}>
              <defs>
                <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="Entrada" stroke="#22c55e" fill="url(#colorEntrada)" />
              <Area type="monotone" dataKey="Saída" stroke="#ef4444" fill="url(#colorSaida)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Por Tipo de Lançamento">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
