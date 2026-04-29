import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { Save, Loader, AlertTriangle, History, X, UserPlus } from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import SolicitanteInput from './SolicitanteInput';
import SolicitanteFormModal from '../Solicitantes/SolicitanteFormModal';

// ─── Estilos responsivos ──────────────────────────────────────────────────────
// Contraste melhorado: slate-700 no light, slate-200 no dark
const inp = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all";
const lbl = "block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 leading-none";
const sec = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-sm";

export default function FormStep({ data, type, activeContract }) {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showAddSolicitante, setShowAddSolicitante] = useState(false);

    const suggestion = data.suggestion || {};
    const warnings = suggestion.warnings || [];
    const [isColorOverride, setIsColorOverride] = useState(data.is_color || false);

    const [form, setForm] = useState({
        protocol: '(Novo)',
        date: new Date().toLocaleDateString('pt-BR'),
        status: data.equipment.Status || data.equipment.STATUS || '',
        serie: data.equipment.Serie || '',
        fila: data.equipment.Fila || '',
        modelo: data.equipment.ModeloSimpress || '',
        empresa: data.equipment.Empresa || '',
        plantaInstalada: data.equipment.PlantaInstalada || '',
        localInstalacao: data.equipment.LocalInstalacao || '',
        ruaRef: data.equipment.RuaRef || '',
        cidade: data.equipment.Cidade || '',
        area: data.equipment.Area || '',
        horario: data.equipment.Horario || '',
        contrato: data.equipment.Contrato || '',
        contatoSetor: data.equipment.ContatoSetor || data.equipment.Contato || '',
        ramalEquip: data.equipment.Ramal || '',
        comDefeito: '',
        analiseFV: '',
        recolha: '',
        solicitante: '',
        telefone: '',
        resmas: suggestion.resmas || 1,
        tonerBk: suggestion.toner_bk || 0,
        tonerCy: suggestion.toner_cy || 0,
        tonerMg: suggestion.toner_mg || 0,
        tonerYw: suggestion.toner_yw || 0,
        counterInitial: data.last_delivery?.counter || 0,
        counterFinal: data.counters?.counter_total || '',
        incidente: '',
        emprestimo: 'Nenhum',
        origem: '',
        obs: '',
    });

    const [extraMappings, setExtraMappings] = useState([]);
    const [extraValues, setExtraValues] = useState({});
    const [production, setProduction] = useState(0);

    useEffect(() => {
        const loadMappings = async () => {
            try {
                const res = await api.get('/data/mappings');
                const mapaExtras = res.data.MAPA?.EXTRAS || [];
                setExtraMappings(mapaExtras);
                const initialExtras = {};
                mapaExtras.forEach(ex => {
                    initialExtras[ex.key] = data.equipment[ex.header] || data.equipment[ex.key] || '';
                });
                setExtraValues(initialExtras);
            } catch { /* silent */ }
        };
        loadMappings();
    }, [data.equipment]);

    useEffect(() => {
        const ini = parseInt(form.counterInitial || 0) || 0;
        const fin = parseInt(form.counterFinal || 0) || 0;
        setProduction(Math.max(0, fin - ini));
    }, [form.counterInitial, form.counterFinal]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...form,
                ...extraValues,
                production,
                solicitacao: type,
                extras_meta: extraMappings,
                endereco: form.localInstalacao,
                rua: form.ruaRef,
                contato: form.contatoSetor,
                ramal: form.ramalEquip || form.telefone,
            };
            await api.post(`/data/entregas?contract_id=${activeContract}`, payload);
            addToast('Protocolo gerado com sucesso!', 'success');
            navigate('/');
        } catch {
            addToast('Erro ao salvar protocolo.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-2 h-full overflow-hidden">

            {/* ── Alerta ── */}
            {warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 flex items-center gap-3 shrink-0">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-tight">
                        {warnings.join(' · ')}
                    </p>
                </div>
            )}

            {/* ── Informações do Equipamento (read-only) — cresce em telas grandes ── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 shadow-sm shrink-0">
                <div className="grid grid-cols-6 gap-x-4 gap-y-2">
                    {/* Linha 1 */}
                    <div>
                        <span className={lbl}>Série</span>
                        <span className="text-sm font-bold text-primary font-mono block">{form.serie}</span>
                    </div>
                    <div>
                        <span className={lbl}>Modelo</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-white block">{form.modelo}</span>
                    </div>
                    <div>
                        <span className={lbl}>Fila</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-white font-mono block">{form.fila}</span>
                    </div>
                    <div>
                        <span className={lbl}>Cidade</span>
                        <span className="text-sm text-slate-800 dark:text-slate-100 block">{form.cidade}</span>
                    </div>
                    <div>
                        <span className={lbl}>Horário</span>
                        <span className="text-sm text-slate-800 dark:text-slate-100 block">{form.horario || '—'}</span>
                    </div>
                    <div>
                        <span className={lbl}>Contrato</span>
                        <span className="text-sm text-slate-800 dark:text-slate-100 block">{form.contrato || '—'}</span>
                    </div>
                    {/* Linha 2 */}
                    <div className="col-span-2">
                        <span className={lbl}>Empresa</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white uppercase block">{form.empresa}</span>
                    </div>
                    <div className="col-span-2">
                        <span className={lbl}>Local de Instalação</span>
                        <span className="text-sm text-slate-800 dark:text-slate-100 block">{form.localInstalacao || '—'}</span>
                    </div>
                    <div>
                        <span className={lbl}>Rua / Ref</span>
                        <span className="text-sm text-slate-800 dark:text-slate-100 block">{form.ruaRef || '—'}</span>
                    </div>
                    <div>
                        <span className={lbl}>Área</span>
                        <span className="text-sm text-slate-800 dark:text-slate-100 block">{form.area || '—'}</span>
                    </div>
                    {/* Linha 3 */}
                    <div className="col-span-2">
                        <span className={lbl}>Contato do Setor</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 block">{form.contatoSetor || '—'}</span>
                    </div>
                    <div>
                        <span className={lbl}>Ramal</span>
                        <span className="text-sm font-mono text-slate-800 dark:text-slate-100 block">{form.ramalEquip || '—'}</span>
                    </div>
                    <div className="col-span-2">
                        <span className={lbl}>Planta Instalada</span>
                        <span className="text-sm text-slate-800 dark:text-slate-100 block">{form.plantaInstalada || '—'}</span>
                    </div>
                </div>
            </div>

            {/* ── Formulário principal: 3 colunas ── */}
            <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">

                {/* Coluna 1: Solicitante (flex-1) + Contadores (fixo) */}
                <div className="flex flex-col gap-1.5 min-h-0">
                    {/* Solicitante cresce para preencher */}
                    <div className={sec + " flex-1 min-h-0 flex flex-col"}>
                        <h3 className={lbl + " mb-1 shrink-0"}>Solicitante</h3>
                        <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar">
                            <div className="space-y-1.5">
                                <div className="grid grid-cols-2 gap-1">
                                    <div>
                                        <label className={lbl}>Canal de Solicitação</label>
                                        <select className={inp} name="solicitacao" value={form.solicitacao || type || 'Telefone'} onChange={handleChange}>
                                            <option value="Telefone">Telefone</option>
                                            <option value="E-mail">E-mail</option>
                                            <option value="Sistema">Sistema</option>
                                            <option value="Proativo">Proativo</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={lbl}>Ramal</label>
                                        <input className={inp} name="telefone" value={form.telefone} onChange={handleChange} placeholder="Ex: 3210" />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className={lbl + " !mb-0"}>Nome do Solicitante</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddSolicitante(true)}
                                            className="flex items-center gap-1 text-[9px] font-bold text-primary hover:text-primary/80 transition-colors"
                                            title="Adicionar novo solicitante"
                                        >
                                            <UserPlus size={12} /> Novo
                                        </button>
                                    </div>
                                    <SolicitanteInput
                                        name="solicitante"
                                        value={form.solicitante}
                                        onChange={handleChange}
                                        onSelect={s => {
                                            if (typeof s === 'string') s = { Nome: s, Ramal: '' };
                                            setForm(p => ({
                                                ...p,
                                                solicitante: s.Nome || s.Solicitante || '',
                                                telefone: s.Ramal || p.telefone,
                                                ramalEquip: p.ramalEquip || s.Ramal || '',
                                            }));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className={lbl}>Nº do Chamado</label>
                                    <input className={inp} name="incidente" value={form.incidente} onChange={handleChange} placeholder="Número do incidente" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contadores — fixo no fundo */}
                    <div className={sec + " shrink-0"}>
                        <h3 className={lbl + " mb-1"}>Contadores</h3>
                        <div className="grid grid-cols-3 gap-1">
                            <div>
                                <label className={lbl}>Inicial</label>
                                <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 truncate">
                                    {parseInt(form.counterInitial || 0).toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>Final</label>
                                <input type="number" className={inp + " font-mono"} name="counterFinal" value={form.counterFinal} onChange={handleChange} placeholder="0" />
                            </div>
                            <div>
                                <label className={lbl}>Produção</label>
                                <div className="bg-primary/10 border border-primary/20 rounded px-2 py-1.5 text-xs font-mono font-bold text-primary text-center">
                                    {production.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coluna 2: Insumos — distribui conteúdo verticalmente */}
                <div className={sec + " flex flex-col min-h-0"}>
                    <h3 className={lbl + " mb-1.5 shrink-0"}>Insumos</h3>

                    <div className="flex flex-col gap-2 flex-1 min-h-0 justify-between">
                        {/* Papel A4 */}
                        <div>
                            <label className={lbl}>Papel A4 (Resmas)</label>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setForm(p => ({ ...p, resmas: Math.max(0, (parseInt(p.resmas) || 0) - 1) }))}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold transition-all text-base shrink-0">−</button>
                                <input type="number" name="resmas" value={form.resmas || 0} onChange={handleChange}
                                    className={inp + " text-center text-xl font-black text-slate-900 dark:text-white py-1.5"} />
                                <button type="button" onClick={() => setForm(p => ({ ...p, resmas: (parseInt(p.resmas) || 0) + 1 }))}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold transition-all text-base shrink-0">+</button>
                            </div>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Média: {data.papel_stats?.media || 0} resmas</p>
                        </div>

                        {/* Papel A3 */}
                        <div>
                            <label className={lbl}>Papel A3 (Resmas)</label>
                            <input type="number" className={inp + " text-center text-lg font-black text-slate-900 dark:text-white"} name="a3" value={form.a3 || 0} onChange={handleChange} />
                        </div>

                        {/* Toners */}
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5">
                            <div className="flex items-center justify-between mb-1">
                                <label className={lbl + " !mb-0"}>Toners</label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Colorido</span>
                                    <div className="relative">
                                        <input type="checkbox" checked={isColorOverride} onChange={e => setIsColorOverride(e.target.checked)} className="sr-only peer" />
                                        <div className="w-7 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-primary transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3"></div>
                                    </div>
                                </label>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest mb-0.5">BK</label>
                                    <input type="number" className={inp + " text-center text-lg font-black text-slate-900 dark:text-white"} name="tonerBk" value={form.tonerBk || 0} onChange={handleChange} />
                                </div>
                                {isColorOverride && (<>
                                    <div>
                                        <label className="block text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest mb-0.5">CY</label>
                                        <input type="number" className={inp + " text-center text-lg font-black text-slate-900 dark:text-white"} name="tonerCy" value={form.tonerCy || 0} onChange={handleChange} />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-widest mb-0.5">MG</label>
                                        <input type="number" className={inp + " text-center text-lg font-black text-slate-900 dark:text-white"} name="tonerMg" value={form.tonerMg || 0} onChange={handleChange} />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest mb-0.5">YW</label>
                                        <input type="number" className={inp + " text-center text-lg font-black text-slate-900 dark:text-white"} name="tonerYw" value={form.tonerYw || 0} onChange={handleChange} />
                                    </div>
                                </>)}
                            </div>
                        </div>

                        {/* Outros */}
                        <div>
                            <label className={lbl}>Outros</label>
                            <input type="number" className={inp + " text-center text-lg font-black text-slate-900 dark:text-white"} name="outros" value={form.outros || 0} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Coluna 3: Validação — distribui verticalmente */}
                <div className={sec + " flex flex-col min-h-0"}>
                    <h3 className={lbl + " mb-1.5 shrink-0"}>Validação</h3>

                    <div className="flex flex-col gap-2 flex-1 min-h-0 justify-between">
                        <div className="grid grid-cols-2 gap-1.5">
                            <div>
                                <label className={lbl}>Análise Física/Visual</label>
                                <input className={inp + " text-center font-bold uppercase"} name="analiseFV" value={form.analiseFV} onChange={handleChange} placeholder="OK" />
                            </div>
                            <div>
                                <label className={lbl}>Com Defeito?</label>
                                <select className={inp} name="comDefeito" value={form.comDefeito} onChange={handleChange}>
                                    <option value="">Não</option>
                                    <option value="Sim">Sim</option>
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Recolher Equipamento?</label>
                                <select className={inp} name="recolha" value={form.recolha} onChange={handleChange}>
                                    <option value="">Não</option>
                                    <option value="Sim">Sim</option>
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Empréstimo de Equipamento</label>
                                <select className={inp} name="emprestimo" value={form.emprestimo} onChange={handleChange}>
                                    <option value="Nenhum">Nenhum</option>
                                    <option value="Emprestado">Emprestado</option>
                                    <option value="Recebido">Recebido</option>
                                </select>
                            </div>
                        </div>

                        {form.emprestimo !== 'Nenhum' && (
                            <div>
                                <label className={lbl}>Origem / Destino</label>
                                <input className={inp} name="origem" value={form.origem} onChange={handleChange} placeholder="Emprestado de/para..." />
                            </div>
                        )}

                        {/* Observações ocupa o espaço restante */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <label className={lbl}>Observações</label>
                            <textarea
                                className={inp + " resize-none flex-1 min-h-[60px]"}
                                name="obs"
                                value={form.obs}
                                onChange={handleChange}
                                placeholder="Notas técnicas..."
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Barra de ações ── */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <button
                    type="button"
                    onClick={() => setShowHistory(true)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all"
                >
                    <History className="h-4 w-4" /> Ver Histórico
                </button>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        style={{ backgroundColor: 'rgb(var(--color-primary))', color: 'white' }}
                        className="flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saving ? 'Gerando...' : 'Gerar Protocolo'}
                    </button>
                </div>
            </div>

            {/* ── Modal de Histórico ── */}
            {showHistory && (
                <HistoryModal
                    history={data.history || []}
                    onClose={() => setShowHistory(false)}
                    serie={form.serie}
                />
            )}

            {/* ── Modal de Novo Solicitante ── */}
            {showAddSolicitante && (
                <SolicitanteFormModal
                    mode="create"
                    onSave={async ({ nome, ramal, obs }) => {
                        await api.post('/data/solicitantes', { nome, ramal, obs }, { params: { contract_id: activeContract } });
                        setForm(p => ({ ...p, solicitante: nome, telefone: ramal || p.telefone }));
                    }}
                    onClose={() => setShowAddSolicitante(false)}
                />
            )}
        </div>
    );
}

