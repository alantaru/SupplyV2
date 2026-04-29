import React, { useState, useEffect } from 'react';
import { X, Search, Link, Loader2 } from 'lucide-react';
import api from '../../lib/api';

/**
 * MapaAssociateModal — seletor de equipamento do Mapa para associação.
 * Props:
 *   solicitante: string — nome do solicitante a ser associado
 *   onAssociate: async (serie) => void
 *   onClose: () => void
 */
export default function MapaAssociateModal({ solicitante, onAssociate, onClose }) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [associating, setAssociating] = useState(null);

    useEffect(() => {
        if (search.length >= 2) {
            fetchEquipments(search);
        } else {
            setResults([]);
        }
    }, [search]);

    const fetchEquipments = async (q) => {
        setLoading(true);
        try {
            const res = await api.get(`/data/assist/inventory`);
            const all = Array.isArray(res.data) ? res.data : [];
            const lower = q.toLowerCase();
            setResults(all.filter(item =>
                (item.Serie || "").toLowerCase().includes(lower) ||
                (item.Fila || "").toLowerCase().includes(lower) ||
                (item.LocalInstalacao || "").toLowerCase().includes(lower) ||
                (item.Empresa || "").toLowerCase().includes(lower)
            ).slice(0, 20));
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAssociate = async (serie) => {
        setAssociating(serie);
        try {
            await onAssociate(serie);
            onClose();
        } catch (err) {
            // error handled by parent
        } finally {
            setAssociating(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            <Link size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Associar ao Mapa</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Solicitante: <span className="font-bold text-slate-700 dark:text-slate-300">{solicitante}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
                        <X size={18} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por série, fila, local..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                    </div>
                    {search.length > 0 && search.length < 2 && (
                        <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Digite pelo menos 2 caracteres para buscar</p>
                    )}
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
                            <Loader2 size={16} className="animate-spin" /> Buscando...
                        </div>
                    )}
                    {!loading && search.length >= 2 && results.length === 0 && (
                        <div className="py-8 text-center text-slate-400 text-sm">Nenhum equipamento encontrado</div>
                    )}
                    {!loading && results.length > 0 && (
                        <div className="divide-y divide-slate-50 dark:divide-slate-800">
                            {results.map((item, i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-primary font-mono">{item.Serie}</span>
                                            {item.Fila && <span className="text-[10px] text-slate-500 dark:text-slate-400">{item.Fila}</span>}
                                        </div>
                                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                                            {[item.LocalInstalacao, item.Empresa].filter(Boolean).join(" · ")}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAssociate(item.Serie)}
                                        disabled={!!associating}
                                        className="ml-3 shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all disabled:opacity-50"
                                        style={{ backgroundColor: 'rgb(var(--color-primary))' }}
                                    >
                                        {associating === item.Serie ? <Loader2 size={11} className="animate-spin" /> : <Link size={11} />}
                                        Associar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {search.length < 2 && (
                        <div className="py-8 text-center text-slate-400 text-sm">
                            Busque um equipamento pelo número de série, fila ou local
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
