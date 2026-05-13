import { Phone, Route, AlertTriangle, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function TypeSelection({ onSelect }) {
    const options = [
        { id: 'Telefone', label: 'Solicitação via Telefone', icon: Phone, color: 'text-[#4D91FF]', bg: 'bg-[#4D91FF]/10', border: 'border-[#4D91FF]/20', desc: 'Atendimento via ramal ou celular' },
        { id: 'Rota', label: 'Rota Proativa', icon: Route, color: 'text-[#4DFF88]', bg: 'bg-[#4DFF88]/10', border: 'border-[#4DFF88]/20', desc: 'Identificação por visita periódica' },
        { id: 'Incidente', label: 'Incidente', icon: AlertTriangle, color: 'text-[#FF4D4D]', bg: 'bg-[#FF4D4D]/10', border: 'border-[#FF4D4D]/20', desc: 'Correção de falha documentada' },
        { id: 'Requisicao', label: 'Requisição Interna', icon: FileText, color: 'text-[#D18BFF]', bg: 'bg-[#D18BFF]/10', border: 'border-[#D18BFF]/20', desc: 'Demanda de uso do próprio setor' },
    ];

    return (
        <div className="space-y-12 animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white font-display uppercase tracking-widest">Selecione o Tipo de Pedido</h2>
                <p className="text-slate-500 font-medium">Defina a origem da solicitação</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {options.map((opt) => {
                    const Icon = opt.icon;
                    return (
                        <button
                            key={opt.id}
                            onClick={() => onSelect(opt.id)}
                            className={cn(
                                "flex items-start gap-6 p-8 rounded-2xl border bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 transition-all text-left relative overflow-hidden group hover:bg-slate-100/50 dark:hover:bg-white/[0.05] hover:scale-[1.02] active:scale-[0.98]",
                                opt.border
                            )}
                        >
                             <div className="absolute top-0 right-0 w-32 h-32 bg-slate-900/[0.02] dark:bg-white/[0.02] blur-3xl -mr-16 -mt-16 rounded-full group-hover:bg-slate-900/[0.05] dark:group-hover:bg-white/[0.05] transition-all" />
                            <div className={cn("p-5 rounded-2xl transition-all border group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]", opt.bg, opt.border)}>
                                <Icon className={cn("h-8 w-8", opt.color)} />
                            </div>
                            <div className="relative z-10 flex-1">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 font-display">{opt.label}</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">{opt.desc}</p>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    );
}
