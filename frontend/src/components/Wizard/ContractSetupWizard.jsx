import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, ArrowRight, Loader } from 'lucide-react';
import { useAuth } from '../../context/AuthProvider';
import api from '../../lib/api';

export default function ContractSetupWizard() {
    const { addToast } = useToast();
    const { contractId } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeStep, setActiveStep] = useState(0);
    const processedRef = React.useRef(false);

    // Steps configuration
    const steps = [
        { id: 'welcome', title: 'Boas Vindas' },
        { id: 'mapa', title: 'Mapa de Equipamentos', key: 'MAPA' },
        { id: 'contadores', title: 'Contadores', key: 'CONTADORES' },
        { id: 'papel', title: 'Meta de Papel', key: 'PAPEL' },
        { id: 'finish', title: 'Conclusão' }
    ];
    const { user, updateActiveContract, refreshUser } = useAuth();

    useEffect(() => {
        const syncAndLoad = async () => {
            if (contractId && user) {
                // If contract is not in user list, refresh first
                if (!user.contracts.includes(contractId)) {

                    const updated = await refreshUser();
                    if (updated && !updated.contracts.includes(contractId) && user.role !== 'superadmin') {

                        // Fallback or alert? The App.jsx redirect might still hit
                    }
                }
                
                if (user.activeContract !== contractId) {

                    updateActiveContract(contractId);
                }
            }
            loadStatus();
        };
        
        syncAndLoad();
    }, [contractId, user?.activeContract, user?.contracts?.length]); // Modified dependency array

    const loadStatus = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/admin/contracts/${contractId}/status`);
            setStatus(res.data);

            // Only determine initial step ONCE
            if (!processedRef.current) {
                determineInitialStep(res.data);
                processedRef.current = true;
            }
        } catch (e) {

            addToast("Erro ao carregar status do contrato", "error");
        } finally {
            setLoading(false);
        }
    };

    const determineInitialStep = (s) => {
        // If entirely new (no files), Start at Welcome (0)
        if (!s.has_mapa && !s.has_contadores && !s.has_papel) {
            setActiveStep(0);
            return;
        }

        // Resume logic
        if (!s.has_mapa) setActiveStep(1);
        else if (!s.has_contadores) setActiveStep(2);
        else if (!s.has_papel) setActiveStep(3);
        else setActiveStep(4); // Finish
    };

    const handleNext = () => setActiveStep(prev => Math.min(prev + 1, steps.length - 1));
    const handlePrev = () => setActiveStep(prev => Math.max(prev - 1, 0));

    if (loading) return <div className="p-8 flex items-center justify-center text-slate-500 dark:text-slate-400">Carregando...</div>;

    // Guard: if status failed to load, show error state
    if (!status) return (
        <div className="p-8 flex flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400">
            <AlertCircle size={32} className="text-amber-500" />
            <p className="text-sm font-bold">Não foi possível carregar o status do contrato <span className="text-primary font-mono">{contractId}</span>.</p>
            <button onClick={loadStatus} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-all">Tentar novamente</button>
        </div>
    );

    return (
        <div className="flex flex-col items-center py-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors">
            <div className="w-full bg-white dark:bg-slate-900 glass-surface shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 transition-colors duration-300">
                {/* Minimalist Header */}
                <div className="p-8 border-b border-slate-100 dark:border-white/5 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold font-display text-slate-900 dark:text-white tracking-tight">Configuração do Contrato</h1>
                            <p className="text-[#9D4DFF] font-mono text-xs uppercase tracking-widest">Contrato ID: {contractId}</p>
                        </div>
                        <button 
                            onClick={() => navigate('/admin')} 
                            className="text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-medium px-4 py-1.5 rounded-full border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                            Voltar
                        </button>
                    </div>
                    {/* Progress Indicator */}
                    <div className="flex gap-2">
                        {steps.map((s, i) => (
                            <div 
                                key={s.id} 
                                className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= activeStep ? 'bg-[#D18BFF] shadow-[0_0_10px_rgba(209,139,255,0.3)]' : 'bg-slate-100 dark:bg-white/10'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 min-h-[400px]">
                    {activeStep === 0 && <WelcomeStep onNext={handleNext} status={status} />}
                    {activeStep === 1 && <UploadStep
                        title="Importar Mapa de Equipamentos"
                        description="Arquivo com todos os equipamentos, locais e modelos do contrato."
                        fileKey="MAPA"
                        contractId={contractId}
                        onSuccess={() => { loadStatus(); handleNext(); }}
                        hasFile={status?.has_mapa}
                    />}
                    {activeStep === 2 && <UploadStep
                        title="Importar Contadores"
                        description="Arquivo com as leituras atuais dos contadores de cada equipamento."
                        fileKey="CONTADORES"
                        contractId={contractId}
                        onSuccess={() => { loadStatus(); handleNext(); }}
                        hasFile={status?.has_contadores}
                    />}
                    {activeStep === 3 && <UploadStep
                        title="Importar Meta de Papel (Opcional)"
                        description="Arquivo com a quantidade de papel prevista para cada equipamento."
                        fileKey="PAPEL"
                        contractId={contractId}
                        onSuccess={() => { loadStatus(); handleNext(); }}
                        hasFile={status?.has_papel}
                        isOptional={true}
                        onSkip={handleNext}
                    />}
                    {activeStep === 4 && <FinishStep navigate={navigate} contractId={contractId} />}
                </div>

                {/* Footer Navigation */}
                <div className="bg-slate-50 dark:bg-white/5 p-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center px-8 transition-colors">
                    <button
                        onClick={handlePrev}
                        disabled={activeStep === 0}
                        className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-20 text-sm font-medium"
                    >
                        Anterior
                    </button>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-white/20 uppercase tracking-widest">Etapa {activeStep + 1} de {steps.length}</span>
                </div>
            </div>
        </div>
    );
}

function WelcomeStep({ onNext, status }) {
    return (
        <div className="text-center space-y-8 py-4">
            <div className="mx-auto w-20 h-20 bg-[#D18BFF]/10 text-[#D18BFF] rounded-full flex items-center justify-center animate-pulse">
                <AlertCircle size={40} />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-display">Inicialização do Contrato</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
                    Para ativar este contrato, precisamos importar os arquivos de dados.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <StatusCard label="Mapa" done={status?.has_mapa} color="#4D91FF" />
                <StatusCard label="Contadores" done={status?.has_contadores} color="#D18BFF" />
                <StatusCard label="Papel" done={status?.has_papel} color="#4DFF88" />
            </div>

            <button onClick={onNext} className="bg-[#D18BFF] text-black px-8 py-3 rounded-full font-bold shadow-xl hover:bg-[#D18BFF]/90 transition-all flex items-center justify-center mx-auto hover:scale-105 active:scale-95">
                Começar <ArrowRight className="ml-2" size={18} />
            </button>
        </div>
    );
}

function StatusCard({ label, done, color }) {
    return (
        <div className={`p-4 rounded-xl border transition-all duration-500 ${done ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20' : 'bg-slate-50/50 dark:bg-white/2 border-slate-100 dark:border-white/5 opacity-40'}`}>
            <div className="font-bold text-xs uppercase tracking-tighter mb-1" style={{ color: done ? color : 'inherit' }}>{label}</div>
            <div className="text-[10px] font-mono text-slate-400 opacity-50">{done ? 'OK' : 'Pendente'}</div>
        </div>
    );
}

