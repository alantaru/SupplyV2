import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, AlertTriangle, ArrowRight, CheckCircle2, XCircle, Eye, X, RefreshCcw } from 'lucide-react';

const FIELD_LABELS = {
    SERIE: 'Número de Série', TOTAL: 'Contador Total', DATA: 'Data de Leitura',
    '%BK': 'Toner Preto (%)', '%CY': 'Toner Ciano (%)', '%Mg': 'Toner Magenta (%)', '%Yw': 'Toner Amarelo (%)',
    A4RESMA: 'Meta de Papel (Resmas)', MEDIA: 'Média Mensal (Folhas)',
    FILA: 'Fila / Hostname', MODELOSIMPRESS: 'Modelo do Equipamento', STATUS: 'Status',
    LOCALINSTALACAO: 'Local de Instalação', RUAREF: 'Rua / Referência', CIDADE: 'Cidade',
    EMPRESA: 'Empresa / Unidade', PLANTAINSTALADA: 'Planta Instalada', AREA: 'Área / Setor',
    CONTRATO: 'Contrato', HORARIO: 'Horário', CONTATOSETOR: 'Contato do Setor',
    RAMAL: 'Ramal / Telefone', ALMOXARIFADO: 'Almoxarifado',
};
function fieldLabel(col) { return FIELD_LABELS[col] || FIELD_LABELS[col?.toUpperCase()] || col; }

