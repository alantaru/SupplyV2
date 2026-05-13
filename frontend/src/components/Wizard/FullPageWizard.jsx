import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, Loader, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthProvider';
import api from '../../lib/api';

export default function FullPageWizard() {
    const navigate = useNavigate();
    const { updateActiveContract } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        id: '',
        name: '',
        description: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // 1. Create Contract
            // Endpoint matches backend/routers/admin.py: @router.post("/contracts") expect {id, name, description}
            await api.post('admin/contracts', formData);

            // 2. Redirect to Setup Wizard -> setup-contract (Base Configuration)
            navigate(`/setup-contract/${formData.id}`);

        } catch (_err) {

            setError(err.response?.data?.detail || "Erro ao criar contrato. Verifique se o ID já existe.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center py-10 px-4 animate-in fade-in duration-700">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 glass-surface shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 p-1 transition-colors">
                {/* Header */}
                <div className="p-8 text-center border-b border-slate-100 dark:border-white/5 space-y-4 transition-colors">
                    <div className="mx-auto w-16 h-16 bg-[#D18BFF]/20 rounded-full flex items-center justify-center border border-[#D18BFF]/30">
                        <FileText size={28} className="text-[#D18BFF]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">New Contract</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configuração inicial do Supply 2026.</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-[#FF4D4D] p-3 rounded-xl text-xs flex items-start gap-2 animate-pulse">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-5">
                        <div className="space-y-1">
                            <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[#9D4DFF]">
                                Node Identifier (ID)
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.id}
                                onChange={e => setFormData({ ...formData, id: e.target.value.trim() })}
                                placeholder="e.g. 6070"
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:ring-1 focus:ring-[#D18BFF] outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-white/10"
                            />
                            <p className="text-[10px] text-slate-400 dark:text-white/20">Unique contract key for URL routing.</p>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[#9D4DFF]">
                                Client Name
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Usiminas Supply"
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:ring-1 focus:ring-[#D18BFF] outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-white/10"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[#9D4DFF]">
                                Metadata (Optional)
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Additional details..."
                                rows={2}
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:ring-1 focus:ring-[#D18BFF] outline-none transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-white/10"
                            />
                        </div>

                        <div className="bg-[#FF914D]/5 border border-[#FF914D]/20 p-4 rounded-xl text-[11px] flex items-start gap-3 text-slate-300 italic">
                            <AlertCircle size={16} className="shrink-0 mt-0.5 text-[#FF914D]" />
                            <p>
                                <strong>Constraint Node:</strong> System enforces a <strong>14-digit</strong> limit for Serial Numbers.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="flex-1 px-4 py-3 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] bg-[#D18BFF] text-black px-6 py-3 rounded-full font-bold shadow-xl hover:bg-[#D18BFF]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 scale-100 hover:scale-105 active:scale-95"
                        >
                            {loading ? <Loader className="animate-spin" size={20} /> : <>Initialize Node <ArrowRight size={18} /></>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
