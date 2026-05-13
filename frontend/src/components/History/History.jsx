import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthProvider';
import api from '../../lib/api';
import { Search, Filter, History as HistoryIcon, ArrowUp, ArrowDown } from 'lucide-react';
import Pagination from '../Shared/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { useSortableData } from '../../hooks/useSortableData';
import { useColumns } from '../../hooks/useColumns';
import { useColumnWidths } from '../../hooks/useColumnWidths';
import { cn } from '../../lib/utils';
import ColumnManager from '../Shared/ColumnManager';
import ExportButton from '../Shared/ExportButton';
import ResizableHeader from '../Shared/ResizableHeader';
import HistoryDetailModal from './HistoryDetailModal';

const HISTORY_COLUMNS = [
    { key: 'Protocolo',   label: 'Nº Pedido',       w: '110px' },
    { key: 'Status',      label: 'Status',           w: '110px' },
    { key: 'Cidade',      label: 'Cidade',           w: '110px' },
    { key: 'Empresa',     label: 'Unidade',          w: '160px' },
    { key: 'Modelo',      label: 'Equipamento',      w: '150px' },
    { key: 'Serie',       label: 'Número Série',     w: '130px' },
    { key: 'Fila',        label: 'Fila / Canal',     w: '110px' },
    { key: 'Solicitacao', label: 'Solicitante',      w: '130px' },
    { key: 'A4',          label: 'Itens Entregues',  w: '130px' },
    { key: 'DataEntrega', label: 'Data de Entrega',  w: '130px' },
];

