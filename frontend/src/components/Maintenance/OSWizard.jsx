import { useState, useEffect } from 'react';
import { X, Search, Wrench, Camera, Clipboard as ClipboardIcon, CheckCircle, AlertCircle, Trash2, Copy, Plus, Package } from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthProvider';
import SearchStep from '../Wizard/SearchStep';

export default function OSWizard({ isOpen, onClose, onSuccess, preSelectedSerie }) {
    const { user } = useAuth();
    const activeContract = user?.activeContract;
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [equipment, setEquipment] = useState(null);
    const [formData, setFormData] = useState({
        tipo_servico: 'Corretiva',
        pecas: '',
        contador: '',
        mau_uso: false,
        chamado: '',
        obs: '',
        serie_saindo: '',
        evidencias: []
    });
    const [generatedScript, setGeneratedScript] = useState('');
    const [compatibleParts, setCompatibleParts] = useState([]);
    const [selectedParts, setSelectedParts] = useState([]); // Array of {Codigo, Nome, Qtd}

    useEffect(() => {
        if (isOpen && preSelectedSerie) {
            handleAutoSelect(preSelectedSerie);
        } else if (!isOpen) {
            // Reset state when closing
            setStep(1);
            setEquipment(null);
            setFormData({
                tipo_servico: 'Corretiva',
                pecas: '',
                contador: '',
                mau_uso: false,
                chamado: '',
                obs: '',
                serie_saindo: '',
                evidencias: []
            });
            setSelectedParts([]);
        }
    }, [isOpen, preSelectedSerie]);

    const handleAutoSelect = async (serie) => {
        setLoading(true);
        try {
            const res = await api.get(`equipments/${serie}`);
            if (res.data) {
                handleSearchSelect({ equipment: res.data });
            }
        } catch (_error) {
            console.error("Failed to auto-select equipment", _error);
            setStep(1);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSelect = async (data) => {
        setEquipment(data.equipment);
        setStep(2);
        
        // Fetch compatible parts
        try {
            const res = await api.get(`maintenance/parts/compatible?modelo=${encodeURIComponent(data.equipment.Modelo || '')}`);
            setCompatibleParts(res.data);
        } catch (_error) {
            console.error("Failed to fetch compatible parts", _error);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const form = new FormData();
            form.append('serie', equipment.Serie);
            form.append('tipo_servico', formData.tipo_servico);
            form.append('pecas', selectedParts.map(p => `${p.Nome} (${p.Qtd}x)`).join(', '));
            form.append('contador', formData.contador);
            form.append('mau_uso', formData.mau_uso);
            form.append('serie_saindo', formData.serie_saindo);
            
            // Send selected parts as JSON for stock deduction
            form.append('parts_json', JSON.stringify(selectedParts));
            
            if (formData.evidencias && formData.evidencias.length > 0) {
                Array.from(formData.evidencias).forEach(file => {
                    form.append('files', file);
                });
            }
            
            const response = await api.post('maintenance/os', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setGeneratedScript(response.data.teams_script);
            setStep(3);
        } catch (_error) {
            console.error("OS creation failed", _error);
        } finally {
            setLoading(false);
        }
    };

    const copyScript = () => {
        navigator.clipboard.writeText(generatedScript);
        alert("Copiado para o Teams!");
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Wrench size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Abertura de O.S. Técnica</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-8">
                    {/* Step 1: Equipment Search (QoL Improved) */}
                    {step === 1 && (
                        <div className="h-[450px]">
                            <SearchStep 
                                onSelect={handleSearchSelect} 
                                activeContract={activeContract} 
                            />
                        </div>
                    )}

                    {/* Step 2: Form Details */}
                    {step === 2 && equipment && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/20">
                                <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold">
                                    {equipment.Modelo?.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">{equipment.Serie}</p>
                                    <p className="text-xs text-slate-400">{equipment.LocalInstalacao || 'Sem Localização'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tipo de Serviço</label>
                                    <select 
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary"
                                        value={formData.tipo_servico}
                                        onChange={(e) => setFormData({...formData, tipo_servico: e.target.value})}
                                    >
                                        <option>Corretiva</option>
                                        <option>Instalacao</option>
                                        <option>Movimentacao</option>
                                        <option value="AtivacaoBackup">Ativação Backup</option>
                                        <option value="Troca Tecnica">Troca Técnica</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                     <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contador P&B Atual</label>
                                     <input 
                                         type="number"
                                         className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary font-bold"
                                         placeholder="Leitura P&B"
                                         value={formData.contador}
                                         onChange={(e) => setFormData({...formData, contador: e.target.value})}
                                     />
                                 </div>
                                 <div className="space-y-1.5">
                                     <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contador Color Atual</label>
                                     <input 
                                         type="number"
                                         className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary font-bold"
                                         placeholder="Leitura Color (se houver)"
                                         value={formData.contador_color}
                                         onChange={(e) => setFormData({...formData, contador_color: e.target.value})}
                                     />
                                 </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1.5">
                                     <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Leitor de Crachá</label>
                                     <select 
                                         className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary"
                                         value={formData.leitor}
                                         onChange={(e) => setFormData({...formData, leitor: e.target.value})}
                                     >
                                         <option>Sim (Embarcado / FastRelease)</option>
                                         <option>Não</option>
                                         <option>Externo</option>
                                     </select>
                                 </div>
                                 <div className="space-y-1.5">
                                     <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">IP do Equipamento</label>
                                     <input 
                                         type="text"
                                         className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary"
                                         placeholder="0.0.0.0"
                                         value={formData.ip}
                                         onChange={(e) => setFormData({...formData, ip: e.target.value})}
                                     />
                                 </div>
                             </div>

                             {['AtivacaoBackup', 'Troca Tecnica', 'Movimentacao'].includes(formData.tipo_servico) && (
                                 <div className="space-y-1.5 animate-in fade-in duration-300">
                                     <label className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                                         <Trash2 size={12} /> Equipamento Recolhido / Saindo (Série)
                                     </label>
                                     <input 
                                         type="text"
                                         className="w-full bg-primary/5 dark:bg-slate-800 rounded-xl p-3 text-sm border border-primary/20 outline-none focus:ring-2 focus:ring-primary font-bold"
                                         placeholder="Série da máquina que está saindo"
                                         value={formData.serie_saindo}
                                         onChange={(e) => setFormData({...formData, serie_saindo: e.target.value.toUpperCase()})}
                                     />
                                 </div>
                             )}

                             <div className="space-y-3 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                 <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest">
                                     <Camera size={14} /> Comprovante de Contador (Folha de Config)
                                 </div>
                                 <input 
                                     type="file" 
                                     required
                                     accept="image/*,.pdf"
                                     onChange={(e) => setFormData({...formData, config_sheet: e.target.files[0]})}
                                     className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-emerald-500 file:text-white hover:file:bg-emerald-600 transition-all"
                                 />
                                 <p className="text-[9px] text-slate-400">Obrigatório anexar foto da folha de configuração com contadores.</p>
                             </div>

                             <div className="space-y-3">
                                 <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Peças Necessárias (Estoque)</label>
                                 <div className="space-y-2">
                                     {/* Selected Parts List */}
                                     {selectedParts.length > 0 && (
                                         <div className="space-y-1">
                                             {selectedParts.map((p, i) => (
                                                 <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                     <div className="flex flex-col">
                                                         <span className="text-xs font-bold text-slate-800 dark:text-white">{p.Nome}</span>
                                                         <span className="text-[10px] text-slate-400">{p.Codigo}</span>
                                                     </div>
                                                     <div className="flex items-center gap-3">
                                                         <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700">
                                                             <button onClick={() => {
                                                                 const next = [...selectedParts];
                                                                 if (next[i].Qtd > 1) next[i].Qtd--;
                                                                 setSelectedParts(next);
                                                             }} className="text-primary font-bold px-1">-</button>
                                                             <span className="text-xs font-bold w-4 text-center">{p.Qtd}</span>
                                                             <button onClick={() => {
                                                                 const next = [...selectedParts];
                                                                 next[i].Qtd++;
                                                                 setSelectedParts(next);
                                                             }} className="text-primary font-bold px-1">+</button>
                                                         </div>
                                                         <button onClick={() => setSelectedParts(selectedParts.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 p-1">
                                                             <Trash2 size={14} />
                                                         </button>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     )}

                                     {/* Add Part Dropdown/Search */}
                                     <div className="relative">
                                         <select 
                                             className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary appearance-none"
                                             onChange={(e) => {
                                                 const part = compatibleParts.find(p => p.Codigo === e.target.value);
                                                 if (part && !selectedParts.some(p => p.Codigo === part.Codigo)) {
                                                     setSelectedParts([...selectedParts, { Codigo: part.Codigo, Nome: part.Nome, Qtd: 1 }]);
                                                 }
                                                 e.target.value = "";
                                             }}
                                             value=""
                                         >
                                             <option value="" disabled>+ Adicionar Peça Compatível...</option>
                                             {compatibleParts.map(p => (
                                                 <option key={p.Codigo} value={p.Codigo} disabled={p.Quantidade <= 0}>
                                                     {p.Nome} ({p.Codigo}) - Estoque: {p.Quantidade}
                                                 </option>
                                             ))}
                                         </select>
                                         <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                             <Plus size={16} />
                                         </div>
                                     </div>
                                 </div>
                             </div>

                             <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                                 <div className="flex items-center gap-3">
                                     <AlertCircle className="text-red-500" size={20} />
                                     <div>
                                         <p className="text-sm font-bold text-slate-800 dark:text-white">Constatado Mau Uso?</p>
                                         <p className="text-[10px] text-slate-400">Exige Termo de Ciência e Fotos.</p>
                                     </div>
                                 </div>
                                 <input 
                                     type="checkbox" 
                                     className="h-6 w-6 rounded-lg border-none bg-slate-200 dark:bg-slate-700 text-red-500 focus:ring-red-500"
                                     checked={formData.mau_uso}
                                     onChange={(e) => setFormData({...formData, mau_uso: e.target.checked})}
                                 />
                             </div>

                             {formData.mau_uso && (
                                 <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-300">
                                     <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                         <Camera size={14} /> Fotos do Dano / Evidências
                                     </div>
                                     <input 
                                         type="file" 
                                         multiple 
                                         accept="image/*,.pdf"
                                         onChange={(e) => setFormData({...formData, evidencias: e.target.files})}
                                         className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-primary file:text-white hover:file:bg-primary/90 transition-all"
                                     />
                                 </div>
                             )}

                             <div className="flex gap-4 pt-4">
                                <button onClick={() => setStep(1)} className="flex-1 py-4 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Voltar</button>
                                <button 
                                    onClick={handleSubmit}
                                    disabled={!formData.contador || loading}
                                    className="flex-[2] bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Processando...' : 'Finalizar O.S.'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success & Script */}
                    {step === 3 && (
                        <div className="space-y-6 text-center animate-in zoom-in-95 duration-300">
                            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 mb-4">
                                <CheckCircle size={40} />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-2xl font-bold text-slate-800 dark:text-white">O.S. Aberta com Sucesso!</h4>
                                <p className="text-sm text-slate-400 px-8">A manutenção foi registrada. Copie o script abaixo para postar no grupo do Teams.</p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl text-left font-mono text-xs whitespace-pre-wrap border border-slate-200 dark:border-slate-700 relative group">
                                {generatedScript}
                                <button 
                                    onClick={copyScript}
                                    className="absolute right-4 top-4 p-3 bg-white dark:bg-slate-700 rounded-xl shadow-lg border border-slate-100 dark:border-slate-600 hover:text-primary transition-all active:scale-95"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>

                            <button 
                                onClick={onClose}
                                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-bold shadow-xl transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