import ColumnMappingModal from './ColumnMappingModal';

function UploadStep({ title, description, fileKey, contractId, onSuccess, hasFile, isOptional, onSkip }) {
    const { addToast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [mappingData, setMappingData] = useState(null); // { temp_token, detected_columns, ... }

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) {
            return;
        }



        const formData = new FormData();
        formData.append('file', file);
        e.target.value = null; // Reset input

        try {
            setUploading(true);
            const res = await api.post(`/upload/csv/${fileKey}`, formData, {
                params: {
                    contract_id: contractId
                },
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.status === 'success') {
                onSuccess();
            } else if (res.data.status === 'mapping_required') {
                setMappingData(res.data);
            } else {
                addToast("Resposta desconhecida do servidor: " + JSON.stringify(res.data), "info");
            }
        } catch (err) {

            addToast("Erro no upload: " + (err.response?.data?.detail || err.message), "error");
        } finally {
            setUploading(false);
        }
    };

    const handleMappingConfirm = async (payload) => {
        try {
            setUploading(true);
            const res = await api.post(`/upload/confirm-mapping`, payload, {
                params: { contract_id: contractId }
            });
            if (res.data.status === 'success') {
                setMappingData(null);
                onSuccess();
            } else {
                addToast("Erro ao aplicar mapeamento: resposta inesperada do servidor.", "error");
            }
        } catch (err) {
            addToast("Erro ao aplicar mapeamento: " + (err.response?.data?.detail || err.message), "error");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h2>
            <p className="text-slate-600 dark:text-slate-400">{description}</p>

            {hasFile && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-4 rounded-lg flex items-center gap-3 text-green-700 dark:text-green-400 mb-4">
                    <CheckCircle size={20} />
                    <div>
                        <span className="font-bold">Arquivo já importado.</span>
                        <div className="text-xs">Você pode importar novamente para atualizar.</div>
                    </div>
                </div>
            )}

            <div className={`border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <input
                    type="file"
                    onChange={handleFile}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept=".csv,.xlsx"
                    disabled={uploading}
                />
                <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                    {uploading ? <Loader className="animate-spin text-primary" size={32} /> : <Upload size={32} />}
                    <span className="font-medium">
                        {uploading ? 'Processando...' : 'Clique ou arraste o arquivo aqui'}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Suporta .csv e .xlsx</span>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                {isOptional ? (
                    <button onClick={onSkip} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm">
                        Pular esta etapa
                    </button>
                ) : <div />}

                {hasFile && (
                    <button onClick={onSuccess} className="bg-green-600 text-white px-6 py-2 rounded shadow-sm hover:bg-green-700 flex items-center gap-2">
                        Próximo <ArrowRight size={16} />
                    </button>
                )}
            </div>

            {/* Modal */}
            <ColumnMappingModal
                isOpen={!!mappingData}
                onClose={() => setMappingData(null)}
                checkResult={mappingData}
                onConfirm={handleMappingConfirm}
            />
        </div>
    );
}

function FinishStep({ navigate, contractId }) {
    const { addToast } = useToast();
    return (
        <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center">
                <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Tudo Pronto!</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                O contrato {contractId} está pronto para uso. Você já pode criar pedidos e gerenciar rotas.
            </p>
            <button onClick={() => navigate('/')} className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 mt-8">
                Ir para o Início
            </button>
        </div>
    );
}


