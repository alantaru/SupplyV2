import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthProvider';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { X, CheckCircle, Loader2, PackageCheck, AlertTriangle } from 'lucide-react';
import GenericDeleteModal from '../Shared/GenericDeleteModal';
import { cn } from '../../lib/utils';

// ─── Constantes ───────────────────────────────────────────────────────────────

const INSUMOS = [
    { key: 'A4',           label: 'A4',     color: 'text-slate-600 dark:text-slate-400' },
    { key: 'A3',           label: 'A3',     color: 'text-slate-600 dark:text-slate-400' },
    { key: 'TonerPreto',   label: 'BK',     color: 'text-slate-700 dark:text-slate-300' },
    { key: 'TonerCiano',   label: 'CY',     color: 'text-cyan-500' },
    { key: 'TonerAmarelo', label: 'YW',     color: 'text-yellow-500' },
    { key: 'TonerMagenta', label: 'MG',     color: 'text-pink-500' },
];

// ─── Componente auxiliar: campo read-only ─────────────────────────────────────

const ReadOnlyField = ({ label, value, className = '' }) => (
    <div className={className}>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-0.5">
            {label}
        </span>
        <div className="text-sm font-medium text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 truncate">
            {value || '—'}
        </div>
    </div>
);

// ─── DeliveryModal ────────────────────────────────────────────────────────────

