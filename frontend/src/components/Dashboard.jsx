import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthProvider';
import { Plus, Search, Filter, ArrowUp, ArrowDown, MoreVertical, FileText } from 'lucide-react';
import Pagination from './Shared/Pagination';
import { usePagination } from '../hooks/usePagination';
import { useSortableData } from '../hooks/useSortableData';
import { useColumnWidths } from '../hooks/useColumnWidths';
import { cn } from '../lib/utils';
import { useColumns } from '../hooks/useColumns';
import ColumnManager from './Shared/ColumnManager';
import ExportButton from './Shared/ExportButton';
import ResizableHeader from './Shared/ResizableHeader';
import DeliveryModal from './Protocol/ProtocolDelivery';

const DASH_DEFAULT_COLUMNS = [
    { label: 'Prot.', key: 'Protocolo', w: '80px' },
    { label: 'Cidade', key: 'Cidade', w: '110px' },
    { label: 'Empresa', key: 'Empresa', w: '160px' },
    { label: 'Pl.Instalada', key: 'PlantaInstalada', w: '160px' },
    { label: 'Modelo', key: 'Modelo', w: '130px' },
    { label: 'Fila', key: 'Fila', w: '110px' },
    { label: 'Horário', key: 'Horario', w: '100px' },
    { label: 'Área', key: 'Area', w: '130px' },
    { label: 'A4', key: 'A4', w: '60px' },
    { label: 'Toner', key: 'TonerPreto', w: '60px' },
    { label: 'Data', key: 'Data', w: '110px' }
];

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const activeContract = user?.activeContract;
    const [protocols, setProtocols] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProtocol, setSelectedProtocol] = useState(null);
    const [deliveryModalId, setDeliveryModalId] = useState(null);

    const { items: sortedProtocols, requestSort, sortConfig } = useSortableData(protocols);
    // Pagination
    const { currentData: currentProtocols, paginationProps } = usePagination(sortedProtocols, 13); // Increased density slightly for legacy

    // Filters State
    const [showFilters, setShowFilters] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ cidades: [], filas: [], empresas: [] });
    const [filters, setFilters] = useState({ city: '', fila: '', empresa: '' });
    const [search, setSearch] = useState('');

    const { columns, setColumns, visibleColumns } = useColumns(`supply_dash_cols_${user?.username}_${activeContract}`, DASH_DEFAULT_COLUMNS);
    const { widths, setColumnWidth } = useColumnWidths(`supply_dash_cols_${user?.username}_${activeContract}`);

    const fetchFilterOptions = useCallback(async () => {
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
            // Silent: filter options are non-critical
        }
    }, []);

    const fetchProtocols = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                limit: 150, // Increase limit for filtered results
                status: 'pending',
                city: filters.city,
                fila: filters.fila,
                empresa: filters.empresa,
                search: search,
                contract_id: activeContract
            });
            const response = await api.get(`data/entregas?${params.toString()}`);
            if (Array.isArray(response.data)) {
                setProtocols(response.data);
            } else {
                setProtocols([]);
            }
        } catch (_error) {
            setProtocols([]);
        } finally {
            setLoading(false);
        }
    }, [filters, search, activeContract]);

    useEffect(() => {
        fetchProtocols();
        fetchFilterOptions();
    }, [fetchProtocols, fetchFilterOptions]);

    const handleSearch = (e) => setSearch(e.target.value);

    return (
        <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500">
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
                <div className="bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex-1 flex items-center w-full md:w-auto">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por protocolo, série ou fila..."
                            value={search}
                            onChange={handleSearch}
                            className="w-full pl-10 pr-4 py-2 text-sm border-none focus:ring-0 bg-transparent text-slate-900 dark:text-white placeholder-slate-400"
                        />
                    </div>
                    <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all",
                            showFilters ? "bg-primary/10 text-primary" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                    >
                        <Filter className="h-4 w-4" />
                        <span className="hidden sm:inline">Filtros</span>
                    </button>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <ExportButton
                        tableId="dashboard"
                        data={sortedProtocols}
                        visibleColumns={visibleColumns}
                        backendEndpoint="/export/pendencias"
                        backendParams={{ contract_id: activeContract }}
                        backendFilename="pendencias.csv"
                    />
                    <ColumnManager columns={columns} onChange={setColumns} />
                    <button
                        onClick={() => navigate('/wizard')}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
                    >
                        <Plus className="h-4 w-4" />
                        Novo Pedido
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cidade</label>
                        <select
                            className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                            value={filters.city}
                            onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
                        >
                            <option value="">TODOS</option>
                            {filterOptions.cidades.map(c => <option key={c} value={c} className="dark:bg-slate-900">{c.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Empresa</label>
                        <select
                            className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                            value={filters.empresa}
                            onChange={(e) => setFilters(prev => ({ ...prev, empresa: e.target.value }))}
                        >
                            <option value="">TODAS</option>
                            {filterOptions.empresas.map(c => <option key={c} value={c} className="dark:bg-slate-900">{c.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fila</label>
                        <select
                            className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                            value={filters.fila}
                            onChange={(e) => setFilters(prev => ({ ...prev, fila: e.target.value }))}
                        >
                            <option value="">TODAS</option>
                            {filterOptions.filas.map(c => <option key={c} value={c} className="dark:bg-slate-900">{c.toUpperCase()}</option>)}
                        </select>
                    </div>
                </div>
            )}

            {/* Legacy Data Table - Restored Spacing */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[1100px]">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
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
                                <th className="px-4 py-4 text-right font-bold text-slate-500 uppercase tracking-widest text-[9px] border-b border-slate-200" style={{ width: '80px' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="12" className="px-6 py-32 text-center relative">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                            <p className="text-sm font-medium text-slate-500">Buscando registros...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : protocols.length === 0 ? (
                                <tr>
                                    <td colSpan="12" className="px-6 py-32 text-center">
                                       <div className="flex flex-col items-center gap-2 opacity-50">
                                          <Search size={48} className="text-slate-400" />
                                          <p className="font-bold text-sm">Nenhum protocolo pendente</p>
                                          <p className="text-xs">Tente ajustar seus filtros de busca</p>
                                       </div>
                                    </td>
                                </tr>
                            ) : (
                                currentProtocols.map((p, idx) => (
                                    <tr
                                        key={idx}
                                        className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all cursor-pointer"
                                        onClick={() => setSelectedProtocol(p)}
                                    >
                                        {visibleColumns.map(col => {
                                            switch (col.key) {
                                                case 'Protocolo': return <td key={col.key} className="px-4 py-3 font-bold text-slate-900 dark:text-white border-r border-slate-50 dark:border-slate-800 group-hover:text-primary transition-colors">{p.Protocolo}</td>;
                                                case 'Cidade': return <td key={col.key} className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate max-w-[110px]" title={p.Cidade}>{p.Cidade}</td>;
                                                case 'Empresa': return <td key={col.key} className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate max-w-[160px]" title={p.Empresa}>{p.Empresa}</td>;
                                                case 'PlantaInstalada': return <td key={col.key} className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate font-medium max-w-[160px]" title={p.PlantaInstalada}>{p.PlantaInstalada}</td>;
                                                case 'Modelo': return (
                                                    <td key={col.key} className="px-4 py-3 truncate max-w-[130px]" title={p.Modelo}>
                                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-[10px] font-bold uppercase border border-slate-200 dark:border-slate-700">{p.Modelo}</span>
                                                    </td>
                                                );
                                                case 'Fila': return (
                                                    <td key={col.key} className="px-4 py-3 truncate max-w-[110px]" title={p.Fila}>
                                                        <span className="text-primary font-bold text-[10px] uppercase tracking-wider">{p.Fila}</span>
                                                    </td>
                                                );
                                                case 'Horario': return <td key={col.key} className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">{p.Horario}</td>;
                                                case 'Area': return <td key={col.key} className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate max-w-[130px]" title={p.Area}>{p.Area}</td>;
                                                case 'A4': return <td key={col.key} className="px-4 py-3 text-slate-700 dark:text-slate-300 font-bold">{p.A4}</td>;
                                                case 'TonerPreto': return <td key={col.key} className="px-4 py-3 text-slate-700 dark:text-slate-300 font-bold">{p.TonerPreto || 0}</td>;
                                                case 'Data': return <td key={col.key} className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-[110px] truncate" title={p.Data}>{p.Data}</td>;
                                                default: return <td key={col.key} className="px-4 py-3 text-slate-600">{p[col.key]}</td>;
                                            }
                                        })}
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/protocol/${p.Protocolo}`);
                                                }}
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                        </td>
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

            {/* Modern Cinematic Action Modal - Keeping requested improvement */}
            {selectedProtocol && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6 animate-in fade-in duration-300">
                    <div className="glass-surface p-8 w-full max-w-md relative overflow-hidden rounded-3xl border-white/20 shadow-2xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16" />
                        
                        <div className="flex items-center gap-4 mb-6 relative">
                            <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                                <FileText size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Protocolo #{selectedProtocol.Protocolo}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gerencie os protocolos e entregas</p>
                            </div>
                        </div>

                        <div className="bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 mb-8 space-y-3 relative transition-colors">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-slate-400 dark:text-slate-500">Origem</span>
                                <span className="text-slate-800 dark:text-slate-200">{selectedProtocol.Empresa}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-slate-400 dark:text-slate-500">Localidade</span>
                                <span className="text-slate-800 dark:text-slate-200">{selectedProtocol.Cidade}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-slate-400 dark:text-slate-500">Status Fila</span>
                                <span className="text-primary">{selectedProtocol.Fila}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 relative">
                            <button
                                onClick={() => {
                                    setSelectedProtocol(null);
                                    navigate(`/protocol/${selectedProtocol.Protocolo}`);
                                }}
                                className="w-full py-4 bg-primary text-white font-bold uppercase tracking-widest text-[11px] rounded-xl hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
                            >
                                Visualizar / Editar
                            </button>
                            {selectedProtocol.Status !== 'Entregue' && (
                                <button
                                    onClick={() => {
                                        setSelectedProtocol(null);
                                        setDeliveryModalId(selectedProtocol.Protocolo);
                                    }}
                                    className="w-full py-4 bg-emerald-600 text-white font-bold uppercase tracking-widest text-[11px] rounded-xl hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-emerald-600/20"
                                >
                                    Dar Baixa (Entregar)
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedProtocol(null)}
                                className="w-full mt-2 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* DeliveryModal */}
            <DeliveryModal
                protocolId={deliveryModalId}
                isOpen={!!deliveryModalId}
                onClose={() => setDeliveryModalId(null)}
                onSuccess={() => { setDeliveryModalId(null); fetchProtocols(); }}
            />
        </div >
    );
}
