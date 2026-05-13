import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthProvider';
import api from "../../lib/api";
import {
    Plus, Check, Printer, AlertTriangle, Search, Save, Trash2, Map,
    Loader, Edit, HelpCircle, FileText, ArrowUp, ArrowDown, UserX, X
} from 'lucide-react';
import RoutePrint from './RoutePrint';
import Pagination from '../Shared/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { useSortableData } from '../../hooks/useSortableData';
import StatusLegendModal from './StatusLegendModal';

import { useSearchParams } from 'react-router-dom';
import RouteFilterBuilder from './RouteFilterBuilder';
import RoutePlanner from './RoutePlanner';
import { Calendar, LayoutList } from 'lucide-react';
import { downloadFileFromAPI, cn } from '../../lib/utils';
import GenericDeleteModal from '../Shared/GenericDeleteModal';
import { useColumns } from '../../hooks/useColumns';
import { useColumnWidths } from '../../hooks/useColumnWidths';
import ColumnManager from '../Shared/ColumnManager';
import ExportButton from '../Shared/ExportButton';
import ResizableHeader from '../Shared/ResizableHeader';

const ROUTE_COLUMNS = [
    { label: 'Identificador', key: 'Serie', w: '110px' },
    { label: 'Host/Fila', key: 'Fila', w: '120px' },
    { label: 'Endereçamento', key: 'Local', w: '200px' },
    { label: 'Contato', key: 'Contato', w: '140px' },
    { label: 'Contador', key: 'Contador_Atual', align: 'right', w: '85px' },
    { label: 'Estoque', key: 'Estoque_Estimado', align: 'right', w: '85px' },
    { label: 'A4', key: 'Sugestao_A4', align: 'center', w: '60px' },
    { label: 'BK', key: 'TonerLevel_BK', align: 'center', w: '45px' },
    { label: 'CY', key: 'TonerLevel_CY', align: 'center', w: '45px' },
    { label: 'MG', key: 'TonerLevel_MG', align: 'center', w: '45px' },
    { label: 'YW', key: 'TonerLevel_YW', align: 'center', w: '45px' },
    { label: 'Status Sistema', key: 'Status_Calculado', w: '160px' }
];

