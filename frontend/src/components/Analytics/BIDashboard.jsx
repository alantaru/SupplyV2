import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';
import api from '../../lib/api';
import BIHeader from './BIHeader';
import BITabBar from './BITabBar';
import OverviewTab from './tabs/OverviewTab';
import DeliveriesTab from './tabs/DeliveriesTab';
import SuppliesTab from './tabs/SuppliesTab';
import EquipmentTab from './tabs/EquipmentTab';
import StockTab from './tabs/StockTab';
import OperationalTab from './tabs/OperationalTab';

const TABS = [
  { label: 'Visão Geral', component: OverviewTab },
  { label: 'Entregas', component: DeliveriesTab },
  { label: 'Insumos', component: SuppliesTab },
  { label: 'Equipamentos', component: EquipmentTab },
  { label: 'Estoque', component: StockTab },
  { label: 'Operacional', component: OperationalTab },
];

export default function BIDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const activeContract = user?.activeContract;
  const contractId = typeof activeContract === 'string'
    ? activeContract
    : activeContract?.contract_id || activeContract?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [dateFilter, setDateFilter] = useState({ start: null, end: null });

  const fetchDashboard = useCallback(async () => {
    if (!contractId) return;
    setLoading(true);
    setError(null);
    try {
      const params = { contract_id: contractId };
      if (dateFilter.start) params.start_date = dateFilter.start;
      if (dateFilter.end) params.end_date = dateFilter.end;
      const res = await api.get('/bi/dashboard', { params });
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, [contractId, dateFilter]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleClose = () => navigate('/equipment');

  // Full-page loading (first load)
  if (loading && !data) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-bold uppercase tracking-widest">Carregando BI Dashboard...</p>
        </div>
      </div>
    );
  }

  // Full-page error (no data at all)
  if (error && !data) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
          <button
            onClick={fetchDashboard}
            className="px-6 py-2 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: 'rgb(var(--color-primary))' }}
          >
            Tentar novamente
          </button>
          <button onClick={handleClose} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const ActiveTabComponent = TABS[activeTab]?.component;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
      <BIHeader
        contractId={contractId}
        dateFilter={dateFilter}
        onFilterChange={setDateFilter}
        onClose={handleClose}
      />
      <BITabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-6">
        {loading && data && (
          <div className="flex items-center gap-2 mb-4 px-1 text-xs text-slate-400">
            <div className="w-3 h-3 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
            Atualizando dados...
          </div>
        )}
        {ActiveTabComponent && data && (
          <ActiveTabComponent data={data} contractId={contractId} />
        )}
      </div>
    </div>
  );
}
