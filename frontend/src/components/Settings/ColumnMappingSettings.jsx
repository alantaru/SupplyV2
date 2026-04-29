import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthProvider';
import { Save, AlertCircle, RefreshCw, LayoutTemplate } from 'lucide-react';

const MAPPING_FILES = [
    { key: 'MAPA', label: 'Mapa de Equipamentos' },
    { key: 'CONTADORES', label: 'Contadores' },
    { key: 'PAPEL', label: 'Meta de Papel' },
];

export default function ColumnMappingSettings({ embeddedFileKey = null, activeContractId = null }) {
    const { user } = useAuth();
    // FIX: activeContract is on user object, not directly from useAuth()
    const activeContract = activeContractId || user?.activeContract;
    const [activeFile, setActiveFile] = useState(embeddedFileKey || 'MAPA');

    // Data State
    const [requiredCols, setRequiredCols] = useState([]);
    const [optionalCols, setOptionalCols] = useState([]);
    const [detectedHeaders, setDetectedHeaders] = useState([]); // [Header1, Header2] from CSV

    // UI State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedMapping, setSavedMapping] = useState({}); // Persisted mapping from backend
    const [tempMapping, setTempMapping] = useState({}); // Editable state
    const [extras, setExtras] = useState([]); // [{key, label, header, category}]
    const [status, setStatus] = useState(null);

    // activeContract is now implicitly handled by the backend session via /data endpoints
    // But we still use it to trigger reload if context changes

    useEffect(() => {
        // Since we use session-based auth now (/data endpoints), we don't strictly need activeContract
        // But we want to reload if the user switches files
        loadData();
    }, [activeFile]);

    const loadData = async () => {
        try {
            setLoading(true);
            setStatus(null);

            // 1. Get Saved Mappings
            const mapRes = await api.get(`/data/mappings`);
            const fileMapping = mapRes.data[activeFile] || {};
            
            // Extract Extras if exist
            const savedExtras = fileMapping.EXTRAS || [];
            setExtras(savedExtras);

            // Clean fileMapping for tempMapping (excluding EXTRAS)
            const cleanBaseMapping = { ...fileMapping };
            delete cleanBaseMapping.EXTRAS;

            // Normalize keys: build a case-insensitive lookup so %Mg matches %MG etc.
            // The canonical keys from the backend may differ in case from OPTIONAL_HEADERS
            const normalizedMapping = {};
            Object.entries(cleanBaseMapping).forEach(([k, v]) => {
                normalizedMapping[k] = v; // keep original
            });

            setSavedMapping(normalizedMapping);
            setTempMapping(normalizedMapping);

            // 2. Get Columns Spec
            const colRes = await api.get(`/data/columns/${activeFile}`);
            setRequiredCols(colRes.data.required || []);
            setOptionalCols(colRes.data.optional || []);

            // 3. Get Detected Headers
            try {
                const headRes = await api.get(`/data/files/${activeFile}/headers`);
                setDetectedHeaders(headRes.data.headers || []);
            } catch (err) {
                setDetectedHeaders([]);
            }

        } catch (error) {
            setStatus({ type: 'error', msg: "Erro ao carregar dados. Verifique permissões." });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setStatus(null);

            // Clean empty keys
            const cleanMapping = {};
            Object.entries(tempMapping).forEach(([k, v]) => {
                if (v && v.trim()) cleanMapping[k] = v.trim();
            });

            // Include Extras
            if (extras.length > 0) {
                cleanMapping.EXTRAS = extras.filter(e => e.label && e.header);
            }

            await api.put(`/data/mappings/${activeFile}`, cleanMapping);

            setSavedMapping(cleanMapping);
            setStatus({ type: 'success', msg: "Mapeamento salvo com sucesso!" });
        } catch (error) {

            setStatus({ type: 'error', msg: "Erro ao salvar mapeamento." });
        } finally {
            setSaving(false);
        }
    };

    const addExtra = () => {
        setExtras(prev => [
            ...prev,
            { key: `CUSTOM_${Date.now()}`, label: '', header: '', category: 'endereco' }
        ]);
    };

    const removeExtra = (key) => {
        setExtras(prev => prev.filter(e => e.key !== key));
    };

    const updateExtra = (key, field, value) => {
        setExtras(prev => prev.map(e => e.key === key ? { ...e, [field]: value } : e));
    };

    const handleChange = (sysCol, value) => {
        // Find the actual key in tempMapping (case-insensitive) or use sysCol
        const existingKey = Object.keys(tempMapping).find(
            k => k.toUpperCase() === sysCol.toUpperCase()
        ) || sysCol;
        setTempMapping(prev => ({
            ...prev,
            [existingKey]: value
        }));
    };

    const MappingRow = ({ sysCol, isOptional }) => {
        // Case-insensitive lookup: the saved key might be %MG but sysCol is %Mg
        const mappingKey = Object.keys(tempMapping).find(
            k => k.toUpperCase() === sysCol.toUpperCase()
        ) || sysCol;
        const value = tempMapping[mappingKey] || "";
        const savedKey = Object.keys(savedMapping).find(
            k => k.toUpperCase() === sysCol.toUpperCase()
        ) || sysCol;
        const originalValue = savedMapping[savedKey] || "";
        const isModified = value !== originalValue;

        // Manual vs Dropdown
        const isManualValue = value && detectedHeaders.length > 0 && !detectedHeaders.includes(value);

        return (
            <div className={`grid grid-cols-12 gap-4 p-3 items-center border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors`}>
                {/* System Column Label */}
                <div className="col-span-12 md:col-span-5">
                    <div className="flex items-center gap-2">
                        <span className={`font-mono text-sm ${isOptional ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white font-bold'}`}>
                            {sysCol}
                        </span>
                        {!isOptional && (
                            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">
                                Obrigatório
                            </span>
                        )}
                    </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex col-span-1 justify-center text-slate-300">
                    →
                </div>

                {/* User Input / Dropdown */}
                <div className="col-span-12 md:col-span-6 relative">
                    {detectedHeaders.length > 0 ? (
                        <div className="relative">
                            <select
                                value={value}
                                onChange={(e) => handleChange(sysCol, e.target.value)}
                                className={`w-full text-sm rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none
                                    ${isModified
                                        ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10'
                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white'
                                    }`}
                            >
                                <option value="">(Automático / Vazio)</option>
                                {/* If saved value is not in detectedHeaders, show it as a pinned option */}
                                {isManualValue && (
                                    <option key={`__saved__${value}`} value={value}>{value} ★</option>
                                )}
                                {detectedHeaders.map(h => (
                                    <option key={h} value={h}>{h}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-3 pointer-events-none text-slate-400">
                                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                            </div>
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleChange(sysCol, e.target.value)}
                            placeholder="Nome da coluna..."
                            className={`w-full text-sm rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 transition-all
                                ${isModified
                                    ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white'
                                }`}
                        />
                    )}

                    {isOptional && !value && (
                        <div className={`absolute ${detectedHeaders.length > 0 ? 'right-10' : 'right-3'} top-2.5 text-[10px] text-slate-400 pointer-events-none uppercase`}>Ignorado</div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-xl ${embeddedFileKey ? 'mt-4 border-t border-slate-100 dark:border-slate-700 pt-4' : 'shadow border border-slate-200 dark:border-slate-700 overflow-hidden'}`}>
            {/* Header - Conditional */}
            {!embeddedFileKey && (
                <div className="bg-slate-50 dark:bg-slate-700 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <LayoutTemplate className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            Mapeamento de Colunas
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Defina como as colunas do seu Excel correspondem aos campos do sistema para futuros uploads.
                        </p>
                    </div>

                    <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-600">
                        {MAPPING_FILES.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setActiveFile(f.key)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${activeFile === f.key
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className={embeddedFileKey ? "px-0" : "p-0"}>
                {loading ? (
                    <div className="p-12 flex justify-center text-slate-400">
                        <RefreshCw className="animate-spin w-6 h-6" />
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {/* Info Alert - Hide if embedded to save space, or simplify */}
                        <div className="bg-primary/5 p-4 flex gap-3 text-sm text-primary">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="font-bold">Mapeamento de Importação</p>
                                <p className="opacity-90 mt-1 text-xs">
                                    {detectedHeaders.length > 0
                                        ? "Selecione a coluna do seu arquivo que corresponde a cada campo do sistema."
                                        : "Nenhum arquivo encontrado ou inválido. Digite os nomes das colunas manualmente."
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="p-4 space-y-6">
                            {/* Required */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-3">Campos Obrigatórios</h3>
                                <div className="border rounded-lg border-slate-200 dark:border-slate-700 overflow-hidden">
                                    {requiredCols.map(col => <MappingRow key={col} sysCol={col} isOptional={false} />)}
                                </div>
                            </div>

                            {/* Optional */}
                            {optionalCols.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-3">Campos Opcionais</h3>
                                    <div className="border rounded-lg border-slate-200 dark:border-slate-700 overflow-hidden">
                                        {optionalCols.map(col => <MappingRow key={col} sysCol={col} isOptional={true} />)}
                                    </div>
                                </div>
                            )}

                            {/* Extras (Custom) */}
                            {activeFile === 'MAPA' && (
                                <div>
                                    <div className="flex items-center justify-between mb-3 px-3">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Campos Customizados (Protocolo)</h3>
                                        <button
                                            onClick={addExtra}
                                            className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded font-bold hover:opacity-80 transition-opacity"
                                        >
                                            + ADICIONAR CAMPO
                                        </button>
                                    </div>
                                    <div className="border rounded-lg border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                                        {extras.length === 0 && (
                                            <div className="p-6 text-center text-slate-400 text-xs italic">
                                                Nenhum campo customizado definido.
                                            </div>
                                        )}
                                        {extras.map((ex, idx) => (
                                            <div key={ex.key} className="grid grid-cols-12 gap-3 p-3 items-center bg-slate-50/30 dark:bg-slate-800/30">
                                                <div className="col-span-3">
                                                    <input
                                                        placeholder="Label (Ex: Ponto Ref)"
                                                        value={ex.label}
                                                        onChange={(e) => updateExtra(ex.key, 'label', e.target.value)}
                                                        className="w-full text-xs rounded border border-slate-200 dark:border-slate-600 px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white outline-none"
                                                    />
                                                </div>
                                                <div className="col-span-1 text-center text-slate-300">→</div>
                                                <div className="col-span-4">
                                                    <select
                                                        value={ex.header}
                                                        onChange={(e) => updateExtra(ex.key, 'header', e.target.value)}
                                                        className="w-full text-xs rounded border border-slate-200 dark:border-slate-600 px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white outline-none"
                                                    >
                                                        <option value="">Selecione Coluna...</option>
                                                        {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                    </select>
                                                </div>
                                                <div className="col-span-3">
                                                    <select
                                                        value={ex.category}
                                                        onChange={(e) => updateExtra(ex.key, 'category', e.target.value)}
                                                        className="w-full text-xs rounded border border-slate-200 dark:border-slate-600 px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white outline-none"
                                                    >
                                                        <option value="endereco">Endereço</option>
                                                        <option value="contato">Contato</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <button onClick={() => removeExtra(ex.key)} className="text-red-400 hover:text-red-600 p-1">
                                                        <Save className="w-4 h-4 rotate-45" /> {/* Use rotate Save as X or Import X */}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className={`flex justify-between items-center ${embeddedFileKey ? 'mt-4 pt-4 border-t border-slate-100 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-700/50 p-4 border-t border-slate-200 dark:border-slate-700'}`}>
                {!embeddedFileKey && (
                    <div className="text-xs font-mono text-slate-400">
                        Editando: {activeFile}
                    </div>
                )}

                <div className={`flex items-center gap-4 ${embeddedFileKey ? 'w-full justify-end' : ''}`}>
                    {status && (
                        <span className={`text-sm font-medium ${status.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                            {status.msg}
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={loading || saving}
                        className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Mapeamento
                    </button>
                </div>
            </div>
        </div>
    );
}
