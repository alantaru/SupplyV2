import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { ArrowLeft, Printer, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import ProtocolPrint from './ProtocolPrint';
import SolicitanteInput from '../Wizard/SolicitanteInput';
import { useReactToPrint } from 'react-to-print';

export default function ProtocolEditor() {
    const { addToast } = useToast();
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const printRef = useRef();

    useEffect(() => { loadProtocol(); }, [id]);

    const loadProtocol = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/data/entregas/${id}`);
            setData(res.data);
        } catch {
            addToast("Erro ao carregar protocolo.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Protocolo_${id}`,
    });

    const handleSave = async () => {
        try {
            setSaving(true);
            await api.put(`/data/entregas/${id}`, {
                solicitante: data.Solicitante,
                ramal: data.Ramal,
                solicitacao: data.Solicitacao,
                incidente: data.IncidenteRds,
                analiseFV: data.AnaliseFV,
                counterInitial: data.ContadorInicial,
                counterFinal: data.ContadorFinal,
                production: data.Producao,
                productionReams: data.ProducaoResmas,
                comDefeito: data.ComDefeito,
                recolha: data.Recolha,
                funcionario: data.Funcionario,
                outros: data.Outros,
                tonerBk: data.TonerPreto,
                tonerCy: data.TonerCiano,
                tonerYw: data.TonerAmarelo,
                tonerMg: data.TonerMagenta,
                a4: data.A4,
                a3: data.A3,
                obs: data.Obs,
            });
            addToast("Protocolo salvo com sucesso!", "success");
        } catch {
            addToast("Erro ao salvar.", "error");
        } finally {
            setSaving(false);
        }
    };

    const set = (field, value) => {
        setData(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'ContadorInicial' || field === 'ContadorFinal') {
                const ini = parseInt(next.ContadorInicial) || 0;
                const fin = parseInt(next.ContadorFinal) || 0;
                if (fin >= ini && fin > 0) {
                    next.Producao = fin - ini;
                    next.ProducaoResmas = ((fin - ini) / 500).toFixed(2);
                }
            }
            return next;
        });
    };

    if (loading) return (
        <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
    );

    if (!data?.Protocolo) return (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">Protocolo não encontrado.</div>
    );

    const inp = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all";
    const lbl = "block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";
    const card = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4";

    return (
        <div className="space-y-5 animate-in fade-in duration-300">

            {/* ── Header ── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">Protocolo</span>
                            <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">#{data.Protocolo}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                data.Status === 'Entregue' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                                data.Status === 'Cancelado' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' :
                                'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            }`}>{data.Status || 'Pendente'}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{data.Empresa} · {data.Fila} · {data.Serie}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowPreview(v => !v)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">
                        {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {showPreview ? 'Ocultar' : 'Preview'}
                    </button>
                    <button onClick={() => handlePrint()}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">
                        <Printer className="w-4 h-4" /> Imprimir
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all shadow-md disabled:opacity-50 active:scale-95">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar
                    </button>
                </div>
            </div>

            <div className={`grid gap-5 ${showPreview ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 max-w-2xl'}`}>

                {/* ── Form ── */}
                <div className="space-y-4">

                    {/* Solicitante */}
                    <div className={card}>
                        <h3 className={lbl + " !mb-0"}>Solicitante</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={lbl}>Tipo de Pedido</label>
                                <select className={inp} value={data.Solicitacao || 'Telefone'} onChange={e => set('Solicitacao', e.target.value)}>
                                    <option value="Telefone">Telefone</option>
                                    <option value="E-mail">E-mail</option>
                                    <option value="Sistema">Sistema</option>
                                    <option value="Proativo">Proativo</option>
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Ramal</label>
                                <input className={inp} value={data.Ramal || ''} onChange={e => set('Ramal', e.target.value)} placeholder="Ex: 3210" />
                            </div>
                        </div>
                        <div>
                            <label className={lbl}>Nome do Solicitante</label>
                            <SolicitanteInput
                                name="Solicitante"
                                value={data.Solicitante || ''}
                                onChange={e => set('Solicitante', e.target.value)}
                                onSelect={s => {
                                    if (typeof s === 'string') s = { Nome: s, Ramal: '' };
                                    setData(p => ({ ...p, Solicitante: s.Nome, Ramal: s.Ramal || p.Ramal }));
                                }}
                            />
                        </div>
                        <div>
                            <label className={lbl}>Incidente RDS</label>
                            <input className={inp} value={data.IncidenteRds || ''} onChange={e => set('IncidenteRds', e.target.value)} placeholder="Número do incidente" />
                        </div>
                    </div>

                    {/* Contadores */}
                    <div className={card}>
                        <h3 className={lbl + " !mb-0"}>Contadores & Produção</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={lbl}>Contador Inicial</label>
                                <input type="number" className={inp + " font-mono"} value={data.ContadorInicial || ''} onChange={e => set('ContadorInicial', e.target.value)} />
                            </div>
                            <div>
                                <label className={lbl}>Contador Final</label>
                                <input type="number" className={inp + " font-mono"} value={data.ContadorFinal || ''} onChange={e => set('ContadorFinal', e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center border border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Produção</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-1">{(data.Producao || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center border border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resmas</p>
                                <p className="text-xl font-bold text-primary font-mono mt-1">{data.ProducaoResmas || '0.00'}</p>
                            </div>
                            <div>
                                <label className={lbl}>Análise F/V</label>
                                <input className={inp + " text-center font-bold uppercase"} value={data.AnaliseFV || ''} onChange={e => set('AnaliseFV', e.target.value)} placeholder="OK" />
                            </div>
                        </div>
                    </div>

                    {/* Insumos */}
                    <div className={card}>
                        <h3 className={lbl + " !mb-0"}>Insumos Entregues</h3>
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { key: 'TonerPreto', label: 'Toner BK', accent: 'text-slate-700 dark:text-slate-200' },
                                { key: 'TonerCiano', label: 'Toner CY', accent: 'text-cyan-600 dark:text-cyan-400' },
                                { key: 'TonerAmarelo', label: 'Toner YW', accent: 'text-yellow-600 dark:text-yellow-500' },
                                { key: 'TonerMagenta', label: 'Toner MG', accent: 'text-pink-600 dark:text-pink-400' },
                            ].map(({ key, label, accent }) => (
                                <div key={key}>
                                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${accent}`}>{label}</label>
                                    <input type="number" className={inp + " text-center font-bold"} value={data[key] || 0} onChange={e => set(key, e.target.value)} />
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            {[
                                { key: 'A4', label: 'Papel A4 (Resmas)' },
                                { key: 'A3', label: 'Papel A3 (Resmas)' },
                                { key: 'Outros', label: 'Outros' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <label className={lbl}>{label}</label>
                                    <input type="number" className={inp + " text-center"} value={data[key] || 0} onChange={e => set(key, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Observações & Validação */}
                    <div className={card}>
                        <h3 className={lbl + " !mb-0"}>Observações & Validação</h3>
                        <div>
                            <label className={lbl}>Observações</label>
                            <textarea rows={3} className={inp + " resize-none"} value={data.Obs || ''} onChange={e => set('Obs', e.target.value)} placeholder="Notas técnicas ou anomalias..." />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={lbl}>Funcionário</label>
                                <input className={inp} value={data.Funcionario || ''} onChange={e => set('Funcionario', e.target.value)} placeholder="Nome do técnico" />
                            </div>
                            <div>
                                <label className={lbl}>Competência</label>
                                <input className={inp} value={data.Competencia || ''} onChange={e => set('Competencia', e.target.value)} placeholder="MM/AAAA" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={lbl}>Com Defeito?</label>
                                <select className={inp} value={data.ComDefeito || ''} onChange={e => set('ComDefeito', e.target.value)}>
                                    <option value="">Não</option>
                                    <option value="Sim">Sim</option>
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Recolha?</label>
                                <select className={inp} value={data.Recolha || ''} onChange={e => set('Recolha', e.target.value)}>
                                    <option value="">Não</option>
                                    <option value="Sim">Sim</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Preview ── */}
                {showPreview && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm overflow-auto">
                        <p className={lbl}>Pré-visualização do Protocolo</p>
                        <div className="bg-white rounded-lg overflow-hidden shadow border border-slate-200"
                            style={{ transform: 'scale(0.72)', transformOrigin: 'top left', width: '139%' }}>
                            <ProtocolPrint ref={printRef} data={data} />
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden print target when preview is off */}
            {!showPreview && (
                <div className="hidden">
                    <ProtocolPrint ref={printRef} data={data} />
                </div>
            )}
        </div>
    );
}
