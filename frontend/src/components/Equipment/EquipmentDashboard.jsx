import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Activity, Search, Server, AlertTriangle, Monitor, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { useSortableData } from '../../hooks/useSortableData';
import { useColumns } from '../../hooks/useColumns';
import { useColumnWidths } from '../../hooks/useColumnWidths';
import { downloadFileFromAPI, cn } from '../../lib/utils';
import EquipmentModal from './EquipmentModal';
import ColumnManager from '../Shared/ColumnManager';
import ExportButton from '../Shared/ExportButton';
import ResizableHeader from '../Shared/ResizableHeader';

const EQUIPMENT_COLUMNS = [
    { key: 'Serie',           label: 'Série',           minW: '140px' },
    { key: 'Fila',            label: 'Fila / Hostname', minW: '120px' },
    { key: 'ModeloSimpress',  label: 'Modelo',          minW: '180px' },
    { key: 'STATUS',          label: 'Status',          minW: '140px' },
    { key: '_toner',          label: 'Toner',           minW: '90px' },
    { key: 'Empresa',         label: 'Unidade',         minW: '220px' },
    { key: 'LocalInstalacao', label: 'Local Instalação',minW: '200px' },
];

// Mini toner level indicator with percentage numbers
function TonerBars({ bk, cy, mg, yw }) {
    const parse = (v) => {
        if (!v && v !== 0) return null;
        const n = parseFloat(String(v).replace('%', '').trim());
        return isNaN(n) ? null : n;
    };

    const bkVal = parse(bk);
    const cyVal = parse(cy);
    const mgVal = parse(mg);
    const ywVal = parse(yw);

    const hasColor = [cyVal, mgVal, ywVal].some(v => v !== null && v > 0);
    const hasBk = bkVal !== null;

    if (!hasBk && !hasColor) {
        return <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">—</span>;
    }

    const bars = [
        { label: 'BK', val: bkVal, color: 'bg-slate-700 dark:bg-slate-300', show: hasBk },
        { label: 'CY', val: cyVal, color: 'bg-cyan-500', show: hasColor },
        { label: 'MG', val: mgVal, color: 'bg-pink-500', show: hasColor },
        { label: 'YW', val: ywVal, color: 'bg-yellow-400', show: hasColor },
    ].filter(b => b.show);

    return (
        <div className="flex items-end gap-1.5">
            {bars.map(({ label, val, color }) => {
                const pct = val ?? 0;
                const isLow = pct > 0 && pct <= 20;
                const isEmpty = val === null;
                return (
                    <div key={label} className="flex flex-col items-center gap-0.5">
                        <span className={`text-[9px] font-bold tabular-nums ${isLow ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                            {isEmpty ? '—' : `${Math.round(pct)}%`}
                        </span>
                        <div className={`w-4 h-6 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden relative ${isLow ? 'ring-1 ring-red-400' : ''}`}>
                            <div
                                className={`absolute bottom-0 left-0 right-0 ${color} transition-all`}
                                style={{ height: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">{label}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default function EquipmentDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const contractId = user?.activeContract;

    const [trends, setTrends] = useState(null);
    const [loading, setLoading] = useState(true);

    // Table State
    const [searchTerm, setSearchTerm] = useState('');
    const [tableData, setTableData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [page, setPage] = useState(1);
    const itemsPerPage = 10;

    // Modal State
    const [selectedEquipment, setSelectedEquipment] = useState(null);

    // Filter States
    const [statusFilter, setStatusFilter] = useState('all');
    const [cityFilter, setCityFilter] = useState('all');
    const [contractFilter, setContractFilter] = useState('all');
    const [availableStatuses, setAvailableStatuses] = useState([]);
    const [availableCities, setAvailableCities] = useState([]);

    useEffect(() => {
        if (!contractId) return;

        const loadDashboard = async () => {
            setLoading(true);
            try {
                const [resTrends, resInventory] = await Promise.all([
                    api.get('data/assist/dashboard', { params: { contract_id: contractId } }),
                    api.get('data/assist/inventory', { params: { contract_id: contractId } })
                ]);

                setTrends(resTrends.data);
                const mapData = Array.isArray(resInventory.data) ? resInventory.data : [];
                setTableData(mapData);
                setFilteredData(mapData);

                // Extract unique filters
                const statuses = [...new Set(mapData.map(item => item.Status || item.STATUS).filter(Boolean))].sort();
                const cities = [...new Set(mapData.map(item => item.Cidade).filter(Boolean))].sort();
                setAvailableStatuses(statuses);
                setAvailableCities(cities);
            } catch (err) {
                console.error('Equipment dashboard error:', err);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [contractId]);

    // Handle Filters
    useEffect(() => {
        let data = [...tableData];

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(item =>
                (item.Serie || '').toLowerCase().includes(lower) ||
                (item.Fila || '').toLowerCase().includes(lower) ||
                (item.ModeloSimpress || '').toLowerCase().includes(lower) ||
                (item.Empresa || '').toLowerCase().includes(lower)
            );
        }

        if (statusFilter !== 'all') {
            if (statusFilter === '__non_prod__') {
                data = data.filter(item => {
                    const s = (item.STATUS || item.Status || '').toLowerCase();
                    return s && !s.includes('produ');
                });
            } else {
                data = data.filter(item => (item.STATUS || item.Status) === statusFilter);
            }
        }

        if (cityFilter !== 'all') {
            data = data.filter(item => item.Cidade === cityFilter);
        }

        if (contractFilter !== 'all') {
            data = data.filter(item => (item.Contrato || 'Sem Contrato') === contractFilter);
        }

        setFilteredData(data);
        setPage(1);
    }, [searchTerm, tableData, statusFilter, cityFilter, contractFilter]);

    // CSV Export
    const handleExportInventory = () => {
        downloadFileFromAPI('/export/inventory', `inventario_${contractId}.csv`, { contract_id: contractId });
    };

    // Sorting & Pagination
    const { items: sortedData, requestSort, sortConfig } = useSortableData(filteredData);
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedItems = sortedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const { columns, setColumns, visibleColumns } = useColumns('equipment-columns', EQUIPMENT_COLUMNS);
    const { widths, setColumnWidth } = useColumnWidths('equipment-columns');

    // Color helpers
    const getStatusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (s.includes('produ') || s.includes('ativo')) return 'bg-emerald-500';
        if (s.includes('backup')) return 'bg-amber-500';
        if (s.includes('manuten') || s.includes('troca')) return 'bg-red-500';
        return 'bg-primary';
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center gap-4 text-slate-400">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                <p className="text-sm font-bold uppercase tracking-widest">Carregando Painel...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPI Cards Redesenhados */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 shrink-0">
                {/* Card 1: Visão Geral (clicável para futuro BI) */}
                <button
                    onClick={() => navigate('/equipment/bi')}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-3 hover:shadow-lg hover:border-primary/30 transition-all text-left group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                            <Server className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Resumo da Frota</p>
                    </div>

                    <div className="flex items-end justify-between gap-2">
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white leading-none">{trends?.total || tableData.length}</h3>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Marcas</p>
                            <p className="text-xl font-bold text-slate-700 dark:text-slate-200 leading-none">
                                {[...new Set(tableData.map(i => i.Marca || i.MARCA).filter(Boolean))].length || '—'}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Modelos</p>
                            <p className="text-xl font-bold text-slate-700 dark:text-slate-200 leading-none">
                                {[...new Set(tableData.map(i => i.ModeloSimpress || i.Modelo).filter(Boolean))].length}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <Monitor className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold text-primary">Ver Análise Detalhada →</span>
                    </div>
                </button>

                {/* Card 2: Status Breakdown (cada status clicável) */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-2">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            <Activity className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Por Situação</p>
                    </div>
                    <div className="space-y-1.5">
                        {[
                            { label: 'Em Produção', key: 'produ', color: 'emerald' },
                            { label: 'Backup', key: 'backup', color: 'amber' },
                            { label: 'Aguardando Recolha', key: 'recolha', color: 'red' },
                            { label: 'Em Manutenção', key: 'manuten', color: 'slate' },
                        ].map(({ label, key, color }) => {
                            const count = tableData.filter(item => {
                                const s = (item.STATUS || item.Status || '').toLowerCase();
                                return s.includes(key);
                            }).length;
                            const colorMap = {
                                emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
                                amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30',
                                red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30',
                                slate: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700',
                            };
                            return (
                                <button
                                    key={key}
                                    onClick={() => {
                                        const fullStatus = availableStatuses.find(s => s.toLowerCase().includes(key));
                                        if (fullStatus) {
                                            setStatusFilter(prev => prev === fullStatus ? 'all' : fullStatus);
                                        }
                                    }}
                                    className={cn("w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all", colorMap[color])}
                                >
                                    <span>{label}</span>
                                    <span className="tabular-nums">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Card 3: Por Contrato (cada contrato clicável) */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-2">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <FileText className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Por Contrato</p>
                    </div>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                        {(() => {
                            const byContract = {};
                            tableData.forEach(item => {
                                const c = item.Contrato || 'Sem Contrato';
                                byContract[c] = (byContract[c] || 0) + 1;
                            });
                            return Object.entries(byContract)
                                .sort((a, b) => b[1] - a[1])
                                .map(([contrato, count]) => (
                                    <button
                                        key={contrato}
                                        onClick={() => setContractFilter(prev => prev === contrato ? 'all' : contrato)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                                            contractFilter === contrato
                                                ? "text-white"
                                                : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                        )}
                                        style={contractFilter === contrato ? { backgroundColor: 'rgb(var(--color-primary))', color: 'white' } : {}}
                                    >
                                        <span className="truncate">{contrato}</span>
                                        <span className="tabular-nums ml-2">{count}</span>
                                    </button>
                                ));
                        })()}
                    </div>
                </div>

                {/* Card 4: Alertas Críticos (clicável) */}
                <button
                    onClick={() => {
                        // Filtrar todos equipamentos fora de produção via busca
                        setSearchTerm('');
                        setStatusFilter('all');
                        setContractFilter('all');
                        // Aplicar filtro customizado via searchTerm não é ideal
                        // Melhor: usar um filtro especial "não produção"
                        setStatusFilter('__non_prod__');
                    }}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex items-center gap-4 hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-700 transition-all text-left group"
                >
                    <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Fora de Produção</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                            {tableData.filter(item => {
                                const s = (item.STATUS || item.Status || '').toLowerCase();
                                return !s.includes('produ');
                            }).length}
                        </h3>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium mt-1">Equipamentos inativos</p>
                    </div>
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-0 transition-colors">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Lista de Equipamentos</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Todos os equipamentos cadastrados no contrato</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        {/* Badge de filtro ativo */}
                        {(statusFilter !== 'all' || contractFilter !== 'all') && (
                            <button
                                onClick={() => { setStatusFilter('all'); setContractFilter('all'); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
                                style={{ backgroundColor: 'rgb(var(--color-primary))' }}
                            >
                                ✕ Limpar filtros
                            </button>
                        )}
                        <div className="relative flex-1 md:flex-none md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <input
                                type="text"
                                placeholder="Série, Fila, Modelo..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <select
                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all" className="dark:bg-slate-900">Status: Todos</option>
                            {availableStatuses.map(s => <option key={s} value={s} className="dark:bg-slate-900">{s}</option>)}
                        </select>

                        <select
                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            value={cityFilter}
                            onChange={(e) => setCityFilter(e.target.value)}
                        >
                            <option value="all" className="dark:bg-slate-900">Unidade: Todas</option>
                            {availableCities.map(c => <option key={c} value={c} className="dark:bg-slate-900">{c}</option>)}
                        </select>

                        <ColumnManager columns={columns} onChange={setColumns} />
                        <ExportButton
                            tableId="equipment"
                            data={sortedData}
                            visibleColumns={visibleColumns}
                            backendEndpoint="/export/inventory"
                            backendParams={{ contract_id: contractId }}
                            backendFilename={`inventario_${contractId}.csv`}
                        />
                    </div>
                </div>

                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[1000px]">
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
                                        style={{ minWidth: widths[col.key] ? `${widths[col.key]}px` : col.minW }}
                                        onClick={() => requestSort(col.key)}
                                    >
                                        <div className="flex items-center gap-2">
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
                            {paginatedItems.map((item, i) => (
                                <tr
                                    key={i}
                                    onClick={() => setSelectedEquipment(item.Serie)}
                                    className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-all border-b border-slate-50 dark:border-slate-800"
                                >
                                    {visibleColumns.map(col => {
                                        switch (col.key) {
                                            case 'Serie':
                                                return <td key={col.key} className="px-4 py-4 font-mono font-bold text-primary group-hover:text-primary/80 transition-colors">{item.Serie}</td>;
                                            case 'Fila':
                                                return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 font-medium">{item.Fila}</td>;
                                            case 'ModeloSimpress':
                                                return <td key={col.key} className="px-4 py-4 text-slate-800 dark:text-white font-bold">{item.ModeloSimpress || item.Modelo || '—'}</td>;
                                            case 'STATUS':
                                                return (
                                                    <td key={col.key} className="px-4 py-4">
                                                        {(() => {
                                                            const status = item.STATUS || item.Status || '';
                                                            return (
                                                                <span className={cn(
                                                                    "px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border",
                                                                    status.toLowerCase().includes('produ')
                                                                        ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                                                                        : status.toLowerCase().includes('backup')
                                                                            ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30'
                                                                            : status
                                                                                ? 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50'
                                                                                : 'border-transparent text-slate-300 dark:text-slate-600'
                                                                )}>
                                                                    {status || '—'}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                );
                                            case '_toner':
                                                return (
                                                    <td key={col.key} className="px-4 py-3">
                                                        <TonerBars bk={item.toner_bk} cy={item.toner_cy} mg={item.toner_mg} yw={item.toner_yw} />
                                                    </td>
                                                );
                                            case 'Empresa':
                                                return (
                                                    <td key={col.key} className="px-4 py-4">
                                                        <div className="text-slate-700 dark:text-slate-300 font-medium">{item.Empresa}</div>
                                                        <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">{item.Cidade}</div>
                                                    </td>
                                                );
                                            case 'LocalInstalacao':
                                                return (
                                                    <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 text-xs" title={[item.LocalInstalacao, item.RuaRef].filter(Boolean).join(' · ') || item.ENDERECO}>
                                                        <div>{item.LocalInstalacao || item.ENDERECO || '—'}</div>
                                                        {item.RuaRef && item.RuaRef !== item.LocalInstalacao && (
                                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{item.RuaRef}</div>
                                                        )}
                                                    </td>
                                                );
                                            default:
                                                return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400">{item[col.key]}</td>;
                                        }
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0 transition-colors">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-all active:scale-95 shadow-sm"
                    >
                        Anterior
                    </button>
                    <span className="text-slate-400 dark:text-slate-500 font-medium text-xs">
                        Página <strong className="text-slate-800 dark:text-white">{page}</strong> de <strong className="text-slate-800 dark:text-white">{totalPages}</strong>
                        <span className="mx-2 text-slate-200 dark:text-slate-800">|</span>
                        <strong className="text-primary">{filteredData.length}</strong> dispositivos
                    </span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-all active:scale-95 shadow-sm"
                    >
                        Próxima
                    </button>
                </div>
            </div>

            {/* Modal */}
            {selectedEquipment && (
                <EquipmentModal
                    serie={selectedEquipment}
                    activeContract={contractId}
                    onClose={() => setSelectedEquipment(null)}
                />
            )}
        </div>
    );
}

function Card({ title, value, icon, color, sub }) {
    const colorMap = {
        indigo: { icon: 'text-primary bg-primary/10', border: 'border-primary/20' },
        emerald: { icon: 'text-emerald-600 bg-emerald-100', border: 'border-emerald-100' },
        blue: { icon: 'text-blue-600 bg-blue-100', border: 'border-blue-100' },
        amber: { icon: 'text-amber-600 bg-amber-100', border: 'border-amber-100' }
    };

    const c = colorMap[color] || colorMap.indigo;

    return (
        <div className={cn("bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-all")}>
            <div className={cn("p-3 rounded-2xl", c.icon)}>
                {icon}
            </div>
            <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</h3>
                {sub && (
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium mt-1">{sub}</p>
                )}
            </div>
        </div>
    );
}
