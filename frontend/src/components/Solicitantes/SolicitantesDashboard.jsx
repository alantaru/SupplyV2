import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import {
    Users, Search, Plus, Edit, Trash2, Link,
    ArrowUp, ArrowDown, RefreshCw, AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useColumns } from '../../hooks/useColumns';
import { useColumnWidths } from '../../hooks/useColumnWidths';
import ColumnManager from '../Shared/ColumnManager';
import ExportButton from '../Shared/ExportButton';
import ResizableHeader from '../Shared/ResizableHeader';
import SolicitanteFormModal from './SolicitanteFormModal';
import MapaAssociateModal from './MapaAssociateModal';

// ─── Column definitions ───────────────────────────────────────────────────────
const SOLICITANTES_COLUMNS = [
    { key: 'Nome',              label: 'Nome / Contato',                  w: undefined },
    { key: 'Ramal',             label: 'Ramal',                           w: '110px' },
    { key: 'EquipamentosLista', label: 'Equipamentos (Série | Hostname)', w: '220px' },
    { key: 'Area',              label: 'Setor / Área',                    w: '140px' },
    { key: 'Empresa',           label: 'Empresa',                         w: '140px' },
    { key: 'Source',            label: 'Origem',                          w: '100px' },
    { key: 'Obs',               label: 'Observações',                     w: '180px' },
];

