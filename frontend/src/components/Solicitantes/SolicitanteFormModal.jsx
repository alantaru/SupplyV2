import React, { useState, useEffect } from 'react';
import { X, User, Save, Loader2, Plus, Trash2, Search, Link } from 'lucide-react';
import { cn } from '../../lib/utils';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthProvider';

/**
 * SolicitanteFormModal — modal completo para criar e editar solicitantes.
 * Inclui: Nome, Ramal, Obs, e gerenciamento de equipamentos associados.
 *
 * Props:
 *   mode: "create" | "edit"
 *   initial: dados atuais (modo edit)
 *   onSave: async (data) => void
 *   onClose: () => void
 */
export default function SolicitanteFormModal({ mode = "create", initial = {}, onSave, onClose }) {
    const { user } = useAuth();
    const contractId = user?.activeContract;

    const [form, setForm] = useState({
        nome: initial.Nome || '',
        ramal: initial.Ramal || '',
        area: initial.Area || '',
        obs: initial.Obs || '',
    });
    const [equipamentos, setEquipamentos] = useState(
        Array.isArray(initial.EquipamentosLista) ? initial.EquipamentosLista : []
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Equipment search
    const [equipSearch, setEquipSearch] = useState('');
    const [equipResults, setEquipResults] = useState([]);
    const [equipLoading, setEquipLoading] = useState(false);
    const [showEquipSearch, setShowEquipSearch] = useState(false);

    useEffect(() => {
        setForm({ nome: initial.Nome || '', ramal: initial.Ramal || '', area: initial.Area || '', obs: initial.Obs || '' });
        setEquipamentos(Array.isArray(initial.EquipamentosLista) ? initial.EquipamentosLista : []);
        setError('');
    }, [initial.Nome]);

    // Search equipment
    useEffect(() => {
        if (equipSearch.length < 2) { setEquipResults([]); return; }
        const t = setTimeout(async () => {
            setEquipLoading(true);
            try {
                const res = await api.get('/data/assist/inventory', { params: { contract_id: contractId } });
                const all = Array.isArray(res.data) ? res.data : [];
                const q = equipSearch.toLowerCase();
                setEquipResults(all.filter(item =>
                    (item.Serie || '').toLowerCase().includes(q) ||
                    (item.Fila || '').toLowerCase().includes(q) ||
                    (item.LocalInstalacao || '').toLowerCase().includes(q)
                ).slice(0, 15));
            } catch { setEquipResults([]); }
            finally { setEquipLoading(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [equipSearch, contractId]);

    const addEquipamento = (item) => {
        const serie = item.Serie || '';
        const fila = item.Fila || '';
        if (!serie) return;
        if (equipamentos.some(e => e.serie?.toLowerCase() === serie.toLowerCase())) return;
        setEquipamentos(prev => [...prev, { serie, fila }]);
        setEquipSearch('');
        setEquipResults([]);
    };

    const removeEquipamento = (serie) => {
        setEquipamentos(prev => prev.filter(e => e.serie !== serie));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.nome.trim()) { setError('O nome é obrigatório.'); return; }
        setSaving(true);
        setError('');
        try {
            await onSave({
                nome: form.nome.trim(),
                ramal: form.ramal.trim(),
                area: form.area.trim(),
                obs: form.obs.trim(),
                equipamentos,
            });
            onClose();
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    const inp = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all";
    const lbl = "block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <User size={18} />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white">
                            {mode === 'create' ? 'Novo Solicitante' : `Editar — ${initial.Nome}`}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                    {/* Dados básicos */}
                    <div className="space-y-4">
                        <div>
                            <label className={lbl}>Nome *</label>
                            <input
                                value={form.nome}
                                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                                disabled={mode === 'edit'}
                                placeholder="Nome do solicitante"
                                className={cn(inp, mode === 'edit' && 'opacity-60 cursor-not-allowed')}
                            />
                        </div>
                        <div>
                            <label className={lbl}>Ramal / Telefone</label>
                            <input
                                value={form.ramal}
                                onChange={e => setForm(p => ({ ...p, ramal: e.target.value }))}
                                placeholder="Ex: 1234 ou (31) 99999-9999"
                                className={inp}
                            />
                        </div>
                        <div>
                            <label className={lbl}>Setor / Área</label>
                            <input
                                value={form.area}
                                onChange={e => setForm(p => ({ ...p, area: e.target.value }))}
                                placeholder="Ex: Fragmentadora, Centro de Controle..."
                                className={inp}
                            />
                        </div>
                        <div>
                            <label className={lbl}>Observações</label>
                            <textarea
                                value={form.obs}
                                onChange={e => setForm(p => ({ ...p, obs: e.target.value }))}
                                placeholder="Informações adicionais..."
                                rows={2}
                                className={cn(inp, 'resize-none')}
                            />
                        </div>
                    </div>

                    {/* Equipamentos associados */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className={lbl + ' mb-0'}>Equipamentos Associados</label>
                            <button
                                type="button"
                                onClick={() => setShowEquipSearch(v => !v)}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors"
                            >
                                <Plus size={12} /> Adicionar
                            </button>
                        </div>

                        {/* Search box */}
                        {showEquipSearch && (
                            <div className="relative">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <input
                                        autoFocus
                                        value={equipSearch}
                                        onChange={e => setEquipSearch(e.target.value)}
                                        placeholder="Buscar por série, fila ou local..."
                                        className={cn(inp, 'pl-9 text-xs')}
                                    />
                                </div>
                                {(equipLoading || equipResults.length > 0) && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                        {equipLoading && (
                                            <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                                                <Loader2 size={12} className="animate-spin" /> Buscando...
                                            </div>
                                        )}
                                        {equipResults.map((item, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => addEquipamento(item)}
                                                className="w-full text-left px-4 py-2.5 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        <span className="text-xs font-bold text-primary font-mono">{item.Serie}</span>
                                                        {item.Fila && <span className="text-[10px] text-slate-400 ml-2">{item.Fila}</span>}
                                                    </div>
                                                    <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{item.LocalInstalacao}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Lista de equipamentos */}
                        {equipamentos.length > 0 ? (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                {equipamentos.map((e, i) => (
                                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <div className="flex items-center gap-2">
                                            <Link size={11} className="text-primary shrink-0" />
                                            <span className="text-xs font-bold font-mono text-primary">{e.serie}</span>
                                            {e.fila && <span className="text-[10px] text-slate-400">{e.fila}</span>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeEquipamento(e.serie)}
                                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-400 italic">Nenhum equipamento associado</p>
                        )}
                    </div>

                    {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
                </form>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ backgroundColor: 'rgb(var(--color-primary))' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
