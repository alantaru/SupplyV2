import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { Loader2, User } from 'lucide-react';

/**
 * SolicitanteInput — autocomplete input for requester names.
 * Fetches suggestions from /data/solicitantes?q=...
 * Calls onSelect({ Nome, Ramal }) when a suggestion is picked.
 */
export default function SolicitanteInput({ value, onChange, onSelect, name, className }) {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);
    const timeoutRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchSuggestions = async (query) => {
        if (!query || query.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        try {
            setLoading(true);
            // Correct endpoint: /data/solicitantes
            const res = await api.get(`/data/solicitantes?q=${encodeURIComponent(query)}`);
            const data = Array.isArray(res.data) ? res.data : [];
            setSuggestions(data);
            setShowSuggestions(data.length > 0);
        } catch {
            // Silent — autocomplete is non-critical
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        onChange(e);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => fetchSuggestions(e.target.value), 300);
    };

    const handleSelect = (item) => {
        const s = typeof item === 'string' ? { Nome: item, Ramal: '' } : item;
        if (onSelect) {
            onSelect(s);
        } else {
            onChange({ target: { name, value: s.Nome } });
        }
        setShowSuggestions(false);
        setSuggestions([]);
    };

    const defaultInputClass = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all";

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <input
                    name={name}
                    value={value}
                    onChange={handleInputChange}
                    onFocus={() => { if (value && value.length >= 2) fetchSuggestions(value); }}
                    autoComplete="off"
                    placeholder="Nome do solicitante..."
                    className={className || defaultInputClass}
                />
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-[200] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solicitantes cadastrados</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto custom-scrollbar">
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => handleSelect(s)}
                                className="w-full text-left px-4 py-3 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0 flex items-center justify-between gap-3"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate block">
                                            {s.Solicitante || s.Nome}
                                        </span>
                                        {s.Area && (
                                            <span className="text-[10px] text-slate-400 truncate block">{s.Area}</span>
                                        )}
                                    </div>
                                </div>
                                {(s.Ramal) && (
                                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded shrink-0">
                                        {s.Ramal}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
