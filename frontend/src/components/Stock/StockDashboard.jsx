import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthProvider';
import { Package, RotateCcw, AlertTriangle, Plus, History, Check, Pencil, X, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import Pagination from '../Shared/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { useSortableData } from '../../hooks/useSortableData';
import { downloadFileFromAPI } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { useColumns } from '../../hooks/useColumns';
import { useColumnWidths } from '../../hooks/useColumnWidths';
import ColumnManager from '../Shared/ColumnManager';
import ExportButton from '../Shared/ExportButton';
import ResizableHeader from '../Shared/ResizableHeader';

const STOCK_LEVELS_COLUMNS = [
    { label: 'Item / Modelo', key: 'TipoModelo', align: 'left', minW: '200px' },
    { label: 'Categoria', key: 'Categoria', align: 'left', minW: '100px' },
    { label: 'Modelo Equip.', key: 'ModeloEquipamento', align: 'left', minW: '120px' },
    { label: 'Tipo Toner', key: 'TipoToner', align: 'left', minW: '80px' },
    { label: 'Cód. Sapiens', key: 'Codigo', align: 'left', minW: '120px' },
    { label: 'Estoque Atual', key: 'EstoqueAtual', align: 'right', minW: '150px' },
    { label: 'Último Movimento', key: 'UltimaAlteracao', align: 'left', minW: '180px' },
    { label: 'Unidade Matriz', key: 'Empresa', align: 'left', minW: '200px' },
];

const STOCK_HISTORY_COLUMNS = [
    { label: 'Data Movimentação', key: 'DataLancamento', minW: '180px' },
    { label: 'Classificação', key: 'TipoMaterial', minW: '120px' },
    { label: 'Modelo', key: 'Modelo', minW: '200px' },
    { label: 'Quantidade', key: 'Quantidade', minW: '80px' },
    { label: 'Movimento', key: 'TipoLancamento', minW: '120px' },
    { label: 'Colaborador', key: 'Colaborador', minW: '150px' },
    { label: 'Referência / Obs', key: 'ProtocoloOUPedido', minW: '180px' },
];

export default function StockDashboard() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const activeContract = user?.activeContract;
    const [activeTab, setActiveTab] = useState('levels');
    const [levels, setLevels] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Deletion State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Adjustment Modal
    const [showModal, setShowModal] = useState(false);
    const [adjustItem, setAdjustItem] = useState('');
    const [adjustQty, setAdjustQty] = useState(0);
    const [adjustReason, setAdjustReason] = useState('');
    const [adjustCode, setAdjustCode] = useState('');


    // Modal bifurcado: null | 'select' | 'new-item' | 'adjustment'
    const [modalMode, setModalMode] = useState(null);

    // Novo Item — estado do formulário de criação
    const [newItemCategoria, setNewItemCategoria] = useState('customizado');
    const [newItemModelo, setNewItemModelo] = useState('');
    const [newItemTipoToner, setNewItemTipoToner] = useState('BK');
    const [newItemTipoPapel, setNewItemTipoPapel] = useState('A4');
    const [newItemNome, setNewItemNome] = useState('');
    const [newItemQtd, setNewItemQtd] = useState(0);
    const [newItemEmpresa, setNewItemEmpresa] = useState('');
    const [newItemCodigo, setNewItemCodigo] = useState('');
    const [modelos, setModelos] = useState([]);
    const [creatingItem, setCreatingItem] = useState(false);

    const openModal = () => setModalMode('select');
    const closeModal = () => {
        setModalMode(null);
        setShowModal(false);
        setNewItemCategoria('customizado');
        setNewItemModelo('');
        setNewItemTipoToner('BK');
        setNewItemTipoPapel('A4');
        setNewItemNome('');
        setNewItemQtd(0);
        setNewItemEmpresa('');
        setNewItemCodigo('');
    };

    const loadModelos = async () => {
        try {
            const res = await api.get('stock/modelos', { params: { contract_id: contractId } });
            setModelos(Array.isArray(res.data) ? res.data : []);
        } catch { setModelos([]); }
    };

    const handleCreateItem = async () => {
        setCreatingItem(true);
        try {
            const payload = {
                categoria: newItemCategoria,
                quantidade_inicial: parseInt(newItemQtd) || 0,
                empresa: newItemEmpresa,
                codigo: newItemCodigo,
                user: user?.username || 'User',
            };
            if (newItemCategoria === 'toner') {
                payload.modelo_equipamento = newItemModelo;
                payload.tipo_toner = newItemTipoToner;
            } else if (newItemCategoria === 'papel') {
                payload.tipo_papel = newItemTipoPapel;
            } else {
                payload.nome = newItemNome;
            }
            await api.post('stock/item', payload, { params: { contract_id: contractId } });
            addToast('Item criado com sucesso!', 'success');
            closeModal();
            fetchData();
        } catch (_err) {
            const msg = _err.response?.data?.detail || 'Erro ao criar item';
            addToast(msg, 'error');
            // Não fecha o modal em caso de erro
        } finally {
            setCreatingItem(false);
        }
    };


    const contractId = user?.activeContract;

    const fetchData = useCallback(async () => {
        if (!contractId) return;
        setLoading(true);
        setError(null);
        try {
            const [resLevels, resHistory] = await Promise.all([
                api.get('stock/', { params: { contract_id: contractId } }),
                api.get('stock/history', { params: { contract_id: contractId } })
            ]);
            setLevels(Array.isArray(resLevels.data) ? resLevels.data : []);
            setHistory(Array.isArray(resHistory.data) ? resHistory.data : []);
        } catch (_err) {
            setError("Falha ao carregar dados de estoque");
            setLevels([]);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    }, [contractId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAdjust = async (extraData = {}) => {
        if (!adjustItem || adjustQty === 0) return;
        try {
            await api.post('stock/adjust', {
                item: adjustItem,
                qty: parseInt(adjustQty),
                reason: adjustReason,
                user: user?.username || 'User',
                code: adjustCode,
                nf: extraData.nf || '',
                protocolo: extraData.protocolo || '',
                fila: extraData.fila || '',
                empresa: extraData.empresa || '',
                type: adjustQty > 0 ? 'Entrada' : 'Saída'
            }, { params: { contract_id: contractId } });

            setShowModal(false);
            setAdjustItem('');
            setAdjustQty(0);
            setAdjustReason('');
            setAdjustCode('');
            fetchData();
        } catch (_err) {
            addToast("Falha ao ajustar estoque", "error");
        }
    };

    // Inline Editing
    const [editingRow, setEditingRow] = useState(null); 
    const [editValue, setEditValue] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    const startEditing = (row) => {
        setEditingRow(row.TipoModelo);
        setEditValue(row.EstoqueAtual);
    };

    const cancelEditing = () => {
        setEditingRow(null);
        setEditValue('');
    };

    const saveEditing = async (originalRow) => {
        const newValue = parseInt(editValue);
        const oldValue = parseInt(originalRow.EstoqueAtual);

        if (isNaN(newValue)) {
            addToast("Valor inválido", "warning");
            return;
        }

        if (newValue === oldValue) {
            cancelEditing();
            return;
        }

        const diff = newValue - oldValue;
        setEditSaving(true);
        try {
            await api.post('stock/adjust', {
                item: originalRow.TipoModelo,
                qty: diff,
                reason: 'Ajuste manual rápido (Tabela)',
                user: user?.username || 'User',
                empresa: originalRow.Empresa,
                type: diff > 0 ? 'Entrada' : 'Saída'
            }, { params: { contract_id: contractId } });

            await fetchData();
            cancelEditing();
        } catch (_err) {
            addToast("Erro ao salvar ajuste.", "error");
        } finally {
            setEditSaving(false);
        }
    };

    const handleDeleteClick = (item) => {
        setItemToDelete(item);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;

        try {
            await api.delete('stock/item', {
                params: {
                    contract_id: contractId,
                    item: itemToDelete.TipoModelo
                }
            });
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchData();
        } catch (_err) {
            addToast("Falha ao deletar item.", "error");
        }
    };


    // Pagination
    const { items: sortedLevels, requestSort: sortLevels, sortConfig: levelsSortConfig } = useSortableData(levels);
    const { items: sortedHistory, requestSort: sortHistory, sortConfig: historySortConfig } = useSortableData(history);

    const levelsPagination = usePagination(sortedLevels, 12);
    const historyPagination = usePagination(sortedHistory, 12);

    const { columns: levelsCols, setColumns: setLevelsCols, visibleColumns: visibleLevelsCols } = useColumns(`supply_stock_levels_cols_${user?.username}_${contractId}`, STOCK_LEVELS_COLUMNS);
    const { columns: historyCols, setColumns: setHistoryCols, visibleColumns: visibleHistoryCols } = useColumns(`supply_stock_history_cols_${user?.username}_${contractId}`, STOCK_HISTORY_COLUMNS);
    const { widths: levelsWidths, setColumnWidth: setLevelsWidth } = useColumnWidths(`supply_stock_levels_cols_${user?.username}_${contractId}`);
    const { widths: historyWidths, setColumnWidth: setHistoryWidth } = useColumnWidths(`supply_stock_history_cols_${user?.username}_${contractId}`);


    return (
        <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm">
                        <Package size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Gestão de Estoque</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Controle de insumos e peças do contrato <strong className="text-slate-700 dark:text-slate-300">{contractId}</strong></p>
                    </div>
                </div>
                <button
                    onClick={openModal}
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Novo Lançamento
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-8 border-b border-slate-200 dark:border-slate-800 shrink-0 px-2 bg-white dark:bg-slate-900 rounded-t-xl transition-colors">
                <button
                    onClick={() => setActiveTab('levels')}
                    className={cn(
                        "pb-4 pt-4 text-xs font-bold uppercase tracking-widest transition-all relative",
                        activeTab === 'levels' ? "text-primary" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    )}
                >
                    Estoque Atual
                    {activeTab === 'levels' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={cn(
                        "pb-4 pt-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all relative",
                        activeTab === 'history' ? "text-primary" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    )}
                >
                    <History className="w-4 h-4" /> Movimentações
                    {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
                </button>
                <div className="ml-auto flex items-center gap-2 pb-4 pt-4">
                    <ColumnManager 
                        columns={activeTab === 'levels' ? levelsCols : historyCols} 
                        onChange={activeTab === 'levels' ? setLevelsCols : setHistoryCols} 
                    />
                    {activeTab === 'levels' ? (
                        <ExportButton
                            tableId="stock-levels"
                            data={sortedLevels}
                            visibleColumns={visibleLevelsCols}
                            backendEndpoint="/export/stock/levels"
                            backendParams={{ contract_id: contractId }}
                            backendFilename="estoque_geral.csv"
                        />
                    ) : (
                        <ExportButton
                            tableId="stock-history"
                            data={sortedHistory}
                            visibleColumns={visibleHistoryCols}
                            backendEndpoint="/export/stock/history"
                            backendParams={{ contract_id: contractId }}
                            backendFilename="historico_movimentacoes.csv"
                        />
                    )}
                </div>
            </div>

            {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-600 p-4 rounded-xl shrink-0 text-sm font-medium">{error}</div>}

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-h-0">
                {activeTab === 'levels' && (
                    <>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 transition-colors">
                            <div className="overflow-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[850px]">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors">
                                        <tr>
                                            {visibleLevelsCols.map((col) => (
                                                <ResizableHeader
                                                    key={col.key}
                                                    columnKey={col.key}
                                                    width={levelsWidths[col.key]}
                                                    onResize={(k, w) => setLevelsWidth(k, w)}
                                                    onResizeEnd={(k, w) => setLevelsWidth(k, w)}
                                                    className={cn(
                                                        "px-4 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[9px] cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800",
                                                        col.align === 'right' ? "text-right" : "text-left"
                                                    )}
                                                    style={{ minWidth: levelsWidths[col.key] ? `${levelsWidths[col.key]}px` : col.minW }}
                                                    onClick={() => sortLevels(col.key)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {col.label}
                                                        <div className="flex flex-col opacity-20">
                                                            <ArrowUp className={cn("w-2 h-2", levelsSortConfig?.key === col.key && levelsSortConfig.direction === 'ascending' && "text-primary opacity-100")} />
                                                            <ArrowDown className={cn("w-2 h-2", levelsSortConfig?.key === col.key && levelsSortConfig.direction === 'descending' && "text-primary opacity-100")} />
                                                        </div>
                                                    </div>
                                                </ResizableHeader>
                                            ))}
                                            <th className="px-4 py-4 border-b border-slate-200 dark:border-slate-800" style={{ width: '80px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {levelsPagination.currentData.map((row, i) => (
                                            <tr key={i} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all cursor-pointer border-b border-slate-100 dark:border-slate-800">
                                                {visibleLevelsCols.map(col => {
                                                    switch (col.key) {
                                                        case 'TipoModelo': return <td key={col.key} className="px-4 py-4 font-bold text-slate-800 dark:text-white border-r border-slate-50 dark:border-slate-800 group-hover:text-primary transition-colors">{row.TipoModelo}</td>;
                                                        case 'Codigo': return <td key={col.key} className="px-4 py-4 text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase tracking-tighter">{row.Codigo || '-'}</td>;
                                                        case 'Categoria': {
                                                            const cat = (row.Categoria || 'customizado').toLowerCase();
                                                            const badgeClass = cat === 'papel'
                                                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                                                : cat === 'toner'
                                                                    ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';
                                                            return (
                                                                <td key={col.key} className="px-4 py-4">
                                                                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", badgeClass)}>
                                                                        {cat}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        case 'ModeloEquipamento': return (
                                                            <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                                                                {row.ModeloEquipamento || <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                            </td>
                                                        );
                                                        case 'TipoToner': return (
                                                            <td key={col.key} className="px-4 py-4">
                                                                {row.TipoToner ? (
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                        {row.TipoToner}
                                                                    </span>
                                                                ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                            </td>
                                                        );
                                                        case 'EstoqueAtual': return (
                                                            <td key={col.key} className="px-4 py-4 text-right">
                                                                {editingRow === row.TipoModelo ? (
                                                                    <div className="flex items-center justify-end gap-2 animate-in fade-in duration-200">
                                                                        <input
                                                                            type="number"
                                                                            value={editValue}
                                                                            onChange={(e) => setEditValue(e.target.value)}
                                                                            className="w-20 bg-white dark:bg-slate-800 border-2 border-primary rounded-lg px-2 py-1 text-right font-bold text-primary outline-none"
                                                                            disabled={editSaving}
                                                                            autoFocus
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') saveEditing(row);
                                                                                if (e.key === 'Escape') cancelEditing();
                                                                            }}
                                                                        />
                                                                        <div className="flex gap-1">
                                                                            <button onClick={() => saveEditing(row)} disabled={editSaving} className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-all">
                                                                                {editSaving ? <RotateCcw size={14} className="animate-spin" /> : <Check size={14} />}
                                                                            </button>
                                                                            <button onClick={cancelEditing} disabled={editSaving} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                                                                                <X size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-end gap-3 group/edit">
                                                                        <span className={cn(
                                                                            "font-bold text-sm",
                                                                            Number(row.EstoqueAtual) < 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"
                                                                        )}>
                                                                            {row.EstoqueAtual}
                                                                        </span>
                                                                        <button 
                                                                            onClick={() => startEditing(row)}
                                                                            className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-primary hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                        >
                                                                            <Pencil size={14} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                        case 'UltimaAlteracao': return <td key={col.key} className="px-4 py-4 text-slate-500 dark:text-slate-400 text-[10px] font-medium">{row.UltimaAlteracao}</td>;
                                                        case 'Empresa': return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 truncate">{row.Empresa}</td>;
                                                        default: return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 truncate">{row[col.key]}</td>;
                                                    }
                                                })}
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleDeleteClick(row)}
                                                            className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {levels.length === 0 && !loading && (
                                            <tr>
                                                <td colSpan="6" className="px-4 py-24 text-center">
                                                    <div className="flex flex-col items-center gap-2 opacity-30">
                                                        <Package size={48} className="text-slate-400 dark:text-slate-600" />
                                                        <p className="font-bold text-sm text-slate-500 dark:text-slate-400">Nenhum item em estoque</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="mt-4 shrink-0 px-2">
                            <Pagination {...levelsPagination.paginationProps} />
                        </div>
                    </>
                )}

                {activeTab === 'history' && (
                    <>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 transition-colors">
                            <div className="overflow-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[1000px]">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors">
                                        <tr>
                                            {visibleHistoryCols.map((col) => (
                                                <ResizableHeader
                                                    key={col.key}
                                                    columnKey={col.key}
                                                    width={historyWidths[col.key]}
                                                    onResize={(k, w) => setHistoryWidth(k, w)}
                                                    onResizeEnd={(k, w) => setHistoryWidth(k, w)}
                                                    className="px-4 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[9px] cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800"
                                                    style={{ width: historyWidths[col.key] ? `${historyWidths[col.key]}px` : col.minW, minWidth: col.minW }}
                                                    onClick={() => sortHistory(col.key)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {col.label}
                                                        <div className="flex flex-col opacity-20">
                                                            <ArrowUp className={cn("w-2 h-2", historySortConfig?.key === col.key && historySortConfig.direction === 'ascending' && "text-primary opacity-100")} />
                                                            <ArrowDown className={cn("w-2 h-2", historySortConfig?.key === col.key && historySortConfig.direction === 'descending' && "text-primary opacity-100")} />
                                                        </div>
                                                    </div>
                                                </ResizableHeader>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {historyPagination.currentData.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all border-b border-slate-100 dark:border-slate-800">
                                                {visibleHistoryCols.map(col => {
                                                    switch (col.key) {
                                                        case 'DataLancamento': return <td key={col.key} className="px-4 py-4 text-slate-500 dark:text-slate-400 font-medium">{row.DataLancamento}</td>;
                                                         case 'TipoMaterial': return <td key={col.key} className="px-4 py-4 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">{row.TipoMaterial}</td>;
                                                         case 'Modelo': return <td key={col.key} className="px-4 py-4 text-slate-900 dark:text-white font-bold">{row.Modelo}</td>;
                                                        case 'Quantidade': return <td key={col.key} className="px-4 py-4 font-mono font-bold text-primary text-sm truncate">{row.Quantidade}</td>;
                                                        case 'TipoLancamento': return (
                                                            <td key={col.key} className="px-4 py-4">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                                                                    row.TipoLancamento === 'Entrada' 
                                                                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" 
                                                                        : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800"
                                                                )}>
                                                                    {row.TipoLancamento}
                                                                </span>
                                                            </td>
                                                        );
                                                        case 'Colaborador': return <td key={col.key} className="px-4 py-4 text-slate-600 font-medium">{row.Colaborador}</td>;
                                                        case 'ProtocoloOUPedido': return <td key={col.key} className="px-4 py-4 text-slate-500 italic max-w-xs truncate">{row.ProtocoloOUPedido || row.Obs}</td>;
                                                        default: return <td key={col.key} className="px-4 py-4 text-slate-600">{row[col.key]}</td>;
                                                    }
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="mt-4 shrink-0 px-2">
                            <Pagination {...historyPagination.paginationProps} />
                        </div>
                    </>
                )}
            </div>

            {/* Modal bifurcado: Seleção → Novo Item ou Lançamento */}
            {(modalMode === 'select' || modalMode === 'new-item' || modalMode === 'adjustment' || showModal) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-md p-6 animate-in fade-in duration-300">
                    <div className="glass-surface dark:bg-slate-900/80 p-8 w-full max-w-2xl relative overflow-hidden rounded-3xl border border-white/20 dark:border-slate-800 shadow-2xl space-y-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 dark:bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16" />
                        <div className="flex justify-between items-center relative">
                            <h2 className="text-xl font-bold font-display flex items-center gap-3 text-slate-900 dark:text-white">
                                <Plus className="w-6 h-6 text-primary" />
                                {modalMode === 'select' ? 'O que deseja fazer?' : modalMode === 'new-item' ? 'Novo Item de Estoque' : 'Registrar Movimentação'}
                            </h2>
                            <button onClick={closeModal} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"><X size={20} /></button>
                        </div>
                        {/* TELA DE SELEÇÃO */}
                        {modalMode === 'select' && (
                            <div className="grid grid-cols-2 gap-4 relative">
                                <button onClick={() => { setModalMode('new-item'); loadModelos(); }} className="flex flex-col items-center gap-3 p-6 bg-primary/5 border-2 border-primary/20 hover:border-primary hover:bg-primary/10 rounded-2xl transition-all group">
                                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-all"><Package className="w-6 h-6 text-primary" /></div>
                                    <div className="text-center"><p className="font-bold text-slate-800 dark:text-white text-sm">Novo Item de Estoque</p><p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Cadastrar papel, toner ou item customizado</p></div>
                                </button>
                                <button onClick={() => setModalMode('adjustment')} className="flex flex-col items-center gap-3 p-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:bg-primary/5 rounded-2xl transition-all group">
                                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-all"><History className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors" /></div>
                                    <div className="text-center"><p className="font-bold text-slate-800 dark:text-white text-sm">Lançamento em Item Existente</p><p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Entrada ou saída manual de estoque</p></div>
                                </button>
                            </div>
                        )}
                        {/* FORMULÁRIO DE NOVO ITEM */}
                        {modalMode === 'new-item' && (
                            <div className="space-y-5 relative">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Categoria</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[{value:'papel',label:'Papel',desc:'A4 / A3'},{value:'toner',label:'Toner',desc:'Por modelo'},{value:'customizado',label:'Customizado',desc:'Livre'}].map(opt => (
                                            <button key={opt.value} type="button" onClick={() => setNewItemCategoria(opt.value)} className={cn("p-3 rounded-xl border-2 text-left transition-all", newItemCategoria === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300')}>
                                                <p className="font-bold text-xs">{opt.label}</p><p className="text-[10px] opacity-70">{opt.desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {newItemCategoria === 'toner' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Modelo Equipamento</label>
                                            <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none" value={newItemModelo} onChange={e => setNewItemModelo(e.target.value)}>
                                                <option value="">Selecione o modelo...</option>
                                                {modelos.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tipo de Toner</label>
                                            <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none" value={newItemTipoToner} onChange={e => setNewItemTipoToner(e.target.value)}>
                                                <option value="BK">BK — Preto</option><option value="CY">CY — Ciano</option><option value="MG">MG — Magenta</option><option value="YW">YW — Amarelo</option>
                                            </select>
                                        </div>
                                        {newItemModelo && <div className="col-span-2 bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm font-bold text-primary">Nome gerado: <span className="font-black">{newItemTipoToner} {newItemModelo}</span></div>}
                                    </div>
                                )}
                                {newItemCategoria === 'papel' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tipo de Papel</label>
                                        <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none" value={newItemTipoPapel} onChange={e => setNewItemTipoPapel(e.target.value)}>
                                            <option value="A4">A4 (RESMAS)</option><option value="A3">A3 (RESMAS)</option>
                                        </select>
                                    </div>
                                )}
                                {newItemCategoria === 'customizado' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nome do Item</label>
                                        <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Ex: Grampeador, Papel Ofício..." value={newItemNome} onChange={e => setNewItemNome(e.target.value)} />
                                    </div>
                                )}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Qtd. Inicial</label><input type="number" min="0" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none font-bold text-lg" value={newItemQtd} onChange={e => setNewItemQtd(e.target.value)} /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Empresa</label><select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none" value={newItemEmpresa} onChange={e => setNewItemEmpresa(e.target.value)}><option value="">Selecione...</option><option value="USINAS SIDERURGICAS DE MINAS GERAIS SA">USIMINAS</option><option value="FUNDACAO SAO FRANCISCO XAVIER">FSFX</option><option value="MINERACAO USIMINAS S.A.">MUSA</option><option value="Usiminas Mecanica S.A.">UMSA</option></select></div>
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cód. Sapiens</label><input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none font-mono" placeholder="Opcional" value={newItemCodigo} onChange={e => setNewItemCodigo(e.target.value)} /></div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setModalMode('select')} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Voltar</button>
                                    <button onClick={handleCreateItem} disabled={creatingItem} className="flex-[2] py-3 bg-primary text-white font-bold uppercase tracking-widest text-[11px] rounded-2xl hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">{creatingItem ? 'Criando...' : 'Criar Item'}</button>
                                </div>
                            </div>
                        )}
                        {/* FORMULÁRIO DE LANÇAMENTO */}
                        {(modalMode === 'adjustment' || showModal) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                                <div className="space-y-4">
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Sentido da Carga</label><select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={adjustQty >= 0 ? 'Entrada' : 'Saída'} onChange={e => { const isEntry = e.target.value === 'Entrada'; setAdjustQty(Math.abs(adjustQty) * (isEntry ? 1 : -1)); }}><option value="Entrada">Entrada (+) Abastecimento</option><option value="Saída">Saída (-) Consumo</option></select></div>
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Matriz de Item / Modelo</label><input list="items-list" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={adjustItem} onChange={e => setAdjustItem(e.target.value)} placeholder="Selecione ou digite..." /><datalist id="items-list">{levels.map(l => <option key={l.TipoModelo} value={l.TipoModelo} />)}<option value="A4 (RESMAS)" /><option value="A3 (RESMAS)" /></datalist></div>
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Volume (Qtd)</label><input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-900 dark:text-white text-3xl font-bold focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={Math.abs(adjustQty)} onChange={e => { const val = parseInt(e.target.value) || 0; setAdjustQty(adjustQty >= 0 ? val : -val); }} min="1" /></div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">NF de Origem</label><input id="nf-input" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="000.000.000" /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Unidade Responsável</label><select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all" id="empresa-select" defaultValue=""><option value="">Selecione...</option><option value="USINAS SIDERURGICAS DE MINAS GERAIS SA">USIMINAS</option><option value="FUNDACAO SAO FRANCISCO XAVIER">FSFX</option><option value="MINERACAO USIMINAS S.A.">MUSA</option><option value="Usiminas Mecanica S.A.">UMSA</option><option value="SOLUCOES EM ACO USIMINAS S.A.">SOLUÇÕES</option></select></div>
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Motivação / OBS</label><textarea className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white h-[100px] focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Detalhes técnicos..." /></div>
                                </div>
                                <div className="col-span-2 flex gap-3 pt-4">
                                    <button onClick={closeModal} className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Cancelar</button>
                                    <button onClick={() => { const nf = document.getElementById('nf-input')?.value || ''; const emp = document.getElementById('empresa-select')?.value || ''; handleAdjust({ nf, protocolo: '', fila: '', empresa: emp }); }} className="flex-[2] py-4 bg-primary text-white font-bold uppercase tracking-widest text-[11px] rounded-2xl hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20">Confirmar Lançamento</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Delete Modal */}
            {showDeleteModal && itemToDelete && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-md p-6 animate-in fade-in duration-300">
                    <div className="glass-surface dark:bg-slate-900/80 p-8 w-full max-w-sm flex flex-col items-center text-center gap-6 rounded-3xl border border-white/20 dark:border-slate-800 shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Remover do Catálogo?</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                Você está removendo permanentemente o item <strong className="text-slate-800 dark:text-slate-200">{itemToDelete.TipoModelo}</strong> deste contrato.
                            </p>
                        </div>
                        <div className="flex gap-3 w-full">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Abortar</button>
                            <button onClick={confirmDelete} className="flex-[2] py-3 bg-red-600 text-white font-bold uppercase tracking-widest text-[11px] rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all">Confirmar Exclusão</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
