import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, Check } from 'lucide-react';
import { downloadFileFromAPI } from '../../lib/utils';

// ─── CSV helpers ────────────────────────────────────────────────────────────

export function escapeCSV(value) {
    const str = value === null || value === undefined ? '' : String(value);
    // Wrap in double-quotes if contains ; " or newline, escaping " → ""
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

export function generateFrontendCSV(rows, columns) {
    if (!columns || columns.length === 0) return '\uFEFF';

    const header = columns.map(c => escapeCSV(c.label)).join(';');
    const lines = [header];

    for (const row of rows) {
        const line = columns.map(c => escapeCSV(row[c.key])).join(';');
        lines.push(line);
    }

    return '\uFEFF' + lines.join('\r\n');
}

function triggerDownload(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ExportButton — botão de exportação unificado.
 *
 * Props:
 *   tableId          string        — identificador único da tabela (ex: 'dashboard')
 *   data             array         — SortedFilteredData (dados já filtrados/ordenados)
 *   visibleColumns   array         — [{ key, label }] colunas visíveis na ordem atual
 *   backendEndpoint  string|null   — endpoint para modo "Tabela completa" (null = só visible)
 *   backendParams    object        — params para downloadFileFromAPI
 *   backendFilename  string        — nome do arquivo para download backend
 *   filename         string        — nome base do arquivo frontend (default: tableId)
 */
export default function ExportButton({
    tableId,
    data = [],
    visibleColumns = [],
    backendEndpoint = null,
    backendParams = {},
    backendFilename,
    filename,
}) {
    const lsKey = `export-mode-${tableId}`;
    const hasBackend = !!backendEndpoint;

    const [mode, setMode] = useState(() => {
        try {
            const saved = localStorage.getItem(lsKey);
            if (saved === 'visible' || saved === 'full') return saved;
        } catch (_) {}
        return hasBackend ? 'full' : 'visible';
    });

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Persist mode
    useEffect(() => {
        try { localStorage.setItem(lsKey, mode); } catch (_) {}
    }, [mode, lsKey]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleExport = () => {
        if (mode === 'visible') {
            const csv = generateFrontendCSV(data, visibleColumns);
            const name = filename ? `${filename}.csv` : `${tableId}_export.csv`;
            triggerDownload(csv, name);
        } else {
            downloadFileFromAPI(
                backendEndpoint,
                backendFilename || `${tableId}_completo.csv`,
                backendParams
            );
        }
        setIsOpen(false);
    };

    const modeLabel = mode === 'visible' ? 'Colunas visíveis' : 'Tabela completa';

    return (
        <div className="relative flex" ref={dropdownRef}>
            {/* Main export button */}
            <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-l-xl text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm border-r-0"
                title={`Exportar CSV — ${modeLabel}`}
            >
                <Download size={14} className="text-primary" />
                <span>Exportar CSV</span>
            </button>

            {/* Dropdown toggle */}
            <button
                onClick={() => setIsOpen(v => !v)}
                className={`flex items-center justify-center px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-r-xl text-xs font-bold text-slate-500 dark:text-slate-400 transition-all shadow-sm ${
                    isOpen
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                title="Opções de exportação"
            >
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2.5 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            Modo de exportação
                        </p>
                    </div>
                    <div className="p-2 space-y-1">
                        <button
                            onClick={() => { setMode('visible'); setIsOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                mode === 'visible'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                mode === 'visible' ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                                {mode === 'visible' && <Check size={10} className="text-white" />}
                            </div>
                            <div className="text-left">
                                <div>Colunas visíveis</div>
                                <div className="text-[9px] font-normal opacity-70">Dados filtrados em tela</div>
                            </div>
                        </button>

                        {hasBackend && (
                            <button
                                onClick={() => { setMode('full'); setIsOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                    mode === 'full'
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                    mode === 'full' ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'
                                }`}>
                                    {mode === 'full' && <Check size={10} className="text-white" />}
                                </div>
                                <div className="text-left">
                                    <div>Tabela completa</div>
                                    <div className="text-[9px] font-normal opacity-70">Todos os dados do servidor</div>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