export default function History() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const [protocols, setProtocols] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProtocol, setSelectedProtocol] = useState(null);

    // Filters State
    const [showFilters, setShowFilters] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ cidades: [], filas: [], empresas: [] });
    const [filters, setFilters] = useState({ city: '', fila: '', empresa: '' });
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchFilterOptions();
    }, []);

    useEffect(() => {
        loadHistory();
    }, [filters, search, dateRange, user.activeContract]);

    const fetchFilterOptions = async () => {
        try {
            const res = await api.get('data/entregas/filter-options');
            if (res.data && typeof res.data === 'object') {
                setFilterOptions({
                    cidades: Array.isArray(res.data.cidades) ? res.data.cidades : [],
                    filas: Array.isArray(res.data.filas) ? res.data.filas : [],
                    empresas: Array.isArray(res.data.empresas) ? res.data.empresas : []
                });
            }
        } catch (_error) {
            console.warn("Failed to fetch filter options:", _error);
        }
    };

    const loadHistory = async () => {
        if (!user.activeContract) return;

        try {
            setLoading(true);
            const params = new URLSearchParams({
                limit: 500,
                status: 'all',
                contract_id: user.activeContract,
                city: filters.city,
                fila: filters.fila,
                empresa: filters.empresa,
                search: search,
                start_date: dateRange.start,
                end_date: dateRange.end
            });
            const response = await api.get(`/data/entregas?${params.toString()}`);
            if (Array.isArray(response.data)) {
                setProtocols(response.data);
            } else {
                setProtocols([]);
            }
        } catch (_error) {
            console.error("Failed to load history:", _error);
            setProtocols([]);
        } finally {
            setLoading(false);
        }
    };

    const handleRowClick = async (protocolId) => {
        try {
            const res = await api.get(`/data/entregas/${protocolId}`);
            setSelectedProtocol(res.data);
        } catch (_error) {
            console.error("Failed to fetch protocol details:", _error);
            addToast("Erro ao carregar detalhes do protocolo.", "error");
        }
    };

    const getStatusText = (status, date, cancelado) => {
        if (status === 'Cancelado' || cancelado === 'Sim') return 'Cancelado';
        if (status === 'Entregue' || date) return 'Entregue';
        return 'Pendente';
    };

    const { items: sortedProtocols, requestSort, sortConfig } = useSortableData(protocols);
    const { currentData: currentProtocols, paginationProps } = usePagination(sortedProtocols, 15);
    const { columns, setColumns, visibleColumns } = useColumns(`history-columns`, HISTORY_COLUMNS);
    const { widths, setColumnWidth } = useColumnWidths(`history-columns`);

    return (
        <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm">
                        <HistoryIcon size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Histórico de Entregas</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Todos os pedidos e entregas realizados.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ColumnManager columns={columns} onChange={setColumns} />
                    <ExportButton
                        tableId="history"
                        data={sortedProtocols}
                        visibleColumns={visibleColumns}
                        backendEndpoint="/export/deliveries"
                        backendParams={{
                            status: 'all',
                            contract_id: user.activeContract,
                            city: filters.city,
                            fila: filters.fila,
                            empresa: filters.empresa,
                            search,
                            start_date: dateRange.start,
                            end_date: dateRange.end,
                        }}
                        backendFilename={`historico_${user.activeContract}.csv`}
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col md:flex-row gap-2 items-center justify-between shrink-0 transition-colors">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por identificador ou número de série..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm border-none focus:ring-0 bg-transparent text-slate-800 dark:text-white placeholder-slate-400"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all",
                        showFilters ? "bg-primary/10 text-primary" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                >
                    <Filter className="h-4 w-4" /> Filtros
                </button>
            </div>

            {showFilters && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cidade</label>
                        <select className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 dark:text-white outline-none" value={filters.city} onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}>
                            <option value="" className="dark:bg-slate-900">TODAS</option>
                            {filterOptions.cidades.map(c => <option key={c} value={c} className="dark:bg-slate-900">{c.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Unidade</label>
                        <select className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 dark:text-white outline-none" value={filters.empresa} onChange={(e) => setFilters(prev => ({ ...prev, empresa: e.target.value }))}>
                            <option value="" className="dark:bg-slate-900">TODAS</option>
                            {filterOptions.empresas.map(c => <option key={c} value={c} className="dark:bg-slate-900">{c.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Canal</label>
                        <select className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 dark:text-white outline-none" value={filters.fila} onChange={(e) => setFilters(prev => ({ ...prev, fila: e.target.value }))}>
                            <option value="" className="dark:bg-slate-900">TODOS</option>
                            {filterOptions.filas.map(c => <option key={c} value={c} className="dark:bg-slate-900">{c.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Início (Data Entrega)</label>
                            <input
                                type="date"
                                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 dark:text-white outline-none"
                                value={dateRange.start}
                                onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Fim (Data Entrega)</label>
                            <input
                                type="date"
                                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 dark:text-white outline-none"
                                value={dateRange.end}
                                onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Read-Only Legacy Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 transition-colors">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[1100px]">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors">
                            <tr>
                                {visibleColumns.map((col) => (
                                    <ResizableHeader
                                        key={col.key}
                                        columnKey={col.key}
                                        width={widths[col.key]}
                                        onResize={(k, w) => setColumnWidth(k, w)}
                                        onResizeEnd={(k, w) => setColumnWidth(k, w)}
                                        className="px-4 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[9px] cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800"
                                        style={{ width: widths[col.key] ? `${widths[col.key]}px` : col.w, minWidth: col.w }}
                                        onClick={() => requestSort(col.key)}
                                    >
                                        <div className="flex items-center justify-between">
                                            {col.label}
                                            <div className="flex flex-col opacity-20">
                                                <ArrowUp className={cn("w-2 h-2", sortConfig?.key === col.key && sortConfig.direction === 'ascending' && "text-primary opacity-100")} />
                                                <ArrowDown className={cn("w-2 h-2", sortConfig?.key === col.key && sortConfig.direction === 'descending' && "text-primary opacity-100")} />
                                            </div>
                                        </div>
                                    </ResizableHeader>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="px-6 py-24 text-center">
                                       <div className="flex flex-col items-center gap-4">
                                          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                          <p className="text-sm font-medium text-slate-400">Carregando histórico...</p>
                                       </div>
                                    </td>
                                </tr>
                            ) : protocols.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-6 py-24 text-center">
                                       <div className="flex flex-col items-center gap-2 opacity-30">
                                          <Search size={48} className="text-slate-400" />
                                          <p className="font-bold text-sm">Nenhum registro encontrado</p>
                                       </div>
                                    </td>
                                </tr>
                            ) : (
                                currentProtocols.map((p, idx) => (
                                    <tr
                                        key={idx}
                                        onClick={() => handleRowClick(p.Protocolo)}
                                        className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800"
                                    >
                                        {visibleColumns.map(col => {
                                            switch (col.key) {
                                                case 'Protocolo':
                                                    return <td key={col.key} className="px-4 py-4 font-bold text-primary border-r border-slate-50 dark:border-slate-800">{p.Protocolo}</td>;
                                                case 'Status':
                                                    return (
                                                        <td key={col.key} className="px-4 py-4">
                                                            <span className={cn(
                                                                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                                (p.Status === 'Cancelado' || p.Cancelado === 'Sim')
                                                                    ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800"
                                                                    : (p.Status === 'Entregue' || p.DataEntrega)
                                                                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800"
                                                                        : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800"
                                                            )}>
                                                                {getStatusText(p.Status, p.DataEntrega, p.Cancelado)}
                                                            </span>
                                                        </td>
                                                    );
                                                case 'Cidade':
                                                    return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 truncate max-w-[110px]" title={p.Cidade}>{p.Cidade}</td>;
                                                case 'Empresa':
                                                    return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 truncate max-w-[160px]" title={p.Empresa}>{p.Empresa}</td>;
                                                case 'Modelo':
                                                    return <td key={col.key} className="px-4 py-4 text-slate-700 dark:text-slate-300 font-medium truncate max-w-[150px]" title={p.Modelo}>{p.Modelo}</td>;
                                                case 'Serie':
                                                    return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 font-mono text-[10px] truncate max-w-[130px]" title={p.Serie}>{p.Serie}</td>;
                                                case 'Fila':
                                                    return <td key={col.key} className="px-4 py-4 text-primary font-bold tracking-tight truncate max-w-[110px]" title={p.Fila}>{p.Fila}</td>;
                                                case 'Solicitacao':
                                                    return <td key={col.key} className="px-4 py-4 text-slate-500 dark:text-slate-400 font-medium truncate max-w-[130px]" title={p.Solicitacao}>{p.Solicitacao}</td>;
                                                case 'A4':
                                                    return (
                                                        <td key={col.key} className="px-4 py-4">
                                                            <div className="flex flex-wrap gap-1">
                                                                {(() => {
                                                                    const a4 = parseInt(p.A4 || 0);
                                                                    const a3 = parseInt(p.A3 || 0);
                                                                    const bk = parseInt(p.TonerPreto || 0);
                                                                    const cy = parseInt(p.TonerCiano || 0);
                                                                    const mg = parseInt(p.TonerMagenta || 0);
                                                                    const yw = parseInt(p.TonerAmarelo || 0);
                                                                    const badges = [];
                                                                    if (a4 > 0) badges.push(<span key="a4" className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">A4×{a4}</span>);
                                                                    if (a3 > 0) badges.push(<span key="a3" className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">A3×{a3}</span>);
                                                                    if (bk > 0) badges.push(<span key="bk" className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">BK×{bk}</span>);
                                                                    if (cy > 0) badges.push(<span key="cy" className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">CY×{cy}</span>);
                                                                    if (mg > 0) badges.push(<span key="mg" className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 border border-pink-200 dark:border-pink-800">MG×{mg}</span>);
                                                                    if (yw > 0) badges.push(<span key="yw" className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">YW×{yw}</span>);
                                                                    return badges.length > 0 ? badges : <span className="text-slate-300 dark:text-slate-600">—</span>;
                                                                })()}
                                                            </div>
                                                        </td>
                                                    );
                                                case 'DataEntrega':
                                                    return <td key={col.key} className="px-4 py-4 text-slate-900 dark:text-white font-bold truncate max-w-[130px]" title={p.DataEntrega}>{p.DataEntrega || '-'}</td>;
                                                default:
                                                    return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400">{p[col.key]}</td>;
                                            }
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm shrink-0 transition-colors">
                <Pagination {...paginationProps} />
            </div>

            {/* Detail Modal */}
            {selectedProtocol && (
                <HistoryDetailModal
                    protocol={selectedProtocol}
                    onClose={() => setSelectedProtocol(null)}
                />
            )}
        </div>
    );
}
