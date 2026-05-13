import { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthProvider';
import { Upload, FileText, RefreshCcw, AlertTriangle, History, AlertCircle, Eye, X, Archive, Download, Settings as SettingsIcon, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import Pagination from '../Shared/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { downloadFileFromAPI } from '../../lib/utils';

import ColumnMappingModal from '../Wizard/ColumnMappingModal';
import ColumnMappingSettings from './ColumnMappingSettings';
import GenericDeleteModal from '../Shared/GenericDeleteModal';
import ConflictResolutionModal from '../Mapa/ConflictResolutionModal';

const FILES = [
    // Base/Editable Files
    { key: 'contadores', label: 'Base de Contadores (Contadores.csv)', desc: 'Contadores e Produção', editable: true },
    { key: 'mapa', label: 'Base de Mapa (Mapa.csv)', desc: 'Localização e Contratos', editable: true },
    { key: 'papel', label: 'Base de Papel (Papel.csv)', desc: 'Histórico de Consumo', editable: true },
    // Generated/Read-Only Files
    { key: 'entregas', label: 'Base de Entregas (Entregas.csv)', desc: 'Histórico Geral de Entregas', editable: false, hasArchive: true },
    { key: 'estoque', label: 'Base de Estoque Atual (Estoque.csv)', desc: 'Snapshot de Estoque', editable: false },
    { key: 'estoque_lancamentos', label: 'Histórico de Estoque (EstoqueLancamentos.csv)', desc: 'Log de Movimentações', editable: false },
    { key: 'solicitantes', label: 'Base de Solicitantes (Solicitantes.csv)', desc: 'Registro de Solicitantes', editable: false },
];

export default function DataManagement() {
    const { addToast } = useToast();
    const [previewFile, setPreviewFile] = useState(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const { user } = useAuth();
    const activeContract = user?.activeContract;

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Upload className="w-8 h-8 text-primary" />
                Configurações
            </h1>

            <div className="space-y-6">
                {FILES.map(f => (
                    <FileManagementCard
                        key={f.key}
                        fileConfig={f}
                        activeContract={activeContract}
                        onPreview={(data) => setPreviewFile({ key: f.key, label: f.label, data })}
                    />
                ))}
            </div>

            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <div className="mt-12 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="text-red-500 w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-bold text-red-800 dark:text-red-400">Zona de Perigo</h2>
                            <p className="text-sm text-red-600 dark:text-red-500/80">Ações destrutivas e irreversíveis.</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-red-100 dark:border-red-900/20">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">Resetar Banco de Dados Atual</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Limpa permanentemente o histórico de <strong>Entregas</strong> e <strong>Estoque</strong> deste contrato.<br />
                                Um backup automático será criado antes da limpeza.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowResetModal(true)}
                            className="w-full md:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Trash2 size={18} /> Resetar Banco de Dados
                        </button>
                    </div>
                </div>
            )}

            {previewFile && (
                <PreviewModal
                    file={previewFile}
                    onClose={() => setPreviewFile(null)}
                />
            )}

            {showResetModal && (
                <ResetDatabaseModal
                    contractId={activeContract}
                    onClose={() => setShowResetModal(false)}
                    onSuccess={() => {
                        setShowResetModal(false);
                        window.location.reload(); // Refresh to show empty state
                    }}
                />
            )}
        </div>
    );
}