export default function DeliveryModal({ protocolId, isOpen, onClose, onSuccess }) {
    const { addToast } = useToast();
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [data, setData] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);

    const [form, setForm] = useState({
        RecebidoPor: '',
        DataEntrega: new Date().toISOString().split('T')[0], // YYYY-MM-DD para input type=date
        ContadorFinal: '',
        Obs: '',
        Items: { A4: 0, A3: 0, TonerPreto: 0, TonerCiano: 0, TonerAmarelo: 0, TonerMagenta: 0 }
    });

    // Fechar com Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Carregar protocolo quando abre
    useEffect(() => {
        if (!isOpen || !protocolId) return;
        setData(null);
        loadProtocol();
    }, [isOpen, protocolId]);

    const loadProtocol = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/data/entregas/${protocolId}`);
            const p = res.data;
            setData(p);
            setForm({
                RecebidoPor: p.RecebidoPor || '',
                DataEntrega: new Date().toISOString().split('T')[0],
                ContadorFinal: '',
                Obs: '',
                Items: {
                    A4:           Number(p.A4)           || 0,
                    A3:           Number(p.A3)           || 0,
                    TonerPreto:   Number(p.TonerPreto)   || 0,
                    TonerCiano:   Number(p.TonerCiano)   || 0,
                    TonerAmarelo: Number(p.TonerAmarelo) || 0,
                    TonerMagenta: Number(p.TonerMagenta) || 0,
                }
            });
        } catch {
            addToast('Erro ao carregar protocolo.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleItemChange = (key, value) => {
        setForm(prev => ({ ...prev, Items: { ...prev.Items, [key]: Number(value) || 0 } }));
    };

    const handleSubmit = async () => {
        await performDelivery();
    };

    const performDelivery = async () => {
        try {
            setSubmitting(true);
            await api.post(`/data/entregas/${protocolId}/deliver`, {
                ...form,
                user: user?.username || 'User',
                empresa: data.Empresa
            });
            addToast('Baixa realizada com sucesso!', 'success');
            onSuccess?.();
            onClose();
        } catch (err) {
            addToast(err.response?.data?.detail || 'Erro ao realizar baixa.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        setDeleteModal({
            title: 'Cancelar Pedido',
            message: `Tem certeza que deseja CANCELAR o pedido #${data.Protocolo}? Esta ação é irreversível.`,
            targetId: String(data.Protocolo),
            icon: AlertTriangle,
            variant: 'danger',
            requireTyping: false,
            confirmLabel: 'Confirmar Cancelamento',
            onConfirm: async () => { setDeleteModal(null); await performCancel(); }
        });
    };

    const performCancel = async () => {
        try {
            setSubmitting(true);
            await api.post(`/data/entregas/${protocolId}/cancel`, { reason: form.Obs });
            addToast('Pedido cancelado com sucesso.', 'success');
            onSuccess?.();
            onClose();
        } catch (err) {
            addToast(err.response?.data?.detail || 'Erro ao cancelar pedido.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const canConfirm = true;
    const pedidoOriginal = INSUMOS.filter(i => Number(data?.[i.key]) > 0);

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <PackageCheck className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Baixa de Entrega</h2>
                                {data && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Protocolo <span className="font-bold text-primary">#{data.Protocolo}</span>
                                        {data.Empresa && <span className="ml-2">— {data.Empresa}</span>}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="animate-spin w-8 h-8 text-primary" />
                            </div>
                        ) : !data ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <p className="text-slate-500 dark:text-slate-400">Protocolo não encontrado.</p>
                                <button onClick={onClose} className="text-sm text-primary hover:underline">Fechar</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-700">

                                {/* ── Coluna Esquerda: Informações (read-only) ── */}
                                <div className="p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
                                    <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Informações do Protocolo</h3>

                                    <div className="grid grid-cols-2 gap-3">
                                        <ReadOnlyField label="Série" value={data.Serie} />
                                        <ReadOnlyField label="Modelo" value={data.Modelo} />
                                        <ReadOnlyField label="Fila" value={data.Fila} />
                                        <ReadOnlyField label="Empresa" value={data.Empresa} />
                                    </div>

                                    <ReadOnlyField
                                        label="Local de Instalação"
                                        value={data.LocalInstalacao || data.M_EndCompleto}
                                        className="col-span-2"
                                    />

                                    <div className="grid grid-cols-2 gap-3">
                                        <ReadOnlyField label="Contato" value={data.ContatoSetor || data.Contato} />
                                        <ReadOnlyField label="Ramal" value={data.Ramal} />
                                        {data.Horario && <ReadOnlyField label="Horário" value={data.Horario} />}
                                        {data.Area && <ReadOnlyField label="Área" value={data.Area} />}
                                    </div>

                                    {/* Pedido Original */}
                                    {pedidoOriginal.length > 0 && (
                                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Pedido Original</h4>
                                            <div className="grid grid-cols-3 gap-2">
                                                {pedidoOriginal.map(({ key, label, color }) => (
                                                    <div key={key} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                                                        <span className={cn('text-[10px] font-bold uppercase', color)}>{label}</span>
                                                        <span className="text-sm font-black text-slate-800 dark:text-white">{data[key]}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ── Coluna Direita: Confirmação (editável) ── */}
                                <div className="p-6 space-y-4">
                                    <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Confirmação de Entrega</h3>

                                    {/* Recebido por + Data */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                Recebido por
                                            </label>
                                            <input
                                                type="text"
                                                value={form.RecebidoPor}
                                                onChange={e => setForm(p => ({ ...p, RecebidoPor: e.target.value }))}
                                                placeholder="Nome completo (opcional)"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Data de Entrega</label>
                                            <input
                                                type="date"
                                                value={form.DataEntrega}
                                                onChange={e => setForm(p => ({ ...p, DataEntrega: e.target.value }))}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Contador Final */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Contador Final</label>
                                        <input
                                            type="number"
                                            value={form.ContadorFinal}
                                            onChange={e => setForm(p => ({ ...p, ContadorFinal: e.target.value }))}
                                            placeholder="Leitura do contador no momento da entrega"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        />
                                    </div>

                                    {/* Insumos Entregues */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Insumos Entregues</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {INSUMOS.map(({ key, label, color }) => (
                                                <div key={key} className="space-y-1">
                                                    <label className={cn('text-[10px] font-bold uppercase tracking-widest block text-center', color)}>
                                                        {label}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={form.Items[key]}
                                                        onChange={e => handleItemChange(key, e.target.value)}
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 text-center text-base font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Observações */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Observações</label>
                                        <textarea
                                            value={form.Obs}
                                            onChange={e => setForm(p => ({ ...p, Obs: e.target.value }))}
                                            placeholder="Observações opcionais..."
                                            rows={2}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {data && !loading && (
                        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                            <button
                                onClick={handleCancel}
                                disabled={submitting}
                                className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/30 transition-all disabled:opacity-50"
                            >
                                <AlertTriangle size={14} />
                                Cancelar Pedido
                            </button>

                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !canConfirm}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting
                                    ? <><Loader2 size={14} className="animate-spin" /> Processando...</>
                                    : <><CheckCircle size={14} /> Confirmar Entrega</>
                                }
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de confirmação */}
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
        </>
    );
}

// ─── DeliveryPage — wrapper para rota /protocol/:id/deliver ───────────────────

export function DeliveryPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    return (
        <DeliveryModal
            protocolId={id}
            isOpen={true}
            onClose={() => navigate('/')}
            onSuccess={() => navigate('/')}
        />
    );
}
