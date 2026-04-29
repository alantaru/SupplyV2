import React, { useEffect, useState } from 'react';
import { X, Printer, MapPin, Activity, Calendar, FileText, Search } from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

export default function EquipmentModal({ serie, onClose, activeContract }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('details');

    // History Pagination/Filter
    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const historyItemsPerPage = 5;

    // Helper for contract ID extraction
    const contractId = typeof activeContract === 'string'
        ? activeContract
        : activeContract?.contract_id || activeContract?.id || null;

    useEffect(() => {
        if (!serie) return;
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/data/assist/equipment/${encodeURIComponent(serie)}`, {
                    params: { contract_id: contractId }
                });
                if (res.data) {
                    setData(res.data);
                } else {
                    setError('Equipamento não encontrado.');
                }
            } catch (err) {


                setError('Erro ao carregar detalhes.');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [serie, contractId]);

    if (!serie) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300 transition-colors">
            <div className="glass-surface dark:bg-slate-900/90 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative animate-in zoom-in duration-300 rounded-3xl border border-white/20 dark:border-slate-800 shadow-2xl bg-white transition-colors">

                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 transition-colors">
                    <div className="flex-1">
                        <div className="flex items-center justify-between w-full">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                    <Printer className="h-6 w-6" />
                                </div>
                                {serie}
                                {data?.equipment?.Fila && (
                                    <span className="text-lg text-slate-400 dark:text-slate-500 font-normal">
                                        / {data.equipment.Fila}
                                    </span>
                                )}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-8 mt-5">
                            <button
                                onClick={() => setActiveTab('details')}
                                className={cn(
                                    "pb-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
                                    activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                )}
                            >
                                Detalhes do Equipamento
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={cn(
                                    "pb-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
                                    activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                )}
                            >
                                Histórico ({data?.history?.length || 0})
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50 transition-colors">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Carregando dados...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-600 p-6 rounded-xl flex items-center gap-4 justify-center">
                            <Activity className="h-6 w-6" />
                            <span className="font-bold text-sm">{error}</span>
                        </div>
                    ) : data && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {activeTab === 'details' ? (
                                <>
                                    {/* Main Identity Card */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shadow-sm transition-colors">
                                        <div className="space-y-1">
                                            <label className="text-[9px] uppercase text-slate-400 dark:text-slate-500 font-bold tracking-widest">Modelo</label>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">{data.equipment.ModeloSimpress || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] uppercase text-slate-400 dark:text-slate-500 font-bold tracking-widest">Fila / Hostname</label>
                                            <p className="text-sm font-mono text-primary font-bold">{data.equipment.Fila || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] uppercase text-slate-400 dark:text-slate-500 font-bold tracking-widest">Status</label>
                                            <div>
                                                <span className={cn(
                                                    "inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                                                    (data.equipment.STATUS || '').toLowerCase().includes('produ')
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                                )}>
                                                    {data.equipment.STATUS || 'Desconhecido'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] uppercase text-slate-400 dark:text-slate-500 font-bold tracking-widest">IP</label>
                                            <p className="text-sm font-mono text-slate-500 dark:text-slate-400">{data.equipment.IP || '-'}</p>
                                        </div>
                                    </div>

                                    {/* Location Info */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm transition-colors">
                                        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5 text-primary" />
                                            Localização
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                                            <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-slate-400 dark:text-slate-500 font-medium">Unidade</span>
                                                <span className="font-bold text-slate-800 dark:text-white text-right">{data.equipment.Empresa || '-'}</span>
                                            </div>
                                            <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-slate-400 dark:text-slate-500 font-medium">Cidade / UF</span>
                                                <span className="font-bold text-slate-800 dark:text-white text-right">{data.equipment.Cidade} - {data.equipment.UF}</span>
                                            </div>
                                            <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-slate-400 dark:text-slate-500 font-medium">Setor</span>
                                                <span className="font-bold text-slate-800 dark:text-white text-right">{data.equipment.Area || '-'}</span>
                                            </div>
                                            <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-slate-400 dark:text-slate-500 font-medium">Local de Instalação</span>
                                                <span className="font-bold text-slate-800 dark:text-white text-right">{data.equipment.LocalInstalacao || '-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Counters & Last Delivery */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm transition-colors">
                                            <h3 className="text-primary font-bold mb-5 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                                                <Activity className="h-3.5 w-3.5" />
                                                Contadores e Toner
                                            </h3>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">Total Acumulado</span>
                                                    <span className="font-bold text-slate-900 dark:text-white text-2xl">
                                                        {data.counters?.counter_total?.toLocaleString() || '0'}
                                                    </span>
                                                </div>
                                                <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
                                                <div className="grid grid-cols-4 gap-2 text-center">
                                                    {['BK', 'CY', 'MG', 'YW'].map((c) => {
                                                        const pct = data.counters?.[`toner_${c.toLowerCase()}_pct`];
                                                        const colorClass = c === 'BK' ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' :
                                                                         c === 'CY' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                                                         c === 'MG' ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400' :
                                                                         'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
                                                        return (
                                                            <div key={c} className={cn("py-2.5 rounded-xl border border-slate-100 dark:border-slate-800", colorClass)}>
                                                                <p className="text-[8px] font-bold opacity-60 uppercase">{c}</p>
                                                                <p className="text-sm font-bold">{pct || '0'}%</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm transition-colors">
                                            <h3 className="text-primary font-bold mb-5 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                                                <Calendar className="h-3.5 w-3.5" />
                                                Última Entrega
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">Data</span>
                                                    <span className="font-bold text-slate-800 dark:text-white">
                                                        {data.last_delivery?.date
                                                            ? (data.last_delivery.date instanceof Date
                                                                ? data.last_delivery.date.toLocaleDateString('pt-BR')
                                                                : String(data.last_delivery.date).split('T')[0])
                                                            : 'Sem registro'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">Contador Final</span>
                                                    <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                                                        {data.last_delivery?.counter || '-'}
                                                    </span>
                                                </div>
                                                <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
                                                <div>
                                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-2">Itens Entregues:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {data.last_delivery?.qty > 0 && (
                                                            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full text-[10px] text-slate-700 dark:text-slate-300 font-bold">
                                                                A4: {data.last_delivery.qty} resma(s)
                                                            </span>
                                                        )}
                                                        {!data.last_delivery?.qty && (
                                                            <span className="text-slate-400 dark:text-slate-500 text-[10px] italic">Sem dados</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Suggestion */}
                                    {data.suggestion && (
                                        <div className="bg-amber-50/50 dark:bg-amber-950/20 p-6 rounded-xl border border-amber-200 dark:border-amber-900 flex items-start gap-4 transition-colors">
                                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                                                <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-500">Sugestão de Atendimento</h4>
                                                <p className="text-xs text-amber-600 dark:text-amber-500 opacity-80 mt-1 leading-relaxed">
                                                    Baseado na análise de consumo e telemetrias, segue sugestão:
                                                </p>
                                                <div className="flex flex-wrap gap-3 mt-3">
                                                    <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                                                        <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Resmas A4</p>
                                                        <p className="text-lg font-bold text-slate-900 dark:text-white">{data.suggestion.resmas || 0}</p>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                                                        <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Toner BK</p>
                                                        <p className={cn("text-sm font-bold", data.suggestion.toner_bk ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-600')}>
                                                            {data.suggestion.toner_bk ? 'NECESSÁRIO' : 'ESTÁVEL'}
                                                        </p>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                                                        <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Kit Color</p>
                                                        <p className={cn("text-sm font-bold", (data.suggestion.toner_cy || data.suggestion.toner_mg || data.suggestion.toner_yw) ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-600')}>
                                                            {(data.suggestion.toner_cy || data.suggestion.toner_mg || data.suggestion.toner_yw) ? 'NECESSÁRIO' : 'ESTÁVEL'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <HistoryView
                                    history={data.history}
                                    search={historySearch}
                                    setSearch={setHistorySearch}
                                    page={historyPage}
                                    setPage={setHistoryPage}
                                    itemsPerPage={historyItemsPerPage}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function HistoryView({ history, search, setSearch, page, setPage, itemsPerPage }) {
    const filtered = (history || []).filter(item =>
        (item.Protocolo || '').toString().includes(search) ||
        (item.DataEntrega || item.Data || '').includes(search)
    );

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Histórico de Entregas</h4>
                <div className="relative w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar ID ou Data..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm transition-colors">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[9px] border-b border-slate-200 dark:border-slate-800 transition-colors">
                        <tr>
                            <th className="px-5 py-3.5">Protocolo</th>
                            <th className="px-5 py-3.5">Data</th>
                            <th className="px-5 py-3.5 text-center">Contador</th>
                            <th className="px-5 py-3.5">Itens</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {paginated.length > 0 ? paginated.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-5 py-4 font-bold text-primary">#{item.Protocolo}</td>
                                <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-medium">{item.DataEntrega || item.Data}</td>
                                <td className="px-5 py-4 font-mono text-center text-slate-800 dark:text-slate-200 font-bold">{item.ContadorFinal || item.ContFinal || '-'}</td>
                                <td className="px-5 py-4">
                                    <div className="flex flex-wrap gap-1.5">
                                        {item.A4 > 0 && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 font-bold text-[10px]">A4: {item.A4}</span>}
                                        {(item.TonerPreto > 0 || item.TonerBk > 0) && <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold text-[10px]">BK: {item.TonerPreto || item.TonerBk}</span>}
                                        {(item.TonerCiano > 0 || item.TonerCy > 0) && <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 font-bold text-[10px]">CY: {item.TonerCiano || item.TonerCy}</span>}
                                        {(item.TonerMagenta > 0 || item.TonerMg > 0) && <span className="bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded border border-pink-100 dark:border-pink-800 font-bold text-[10px]">MG: {item.TonerMagenta || item.TonerMg}</span>}
                                        {(item.TonerAmarelo > 0 || item.TonerYw > 0) && <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-800 font-bold text-[10px]">YW: {item.TonerAmarelo || item.TonerYw}</span>}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                 <td colSpan="4" className="px-5 py-16 text-center text-slate-400 dark:text-slate-600 font-bold text-xs uppercase tracking-widest">Nenhum registro no histórico.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-between items-center px-2 mt-4 shrink-0">
                     <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-all active:scale-95 shadow-sm"
                    >
                        Anterior
                    </button>
                     <span className="text-slate-400 dark:text-slate-500 font-bold text-xs">
                        Página <span className="text-slate-800 dark:text-white">{page}</span> de <span className="text-slate-800 dark:text-white">{totalPages}</span>
                    </span>
                     <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-all active:scale-95 shadow-sm"
                    >
                        Próxima
                    </button>
                </div>
            )}
        </div>
    );
}