export default function ColumnMappingModal({ isOpen, onClose, checkResult, onConfirm, isLoading }) {
    const [mapping, setMapping] = useState({});
    const [saveForFuture, setSaveForFuture] = useState(true);
    const [showPreview, setShowPreview] = useState(false);
    const [showNonEssential, setShowNonEssential] = useState(false);

    useEffect(() => {
        if (!checkResult) return;
        const { detected_columns = [], required_columns = [], optional_columns = [], current_mapping = {} } = checkResult;
        const initial = {};
        [...required_columns, ...optional_columns].forEach(sysCol => {
            const mappingKey = Object.keys(current_mapping).find(k => k.toUpperCase() === sysCol.toUpperCase());
            const fromMap = mappingKey ? current_mapping[mappingKey] : undefined;
            if (fromMap && detected_columns.includes(fromMap)) {
                initial[sysCol] = fromMap;
            } else {
                const direct = detected_columns.find(c => c.toUpperCase() === sysCol.toUpperCase());
                if (direct) initial[sysCol] = direct;
            }
        });
        setMapping(initial);
    }, [checkResult]);

    if (!isOpen || !checkResult) return null;

    const {
        detected_columns = [], required_columns = [], optional_columns = [],
        missing_essential_optional = [], temp_token, file_key, preview_data = []
    } = checkResult;

    const handleMapChange = (col, val) => setMapping(p => ({ ...p, [col]: val }));
    const handleIgnore = (col) => setMapping(p => ({ ...p, [col]: '' }));
    const handleUnignore = (col) => setMapping(p => { const n = { ...p }; delete n[col]; return n; });

    const isRequiredComplete = required_columns.every(col => !!mapping[col]);
    const undecidedEssential = missing_essential_optional.filter(col => mapping[col] === undefined);
    // canConfirm: only requires that REQUIRED fields are mapped.
    // Essential optional fields (FILA, MODELOSIMPRESS, etc.) are suggestions — user can ignore them.
    // The "Confirmar" button is enabled as soon as all required fields are mapped.
    const canConfirm = isRequiredComplete;

    const essentialOptionalToShow = optional_columns.filter(col =>
        missing_essential_optional.some(m => m.toUpperCase() === col.toUpperCase())
    );
    const nonEssentialOptional = optional_columns.filter(col => !essentialOptionalToShow.includes(col));

    const handleConfirm = () => onConfirm({ temp_token, file_key, mapping, save_for_future: saveForFuture });

    return createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
            {/* Modal container — flex column with fixed header/footer and scrollable body */}
            <div
                className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-4xl flex flex-col border border-slate-200 dark:border-slate-700"
                style={{ maxHeight: '92vh' }}
            >
                {/* ── HEADER (fixed) ── */}
                <div className="shrink-0 p-5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start rounded-t-2xl sm:rounded-t-xl">
                    <div className="flex gap-3">
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-xl h-10 w-10 flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mapeamento de Colunas</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                                Arquivo <span className="font-mono font-bold text-primary">{file_key}</span> — associe as colunas do CSV aos campos do sistema.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        {preview_data.length > 0 && (
                            <button onClick={() => setShowPreview(true)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                                <Eye className="h-3.5 w-3.5" /> Ver CSV
                            </button>
                        )}
                        {canConfirm
                            ? <span className="text-green-600 font-bold flex items-center gap-1 text-xs whitespace-nowrap"><CheckCircle2 size={14} /> Pronto</span>
                            : <span className="text-amber-600 font-bold flex items-center gap-1 text-xs whitespace-nowrap"><XCircle size={14} /> Pendente</span>
                        }
                    </div>
                </div>

                {/* ── BODY (scrollable) ── */}
                <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5 bg-slate-50/50 dark:bg-slate-900">

                    {required_columns.length > 0 && (
                        <Section title="Campos Obrigatórios" dotColor="bg-red-500"
                            description="O arquivo não pode ser importado sem estes campos.">
                            {required_columns.map(col => (
                                <MappingRow key={col} sysCol={col} value={mapping[col]}
                                    detected_columns={detected_columns} variant="required" onChange={handleMapChange} />
                            ))}
                        </Section>
                    )}

                    {essentialOptionalToShow.length > 0 && (
                        <Section title="Campos do Protocolo" dotColor="bg-amber-400"
                            description="Estes campos preenchem o protocolo de entrega. Mapeie ou escolha Ignorar."
                            badge={undecidedEssential.length > 0 ? `${undecidedEssential.length} pendente${undecidedEssential.length > 1 ? 's' : ''}` : null}>
                            {essentialOptionalToShow.map(col => {
                                const isIgnored = mapping[col] === '';
                                const isUndecided = mapping[col] === undefined;
                                return (
                                    <MappingRow key={col} sysCol={col} value={mapping[col]}
                                        detected_columns={detected_columns}
                                        variant={isIgnored ? 'ignored' : isUndecided ? 'undecided' : 'recommended'}
                                        onChange={handleMapChange} onIgnore={handleIgnore}
                                        onUnignore={handleUnignore} isIgnored={isIgnored} />
                                );
                            })}
                        </Section>
                    )}

                    {nonEssentialOptional.length > 0 && (
                        <div>
                            <button onClick={() => setShowNonEssential(v => !v)}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-widest flex items-center gap-2 transition-colors">
                                <span>{showNonEssential ? '▾' : '▸'}</span>
                                Campos Adicionais ({nonEssentialOptional.length})
                            </button>
                            {showNonEssential && (
                                <div className="mt-3 space-y-2">
                                    {nonEssentialOptional.map(col => (
                                        <MappingRow key={col} sysCol={col} value={mapping[col]}
                                            detected_columns={detected_columns} variant="optional" onChange={handleMapChange} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Colunas detectadas no CSV ({detected_columns.length})</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {detected_columns.map(col => (
                                <span key={col} className="text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600">{col}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── FOOTER (fixed, always visible) ── */}
                <div className="shrink-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center rounded-b-xl">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={saveForFuture} onChange={e => setSaveForFuture(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 accent-primary" />
                        <span className="text-xs text-slate-600 dark:text-slate-300">Lembrar para futuros uploads</span>
                    </label>
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleConfirm} disabled={!canConfirm || isLoading}
                            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-lg transition-all shadow-md
                                ${canConfirm && !isLoading ? 'bg-primary hover:bg-primary/90 active:scale-95' : 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed opacity-60'}`}>
                            {isLoading
                                ? <><RefreshCcw className="h-4 w-4 animate-spin" /> Processando...</>
                                : <><Save className="h-4 w-4" /> Confirmar Importação</>
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview modal */}
            {showPreview && (
                <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-[95vw] h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Eye className="h-5 w-5 text-primary" /> Pré-visualização — {detected_columns.length} colunas
                            </h3>
                            <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <table className="text-left text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden min-w-max">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500 font-bold sticky top-0">
                                    <tr>{detected_columns.map(col => <th key={col} className="px-4 py-3 border-b border-r border-slate-200 dark:border-slate-700 whitespace-nowrap last:border-r-0">{col}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                    {preview_data.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            {detected_columns.map(col => <td key={col} className="px-4 py-2 whitespace-nowrap border-r border-slate-100 dark:border-slate-800/50 last:border-r-0">{row[col]}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}

function Section({ title, dotColor, description, badge, children }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{title}</h3>
                {badge && <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">{badge}</span>}
            </div>
            {description && <p className="text-xs text-slate-400 dark:text-slate-500 ml-4">{description}</p>}
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function MappingRow({ sysCol, value, detected_columns, variant, onChange, onIgnore, onUnignore, isIgnored }) {
    const label = fieldLabel(sysCol);
    const isMapped = !!value;

    const containerClass = {
        required: isMapped ? 'border-green-200 dark:border-green-900/50 bg-white dark:bg-slate-800' : 'border-red-200 dark:border-red-900/50 bg-red-50/30',
        recommended: isMapped ? 'border-green-200 dark:border-green-900/50 bg-white dark:bg-slate-800' : 'border-amber-200 dark:border-amber-900/50 bg-amber-50/30',
        undecided: 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-200 dark:ring-amber-800',
        ignored: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60',
        optional: isMapped ? 'border-green-200 dark:border-green-900/50 bg-white dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800',
    }[variant] || 'border-slate-200 bg-white dark:bg-slate-800';

    const badgeEl = {
        required: <span className="text-[9px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded font-bold">Obrigatório</span>,
        recommended: <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">Protocolo</span>,
        undecided: <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold animate-pulse">Decidir</span>,
        ignored: <span className="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded">Ignorado</span>,
        optional: <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">Opcional</span>,
    }[variant];

    return (
        <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${containerClass}`}>
            <div className="w-44 shrink-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-slate-800 dark:text-white">{label}</span>
                    {badgeEl}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{sysCol}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
            <div className="flex-1 min-w-0">
                {isIgnored ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 italic flex-1">Campo ignorado</span>
                        <button onClick={() => onUnignore(sysCol)} className="text-xs text-primary hover:underline font-bold shrink-0">Desfazer</button>
                    </div>
                ) : (
                    <select value={value || ''} onChange={e => onChange(sysCol, e.target.value)}
                        className={`w-full p-2 rounded-md border text-sm outline-none transition-all appearance-none cursor-pointer
                            ${isMapped ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 text-green-800 dark:text-green-300 font-medium'
                                : variant === 'required' ? 'border-red-300 dark:border-red-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-white'
                                : variant === 'undecided' ? 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200'}`}>
                        <option value="">— Selecione a coluna —</option>
                        {detected_columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                )}
            </div>
            {(variant === 'recommended' || variant === 'undecided') && !isIgnored && onIgnore && (
                <button onClick={() => onIgnore(sysCol)}
                    className="shrink-0 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
                    Ignorar
                </button>
            )}
        </div>
    );
}
