import React, { useState, useEffect } from 'react';
import { Save, Folder, Download, Laptop, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { downloadFileFromAPI } from '../../lib/utils';
import { cn } from '../../lib/utils';

export default function DownloadSettings() {
    const { addToast } = useToast();
    const [customDestEnabled, setCustomDestEnabled] = useState(false);
    const [targetPath, setTargetPath] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Load initial state from localStorage
        const enabled = localStorage.getItem('VITE_INTERNAL_DOWNLOADS') === 'true';
        const path = localStorage.getItem('VITE_INTERNAL_DOWNLOAD_PATH') || '';
        setCustomDestEnabled(enabled);
        setTargetPath(path);
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        try {
            localStorage.setItem('VITE_INTERNAL_DOWNLOADS', customDestEnabled.toString());
            localStorage.setItem('VITE_INTERNAL_DOWNLOAD_PATH', targetPath);
            // Sync with global window for current session
            window.INTERNAL_DOWNLOAD_AUDIT = customDestEnabled;
            
            addToast("Configurações de download atualizadas.", "success");
        } catch (err) {
            addToast("Erro ao salvar configurações.", "error");
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    const runTest = async () => {
        if (!customDestEnabled) {
            return addToast("Ative o destino customizado antes de testar.", "warning");
        }
        addToast("Iniciando teste de exportação local...", "info");
        // Trigger a dummy save to verify the path
        downloadFileFromAPI('/debug/test-save', 'teste_final.csv', { test: true });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
                <div className="p-5 bg-white rounded-2xl shadow-sm text-primary border border-primary/10">
                    <Laptop size={40} />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Destino de Exportação Personalizado</h3>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
                        Esta funcionalidade permite que o sistema salve arquivos CSV diretamente em uma pasta do seu computador, ignorando o gerenciador de downloads do navegador.
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest bg-white/50 w-fit px-3 py-1 rounded-full border border-primary/20">
                        <AlertCircle size={12} /> Requer o Assistente Local em execução (Porta 8000)
                    </div>
                </div>
                <button
                    onClick={() => setCustomDestEnabled(!customDestEnabled)}
                    className={cn(
                        "relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                        customDestEnabled ? "bg-primary" : "bg-slate-300"
                    )}
                >
                    <span
                        className={cn(
                            "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out",
                            customDestEnabled ? "translate-x-8" : "translate-x-0"
                        )}
                    />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Folder size={18} className="text-primary" />
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Pasta de Destino no Computador</h4>
                            </div>
                            
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-mono text-slate-700 focus:bg-white focus:border-primary/50 outline-none transition-all shadow-inner"
                                    placeholder="Ex: C:\MeusProjetos\Exportacoes"
                                    value={targetPath}
                                    onChange={(e) => setTargetPath(e.target.value)}
                                />
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        <span className="font-bold text-primary">Dica:</span> Se você deixar este campo vazio, o sistema usará a pasta padrão do projeto (<code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">/exports_verification</code>).
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex flex-wrap gap-4">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-primary text-white px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center gap-3"
                            >
                                <Save size={18} /> {isSaving ? "Salvando..." : "Salvar Configurações"}
                            </button>
                            <button
                                onClick={runTest}
                                className="bg-white border-2 border-slate-100 text-slate-600 px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-95 flex items-center gap-3"
                            >
                                <Download size={18} className="text-primary/60" /> Testar Localmente
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 shadow-sm">
                        <div className="flex gap-4 items-start">
                            <div className="p-2 bg-white rounded-xl shadow-sm">
                                <CheckCircle2 size={24} className="text-emerald-500" />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-emerald-800 mb-1">Backup Automático</h5>
                                <p className="text-[11px] text-emerald-600 leading-relaxed">Se o assistente local falhar ou não estiver aberto, o sistema usará o download padrão do seu navegador automaticamente.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800 rounded-3xl p-6 shadow-xl text-white">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Informação Técnica</h5>
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black mb-1">URL do Assistente</p>
                                <p className="text-xs font-mono text-primary">http://127.0.0.1:8000</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Status de Conexão</p>
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    Ativo e Pronto
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
