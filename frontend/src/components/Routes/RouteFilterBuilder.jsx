import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Filter, Loader } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthProvider';

const AVAILABLE_FIELDS = [
    { label: 'Cidade',        value: 'Cidade' },
    { label: 'Status',        value: 'Status' },
    { label: 'Modelo',        value: 'ModeloSimpress' },
    { label: 'Fila / Hostname', value: 'Fila' },
    { label: 'Empresa',       value: 'Empresa' },
    { label: 'Rua / Ref.',    value: 'RuaRef' },
    { label: 'Planta',        value: 'PlantaInstalada' },
    { label: 'Setor / Área',  value: 'Area' },
    { label: 'Contrato',      value: 'Contrato' },
];

export default function RouteFilterBuilder({ onFiltersChange, initialFilters = [], contract_id }) {
    const { user } = useAuth();
    const contractId = contract_id || user?.activeContract || user?.contract_id;

    // Sync initialFilters when the prop changes (e.g. editing an existing route)
    const [filters, setFilters] = useState(initialFilters);
    useEffect(() => {
        setFilters(initialFilters);
    }, [JSON.stringify(initialFilters)]); // eslint-disable-line react-hooks/exhaustive-deps

    const [field, setField]   = useState(AVAILABLE_FIELDS[0].value);
    const [value, setValue]   = useState('');

    const [availableValues, setAvailableValues] = useState([]);
    const [loadingValues,   setLoadingValues]   = useState(false);

    // Track previous field to know when to reset the value selector
    const prevFieldRef = useRef(field);

    // Stable fetch function — recreated only when contractId changes
    const fetchValues = useCallback(async (targetField, activeFilters) => {
        if (!contractId) return;
        setLoadingValues(true);
        setAvailableValues([]);
        try {
            const res = await api.post(
                `/data/mapa/unique/${targetField}`,
                { current_filters: activeFilters },
                { params: { contract_id: contractId } }
            );
            setAvailableValues(Array.isArray(res.data) ? res.data : []);
        } catch {
            setAvailableValues([]);
        } finally {
            setLoadingValues(false);
        }
    }, [contractId]);

    // Re-fetch when field changes OR when filters change (cascade)
    useEffect(() => {
        const fieldChanged = prevFieldRef.current !== field;
        prevFieldRef.current = field;

        if (fieldChanged) {
            setValue(''); // Only reset selected value when the field selector itself changes
        }

        fetchValues(field, filters);
    }, [field, filters, fetchValues]);

    const handleAdd = () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        const newFilters = [...filters, { field, value: trimmed }];
        setFilters(newFilters);
        setValue('');
        onFiltersChange(newFilters);
    };

    const handleRemove = (index) => {
        const newFilters = filters.filter((_, i) => i !== index);
        setFilters(newFilters);
        onFiltersChange(newFilters);
    };

    return (
        <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Filter size={12} /> Filtros da Rota
            </h4>

            {/* Input Row */}
            <div className="flex gap-2 min-w-0">
                {/* Field selector */}
                <select
                    className="border border-slate-300 dark:border-slate-600 rounded text-sm p-1.5 focus:ring-2 focus:ring-primary outline-none bg-white dark:bg-slate-700 dark:text-slate-200 w-1/3 min-w-[80px]"
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                >
                    {AVAILABLE_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                </select>

                {/* Value selector */}
                <div className="flex-1 relative min-w-[80px]">
                    <select
                        className="w-full border border-slate-300 dark:border-slate-600 rounded text-sm p-1.5 focus:ring-2 focus:ring-primary outline-none bg-white dark:bg-slate-700 dark:text-slate-200 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        disabled={loadingValues || availableValues.length === 0}
                    >
                        <option value="">
                            {loadingValues
                                ? 'Carregando...'
                                : availableValues.length === 0
                                    ? 'Sem valores disponíveis'
                                    : 'Escolha um valor...'}
                        </option>
                        {availableValues.map((v, idx) => (
                            <option key={idx} value={v}>{v}</option>
                        ))}
                    </select>
                    {loadingValues && (
                        <div className="absolute right-2 top-2 pointer-events-none">
                            <Loader size={14} className="animate-spin text-slate-400" />
                        </div>
                    )}
                </div>

                {/* Add button */}
                <button
                    onClick={handleAdd}
                    className="bg-primary text-white p-1.5 rounded hover:bg-primary/90 transition disabled:opacity-40"
                    disabled={loadingValues || !value}
                    title="Adicionar filtro"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Active filter chips */}
            {filters.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                    {filters.map((f, i) => {
                        const fieldLabel = AVAILABLE_FIELDS.find(af => af.value === f.field)?.label || f.field;
                        return (
                            <div
                                key={i}
                                className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-primary/20 text-primary text-xs px-2 py-1 rounded-full shadow-sm"
                            >
                                <span className="font-semibold">{fieldLabel}:</span>
                                <span>{f.value}</span>
                                <button
                                    onClick={() => handleRemove(i)}
                                    className="ml-1 text-primary/60 hover:text-red-500 transition-colors"
                                    title="Remover filtro"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Dica: adicione vários valores do mesmo campo para ampliar a busca (OR). Campos diferentes se combinam (AND).
            </p>
        </div>
    );
}
