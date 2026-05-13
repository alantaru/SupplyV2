import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';
import TypeSelection from './TypeSelection';
import SearchStep from './SearchStep';
import FormStep from './FormStep';
import { ArrowLeft } from 'lucide-react';

export default function ProtocolWizard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const activeContract = user?.activeContract;
    const [step, setStep] = useState(1);
    const [protocolType, setProtocolType] = useState(null);
    const [selectedData, setSelectedData] = useState(null);

    const handleTypeSelect = (type) => {
        setProtocolType(type);
        setStep(2);
    };

    const handleSearchSelect = (data) => {
        setSelectedData(data);
        setStep(3);
    };

    const handleBack = () => {
        if (step === 1) navigate('/');
        else if (step === 2) setStep(1);
        else if (step === 3) setStep(2);
    };

    return (
        <div className="h-full flex flex-col gap-3 animate-in fade-in duration-300">
            {/* Header compacto */}
            <div className="flex items-center gap-4 shrink-0">
                <button 
                    onClick={handleBack} 
                    className="p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 flex items-center gap-4">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Novo Protocolo</h1>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            {[1, 2, 3].map(i => (
                                <div 
                                    key={i} 
                                    className={`h-1 w-6 rounded-full transition-all duration-500 ${step >= i ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} 
                                />
                            ))}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estágio {step} de 3 — {
                            step === 1 ? 'Tipo' :
                            step === 2 ? 'Equipamento' :
                            'Detalhes'
                        }</p>
                    </div>
                </div>
            </div>

            {/* Conteúdo — ocupa todo o espaço restante */}
            <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className={`h-full p-3 flex flex-col ${step !== 3 ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`}>
                    {step === 1 && <TypeSelection onSelect={handleTypeSelect} />}
                    {step === 2 && <SearchStep onSelect={handleSearchSelect} activeContract={activeContract} />}
                    {step === 3 && <FormStep data={selectedData} type={protocolType} activeContract={activeContract} />}
                </div>
            </div>
        </div>
    );
}