export default function RouteDashboard() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'routes';

    const [routes, setRoutes] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [analysis, setAnalysis] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isLegendOpen, setIsLegendOpen] = useState(false);

    // Filter State
    const [filterText, setFilterText] = useState("");
    const [filterStatus, setFilterStatus] = useState("all"); 


    // New Route State
    const [isCreating, setIsCreating] = useState(false);
    const [newRouteName, setNewRouteName] = useState("");
    const [newRouteSeries, setNewRouteSeries] = useState(""); // Missing state fixed
    const [newRouteFilters, setNewRouteFilters] = useState([]); 
    const [deleteModal, setDeleteModal] = useState(null); 
    const [extrasMeta, setExtrasMeta] = useState([]);
    const [excludedSeries, setExcludedSeries] = useState([]);

    const contractId = user?.activeContract;

    // Load mappings for extras
    useEffect(() => {
        const loadMappings = async () => {
            try {
                const res = await api.get('data/mappings');
                const mapaExtras = res.data.MAPA?.EXTRAS || [];
                setExtrasMeta(mapaExtras);
            } catch (_err) {
                // Silent
            }
        };
        loadMappings();
    }, [contractId]);

    const fetchRoutes = useCallback(async () => {
        try {
            const res = await api.get('routes/', { params: { contract_id: contractId } });
            setRoutes(Array.isArray(res.data) ? res.data : []);
        } catch (_error) {
            setRoutes([]);
        }
    }, [contractId]);

    useEffect(() => {
        fetchRoutes();
    }, [fetchRoutes]);

    // Auto-select route from URL
    useEffect(() => {
        const routeName = searchParams.get('name');
        if (routeName && routes.length > 0 && !selectedRoute) {
            const found = routes.find(r => r.name === routeName);
            if (found) {
                handleAnalyze(found);
            }
        }
    }, [routes, searchParams, selectedRoute, handleAnalyze]);

    const handleAnalyze = useCallback(async (route) => {
        setLoading(true);
        setSelectedRoute(route);
        setAnalysis([]);
        setExcludedSeries(route.excluded_series || []);
        try {
            const res = await api.post('routes/analyze', { series: route.series }, { params: { contract_id: contractId } });
            const data = Array.isArray(res.data) ? res.data : [];
            setAnalysis(data);
            if (data.length === 0) {
                addToast("Nenhum equipamento correspondente encontrado para esta rota.", "warning");
            }
        } catch (_error) {
            setAnalysis([]);
            addToast("Falha ao analisar rota.", "error");
        } finally {
            setLoading(false);
        }
    }, [contractId, addToast]);

    // Filter Logic
    const { columns, setColumns, visibleColumns } = useColumns(`supply_route_cols_${user?.username}_${contractId}`, ROUTE_COLUMNS);
    const { widths, setColumnWidth } = useColumnWidths(`supply_route_cols_${user?.username}_${contractId}`);

    const filteredAnalysis = useMemo(() => {
        return analysis
            .filter(item => !excludedSeries.includes(item.Serie))
            .filter(item => {
                const matchText = (item.Serie + item.Local + item.Fila).toLowerCase().includes(filterText.toLowerCase());
                const matchStatus = filterStatus === 'all' ? true :
                    filterStatus === 'needs' ? (item.Sugestao_A4 > 0 || item.Toner_Alerts.length > 0) :
                        filterStatus === 'toner' ? item.Toner_Alerts.length > 0 :
                            filterStatus === 'stock' ? item.Sugestao_A4 > 0 : true;
                return matchText && matchStatus;
            });
    }, [analysis, filterText, filterStatus, excludedSeries]);

    // Pagination
    const { items: sortedAnalysis, requestSort, sortConfig } = useSortableData(filteredAnalysis);
    const { currentData: currentAnalysis, paginationProps } = usePagination(sortedAnalysis, 20);

    const handleCreateRoute = async () => {
        if (!newRouteName) return;

        try {
            let finalSeries = [];
            let finalFilters = [];

            if (newRouteFilters.length > 0) {
                if (analysis.length === 0) {
                    addToast("A rota está vazia! Adicione filtros válidos.", "info");
                    return;
                }
                finalSeries = analysis.map(a => a.Serie);
                finalFilters = newRouteFilters;
            } else {
                finalSeries = newRouteSeries.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
            }

            if (finalSeries.length === 0) return;

            await api.post('routes/', {
                name: newRouteName,
                series: finalSeries,
                filters: finalFilters,
                excluded_series: excludedSeries
            }, { params: { contract_id: contractId } });

            fetchRoutes();
            setIsCreating(false);
            setNewRouteName("");
            setNewRouteSeries("");
            setNewRouteFilters([]);
            setExcludedSeries([]);
            setAnalysis([]); 
            setSelectedRoute(null);
        } catch (_error) {

        }
    };

    // Real-time Preview Effect
    useEffect(() => {
        if (!isCreating) return;

        const timer = setTimeout(async () => {
            if (newRouteFilters.length > 0) {
                setLoading(true);
                try {
                    const res = await api.post('routes/preview', { filters: newRouteFilters, excluded_series: excludedSeries }, { params: { contract_id: contractId } });
                    setAnalysis(Array.isArray(res.data) ? res.data : []);
                    setSelectedRoute({ name: "Nova Rota (Preview)", series: [] });
                } catch (_err) {

                } finally {
                    setLoading(false);
                }
            } else if (newRouteSeries) {
                if (newRouteSeries.length === 0) {
                    setAnalysis([]);
                    setSelectedRoute(null);
                }
            } else {
                setAnalysis([]);
                setSelectedRoute(null);
            }
        }, 500); 

        return () => clearTimeout(timer);
    }, [newRouteFilters, contractId, isCreating, excludedSeries]);

    useEffect(() => {
        if (contractId) {
            fetchRoutes();
            setAnalysis([]);
            setSelectedRoute(null);
            setIsCreating(false);
        }
    }, [contractId]);

    const handleTabChange = (tab) => {
        setSearchParams({ tab });
    };

    const handleDeleteRoute = async (name) => {
        setDeleteModal({
            title: "Deletar Rota",
            message: `Tem certeza que deseja deletar permanentemente a rota "${name}"?`,
            targetId: name,
            requireTyping: false,
            onConfirm: async () => {
                setDeleteModal(null);
                try {
                    await api.delete(`/routes/${name}`, { params: { contract_id: contractId } });
                    fetchRoutes();
                    if (selectedRoute?.name === name) {
                        setSelectedRoute(null);
                        setAnalysis([]);
                    }
                } catch (_error) {

                    addToast("Erro ao excluir rota.", "error");
                }
            }
        });
    };

    const handleEditRoute = (route) => {
        setAnalysis([]);
        setSelectedRoute(null);
        setNewRouteName(route.name);
        setNewRouteFilters(route.filters || []);
        setNewRouteSeries(route.series ? route.series.join('\n') : "");
        setExcludedSeries(route.excluded_series || []);
        setIsCreating(true);
    };

    const saveRouteWithExclusions = async (updatedExclusions) => {
        if (!selectedRoute) return;
        try {
            await api.post('routes/', {
                name: selectedRoute.name,
                series: selectedRoute.series,
                filters: selectedRoute.filters || [],
                excluded_series: updatedExclusions
            }, { params: { contract_id: contractId } });
            addToast('Equipamento removido da rota.', 'success');
        } catch {
            addToast('Erro ao salvar exclusão.', 'error');
            // revert
            setExcludedSeries(prev => prev.filter(s => s !== updatedExclusions[updatedExclusions.length - 1]));
        }
    };

    const handleExcludeSerie = (serie) => {
        const updated = [...excludedSeries, serie];
        setExcludedSeries(updated);
        setAnalysis(prev => prev.filter(item => item.Serie !== serie));
        if (!isCreating && selectedRoute) {
            saveRouteWithExclusions(updated);
        }
    };

    const handleRestoreSerie = (serie) => {
        setExcludedSeries(prev => prev.filter(s => s !== serie));
    };

    // Core generate logic — reusable by both handleGenerate and handlePrintWithProtocols
    const doGenerate = async () => {
        const selection = filteredAnalysis.map(item => ({
            Serie: item.Serie,
            A4: (item.Sugestao_A4 && item.Sugestao_A4 > 0) ? item.Sugestao_A4 : 1,
            TonerBk: item.Toner_Alerts.includes('BK') ? 1 : 0,
            TonerCy: item.Toner_Alerts.includes('CY') ? 1 : 0,
            TonerMg: item.Toner_Alerts.includes('MG') ? 1 : 0,
            TonerYw: item.Toner_Alerts.includes('YW') ? 1 : 0
        }));
        const res = await api.post('routes/generate', { selection }, { params: { contract_id: contractId } });
        const createdIds = res.data.created_ids || [];
        // Map protocol IDs back to analysis items by position (same order as selection)
        setAnalysis(prev => prev.map(item => {
            const idx = selection.findIndex(s => s.Serie === item.Serie);
            if (idx !== -1 && createdIds[idx]) {
                return { ...item, Protocolo: createdIds[idx] };
            }
            return item;
        }));
        return createdIds.length;
    };

    const handleGenerate = async () => {
        if (!filteredAnalysis.length) return;

        setDeleteModal({
            title: "Gerar Protocolos",
            message: `Deseja gerar protocolos proativos para ${filteredAnalysis.length} máquinas listadas${filterStatus !== 'all' ? ' (filtro ativo)' : ''} na rota "${selectedRoute?.name}"?`,
            targetId: selectedRoute?.name || "CONFIRMAR",
            requireTyping: false,
            confirmLabel: "Gerar Protocolos",
            variant: "info",
            onConfirm: async () => {
                setDeleteModal(null);
                try {
                    const count = await doGenerate();
                    addToast(`Protocolos gerados: ${count}`, "info");
                } catch (_error) {
                    addToast("Erro ao gerar protocolos", "error");
                }
            }
        });
    };

    const handlePrintRoute = () => {
        if (!filteredAnalysis.length) return;

        // Check if protocols were already generated (any item has Protocolo set)
        const alreadyGenerated = filteredAnalysis.some(item => item.Protocolo);
        if (alreadyGenerated) {
            setIsPrinting(true);
            return;
        }

        setDeleteModal({
            title: "Imprimir Rota",
            message: `Para imprimir os números dos protocolos nos cards é necessário gerar os pedidos primeiro. Deseja gerar os ${filteredAnalysis.length} pedidos agora?`,
            targetId: "CONFIRMAR",
            requireTyping: false,
            confirmLabel: "Gerar e Imprimir",
            cancelLabel: "Imprimir sem números",
            onConfirm: async () => {
                setDeleteModal(null);
                try {
                    const count = await doGenerate();
                    addToast(`${count} protocolo(s) gerado(s). Abrindo impressão...`, "success");
                } catch (_error) {
                    addToast("Erro ao gerar protocolos. Abrindo impressão sem números.", "warning");
                }
                setIsPrinting(true);
            },
            onCancel: () => {
                setDeleteModal(null);
                setIsPrinting(true);
            }
        });
    };

    const handleExportCSV = () => {
        if (!filteredAnalysis.length) return addToast("Sem dados para exportar.", "info");
        const seriesList = filteredAnalysis.map(a => a.Serie);
        downloadFileFromAPI('/export/routes/analysis', `rota_${selectedRoute?.name || 'analise'}.csv`, {
            contract_id: contractId,
            route_name: selectedRoute?.name
        }, 'POST', seriesList);
    };

    if (isPrinting && selectedRoute) {
        return <RoutePrint
            route={selectedRoute}
            analysis={analysis}
            extrasMeta={extrasMeta}
            onBack={() => setIsPrinting(false)}
        />;
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
            {/* Tab Navigation - Legacy Visual */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-8 shrink-0 transition-colors">
                <button
                    onClick={() => handleTabChange('routes')}
                    className={cn(
                        "flex items-center gap-2 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
                        activeTab === 'routes' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
                    )}
                >
                    <LayoutList size={16} />
                    MINHAS ROTAS
                </button>
                <button
                    onClick={() => handleTabChange('planning')}
                    className={cn(
                        "flex items-center gap-2 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
                        activeTab === 'planning' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
                    )}
                >
                    <Calendar size={16} />
                    CALENDÁRIO
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'planning' ? (
                <div className="flex-1 overflow-hidden">
                    <RoutePlanner />
                </div>
            ) : (
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar: Route List */}
                    <div className="w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                            <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Map size={14} className="text-primary" />
                                ROTAS SALVAS
                            </h2>
                            <button 
                                onClick={() => { setIsCreating(true); setSelectedRoute(null); }} 
                                className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-all"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        {/* Creation Mode Panel */}
                        {isCreating ? (
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nome Identificador</label>
                                    <input
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-bold bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                                        placeholder="EX: ROTA NORTE"
                                        value={newRouteName}
                                        onChange={e => setNewRouteName(e.target.value)}
                                    />
                                </div>

                                <RouteFilterBuilder
                                    initialFilters={newRouteFilters}
                                    onFiltersChange={setNewRouteFilters}
                                    contract_id={contractId}
                                />

                                {excludedSeries.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest mb-1">Excluídos ({excludedSeries.length})</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {excludedSeries.map((serie, i) => (
                                                <div key={i} className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full">
                                                    <span>{serie}</span>
                                                    <button onClick={() => handleRestoreSerie(serie)} className="hover:text-red-900"><X size={10} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {newRouteFilters.length === 0 && (
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Inserção Manual (Séries)</label>
                                        <textarea
                                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-[10px] h-20 mt-1 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono dark:text-white"
                                            placeholder="Cole as séries separadas por vírgula..."
                                            value={newRouteSeries}
                                            onChange={e => setNewRouteSeries(e.target.value)}
                                        />
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button onClick={handleCreateRoute} className="flex-1 bg-primary text-white text-[10px] font-bold uppercase py-2.5 rounded-lg hover:bg-primary/90 transition-all shadow-md shadow-primary/10">Gravar Rota</button>
                                    <button onClick={() => { setIsCreating(false); setAnalysis([]); setSelectedRoute(null); setExcludedSeries([]); }} className="flex-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase py-2.5 rounded-lg hover:bg-slate-200 transition-all">Cancelar</button>
                                </div>
                            </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {routes.map(r => (
                                    <div
                                        key={r.name}
                                        onClick={() => handleAnalyze(r)}
                                        className={cn(
                                            "p-4 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-all flex justify-between group",
                                            selectedRoute?.name === r.name ? "bg-white dark:bg-slate-800 border-l-4 border-l-primary shadow-sm" : "hover:bg-white dark:hover:bg-slate-800"
                                        )}
                                    >
                                        <div>
                                            <div className={cn("text-sm font-bold", selectedRoute?.name === r.name ? "text-primary" : "text-slate-700 dark:text-slate-200")}>{r.name}</div>
                                            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase mt-0.5 tracking-tight">{r.series?.length || 0} Equipamentos na Rota</div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteRoute(r.name); }}
                                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 p-1 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Main Analysis Area */}
                    <div className="flex-1 min-w-0 flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
                        {selectedRoute ? (
                            <>
                                <div className="h-20 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 bg-white dark:bg-slate-900 shrink-0 shadow-sm z-10 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary/10 text-primary rounded-xl">
                                            <Map size={24} />
                                        </div>
                                        <div>
                                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{selectedRoute.name}</h1>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">ROTA ATIVA</span>
                                                {excludedSeries.length > 0 && (
                                                    <span className="text-xs text-red-500 font-semibold ml-2">{excludedSeries.length} excluído{excludedSeries.length !== 1 ? 's' : ''}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEditRoute(selectedRoute)}
                                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-bold uppercase transition-all shadow-sm"
                                        >
                                            <Edit size={14} /> Configurar
                                        </button>
                                        <button
                                            onClick={handlePrintRoute}
                                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-bold uppercase transition-all shadow-sm"
                                        >
                                            <Printer size={14} /> Imprimir Rota
                                        </button>
                                        <ColumnManager columns={columns} onChange={setColumns} />
                                        <ExportButton
                                            tableId="route-analysis"
                                            data={sortedAnalysis}
                                            visibleColumns={visibleColumns}
                                            backendEndpoint="/export/routes/analysis"
                                            backendParams={{ contract_id: contractId, route_name: selectedRoute?.name }}
                                            backendFilename={`rota_${selectedRoute?.name || 'analise'}.csv`}
                                        />
                                        <button
                                            onClick={handleGenerate}
                                            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 text-[11px] font-bold uppercase transition-all shadow-lg shadow-primary/20 active:scale-95"
                                        >
                                            <Check size={14} /> Gerar Pedidos
                                        </button>
                                    </div>
                                </div>

                                {/* Filter Bar */}
                                <div className="bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 px-8 py-3 flex gap-6 items-center shrink-0 backdrop-blur-md">
                                    <div className="relative flex-1 max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4" />
                                        <input
                                            className="pl-10 pr-4 py-2 text-sm border-none bg-slate-100 dark:bg-slate-800 rounded-xl w-full focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                                            placeholder="Filtrar Identificador, Fila ou Local..."
                                            value={filterText}
                                            onChange={e => setFilterText(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Classificar:</span>
                                        <select
                                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 dark:text-slate-300 transition-all"
                                            value={filterStatus}
                                            onChange={e => setFilterStatus(e.target.value)}
                                        >
                                            <option value="all">TODOS</option>
                                            <option value="needs">COM ALERTA</option>
                                            <option value="toner">TONER BAIXO</option>
                                            <option value="stock">PAPEL BAIXO</option>
                                        </select>
                                        <button
                                            onClick={() => setIsLegendOpen(true)}
                                            className="p-2 text-slate-400 hover:text-primary transition-colors"
                                        >
                                            <HelpCircle size={18} />
                                        </button>
                                    </div>
                                    <div className="ml-auto flex items-center gap-1.5 py-1 px-3 bg-primary/10 rounded-full border border-primary/20">
                                        <span className="text-[10px] font-bold text-primary uppercase">EXIBINDO:</span>
                                        <span className="text-[10px] font-bold text-primary/60">{filteredAnalysis.length}/{analysis.length} Equipamentos</span>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-hidden p-6">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                                            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                                            <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Carregando...</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-full transition-colors">
                                            {currentAnalysis.length > 0 ? (
                                                <>
                                                    <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                                                        <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[1100px]">
                                                            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
                                                                <tr>
                                                                    {/* Coluna de exclusão — só em modo de edição */}
                                                                    {isCreating && (
                                                                        <th className="px-2 py-4 w-10 border-b border-slate-200 dark:border-slate-800 text-center sticky left-0 bg-slate-50 dark:bg-slate-900 z-20">
                                                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">–</span>
                                                                        </th>
                                                                    )}
                                                                    {visibleColumns.map((col) => (
                                                                        <ResizableHeader
                                                                            key={col.key}
                                                                            columnKey={col.key}
                                                                            width={widths[col.key]}
                                                                            onResize={(k, w) => setColumnWidth(k, w)}
                                                                            onResizeEnd={(k, w) => setColumnWidth(k, w)}
                                                                            className={cn(
                                                                                "px-4 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[9px] cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800",
                                                                                col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                                                                            )}
                                                                            style={{ width: widths[col.key] ? `${widths[col.key]}px` : col.w, minWidth: col.w }}
                                                                            onClick={() => requestSort(col.key)}
                                                                        >
                                                                            <div className={cn("flex items-center gap-1", col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start')}>
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
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                {currentAnalysis.map((item, idx) => (
                                                                    <tr key={idx} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all">
                                                                        {/* Botão de exclusão — só em modo de edição */}
                                                                        {isCreating && (
                                                                            <td className="px-2 py-4 w-10 text-center">
                                                                                <button
                                                                                    onClick={() => handleExcludeSerie(item.Serie)}
                                                                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all"
                                                                                    title={`Remover ${item.Serie} da rota`}
                                                                                >
                                                                                    <UserX size={13} />
                                                                                </button>
                                                                            </td>
                                                                        )}
                                                                        {visibleColumns.map(col => {
                                                                            switch (col.key) {
                                                                                case 'Serie': return (
                                                                                    <td key={col.key} className="px-4 py-4">
                                                                                        <div className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{item.Serie}</div>
                                                                                        <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-0.5">{item.Modelo}</div>
                                                                                    </td>
                                                                                );
                                                                                case 'Fila': return <td key={col.key} className="px-4 py-4 text-slate-500 dark:text-slate-400 font-bold truncate max-w-[120px]" title={item.Fila}>{item.Fila || "-"}</td>;
                                                                                case 'Local': return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 font-medium truncate max-w-[200px]" title={item.Local}>{item.Local}</td>;
                                                                                case 'Contato': return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 text-[10px] font-bold truncate max-w-[140px]" title={item.Contato}>{item.Contato || "-"}</td>;
                                                                                case 'Contador_Atual': return <td key={col.key} className="px-4 py-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{item.Contador_Atual?.toLocaleString()}</td>;
                                                                                case 'Estoque_Estimado': return (
                                                                                    <td key={col.key} className={cn(
                                                                                        "px-4 py-4 text-right font-mono font-bold",
                                                                                        item.Estoque_Estimado < 500 ? 'text-red-500' : 'text-emerald-500'
                                                                                    )}>
                                                                                        {(item.Estoque_Estimado / 500).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                                                    </td>
                                                                                );
                                                                                case 'Sugestao_A4': return (
                                                                                    <td key={col.key} className="px-4 py-4 text-center">
                                                                                        {item.Sugestao_A4 > 0 ? (
                                                                                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold border border-primary/20 shadow-sm animate-pulse">
                                                                                                {item.Sugestao_A4}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-slate-200">-</span>
                                                                                        )}
                                                                                    </td>
                                                                                );
                                                                                case 'TonerLevel_BK': return (
                                                                                    <td key={col.key} className="px-1 py-4 text-center">
                                                                                        <span className={cn("text-[10px] font-bold p-1 rounded",
                                                                                            item.TonerLevel_BK <= 30 && item.TonerLevel_BK > 0
                                                                                                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
                                                                                                : "text-slate-500 dark:text-slate-400"
                                                                                        )}>
                                                                                            {item.TonerLevel_BK > 0 ? `${item.TonerLevel_BK}%` : '-'}
                                                                                        </span>
                                                                                    </td>
                                                                                );
                                                                                case 'TonerLevel_CY': return (
                                                                                    <td key={col.key} className="px-1 py-4 text-center">
                                                                                        <span className={cn("text-[10px] font-bold p-1 rounded",
                                                                                            item.TonerLevel_CY <= 30 && item.TonerLevel_CY > 0
                                                                                                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
                                                                                                : "text-slate-500 dark:text-slate-400"
                                                                                        )}>
                                                                                            {item.TonerLevel_CY > 0 ? `${item.TonerLevel_CY}%` : '-'}
                                                                                        </span>
                                                                                    </td>
                                                                                );
                                                                                case 'TonerLevel_MG': return (
                                                                                    <td key={col.key} className="px-1 py-4 text-center">
                                                                                        <span className={cn("text-[10px] font-bold p-1 rounded",
                                                                                            item.TonerLevel_MG <= 30 && item.TonerLevel_MG > 0
                                                                                                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
                                                                                                : "text-slate-500 dark:text-slate-400"
                                                                                        )}>
                                                                                            {item.TonerLevel_MG > 0 ? `${item.TonerLevel_MG}%` : '-'}
                                                                                        </span>
                                                                                    </td>
                                                                                );
                                                                                case 'TonerLevel_YW': return (
                                                                                    <td key={col.key} className="px-1 py-4 text-center">
                                                                                        <span className={cn("text-[10px] font-bold p-1 rounded",
                                                                                            item.TonerLevel_YW <= 30 && item.TonerLevel_YW > 0
                                                                                                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
                                                                                                : "text-slate-500 dark:text-slate-400"
                                                                                        )}>
                                                                                            {item.TonerLevel_YW > 0 ? `${item.TonerLevel_YW}%` : '-'}
                                                                                        </span>
                                                                                    </td>
                                                                                );
                                                                                case 'Status_Calculado': return (
                                                                                    <td key={col.key} className="px-4 py-4">
                                                                                        <div className="flex flex-wrap gap-1.5 min-w-[150px]">
                                                                                            {item.Status_Calculado.split(',').map((statusPart, i) => {
                                                                                                const s = statusPart.trim();
                                                                                                if (!s || s === 'OK') return (
                                                                                                    <span key={i} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                                                                                                        style={{ color: 'rgb(var(--color-primary))', backgroundColor: 'rgb(var(--color-primary) / 0.08)', borderColor: 'rgb(var(--color-primary) / 0.2)' }}>
                                                                                                        SAUDÁVEL
                                                                                                    </span>
                                                                                                );
                                                                                                let badgeClass = "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700";
                                                                                                if (s.includes("Estoque") || s.includes("Toner")) badgeClass = "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 animate-pulse";
                                                                                                if (s.includes("Crítico")) badgeClass = "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
                                                                                                return (
                                                                                                    <span key={i} className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase border whitespace-nowrap", badgeClass)}>
                                                                                                        {s}
                                                                                                    </span>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                    </td>
                                                                                );
                                                                                default: return <td key={col.key} className="px-4 py-4">{item[col.key]}</td>;
                                                                            }
                                                                        })}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 transition-colors">
                                                        <Pagination {...paginationProps} />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
                                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-full">
                                                        <AlertTriangle size={32} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nenhum equipamento encontrado</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                                                            Os equipamentos desta rota não foram encontrados. Verifique os filtros ou reconfigure a rota.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center gap-4 transition-colors">
                                <Map size={64} className="opacity-10 text-primary" />
                                <div className="max-w-xs space-y-2">
                                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Painel de Rotas</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Selecione uma rota na lista ao lado ou crie uma nova.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isLegendOpen && (
                <StatusLegendModal onClose={() => setIsLegendOpen(false)} />
            )}

            {deleteModal && (
                <GenericDeleteModal
                    title={deleteModal.title}
                    message={deleteModal.message}
                    targetId={deleteModal.targetId}
                    requireTyping={deleteModal.requireTyping ?? false}
                    variant={deleteModal.variant || "danger"}
                    icon={deleteModal.icon}
                    confirmLabel={deleteModal.confirmLabel}
                    cancelLabel={deleteModal.cancelLabel}
                    onClose={() => setDeleteModal(null)}
                    onCancel={deleteModal.onCancel}
                    onConfirm={deleteModal.onConfirm}
                />
            )}
        </div>
    );
}
