import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthProvider';
import { Calendar, Map, CheckCircle, ArrowRight, Loader, Search, Settings, Save, X, CalendarClock, ArrowUp, ArrowDown } from 'lucide-react';
import Pagination from '../Shared/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { useSortableData } from '../../hooks/useSortableData';
import { useColumns } from '../../hooks/useColumns';
import { useColumnWidths } from '../../hooks/useColumnWidths';
import GenericDeleteModal from '../Shared/GenericDeleteModal';
import ColumnManager from '../Shared/ColumnManager';
import ExportButton from '../Shared/ExportButton';
import ResizableHeader from '../Shared/ResizableHeader';
import { cn } from '../../lib/utils';

const PLANNER_COLUMNS = [
    { key: 'status_color', label: 'Status',        w: '50px' },
    { key: 'last_delivery',label: 'Última Entrega', w: '110px' },
    { key: 'name',         label: 'Rota / Rua',    w: undefined },
    { key: 'series_count', label: 'No. Equip.',    w: '90px', align: 'center' },
    { key: 'days_elapsed', label: 'Dias Corridos', w: '100px', align: 'center' },
    { key: 'status',       label: 'Situação',      w: '160px' },
    { key: 'data_agendada',label: 'Data Agendada', w: '150px' },
];

export default function RoutePlanner() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [planningData, setPlanningData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState({ cycle_days_threshold: 26, alert_enabled: true });

    // Editing State (Date)
    const [editingRoute, setEditingRoute] = useState(null); // name of route being edited
    const [editDate, setEditDate] = useState("");
    const [deleteModal, setDeleteModal] = useState(null); // { title, message, targetId, onConfirm }

    const contractId = user?.activeContract || user?.contract_id;

    // Filter & Pagination
    const filteredData = React.useMemo(() => {
        if (!searchTerm) return planningData;
        const lower = searchTerm.toLowerCase();
        return planningData.filter(row =>
            row.name.toLowerCase().includes(lower) ||
            row.status.toLowerCase().includes(lower)
        );
    }, [planningData, searchTerm]);



    // Sorting & Pagination
    const { items: sortedData, requestSort, sortConfig } = useSortableData(filteredData);
    const { currentData: currentPlanningData, paginationProps } = usePagination(sortedData, 10);
    const { columns, setColumns, visibleColumns } = useColumns('planner-columns', PLANNER_COLUMNS);
    const { widths, setColumnWidth } = useColumnWidths('planner-columns');

    useEffect(() => {
        fetchPlanning();
        fetchSettings();
    }, [contractId]);

    const fetchPlanning = async () => {
        try {
            const res = await api.get('routes/planning', { params: { contract_id: contractId } });
            setPlanningData(res.data);
        } catch (error) {

        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await api.get('routes/settings', { params: { contract_id: contractId } });
            if (res.data) setSettings(res.data);
        } catch (error) {

        }
    };

    const saveSettings = async () => {
        try {
            await api.post('routes/settings', settings, { params: { contract_id: contractId } });
            setShowSettings(false);
            fetchPlanning(); // Refresh to apply new threshold
        } catch (error) {
            addToast("Erro ao salvar configurações", "error");
        }
    };

    const handleOpenRoute = (routeName) => {
        navigate(`/routes?name=${encodeURIComponent(routeName)}`);
    };

    const handleExportCSV = () => {
        downloadFileFromAPI('/export/routes/planning', 'planejamento_rotas.csv', { contract_id: contractId });
    };

    const handleEditDate = (row) => {
        setEditingRoute(row.name);
        // data_agendada is formatted?? Or raw? Currently backend sends string. 
        // We will assume YYYY-MM-DD for input. If it's empty, empty.
        setEditDate(row.data_agendada || "");
    };

    const saveDate = async (rowName) => {
        try {
            await api.post(`/routes/${rowName}/metadata`,
                { scheduled_date: editDate },
                { params: { contract_id: contractId } }
            );
            setEditingRoute(null);
            fetchPlanning();
        } catch (error) {
            addToast("Erro ao salvar data", "error");
        }
    };

    const handleAutoSchedule = async (row) => {
        if (!row.last_delivery_iso) {
            addToast("Não há entrega anterior para calcular a próxima data.", "info");
            return;
        }

        try {
            const lastDate = new Date(row.last_delivery_iso);
            // Add 1 month
            lastDate.setMonth(lastDate.getMonth() + 1);

            const nextDate = lastDate.toISOString().split('T')[0]; // YYYY-MM-DD
            const formattedDate = nextDate.split('-').reverse().join('/');

            setDeleteModal({
                title: "Confirmar Agendamento",
                message: `Agendar automaticamente para ${formattedDate}? Isso atualizará os metadados da rota.`,
                targetId: row.name,
                icon: CalendarClock,
                variant: "info",
                requireTyping: false,
                confirmLabel: "Confirmar Agendamento",
                onConfirm: async () => {
                    setDeleteModal(null);
                    try {
                        await api.post(`/routes/${row.name}/metadata`,
                            { scheduled_date: nextDate },
                            { params: { contract_id: contractId } }
                        );
                        fetchPlanning();
                    } catch (e) {
                        addToast("Erro ao calcular data.", "error");
                    }
                }
            });
        } catch (e) {

            addToast("Erro ao calcular data.", "error");
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center text-slate-500 gap-2">
                <Loader className="animate-spin" /> Carregando planejamento...
            </div>
        );
    }

    // Traffic Light Component
    const TrafficLight = ({ color }) => {
    const { addToast } = useToast();
        const colors = {
            green: "bg-emerald-500 shadow-emerald-200",
            red: "bg-red-500 shadow-red-200",
            yellow: "bg-amber-400 shadow-amber-100",
            gray: "bg-slate-300"
        };
        return <div className={`w-3 h-3 rounded-full shadow-lg ${colors[color] || colors.gray}`} />;
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        <Calendar className="text-primary" /> Planejamento de Rotas
                    </h1>
                    <p className="text-slate-500">Gestão do ciclo de vida e agendamento de atendimentos.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition ${showSettings ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                    >
                        <Settings className="h-4 w-4" /> Config
                    </button>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 text-slate-400 h-4 w-4" />
                        <input
                            className="pl-9 pr-3 py-2 border rounded-lg w-64 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            placeholder="Buscar rota..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <ColumnManager columns={columns} onChange={setColumns} />
                        <ExportButton
                            tableId="planner"
                            data={sortedData}
                            visibleColumns={visibleColumns}
                            backendEndpoint="/export/routes/planning"
                            backendParams={{ contract_id: contractId }}
                            backendFilename="planejamento_rotas.csv"
                        />
                    </div>
                </div>
            </div>

            {/* Settings Toolbar */}
            {showSettings && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700 flex items-center gap-6 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ciclo de Alerta (Dias):</label>
                        <input
                            type="number"
                            className="w-20 border rounded p-1 text-center font-bold text-primary"
                            value={settings.cycle_days_threshold}
                            onChange={e => setSettings({ ...settings, cycle_days_threshold: Number(e.target.value) })}
                        />
                    </div>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                    <button
                        onClick={saveSettings}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-1.5 rounded text-sm hover:opacity-90"
                    >
                        <Save size={14} /> Salvar Parâmetros
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            {visibleColumns.map((col) => (
                                <ResizableHeader
                                    key={col.key}
                                    columnKey={col.key}
                                    width={widths[col.key]}
                                    onResize={(k, w) => setColumnWidth(k, w)}
                                    onResizeEnd={(k, w) => setColumnWidth(k, w)}
                                    className={`p-4 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${col.align === 'center' ? 'text-center' : 'text-left'}`}
                                    style={{ width: widths[col.key] ? `${widths[col.key]}px` : col.w }}
                                    onClick={() => requestSort(col.key)}
                                >
                                    <div className={`flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                        {col.label}
                                        {sortConfig?.key === col.key && (
                                            sortConfig.direction === 'ascending' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                        )}
                                    </div>
                                </ResizableHeader>
                            ))}
                            <th className="p-4 w-[50px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {currentPlanningData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 group transition-colors">
                                {visibleColumns.map(col => {
                                    switch (col.key) {
                                        case 'status_color':
                                            return <td key={col.key} className="p-4"><TrafficLight color={row.status_color} /></td>;
                                        case 'last_delivery':
                                            return <td key={col.key} className="p-4 font-mono text-sm text-slate-700 dark:text-slate-300">{row.last_delivery}</td>;
                                        case 'name':
                                            return <td key={col.key} className="p-4 font-medium text-slate-900 dark:text-white">{row.name}</td>;
                                        case 'series_count':
                                            return <td key={col.key} className="p-4 text-center text-slate-600">{row.series_count}</td>;
                                        case 'days_elapsed':
                                            return <td key={col.key} className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{row.days_elapsed >= 0 ? row.days_elapsed : '-'}</td>;
                                        case 'status':
                                            return (
                                                <td key={col.key} className="p-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${row.status_color === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : row.status_color === 'red' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : row.status_color === 'yellow' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                            );
                                        case 'data_agendada':
                                            return (
                                                <td key={col.key} className="p-4 text-sm">
                                                    {editingRoute === row.name ? (
                                                        <div className="flex items-center gap-2">
                                                            <input type="date" className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded p-1 text-xs w-32 outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={editDate} onChange={e => setEditDate(e.target.value)} />
                                                            <button onClick={() => saveDate(row.name)} className="text-green-600 hover:bg-green-100 p-1 rounded"><CheckCircle size={14} /></button>
                                                            <button onClick={() => setEditingRoute(null)} className="text-red-500 hover:bg-red-100 p-1 rounded"><X size={14} /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className="group/date flex items-center gap-2 cursor-pointer text-slate-600 hover:text-primary" onClick={() => handleEditDate(row)}>
                                                                {row.data_agendada ? (
                                                                    <span className="font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">{row.data_agendada}</span>
                                                                ) : (
                                                                    <span className="text-slate-400 italic text-xs">Agendar...</span>
                                                                )}
                                                            </div>
                                                            {row.last_delivery_iso && (
                                                                <button onClick={() => handleAutoSchedule(row)} className="p-1 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Agendar +1 Mês">
                                                                    <CalendarClock size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        default:
                                            return <td key={col.key} className="p-4 text-slate-600 dark:text-slate-400">{row[col.key]}</td>;
                                    }
                                })}
                                <td className="p-4 text-right">
                                    <button onClick={() => handleOpenRoute(row.name)} className="p-2 text-primary hover:bg-primary/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Abrir Detalhes">
                                        <ArrowRight size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {planningData.length === 0 && (
                            <tr>
                                <td colSpan="8" className="p-8 text-center text-slate-400">
                                    Nenhuma rota salva encontrada.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination {...paginationProps} />
            
            {deleteModal && (
                <GenericDeleteModal
                    title={deleteModal.title}
                    message={deleteModal.message}
                    targetId={deleteModal.targetId}
                    onClose={() => setDeleteModal(null)}
                    onConfirm={deleteModal.onConfirm}
                    icon={deleteModal.icon}
                    variant={deleteModal.variant}
                    confirmLabel={deleteModal.confirmLabel}
                />
            )}
        </div>
    );
}
