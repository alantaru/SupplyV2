import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { Users, FileText, Plus, Trash2, Shield, Key, FolderPlus, X, Edit, Settings, Check, Sliders, Image, Globe, RefreshCw, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import GenericDeleteModal from '../Shared/GenericDeleteModal';
import Pagination from '../Shared/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../context/AuthProvider';
import { cn } from '../../lib/utils';
import { useColumns } from '../../hooks/useColumns';
import { useColumnWidths } from '../../hooks/useColumnWidths';
import ColumnManager from '../Shared/ColumnManager';
import ExportButton from '../Shared/ExportButton';
import ResizableHeader from '../Shared/ResizableHeader';

const ADMIN_USERS_COLUMNS = [
    { key: 'username',      label: 'Usuário',      w: undefined },
    { key: 'role',          label: 'Perfil',        w: '120px' },
    { key: 'initial_route', label: 'Tela Inicial',  w: '130px' },
    { key: 'contracts',     label: 'Contratos',     w: undefined },
];

export default function AdminPanel() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const isSuperadmin = user?.role === 'superadmin';
    const [activeTab, setActiveTab] = useState('users');

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm">
                    <Shield size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Painel Administrativo</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Gerencie usuários e contratos</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                <div className="border-b border-slate-200 dark:border-slate-800 flex gap-8 px-6 bg-white dark:bg-slate-900 transition-colors">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={cn(
                            "py-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all relative",
                            activeTab === 'users' ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                        )}
                    >
                        <Users size={14} /> Usuários
                        {activeTab === 'users' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('contracts')}
                        className={cn(
                            "py-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all relative",
                            activeTab === 'contracts' ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                        )}
                    >
                        <FileText size={14} /> Contratos
                        {activeTab === 'contracts' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
                    </button>
                    {isSuperadmin && (
                        <button
                            onClick={() => setActiveTab('superadmin')}
                            className={cn(
                                "py-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all relative",
                                activeTab === 'superadmin' ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                            )}
                        >
                            <Lock size={14} /> Superadmin
                            {activeTab === 'superadmin' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {activeTab === 'users' && <UsersTab />}
                    {activeTab === 'contracts' && <ContractsTab />}
                    {activeTab === 'superadmin' && isSuperadmin && <SuperadminTab />}
                </div>
            </div>
        </div>
    );
}

function UsersTab() {
    const { addToast } = useToast();
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [contracts, setContracts] = useState([]);

    const { currentData: currentUsers, paginationProps } = usePagination(users, 10);
    const { columns, setColumns, visibleColumns } = useColumns('admin-users-columns', ADMIN_USERS_COLUMNS);
    const { widths, setColumnWidth } = useColumnWidths('admin-users-columns');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [uRes, cRes] = await Promise.all([
                api.get('admin/users'),
                api.get('admin/contracts')
            ]);
            setUsers(Array.isArray(uRes.data) ? uRes.data : []);
            setContracts(Array.isArray(cRes.data) ? cRes.data : []);
        } catch (e) { setUsers([]); setContracts([]); }
    };

    const handleDelete = (username) => {
        setDeleteModal({ 
            id: username, 
            icon: Trash2,
            variant: "danger",
            requireTyping: false,
            confirmLabel: "Confirmar Exclusão"
        });
    };

    const confirmDelete = async () => {
        const username = deleteModal?.id;
        if (!username) return;
        try {
            await api.delete(`/admin/users/${username}`);
            setDeleteModal(null);
            loadData();
        } catch (e) { addToast(e.response?.data?.detail || "Erro ao excluir", "error"); }
    };

    const openEdit = (user) => { setSelectedUser(user); setIsEditMode(true); setShowModal(true); };
    const openCreate = () => { setSelectedUser(null); setIsEditMode(false); setShowModal(true); };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Usuários do Sistema</h2>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">{users.length} usuários cadastrados</p>
                </div>
                <div className="flex items-center gap-2">
                    <ColumnManager columns={columns} onChange={setColumns} />
                    <ExportButton
                        tableId="admin-users"
                        data={currentUsers}
                        visibleColumns={visibleColumns}
                        backendEndpoint={null}
                    />
                    <button
                        onClick={openCreate}
                        className="bg-primary text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
                    >
                        <Plus size={16} /> Novo Usuário
                    </button>
                </div>
            </div>

            <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl transition-colors">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
                        <tr>
                            {visibleColumns.map(col => (
                                <ResizableHeader
                                    key={col.key}
                                    columnKey={col.key}
                                    width={widths[col.key]}
                                    onResize={(k, w) => setColumnWidth(k, w)}
                                    onResizeEnd={(k, w) => setColumnWidth(k, w)}
                                    className="px-5 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[9px]"
                                    style={{ width: widths[col.key] ? `${widths[col.key]}px` : col.w }}
                                >
                                    {col.label}
                                </ResizableHeader>
                            ))}
                            <th className="px-5 py-4 text-right font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[9px]">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {currentUsers.map(u => (
                            <tr key={u.username} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all group">
                                {visibleColumns.map(col => {
                                    switch (col.key) {
                                        case 'username':
                                            return <td key={col.key} className="px-5 py-4 font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">{u.username}</td>;
                                        case 'role':
                                            return (
                                                <td key={col.key} className="px-5 py-4">
                                                    <span className={cn(
                                                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                                                        (u.role === 'admin' || u.role === 'superadmin')
                                                            ? 'bg-primary/10 text-primary border-primary/20'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                                    )}>
                                                        {u.role.toUpperCase()}
                                                    </span>
                                                </td>
                                            );
                                        case 'initial_route':
                                            return <td key={col.key} className="px-5 py-4 text-slate-600 dark:text-slate-400 font-mono text-[10px] font-bold">{u.initial_route || "/"}</td>;
                                        case 'contracts':
                                            return (
                                                <td key={col.key} className="px-5 py-4">
                                                    {u.contracts.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {u.contracts.map(c => (
                                                                <span key={c} className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[10px] font-bold">#{c}</span>
                                                            ))}
                                                        </div>
                                                    ) : <span className="text-slate-500 dark:text-slate-400 text-[10px] italic font-medium">Todos (Admin)</span>}
                                                </td>
                                            );
                                        default:
                                            return <td key={col.key} className="px-5 py-4 text-slate-600 dark:text-slate-400">{u[col.key]}</td>;
                                    }
                                })}
                                <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"><Edit size={14} /></button>
                                        <button onClick={() => handleDelete(u.username)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-all"><Trash2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination {...paginationProps} />

            {deleteModal && (
                <GenericDeleteModal
                    title="Excluir Usuário?"
                    message={`Isso excluirá permanentemente o acesso do usuário ${deleteModal.id}.`}
                    targetId={deleteModal.id}
                    onClose={() => setDeleteModal(null)}
                    onConfirm={confirmDelete}
                    icon={deleteModal.icon}
                    variant={deleteModal.variant}
                    requireTyping={false}
                    confirmLabel={deleteModal.confirmLabel}
                />
            )}

            {showModal && (
                <UserModal
                    user={selectedUser}
                    isEdit={isEditMode}
                    contracts={contracts}
                    isSuperadmin={users.some(u => u.role === 'superadmin')}
                    onClose={() => setShowModal(false)}
                    onSuccess={loadData}
                />
            )}
        </div>
    );
}

function UserModal({ user, isEdit, contracts, isSuperadmin, onClose, onSuccess }) {
    const { addToast } = useToast();
    const [form, setForm] = useState({
        username: user?.username || '',
        password: '',
        role: user?.role || 'user',
        contracts: user?.contracts || [],
        initial_route: user?.initial_route || '/'
    });
    const [recoveryInfo, setRecoveryInfo] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) {
                await api.put(`/admin/users/${user.username}`, {
                    contracts: form.contracts,
                    initial_route: form.initial_route
                });
                onSuccess();
                onClose();
            } else {
                const res = await api.post('admin/users', form);
                setRecoveryInfo(res.data);
            }
        } catch (e) { addToast(e.response?.data?.detail || "Erro ao salvar", "error"); }
    };

    const handleContractChange = (contractId) => {
        setForm(prev => {
            const isSelected = prev.contracts.includes(contractId);
            return {
                ...prev,
                contracts: isSelected 
                    ? prev.contracts.filter(id => id !== contractId) 
                    : [...prev.contracts, contractId]
            };
        });
    };

    if (recoveryInfo) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300 transition-colors">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 w-full max-w-md text-center border border-slate-200 dark:border-slate-800 transition-colors relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-t-3xl" />
                    <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-5 border border-emerald-200 dark:border-emerald-800">
                        <Key size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Usuário Criado!</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">Guarde esta chave de recuperação</p>

                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl font-mono text-lg font-bold tracking-widest text-emerald-600 dark:text-emerald-400 select-all mb-6 transition-colors">
                        {recoveryInfo.recovery_key}
                    </div>
 
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-6">
                        Guarde esta chave em local seguro. Ela não será exibida novamente.
                    </p>

                    <button
                        onClick={() => { onClose(); onSuccess(); }}
                        className="w-full bg-primary text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-all"
                    >
                        Concluir
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300 transition-colors">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 custom-scrollbar transition-colors">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white">
                            {isEdit ? 'Editar Usuário' : 'Novo Usuário'}
                        </h3>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Dados de acesso e permissões</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {!isEdit && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Usuário</label>
                    <input required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="usuario_01" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Senha</label>
                                <input required type="password" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
                            </div>
                        </div>
                    )}

                    {isEdit && (
                        <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-center gap-3 transition-colors">
                            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary"><Users size={16} /></div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Editando</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">{form.username}</p>
                            </div>
                        </div>
                    )}

                    {!isEdit && (
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tipo de Usuário</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={() => setForm({ ...form, role: 'user' })} className={cn("px-4 py-3 rounded-xl border text-xs font-bold uppercase transition-all", form.role === 'user' ? 'bg-primary text-white border-primary' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600')}>
                                    Usuário
                                </button>
                                <button type="button" onClick={() => setForm({ ...form, role: 'admin' })} className={cn("px-4 py-3 rounded-xl border text-xs font-bold uppercase transition-all", form.role === 'admin' ? 'bg-amber-500 dark:bg-amber-600 text-white border-amber-500 dark:border-amber-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600')}>
                                    Administrador
                                </button>
                                {isSuperadmin && (
                                    <button type="button" onClick={() => setForm({ ...form, role: 'superadmin' })} className={cn("px-4 py-3 rounded-xl border text-xs font-bold uppercase transition-all col-span-2", form.role === 'superadmin' ? 'bg-red-500 dark:bg-red-600 text-white border-red-500 dark:border-red-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600')}>
                                        Superadministrador
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tela Inicial ao Entrar</label>
                        <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={form.initial_route} onChange={e => setForm({ ...form, initial_route: e.target.value })}>
                            <option value="/" className="dark:bg-slate-900">Dashboard (/)</option>
                            <option value="/admin" className="dark:bg-slate-900">Admin (/admin)</option>
                            <option value="/wizard" className="dark:bg-slate-900">Protocolos (/wizard)</option>
                            <option value="/settings" className="dark:bg-slate-900">Configurações (/settings)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contratos com Acesso</label>
                        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar transition-colors">
                            {contracts.length === 0 && <span className="text-[10px] text-slate-400 dark:text-slate-500 italic p-3 block text-center">Nenhum contrato disponível</span>}
                            {contracts
                                .filter(c => c.status === 'active' || (user?.contracts || []).includes(c.id || c))
                                .map(c => {
                                    const contractId = c.id || c;
                                    const contractName = c.name || '';
                                    const isSelected = form.contracts.includes(contractId);
                                    return (
                                        <label key={contractId} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer", isSelected ? 'bg-primary/10 border-primary/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700')}>
                                            <div className={cn("w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all", isSelected ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900')}>
                                                {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                                            </div>
                                            <input type="checkbox" checked={isSelected} onChange={() => handleContractChange(contractId)} className="hidden" />
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-slate-800 dark:text-white text-sm">#{contractId}</span>
                                                {contractName && contractName !== contractId && (
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{contractName}</span>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}
                        </div>
                    </div>

                    <div className="pt-2">
                        <button type="submit" className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]">
                            {isEdit ? 'Salvar Alterações' : 'Criar Usuário'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ContractsTab() {
    const { addToast } = useToast();
    const { updateActiveContract } = useAuth();
    const [contracts, setContracts] = useState([]);
    const [users, setUsers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [form, setForm] = useState({ id: '', name: '', description: '', status: 'active' });
    const [creating, setCreating] = useState(false);
    const [deleteModal, setDeleteModal] = useState(null);
    const navigate = useNavigate();

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const [cRes, uRes] = await Promise.all([api.get('admin/contracts'), api.get('admin/users')]);
            setContracts(Array.isArray(cRes.data) ? cRes.data : []);
            setUsers(Array.isArray(uRes.data) ? uRes.data : []);
        } catch (e) { setContracts([]); setUsers([]); }
    };

    const handleCreateOrUpdate = async (e) => {
        e.preventDefault();
        if (!form.id.trim()) return addToast("ID do contrato é obrigatório.", "warning");
        try {
            setCreating(true);
            if (isEditMode) {
                await api.put(`/admin/contracts/${form.id}`, form);
                addToast("Contrato atualizado!", "success");
                load();
            } else {
                await api.post('admin/contracts', form);
                const newId = form.id;
                setForm({ id: '', name: '', description: '', status: 'active' });
                setShowForm(false);
                setIsEditMode(false);
                navigate(`/setup-contract/${newId}`);
                return;
            }
            setShowForm(false);
            setIsEditMode(false);
            load();
        } catch (e) { addToast(e.response?.data?.detail || "Erro", "error"); }
        finally { setCreating(false); }
    };

    const handleDelete = (cid) => { 
        if (!cid) return; 
        setDeleteModal({ 
            id: cid,
            icon: Trash2,
            variant: "danger",
            confirmLabel: "Confirmar Exclusão"
        }); 
    };

    const confirmDelete = async () => {
        const cid = deleteModal?.id;
        if (!cid) return;
        try {
            await api.delete(`/admin/contracts/${cid}`);
            setDeleteModal(null);
            load();
        } catch (e) { addToast(e.response?.data?.detail || "Erro ao excluir.", "error"); }
    };

    const openEdit = (c) => { setForm({ id: c.id, name: c.name || '', description: c.description || '', status: c.status || 'active' }); setIsEditMode(true); setShowForm(true); };
    const openCreate = () => { setForm({ id: '', name: '', description: '', status: 'active' }); setIsEditMode(false); setShowForm(true); };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Contratos Ativos</h2>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{contracts.length} contratos cadastrados</p>
                </div>
                <button onClick={openCreate} className="bg-primary text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95">
                    <FolderPlus size={16} /> Novo Contrato
                </button>
            </div>

            {showForm && (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-6 rounded-xl animate-in slide-in-from-top-2 duration-300">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                        {isEditMode ? <Edit size={14} className="text-primary" /> : <FolderPlus size={14} className="text-primary" />}
                        {isEditMode ? 'Editar Contrato' : 'Novo Contrato'}
                    </h3>
                    <form onSubmit={handleCreateOrUpdate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Código do Contrato</label>
                                <input placeholder="Ex: 7080" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-30 dark:disabled:opacity-40" value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} required disabled={isEditMode} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nome</label>
                                <input placeholder="Ex: Usiminas Ipatinga" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</label>
                                <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                    <option value="active">Ativo</option>
                                    <option value="inactive">Inativo</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Descrição</label>
                                <textarea placeholder="Notas..." rows={1} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => { setShowForm(false); setIsEditMode(false); }} className="px-5 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 uppercase">Cancelar</button>
                            <button
                                type="submit"
                                disabled={creating}
                                style={{ backgroundColor: 'rgb(var(--color-primary))', color: 'white' }}
                                className="px-8 py-2.5 rounded-xl text-xs font-bold uppercase hover:opacity-90 transition-all shadow-lg disabled:opacity-50 active:scale-95"
                            >
                                {creating ? 'Salvando...' : (isEditMode ? 'Atualizar' : 'Criar Contrato')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contracts.map(c => (
                    <div key={c.id || c} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl group hover:shadow-md transition-all overflow-hidden flex flex-col">
                        <div className="p-5 flex-1">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-lg font-bold text-slate-800 dark:text-white">#{c.id || c}</span>
                                        <div className={cn("w-2 h-2 rounded-full", c.status === 'inactive' ? 'bg-red-500' : 'bg-emerald-500')} />
                                    </div>
                                    {c.name && c.name !== c.id && (
                                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5 truncate max-w-[180px]">{c.name}</div>
                                    )}
                                </div>
                                <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border", c.status === 'inactive' ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900')}>
                                    {c.status === 'inactive' ? 'Inativo' : 'Ativo'}
                                </span>
                            </div>

                            {c.description && <p className="text-xs text-slate-400 mb-4 line-clamp-2 border-l-2 border-slate-200 pl-3 italic">{c.description}</p>}

                            <div className="space-y-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Usuários com acesso:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {users.filter(u => u.contracts.includes(c.id || c)).length > 0 ? (
                                        users.filter(u => u.contracts.includes(c.id || c)).map(u => (
                                            <span key={u.username} className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-lg font-bold">
                                                {u.username}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-[10px] text-slate-400 italic">Nenhum usuário vinculado</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center transition-colors">
                            <div className="flex gap-2">
                                <button onClick={() => openEdit(c)} className="text-slate-400 dark:text-slate-500 hover:text-primary transition-all p-1"><Edit size={16} /></button>
                                <button 
                                    onClick={() => c.status === 'inactive' ? handleDelete(c.id || c) : addToast("Inative este contrato antes de excluí-lo.", "warning")} 
                                    className={cn("transition-all p-1", c.status === 'inactive' ? 'text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400' : 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50')}
                                    title={c.status === 'inactive' ? "Excluir" : "Inative o contrato primeiro"}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <button
                                onClick={() => navigate(`/setup-contract/${c.id || c}`)}
                                className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-all flex items-center gap-1.5"
                            >
                                <Settings size={12} /> Configurar
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {deleteModal && (
                <GenericDeleteModal
                    title="Excluir Contrato?"
                    message={`Isso excluirá permanentemente o contrato ${deleteModal.id} e TODOS os arquivos, backups e mapeamentos. Esta ação é irreversível.`}
                    targetId={deleteModal.id}
                    onClose={() => setDeleteModal(null)}
                    onConfirm={confirmDelete}
                    icon={deleteModal.icon}
                    variant={deleteModal.variant}
                    confirmLabel={deleteModal.confirmLabel}
                />
            )}
        </div>
    );
}

// Helper: mini logo settings panel reutilizável
function LogoSettingsPanel({ storagePrefix, label, description, defaultTitle, addToast }) {
    const urlKey = `${storagePrefix}_logo_url`;
    const modeKey = `${storagePrefix}_logo_mode`;
    const titleKey = `${storagePrefix}_logo_title`;

    const fileRef = useRef(null);
    const [preview, setPreview] = useState(() => localStorage.getItem(urlKey) || null);
    const [mode, setMode] = useState(() => localStorage.getItem(modeKey) || 'text');
    const [title, setTitle] = useState(() => localStorage.getItem(titleKey) || defaultTitle);
    const [saving, setSaving] = useState(false);

    const MODES = [
        { value: 'logo',       label: 'Somente Logo',    desc: 'Apenas a imagem' },
        { value: 'text',       label: 'Somente Texto',   desc: 'Apenas o nome' },
        { value: 'both_side',  label: 'Logo + Texto →',  desc: 'Imagem e nome lado a lado' },
        { value: 'both_below', label: 'Logo + Texto ↓',  desc: 'Texto abaixo da imagem' },
    ];

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            setPreview(dataUrl);
            localStorage.setItem(urlKey, dataUrl);
            if (mode === 'text') { setMode('logo'); localStorage.setItem(modeKey, 'logo'); }
            addToast('Logo atualizada!', 'success');
        };
        reader.readAsDataURL(file);
    };

    const handleRemove = () => {
        setPreview(null);
        localStorage.removeItem(urlKey);
        setMode('text');
        localStorage.setItem(modeKey, 'text');
        addToast('Logo removida.', 'info');
    };

    const handleModeChange = (m) => { setMode(m); localStorage.setItem(modeKey, m); };

    const handleSave = () => {
        setSaving(true);
        localStorage.setItem(titleKey, title);
        setTimeout(() => { setSaving(false); addToast('Salvo!', 'success'); }, 400);
    };

    // Preview visual
    const showImg = (mode === 'logo' || mode === 'both_side' || mode === 'both_below') && preview;
    const showTxt = mode === 'text' || mode === 'both_side' || mode === 'both_below' || !preview;
    const isBelow = mode === 'both_below';

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
                <Image size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">{label}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>

            {/* Upload + Preview */}
            <div className="flex items-center gap-6">
                <div className={cn(
                    "bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shrink-0 px-3 py-2 flex items-center justify-center",
                    isBelow ? "w-28 h-20 flex-col gap-1" : "w-36 h-16 flex-row gap-2"
                )}>
                    {showImg && <img src={preview} alt="Logo" className={cn("object-contain", isBelow ? "max-h-9 max-w-[80px]" : "max-h-10 max-w-[80px]")} />}
                    {showTxt && (
                        <span className={cn("text-white font-bold tracking-tighter whitespace-nowrap", isBelow ? "text-[10px] text-center" : "text-sm")}>
                            {title}
                        </span>
                    )}
                    {mode === 'logo' && !preview && <span className="text-slate-500 text-[10px]">Sem logo</span>}
                </div>

                <div className="flex flex-col gap-2">
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                    <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all" style={{ backgroundColor: 'rgb(var(--color-primary))' }}>
                        <Image size={14} /> Escolher Imagem
                    </button>
                    {preview && (
                        <button onClick={handleRemove} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                            <X size={14} /> Remover Logo
                        </button>
                    )}
                    <p className="text-[10px] text-slate-400">PNG, SVG ou JPG. Recomendado: 200×60px</p>
                </div>
            </div>

            {/* Modos */}
            <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Modo de Exibição</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {MODES.map(m => (
                        <button key={m.value} type="button" onClick={() => handleModeChange(m.value)}
                            disabled={m.value !== 'text' && !preview}
                            className={cn(
                                "flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-xs font-bold transition-all",
                                mode === m.value ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600',
                                m.value !== 'text' && !preview && 'opacity-40 cursor-not-allowed'
                            )}>
                            <span className="font-bold">{m.label}</span>
                            <span className="text-[9px] font-normal opacity-70">{m.desc}</span>
                        </button>
                    ))}
                </div>
                {!preview && <p className="text-[10px] text-amber-500">Faça upload de uma imagem para habilitar os modos com logo.</p>}
            </div>

            {/* Título */}
            <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Texto / Nome</label>
                    <input value={title} onChange={e => setTitle(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        placeholder={defaultTitle} />
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 shrink-0"
                    style={{ backgroundColor: 'rgb(var(--color-primary))' }}>
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </div>
    );
}

// ─── BasePurgePanel ───────────────────────────────────────────────────────────
function BasePurgePanel({ addToast }) {
    const [bases, setBases] = useState(null);
    const [loading, setLoading] = useState(false);
    const [purging, setPurging] = useState(null); // "CONTRACT_ID:FILE_KEY"
    const [confirmTarget, setConfirmTarget] = useState(null); // { contractId, fileKey, label, contractName }
    const [selectedContract, setSelectedContract] = useState('all');

    const loadBases = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/superadmin/bases');
            setBases(res.data);
        } catch (e) {
            addToast('Erro ao carregar bases.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadBases(); }, []);

    const handlePurge = async () => {
        if (!confirmTarget) return;
        const { contractId, fileKey, label } = confirmTarget;
        setPurging(`${contractId}:${fileKey}`);
        setConfirmTarget(null);
        try {
            const res = await api.delete(`/admin/superadmin/purge-base?contract_id=${contractId}&file_key=${fileKey}`);
            addToast(res.data.message || `Base "${label}" apagada.`, 'success');
            loadBases();
        } catch (e) {
            addToast(e.response?.data?.detail || 'Erro ao apagar base.', 'error');
        } finally {
            setPurging(null);
        }
    };

    // Unique contracts from all bases
    const allContracts = bases
        ? [...new Map(bases.flatMap(b => b.contracts).map(c => [c.contract_id, c])).values()]
        : [];

    const filteredBases = bases?.map(base => ({
        ...base,
        contracts: selectedContract === 'all'
            ? base.contracts
            : base.contracts.filter(c => c.contract_id === selectedContract)
    })).filter(base => base.contracts.length > 0);

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
                <Trash2 size={16} className="text-red-500" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Gerenciamento de Bases</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
                Apague permanentemente qualquer base de dados de qualquer contrato. Esta ação é irreversível.
            </p>

            {/* Filtro por contrato */}
            <div className="flex items-center gap-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Filtrar por contrato:</label>
                <select
                    value={selectedContract}
                    onChange={e => setSelectedContract(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                >
                    <option value="all">Todos os contratos</option>
                    {allContracts.map(c => (
                        <option key={c.contract_id} value={c.contract_id}>{c.contract_name} ({c.contract_id})</option>
                    ))}
                </select>
                <button onClick={loadBases} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Atualizar">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                    <RefreshCw size={14} className="animate-spin" /> Carregando bases...
                </div>
            )}

            {filteredBases && (
                <div className="space-y-2">
                    {filteredBases.map(base => (
                        <div key={base.key} className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{base.label}</span>
                                <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{base.file}</span>
                            </div>
                            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {base.contracts.map(c => {
                                    const pid = `${c.contract_id}:${base.key}`;
                                    const isPurging = purging === pid;
                                    return (
                                        <div key={c.contract_id} className="flex items-center justify-between px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{c.contract_name}</span>
                                                <span className="text-[9px] font-mono text-slate-400">({c.contract_id})</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {c.exists ? (
                                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                                        Existe
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                                                        Vazia
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => c.exists && setConfirmTarget({ contractId: c.contract_id, fileKey: base.key, label: base.label, contractName: c.contract_name })}
                                                    disabled={!c.exists || isPurging}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-900/30 disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    {isPurging ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                                    {isPurging ? 'Apagando...' : 'Apagar'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de confirmação */}
            {confirmTarget && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-2xl p-8 w-full max-w-md space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                <Trash2 size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Confirmar Exclusão Permanente</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Esta ação não pode ser desfeita</p>
                            </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-4 space-y-1">
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                Você está prestes a apagar permanentemente:
                            </p>
                            <p className="text-sm font-bold text-red-700 dark:text-red-400">{confirmTarget.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Contrato: <span className="font-bold">{confirmTarget.contractName} ({confirmTarget.contractId})</span>
                            </p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Todos os dados desta base serão deletados do servidor. Não há backup automático desta operação.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmTarget(null)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePurge}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all"
                            >
                                Sim, apagar permanentemente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SuperadminTab() {
    const { addToast } = useToast();
    const [siteName, setSiteName] = useState(() => localStorage.getItem('site_name') || 'SupplyV2 - Controle de Suprimentos');
    const [saving, setSaving] = useState(false);

    const handleSaveSiteName = () => {
        setSaving(true);
        localStorage.setItem('site_name', siteName);
        document.title = siteName;
        setTimeout(() => { setSaving(false); addToast('Título do browser salvo!', 'success'); }, 400);
    };

    const handleClearCache = () => {
        if (window.confirm('Limpar cache local do navegador? Isso irá deslogar todos os usuários neste dispositivo.')) {
            localStorage.clear();
            sessionStorage.clear();
            addToast('Cache limpo. Redirecionando...', 'info');
            setTimeout(() => window.location.href = '/login', 1500);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <Lock size={18} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Configurações do Superadmin</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Opções exclusivas para o superadministrador do sistema</p>
                </div>
            </div>

            {/* 3 painéis de logo independentes */}
            <LogoSettingsPanel
                storagePrefix="site"
                label="Logo — Barra Lateral (Site)"
                description="Identidade visual exibida na sidebar do sistema."
                defaultTitle="SUPPLY2026"
                addToast={addToast}
            />
            <LogoSettingsPanel
                storagePrefix="proto"
                label="Logo — Protocolo Individual"
                description="Cabeçalho das folhas de protocolo de entrega individual."
                defaultTitle="SUPPLY2026"
                addToast={addToast}
            />
            <LogoSettingsPanel
                storagePrefix="route"
                label="Logo — Rota Proativa"
                description="Cabeçalho das folhas de rota proativa de consumíveis."
                defaultTitle="SUPPLY2026"
                addToast={addToast}
            />

            {/* Título do Browser */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Globe size={16} className="text-primary" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Título da Aba do Browser</h3>
                </div>
                <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1.5">
                        <input
                            value={siteName}
                            onChange={e => setSiteName(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            placeholder="SupplyV2 - Controle de Suprimentos"
                        />
                        <p className="text-[10px] text-slate-400">Nome exibido na aba do navegador</p>
                    </div>
                    <button onClick={handleSaveSiteName} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 shrink-0"
                        style={{ backgroundColor: 'rgb(var(--color-primary))' }}>
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            {/* Informações do Sistema */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Sliders size={16} className="text-primary" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Informações do Sistema</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Versão', value: 'V3-PERFECTION' },
                        { label: 'Build', value: '2026.04' },
                        { label: 'Backend', value: 'FastAPI 0.115' },
                        { label: 'Frontend', value: 'React 19 + Vite' },
                    ].map(item => (
                        <div key={item.label} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-0.5">{item.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Gerenciamento de Bases — Superadmin */}
            <BasePurgePanel addToast={addToast} />

            {/* Zona de Perigo */}
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Shield size={16} className="text-red-500" />
                    <h3 className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">Zona de Perigo</h3>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-red-100 dark:border-red-900/20">
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">Limpar Cache Local</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Remove todos os dados armazenados localmente neste dispositivo.</p>
                    </div>
                    <button onClick={handleClearCache} className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all">
                        <RefreshCw size={14} /> Limpar Cache
                    </button>
                </div>
            </div>
        </div>
    );
}