// ─── Source Badge ─────────────────────────────────────────────────────────────
const SOURCE_CONFIG = {
    manual:         { label: 'Manual',       cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
    mapa:           { label: 'Mapa',         cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
    mapa_associado: { label: 'Associado',    cls: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' },
};

function SourceBadge({ source }) {
    const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.manual;
    return (
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', cfg.cls)}>
            {cfg.label}
        </span>
    );
}

const SortIcon = ({ col, sortCol, sortDir }) => {
    if (sortCol !== col) return <div className="flex flex-col opacity-20"><ArrowUp className="w-2 h-2" /><ArrowDown className="w-2 h-2" /></div>;
    return sortDir === 'asc'
        ? <ArrowUp className="w-3 h-3 text-primary" />
        : <ArrowDown className="w-3 h-3 text-primary" />;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SolicitantesDashboard() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const contractId = user?.activeContract;

    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Column management — same pattern as all other tables
    const { columns, setColumns, visibleColumns } = useColumns(
        `solicitantes-columns-${user?.username}-${contractId}`,
        SOLICITANTES_COLUMNS
    );
    const { widths, setColumnWidth } = useColumnWidths(
        `solicitantes-columns-${user?.username}-${contractId}`
    );

    // Filters
    const [search, setSearch] = useState('');
    const [filterEmpresa, setFilterEmpresa] = useState('');
    const [filterSource, setFilterSource] = useState('');

    // Sort
    const [sortCol, setSortCol] = useState('Nome');
    const [sortDir, setSortDir] = useState('asc');

    // Modals
    const [modalCreate, setModalCreate] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [associateTarget, setAssociateTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Import result
    const [importResult, setImportResult] = useState(null);
    const [importing, setImporting] = useState(false);

    // ─── Load ───────────────────────────────────────────────────────────────
    const load = async () => {
        if (!contractId) return;
        setLoading(true);
        try {
            const res = await api.get('data/solicitantes', { params: { contract_id: contractId } });
            setContacts(Array.isArray(res.data) ? res.data : []);
        } catch {
            addToast('Erro ao carregar solicitantes.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [contractId]);

    // ─── Derived data ────────────────────────────────────────────────────────
    const empresas = useMemo(() => {
        const set = new Set(contacts.map(c => c.Empresa).filter(Boolean));
        return [...set].sort();
    }, [contacts]);

    const filtered = useMemo(() => {
        let data = [...contacts];
        if (search) {
            const q = search.toLowerCase();
            data = data.filter(c => (c.Nome || '').toLowerCase().includes(q));
        }
        if (filterEmpresa) {
            data = data.filter(c => c.Empresa === filterEmpresa);
        }
        if (filterSource === 'manual') {
            data = data.filter(c => c.Source === 'manual' || c.Source === 'mapa_associado');
        } else if (filterSource === 'mapa') {
            data = data.filter(c => c.Source === 'mapa');
        }
        // Sort — skip EquipamentosLista (complex field)
        if (sortCol !== 'EquipamentosLista') {
            data.sort((a, b) => {
                const va = String(a[sortCol] || '').toLowerCase();
                const vb = String(b[sortCol] || '').toLowerCase();
                return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            });
        }
        return data;
    }, [contacts, search, filterEmpresa, filterSource, sortCol, sortDir]);

    const toggleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    // ─── CRUD handlers ───────────────────────────────────────────────────────
    const handleCreate = async ({ nome, ramal, area, obs }) => {
        await api.post('data/solicitantes', { nome, ramal, obs }, { params: { contract_id: contractId } });
        addToast('Solicitante criado.', 'success');
        load();
    };

    const handleEdit = async ({ nome, ramal, area, obs, equipamentos: newEquips }) => {
        await api.put(`/data/solicitantes/${encodeURIComponent(editTarget.Nome)}`, { ramal, area, obs }, { params: { contract_id: contractId } });
        // Sincronizar equipamentos: associar os novos
        const existingSet = new Set((editTarget.EquipamentosLista || []).map(e => e.serie?.toLowerCase()));
        for (const e of (newEquips || [])) {
            if (!existingSet.has(e.serie?.toLowerCase())) {
                try {
                    await api.post(
                        `/data/solicitantes/${encodeURIComponent(editTarget.Nome)}/associate`,
                        { serie: e.serie },
                        { params: { contract_id: contractId } }
                    );
                } catch { /* silent — equip may not be in mapa */ }
            }
        }
        addToast('Solicitante atualizado.', 'success');
        load();
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/data/solicitantes/${encodeURIComponent(deleteTarget.Nome)}`, { params: { contract_id: contractId } });
            addToast('Solicitante excluído.', 'success');
            setDeleteTarget(null);
            load();
        } catch (_e) {
            addToast(_e.response?.data?.detail || 'Erro ao excluir.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleAssociate = async (serie) => {
        await api.post(
            `/data/solicitantes/${encodeURIComponent(associateTarget.Nome)}/associate`,
            { serie },
            { params: { contract_id: contractId } }
        );
        addToast('Associação realizada.', 'success');
        load();
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const res = await api.post('data/solicitantes/import-from-mapa', {}, { params: { contract_id: contractId } });
            setImportResult(res.data);
            load();
        } catch (_e) {
            addToast(_e.response?.data?.detail || 'Erro na importação.', 'error');
        } finally {
            setImporting(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm">
                        <Users size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Solicitantes e Contatos</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Gerencie os contatos do contrato ativo.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleImport}
                        disabled={importing}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50"
                    >
                        {importing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} className="text-emerald-500" />}
                        Importar do Mapa
                    </button>
                    <ColumnManager columns={columns} onChange={setColumns} />
                    <ExportButton
                        tableId="solicitantes"
                        data={filtered.map(c => ({
                            ...c,
                            Equipamentos: (c.EquipamentosLista || []).map(e => e.fila ? `${e.serie}|${e.fila}` : e.serie).join(', '),
                        }))}
                        visibleColumns={visibleColumns.map(col =>
                            col.key === 'EquipamentosLista'
                                ? { key: 'Equipamentos', label: col.label }
                                : col
                        )}
                        backendEndpoint={null}
                        filename={`solicitantes_${contractId}`}
                    />
                    <button
                        onClick={() => setModalCreate(true)}
                        className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-lg active:scale-95"
                        style={{ backgroundColor: 'rgb(var(--color-primary))' }}
                    >
                        <Plus size={16} /> Novo Solicitante
                    </button>
                </div>
            </div>

            {/* Import result toast */}
            {importResult && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between shrink-0">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                        Importação concluída — <strong>{importResult.criados}</strong> criados,{' '}
                        <strong>{importResult.atualizados}</strong> atualizados,{' '}
                        <strong>{importResult.ignorados}</strong> manuais preservados.
                    </p>
                    <button onClick={() => setImportResult(null)} className="text-emerald-500 hover:text-emerald-700 ml-4">
                        <ArrowUp size={14} className="rotate-45" />
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-wrap gap-2 items-center shrink-0">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nome..."
                        className="w-full pl-10 pr-4 py-2 text-sm border-none focus:ring-0 bg-transparent text-slate-800 dark:text-white placeholder-slate-400"
                    />
                </div>
                <select
                    value={filterEmpresa}
                    onChange={e => setFilterEmpresa(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                >
                    <option value="">Todas as empresas</option>
                    {empresas.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select
                    value={filterSource}
                    onChange={e => setFilterSource(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                >
                    <option value="">Todas as origens</option>
                    <option value="manual">Manual</option>
                    <option value="mapa">Mapa</option>
                </select>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">
                    {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[900px]">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                            <tr>
                                {visibleColumns.map(col => (
                                    <ResizableHeader
                                        key={col.key}
                                        columnKey={col.key}
                                        width={widths[col.key]}
                                        onResize={(k, w) => setColumnWidth(k, w)}
                                        onResizeEnd={(k, w) => setColumnWidth(k, w)}
                                        className="px-4 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[9px] cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800"
                                        style={{ width: widths[col.key] ? `${widths[col.key]}px` : col.w, minWidth: col.w }}
                                        onClick={() => col.key !== 'EquipamentosLista' && toggleSort(col.key)}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {col.label}
                                            {col.key !== 'EquipamentosLista' && <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />}
                                        </div>
                                    </ResizableHeader>
                                ))}
                                <th className="px-4 py-4 text-right font-bold text-slate-500 uppercase tracking-widest text-[9px] border-b border-slate-200 dark:border-slate-800" style={{ width: '80px' }}>
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                            <p className="text-sm font-medium text-slate-400">Carregando...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-40">
                                            <Users size={40} className="text-slate-400" />
                                            <p className="font-bold text-sm">Nenhum contato encontrado</p>
                                            <p className="text-xs">Adicione um solicitante ou importe do Mapa</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((c, i) => (
                                    <tr key={i} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => setEditTarget(c)}>
                                        {visibleColumns.map(col => {
                                            switch (col.key) {
                                                case 'Nome':
                                                    return <td key={col.key} className="px-4 py-3 font-bold text-slate-800 dark:text-white">{c.Nome}</td>;
                                                case 'Ramal':
                                                    return <td key={col.key} className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{c.Ramal || '—'}</td>;
                                                case 'EquipamentosLista':
                                                    return (
                                                        <td key={col.key} className="px-4 py-3">
                                                            {c.EquipamentosLista && c.EquipamentosLista.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                                                    {c.EquipamentosLista.slice(0, 3).map((e, j) => (
                                                                        <span key={j} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/20" title={`${e.serie}${e.fila ? ' | ' + e.fila : ''}`}>
                                                                            {e.serie}{e.fila ? <span className="text-slate-400 font-normal">|{e.fila}</span> : null}
                                                                        </span>
                                                                    ))}
                                                                    {c.EquipamentosLista.length > 3 && (
                                                                        <span className="text-[9px] text-slate-400 font-bold">+{c.EquipamentosLista.length - 3}</span>
                                                                    )}
                                                                </div>
                                                            ) : '—'}
                                                        </td>
                                                    );
                                                case 'Area':
                                                    return <td key={col.key} className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={c.Area}>{c.Area || '—'}</td>;
                                                case 'Empresa':
                                                    return <td key={col.key} className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={c.Empresa}>{c.Empresa || '—'}</td>;
                                                case 'Source':
                                                    return <td key={col.key} className="px-4 py-3"><SourceBadge source={c.Source} /></td>;
                                                case 'Obs':
                                                    return (
                                                        <td key={col.key} className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={c.Obs}>
                                                            {c.Obs ? (c.Obs.length > 60 ? c.Obs.slice(0, 60) + '…' : c.Obs) : '—'}
                                                        </td>
                                                    );
                                                default:
                                                    return <td key={col.key} className="px-4 py-3 text-slate-600 dark:text-slate-400">{c[col.key] || '—'}</td>;
                                            }
                                        })}
                                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {c.Source === 'manual' && (
                                                    <button onClick={() => setAssociateTarget(c)} className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all" title="Associar ao Mapa">
                                                        <Link size={14} />
                                                    </button>
                                                )}
                                                <button onClick={() => setEditTarget(c)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Editar">
                                                    <Edit size={14} />
                                                </button>
                                                {(c.Source === 'manual' || c.Source === 'mapa_associado') && (
                                                    <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="Excluir">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {modalCreate && (
                <SolicitanteFormModal
                    mode="create"
                    onSave={handleCreate}
                    onClose={() => setModalCreate(false)}
                />
            )}

            {editTarget && (
                <SolicitanteFormModal
                    mode="edit"
                    initial={editTarget}
                    onSave={handleEdit}
                    onClose={() => setEditTarget(null)}
                />
            )}

            {associateTarget && (
                <MapaAssociateModal
                    solicitante={associateTarget.Nome}
                    onAssociate={handleAssociate}
                    onClose={() => setAssociateTarget(null)}
                />
            )}

            {/* Delete confirmation */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-2xl p-8 w-full max-w-sm space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Excluir Solicitante?</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Esta ação não pode ser desfeita</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Excluir <span className="font-bold">{deleteTarget.Nome}</span>? Os protocolos existentes não serão afetados.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleting ? <RefreshCw size={12} className="animate-spin" /> : null}
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