function FileManagementCard({ fileConfig, activeContract, onPreview }) {
    const { addToast } = useToast();
    const { user } = useAuth();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState(null);
    const [backups, setBackups] = useState([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [metadata, setMetadata] = useState(null); // { last_modified, exists }
    const [downloading, setDownloading] = useState(false);
    const [mappingData, setMappingData] = useState(null); // For dynamic mapping modal
    const [conflictData, setConflictData] = useState(null); // For map conflict resolution
    const [showMappingSettings, setShowMappingSettings] = useState(false); // Toggle embedded mapping

    // Archive Logic States
    const [archiveLoading, setArchiveLoading] = useState(false);
    const [archives, setArchives] = useState([]);
    const [archiveDate, setArchiveDate] = useState('');

    const [deleteModal, setDeleteModal] = useState(null); // { title, message, targetId, onConfirm }

    useEffect(() => {
        loadMetadata();
        if (fileConfig.editable) {
            loadBackups();
        }
        if (fileConfig.hasArchive) {
            loadArchives();
        }
    }, []);

    const loadMetadata = async () => {
        try {
            const res = await api.get(`/preview/${fileConfig.key}`);
            setMetadata(res.data);
        } catch (_e) { /* Silent */ }
    };

    const loadBackups = async () => {
        try {
            setLoadingBackups(true);
            const res = await api.get(`/backups/${fileConfig.key}`);
            setBackups(Array.isArray(res.data) ? res.data : []);
        } catch (_e) { setBackups([]); }
        finally { setLoadingBackups(false); }
    };

    const handleFileUpload = async (fileKey, file) => {
        let currentContract = activeContract || localStorage.getItem('activeContract');
        
        // Anti-vício: Prevenir que a string "undefined" vinda do localStorage engane o sistema
        if (!currentContract || currentContract === 'undefined' || currentContract === 'null') {
            addToast("Contrato não identificado. Por favor, selecione um contrato no topo da página.", "warning");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploading(true);
            // Garantir que a URL não tenha parâmetros duplicados se o interceptor da API já estiver adicionando um
            const res = await api.post(`/upload/csv/${fileKey.toLowerCase()}`, formData, {
                params: { contract_id: currentContract },
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.status === 'success') {
                setStatus({ type: 'success', msg: `Sucesso! ${res.data.lines} linhas processadas.` });
                setFile(null);
                loadBackups();
                loadMetadata();
            } else if (res.data.status === 'mapping_required') {
                setMappingData(res.data);
            } else if (res.data.status === 'conflicts_found') {
                setConflictData(res.data);
            }
        } catch (_error) {
            const msg = error.response?.data?.detail || "Erro no upload.";
            setStatus({ type: 'error', msg });
        } finally {
            setUploading(false);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        
        setDeleteModal({
            title: "Confirmar Upload",
            message: `Tem certeza que deseja substituir a ${fileConfig.label}? Esta ação irá sobrescrever o arquivo atual no servidor.`,
            targetId: activeContract || '---',
            icon: Upload,
            variant: "info",
            confirmLabel: "Confirmar Atualização",
            requireTyping: false,
            onConfirm: () => {
                setDeleteModal(null);
                handleFileUpload(fileConfig.key, file);
            }
        });
    };

    const handleMappingConfirm = async (payload) => {
        try {
            setUploading(true);
            const res = await api.post(`/upload/confirm-mapping`, payload);
            if (res.data.status === 'success') {
                setMappingData(null);
                addToast(`Sucesso! ${res.data.lines} linhas com mapeamento aplicado.`, "success");
                setFile(null);
                loadBackups();
                loadMetadata();
            }
        } catch (_err) {
            addToast(err.response?.data?.detail || "Erro ao confirmar mapeamento.", "error");
        } finally {
            setUploading(false);
        }
    };

    const handleRestore = async (filename) => {
        setDeleteModal({
            title: "Confirmar Restauro",
            message: `Tem certeza que deseja restaurar o backup "${filename}"? Isso substituirá os dados atuais.`,
            targetId: filename.split('_')[0] || filename,
            onConfirm: async () => {
                setDeleteModal(null);
                try {
                    await api.post(`/restore/${filename}`);
                    addToast("Restaurado com sucesso!", "success");
                    loadBackups();
                    loadMetadata();
                } catch (_e) { addToast("Erro ao restaurar.", "error"); }
            },
            icon: RefreshCcw,
            variant: "info",
            requireTyping: false,
            confirmLabel: "Confirmar Restauro"
        });
    };

    const handleDeleteBackup = async (filename) => {
        setDeleteModal({
            title: "Excluir Backup",
            message: `Excluir permanentemente o backup "${filename}"? Esta ação não pode ser desfeita.`,
            targetId: filename,
            requireTyping: false,
            onConfirm: async () => {
                setDeleteModal(null);
                try {
                    await api.delete(`/backups/${filename}`);
                    loadBackups();
                } catch (_e) {
                    addToast("Erro ao excluir backup.", "error");
                }
            }
        });
    };

    // Archive Functions
    const loadArchives = async () => {
        try {
            const res = await api.get('archive/list', { params: { contract_id: activeContract } });
            setArchives(Array.isArray(res.data) ? res.data : []);
        } catch (_error) { setArchives([]); }
    };

    const handleArchive = async () => {
        if (!archiveDate) return addToast("Selecione uma data de corte.", "warning");
        
        setDeleteModal({
            title: "Confirmar Arquivamento",
            message: `ATENÇÃO: Isso irá mover todos os registros ANTERIORES a ${archiveDate} para um arquivo de histórico. O banco de dados atual manterá apenas registros a partir desta data.`,
            targetId: activeContract,
            requireTyping: false,
            onConfirm: async () => {
                setDeleteModal(null);
                setArchiveLoading(true);
                try {
                    const res = await api.post('archive/split', { cutoff_date: archiveDate }, { params: { contract_id: activeContract } });
                    addToast(res.data.message, "info");
                    loadArchives();
                    setArchiveDate('');
                    loadMetadata();
                } catch (_error) {

                    addToast(error.response?.data?.detail || "Erro ao arquivar.", "error");
                } finally {
                    setArchiveLoading(false);
                }
            },
            icon: Archive,
            variant: "warning",
            confirmLabel: "Confirmar Arquivamento"
        });
    };

    const handlePreviewClick = async () => {
        if (!metadata || !metadata.exists) return;
        onPreview(metadata);
    };

    const handleDownload = async () => {
        downloadFileFromAPI(`/download/${fileConfig.key}`, `${fileConfig.key}.csv`, { contract_id: activeContract });
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-700 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        {fileConfig.label}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{fileConfig.desc}</p>
                </div>
                <div className="text-right">
                    {metadata?.exists ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Atualizado em: <span className="font-medium text-slate-700 dark:text-slate-200 block text-sm">{metadata.last_modified}</span>
                        </div>
                    ) : (
                        <span className="text-xs text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">Arquivo Ausente</span>
                    )}
                    {!fileConfig.editable && (
                        <span className="ml-2 text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                            Gerado pelo Sistema
                        </span>
                    )}
                </div>
            </div>

            <div className={`p-6 grid grid-cols-1 ${fileConfig.editable ? 'lg:grid-cols-2' : ''} gap-8`}>
                {/* Actions */}
                <div>
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={handlePreviewClick}
                            disabled={!metadata?.exists}
                            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 text-sm font-medium disabled:opacity-50"
                        >
                            <Eye className="w-4 h-4" /> Visualizar
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={!metadata?.exists}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50"
                        >
                            <FileText size={16} className="text-primary" />
                            <span>Download</span>
                        </button>
                        
                        {/* Individual Delete Button for Admins */}
                        {(user?.role === 'admin' || user?.role === 'superadmin') && metadata?.exists && (
                            <button
                                onClick={() => {
                                    setDeleteModal({
                                        title: `Deletar ${fileConfig.label}`,
                                        message: `Tem certeza que deseja DELETAR o arquivo atual "${fileConfig.label}"? Um backup será criado automaticamente antes da exclusão.`,
                                        targetId: activeContract,
                                        requireTyping: false,
                                        onConfirm: async () => {
                                            setDeleteModal(null);
                                            try {
                                                await api.post(`/upload/csv/${fileConfig.key}/delete`);
                                                addToast("Arquivo deletado com sucesso. Backup criado.", "success");
                                                loadBackups();
                                                loadMetadata();
                                            } catch (_e) {

                                                addToast("Erro ao deletar arquivo.", "error");
                                            }
                                        }
                                    });
                                }}
                                className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 text-sm font-bold transition-colors"
                                title="Excluir arquivo atual"
                            >
                                <Trash2 className="w-4 h-4" /> Deletar
                            </button>
                        )}
                    </div>

                    {fileConfig.editable && (
                        <div className="mb-4">
                            <button
                                onClick={() => setShowMappingSettings(!showMappingSettings)}
                                className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wide"
                            >
                                <SettingsIcon className="w-3 h-3" />
                                {showMappingSettings ? "Ocultar Mapeamento" : "Mapear Colunas"}
                                {showMappingSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {showMappingSettings && (
                                <div className="mt-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-100 dark:border-slate-700/50">
                                    <ColumnMappingSettings
                                        embeddedFileKey={fileConfig.key.toUpperCase()}
                                        activeContractId={activeContract}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {fileConfig.editable && (
                        <div className="bg-primary/5 dark:bg-slate-700/50 border border-primary/20 dark:border-slate-600 rounded p-4 mb-4">
                            <label className="block text-sm font-semibold text-primary dark:text-primary mb-2">Atualizar Arquivo (.csv)</label>

                            {/* Serial Number Warning */}
                            <div className="mb-3 flex gap-2 items-start text-xs text-primary bg-primary/5 dark:bg-primary/10 p-2 rounded">
                                <AlertCircle size={14} className="shrink-0 mt-0.5 text-primary" />
                                <span><strong>Atenção:</strong> Números de Série são limitados a 14 caracteres. Dígitos extras serão removidos automaticamente.</span>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={e => { setFile(e.target.files[0]); setStatus(null); }}
                                    className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 dark:file:bg-primary/20 file:text-primary dark:file:text-primary hover:file:bg-primary/20 dark:hover:file:bg-primary/30"
                                />
                                <button
                                    onClick={handleUpload}
                                    disabled={!file || uploading}
                                    className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                >
                                    {uploading ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                    Atualizar
                                </button>
                            </div>
                            {status && (
                                <div className={`mt-2 text-xs font-medium ${status.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {status.msg}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* History - Only for editable files */}
                {fileConfig.editable && (
                    <div className="border-l border-slate-100 dark:border-slate-700 pl-8">
                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <History className="w-4 h-4" /> Histórico de Versões
                        </h3>
                        <div className="max-h-40 overflow-y-auto pr-2">
                            {loadingBackups ? <div className="text-xs text-slate-400">Carregando...</div> :
                                backups.length === 0 ? <div className="text-xs text-slate-400 italic">Nenhum backup.</div> : (
                                    <ul className="space-y-2">
                                        {backups.map((bk, i) => (
                                            <li key={i} className="flex items-center justify-between text-xs group bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                                                <div className="min-w-0 flex-1">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300 block">{bk.date}</span>
                                                    <span className="text-slate-400 font-mono text-[10px] truncate block">{bk.filename}</span>
                                                </div>
                                                <div className="flex gap-1 ml-2 shrink-0">
                                                    <button
                                                        onClick={() => downloadFileFromAPI(`/download-backup/${bk.filename}`, bk.filename, { contract_id: activeContract })}
                                                        className="text-slate-500 hover:text-primary hover:bg-primary/10 p-1.5 rounded transition-colors"
                                                        title="Baixar este backup"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRestore(bk.filename)}
                                                        className="text-primary hover:text-primary/80 hover:bg-primary/10 p-1.5 rounded transition-colors text-[10px] font-bold"
                                                        title="Restaurar esta versão"
                                                    >
                                                        Restaurar
                                                    </button>
                                                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                                        <button
                                                            onClick={() => handleDeleteBackup(bk.filename)}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded transition-colors"
                                                            title="Excluir permanentemente"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                        </div>
                    </div>
                )}
            </div>

            {/* Archive Section (Integrated) */}
            {fileConfig.hasArchive && (
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 mx-6 mb-6">
                    <div className="bg-amber-50 dark:bg-slate-700/50 border border-amber-100 dark:border-slate-700 rounded-lg p-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2">
                            <Archive className="w-4 h-4 text-amber-600" />
                            Arquivamento de Banco de Dados
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                    Registros <strong>anteriores</strong> à data selecionada serão movidos para o histórico.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={archiveDate}
                                        onChange={e => setArchiveDate(e.target.value)}
                                        className="block w-full text-xs box-border border border-slate-300 dark:border-slate-600 rounded shadow-sm focus:border-amber-500 focus:ring-amber-500 bg-white dark:bg-slate-800 dark:text-white outline-none"
                                    />
                                    <button
                                        onClick={handleArchive}
                                        disabled={archiveLoading || !archiveDate}
                                        className="bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                                    >
                                        {archiveLoading ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                                        Arquivar
                                    </button>
                                </div>
                            </div>
                            <div className="border-l border-amber-200 dark:border-slate-600 pl-4">
                                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                                    <History className="w-3 h-3" /> Arquivos Gerados
                                </h4>
                                <div className="max-h-32 overflow-y-auto pr-1 space-y-1">
                                    {archives.length === 0 ? <div className="text-[10px] text-slate-400 italic">Nenhum arquivo arquivado.</div> : (
                                        <ul className="space-y-1.5">
                                            {archives.map((bk, i) => (
                                                <li key={i} className="flex items-center justify-between text-[10px] bg-amber-50 dark:bg-slate-800 rounded px-2 py-1.5 group">
                                                    <div className="min-w-0 flex-1">
                                                        <span className="font-medium text-slate-700 dark:text-slate-300 block truncate">{bk.filename}</span>
                                                        <span className="text-slate-400">{bk.date} · {bk.size}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => downloadFileFromAPI(`/archive/download/${bk.filename}`, bk.filename, { contract_id: activeContract })}
                                                        className="ml-2 shrink-0 text-amber-600 hover:text-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 p-1.5 rounded transition-colors"
                                                        title="Baixar arquivo arquivado"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Column Mapping Modal */}
            <ColumnMappingModal
                isOpen={!!mappingData}
                onClose={() => setMappingData(null)}
                checkResult={mappingData}
                onConfirm={handleMappingConfirm}
                isLoading={uploading}
            />

            <ConflictResolutionModal
                isOpen={!!conflictData}
                conflicts={conflictData?.conflicts || []}
                tempToken={conflictData?.temp_token}
                onClose={() => setConflictData(null)}
                onSuccess={() => {
                    setConflictData(null);
                    addToast("Mapa sincronizado com sucesso!", "success");
                    loadMetadata();
                }}
            />

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
                    requireTyping={deleteModal.requireTyping === true}
                />
            )}
        </div>
    );
}


function PreviewModal({ file, onClose }) {
    const { addToast: _addToast } = useToast();
    // Pagination
    const { currentData: currentRows, paginationProps } = usePagination(file?.data?.rows || [], 20);

    if (!file || !file.data || !file.data.rows) return null;
    const { columns } = file.data;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col m-4">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Visualização: {file.label}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><X className="w-5 h-5 dark:text-slate-400" /></button>
                </div>
                <div className="overflow-auto flex-1 p-4 bg-slate-50 dark:bg-slate-900">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white">
                                {columns.map((c, i) => <th key={i} className="p-2 border border-slate-300 dark:border-slate-600 font-bold whitespace-nowrap">{c}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {currentRows.map((r, i) => (
                                <tr key={i} className="bg-white dark:bg-slate-800 hover:bg-primary/5 dark:hover:bg-slate-700">
                                    {columns.map((c, j) => (
                                        <td key={j} className="p-2 border border-slate-200 dark:border-slate-600 whitespace-nowrap overflow-hidden max-w-[200px] text-ellipsis dark:text-slate-300">
                                            {String(r[c])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <Pagination {...paginationProps} />
                </div>
            </div>
        </div>
    );
}

function ResetDatabaseModal({ contractId, onClose, onSuccess }) {
    const { addToast } = useToast();
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetResult, setResetResult] = useState(null);
    const [resetBackups, setResetBackups] = useState([]);

    useEffect(() => {
        // Carrega histórico de viradas anteriores
        api.get(`/admin/contracts/${contractId}/reset-backups`)
            .then(r => setResetBackups(Array.isArray(r.data) ? r.data : []))
            .catch(() => {});
    }, [contractId]);

    const handleReset = async () => {
        if (confirmText !== 'RESET') return;
        setLoading(true);
        try {
            const res = await api.post(`/admin/contracts/${contractId}/reset`);
            setResetResult(res.data);
            addToast("Virada de período concluída!", "success");
            // Recarrega lista de backups
            const r2 = await api.get(`/admin/contracts/${contractId}/reset-backups`);
            setResetBackups(Array.isArray(r2.data) ? r2.data : []);
        } catch (_e) {
            addToast(e.response?.data?.detail || "Erro ao realizar virada de período.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-red-100 dark:border-red-900/30">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center shrink-0">
                            <Archive size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Virada de Período</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Arquiva os dados atuais e inicia uma base limpa</p>
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 text-xs text-amber-800 dark:text-amber-300">
                        <strong>O que acontece:</strong> Os arquivos de <strong>Entregas</strong>, <strong>Estoque</strong> e <strong>Histórico de Estoque</strong> do contrato <span className="font-mono font-bold">{contractId}</span> serão salvos como backup e a base será reiniciada vazia. Os arquivos salvos ficam disponíveis para download abaixo.
                    </div>

                    {!resetResult ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Digite RESET para confirmar</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="RESET"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center font-black tracking-[0.2em] text-red-600 dark:text-red-400 focus:border-red-500 dark:focus:border-red-600 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value.toUpperCase())}
                                />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={onClose} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    disabled={confirmText !== 'RESET' || loading}
                                    onClick={handleReset}
                                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-30 transition-all"
                                >
                                    {loading ? "Arquivando..." : "Confirmar Virada"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 mb-4">
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{resetResult.message}</p>
                        </div>
                    )}

                    {/* Histórico de viradas anteriores */}
                    {resetBackups.length > 0 && (
                        <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <History className="w-3 h-3" /> Viradas Anteriores
                            </h4>
                            <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                                {resetBackups.map((group, i) => (
                                    <div key={i} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">{group.date}</p>
                                        <div className="space-y-1">
                                            {group.files.map((f, j) => (
                                                <div key={j} className="flex items-center justify-between text-[10px]">
                                                    <span className="font-mono text-slate-600 dark:text-slate-300">{f.filename}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-400">{f.size}</span>
                                                        <button
                                                            onClick={() => downloadFileFromAPI(
                                                                `/admin/contracts/${contractId}/reset-backups/download?filepath=${encodeURIComponent(group.timestamp + '/' + f.filename)}`,
                                                                f.filename
                                                            )}
                                                            className="text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10 transition-colors"
                                                            title="Baixar"
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {resetResult && (
                        <button onClick={onSuccess} className="w-full mt-4 px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all" style={{ backgroundColor: 'rgb(var(--color-primary))' }}>
                            Fechar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
