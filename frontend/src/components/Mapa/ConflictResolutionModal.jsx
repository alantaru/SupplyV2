import { useState } from 'react';
import { X, AlertTriangle, Check, User, ShieldCheck } from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

const ConflictResolutionModal = ({ isOpen, conflicts, tempToken, onClose, onSuccess }) => {
    const [resolutions, setResolutions] = useState(
        conflicts.map(c => ({ ...c, Choice: 'TECNICO' })) // Default to Technician (Preserve local edits)
    );
    const [loading, setLoading] = useState(false);

    const handleChoice = (idx, choice) => {
        const newRes = [...resolutions];
        newRes[idx].Choice = choice;
        setResolutions(newRes);
    };

    const handleResolve = async () => {
        setLoading(true);
        try {
            await api.post('maintenance/resolve-map-conflicts', {
                temp_token: tempToken,
                resolutions: resolutions
            });
            onSuccess();
        } catch (_error) {
            console.error("Conflict resolution failed", error);
            alert("Erro ao resolver conflitos.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-500/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Conciliação de Inventário (Mapa)</h3>
                            <p className="text-xs text-slate-400">Detectamos {conflicts.length} divergências entre as edições manuais e a atualização oficial.</p>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">
                        {resolutions.map((res, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 items-center">
                                <div className="col-span-3">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{res.Campo}</p>
                                    <p className="font-black text-slate-800 dark:text-white">{res.Serie}</p>
                                </div>
                                
                                <div className="col-span-4 space-y-2">
                                    <button 
                                        onClick={() => handleChoice(idx, 'TECNICO')}
                                        className={cn(
                                            "w-full p-3 rounded-xl border text-left transition-all relative overflow-hidden",
                                            res.Choice === 'TECNICO' 
                                                ? "bg-primary/10 border-primary text-primary" 
                                                : "bg-white dark:bg-slate-800 border-transparent text-slate-400 opacity-60"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <User size={12} />
                                            <span className="text-[10px] font-bold uppercase">Edição Técnica</span>
                                        </div>
                                        <p className="font-bold text-sm">{res.ValorTecnico}</p>
                                        {res.Choice === 'TECNICO' && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Check size={16}/></div>}
                                    </button>
                                </div>

                                <div className="col-span-1 flex items-center justify-center text-slate-300 font-bold italic">VS</div>

                                <div className="col-span-4 space-y-2">
                                    <button 
                                        onClick={() => handleChoice(idx, 'OFICIAL')}
                                        className={cn(
                                            "w-full p-3 rounded-xl border text-left transition-all relative overflow-hidden",
                                            res.Choice === 'OFICIAL' 
                                                ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                                                : "bg-white dark:bg-slate-800 border-transparent text-slate-400 opacity-60"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <ShieldCheck size={12} />
                                            <span className="text-[10px] font-bold uppercase">Update Oficial</span>
                                        </div>
                                        <p className="font-bold text-sm">{res.ValorOficial}</p>
                                        {res.Choice === 'OFICIAL' && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Check size={16}/></div>}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-4">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:text-slate-600 transition-all"
                    >
                        Cancelar Upload
                    </button>
                    <button 
                        onClick={handleResolve}
                        disabled={loading}
                        className="px-10 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Sincronizando...' : 'Confirmar e Salvar Mapa'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConflictResolutionModal;