function HistoryModal({ history, onClose, serie }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Histórico de Entregas</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Série: <span className="font-bold text-primary">{serie}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar">
                    {history.length === 0 ? (
                        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
                            Nenhuma entrega anterior encontrada.
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs min-w-[800px]">
                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                                <tr>
                                    {['Protocolo', 'Data', 'Contador Final', 'Produção', 'A4', 'Toners', 'Solicitante'].map(h => (
                                        <th key={h} className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[9px]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {history.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3 font-bold text-primary">#{item.Protocolo}</td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.DataEntrega || item.Data}</td>
                                        <td className="px-4 py-3 font-mono text-slate-800 dark:text-white">{item.ContadorFinal || item.ContFinal || '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100 dark:border-emerald-800">
                                                {item.Producao || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-bold border border-primary/20">
                                                {item.A4 || 0}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                {[
                                                    { val: item.TonerPreto || item.TonerBk, cls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
                                                    { val: item.TonerCiano || item.TonerCy, cls: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400' },
                                                    { val: item.TonerMagenta || item.TonerMg, cls: 'bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' },
                                                    { val: item.TonerAmarelo || item.TonerYw, cls: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
                                                ].map((t, i) => (
                                                    <span key={i} className={cn('w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700', t.cls)}>
                                                        {t.val || 0}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{item.Solicitante || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-900/50">
                    <button onClick={onClose} className="px-5 py-2 bg-primary text-white rounded-lg font-bold text-xs hover:bg-primary/90 transition-all">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
