import { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { Search, Loader, AlertCircle, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import Pagination from '../Shared/Pagination';
import { usePagination } from '../../hooks/usePagination';
import api from '../../lib/api';

// ─── Estilos reutilizáveis (mesmos do FormStep) ───────────────────────────────
const inp = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all";
const lbl = "block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5";

const STATUS_STYLES = {
    'Em Produção': 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800',
    'default':     'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};

export default function SearchStep({ onSelect, activeContract }) {
    const { addToast } = useToast();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(null);
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const inputRef = useRef(null);

    const { currentData: currentResults, paginationProps } = usePagination(results, 8);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSearch = async (e) => {
        e?.preventDefault();
        if (query.trim().length < 4) {
            setError('Digite pelo menos 4 caracteres para buscar.');
            return;
        }
        setLoading(true);
        setError(null);
        setResults([]);
        setHasSearched(false);
        try {
            const res = await api.get(`/data/assist/search?q=${encodeURIComponent(query)}&contract_id=${activeContract}`);
            setResults(res.data?.results || []);
            setHasSearched(true);
        } catch {
            setError('Erro ao buscar. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMachine = async (serie) => {
        setLoadingDetails(serie);
        try {
            const res = await api.get(`/data/assist/equipment/${encodeURIComponent(serie)}?contract_id=${activeContract}`);
            if (res.data?.equipment) {
                onSelect(res.data);
            } else {
                addToast('Erro ao carregar detalhes do equipamento.', 'error');
            }
        } catch {
            addToast('Erro de conexão ao carregar detalhes.', 'error');
        } finally {
            setLoadingDetails(null);
        }
    };

    const canSearch = query.trim().length >= 4;

    return (
        <div className="h-full flex flex-col gap-3 animate-in fade-in duration-300">

            {/* ── Cabeçalho compacto ── */}
            <div className="shrink-0">
                <h2 className="text-base font-bold text-slate-800 dark:text-white tracking-tight">Buscar Equipamento</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Digite a Fila (Hostname) ou Número de Série</p>
            </div>

            {/* ── Campo de busca ── */}
            <form onSubmit={handleSearch} className="flex gap-2 shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); if (error) setError(null); }}
                        onKeyDown={(e) => e.key === 'Enter' && canSearch && handleSearch(e)}
                        placeholder="Ex: URIPA0123 ou número de série..."
                        className={inp + " pl-9"}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading || !canSearch}
                    style={canSearch ? { backgroundColor: 'rgb(var(--color-primary))', color: 'white' } : {}}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                        canSearch
                            ? 'hover:opacity-90 active:scale-95 shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                >
                    {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {loading ? 'Buscando...' : 'Buscar'}
                </button>
            </form>

            {/* ── Hint ── */}
            {!hasSearched && !error && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center shrink-0">
                    Mínimo de 4 caracteres para iniciar a busca.
                </p>
            )}

            {/* ── Erro ── */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 shrink-0">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            {/* ── Sem resultados ── */}
            {hasSearched && results.length === 0 && !error && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center py-10 px-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 w-full max-w-md">
                        <Search className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nenhum equipamento encontrado.</p>
                        <p className="text-[10px] text-slate-400 mt-1">Tente outro termo de busca.</p>
                    </div>
                </div>
            )}

            {/* ── Resultados ── */}
            {results.length > 0 && (
                <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                    {/* Header da tabela */}
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 shrink-0">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                        </span>
                        {results.length > 8 && (
                            <span className="text-[10px] text-slate-400">Página {paginationProps.currentPage} de {paginationProps.totalPages}</span>
                        )}
                    </div>

                    {/* Tabela */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-10">
                                <tr>
                                    {['Fila / Modelo', 'Série', 'Status', 'Ação'].map((h, i) => (
                                        <th key={h} className={`px-4 py-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {currentResults.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors">{item.Fila}</div>
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{item.Modelo}</div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 tracking-wider">{item.Serie}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[item.Status] || STATUS_STYLES.default}`}>
                                                {item.Status === 'Em Produção'
                                                    ? <CheckCircle className="h-3 w-3" />
                                                    : <Clock className="h-3 w-3" />
                                                }
                                                {item.Status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleSelectMachine(item.Serie)}
                                                disabled={!!loadingDetails}
                                                style={{ backgroundColor: 'rgb(var(--color-primary))', color: 'white' }}
                                                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 shadow-sm"
                                            >
                                                {loadingDetails === item.Serie
                                                    ? <Loader className="h-3.5 w-3.5 animate-spin" />
                                                    : <>Selecionar <ArrowRight className="h-3.5 w-3.5" /></>
                                                }
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginação — só aparece se necessário */}
                    {results.length > 8 && (
                        <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 px-4 py-2">
                            <Pagination {...paginationProps} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
