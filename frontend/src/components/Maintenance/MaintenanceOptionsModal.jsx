import { X, Wrench, Info, History, Package, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function MaintenanceOptionsModal({ isOpen, onClose, equipment, onAction }) {
    if (!isOpen || !equipment) return null;

    const actions = [
        {
            id: 'os',
            title: 'Abrir O.S. Técnica',
            desc: 'Registrar manutenção corretiva, troca de peças ou backups.',
            icon: Wrench,
            color: 'text-primary bg-primary/10',
            hover: 'hover:border-primary/40 hover:bg-primary/5'
        },
        {
            id: 'details',
            title: 'Detalhes / Editar Mapa',
            desc: 'Ver telemetria completa e editar dados de localização do inventário.',
            icon: Info,
            color: 'text-blue-500 bg-blue-500/10',
            hover: 'hover:border-blue-500/40 hover:bg-blue-500/5'
        },
        {
            id: 'parts',
            title: 'Peças e Insumos',
            desc: 'Consultar compatibilidade e lançar movimentação de peças.',
            icon: Package,
            color: 'text-emerald-500 bg-emerald-500/10',
            hover: 'hover:border-emerald-500/40 hover:bg-emerald-500/5'
        },
        {
            id: 'history',
            title: 'Histórico de Intervenções',
            desc: 'Ver histórico de manutenções e trocas realizadas neste equipamento.',
            icon: History,
            color: 'text-slate-500 bg-slate-500/10',
            hover: 'hover:border-slate-500/40 hover:bg-slate-500/5'
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/20">
                            {equipment.Modelo?.substring(0, 2).toUpperCase() || 'EQ'}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">{equipment.Serie}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {equipment.Modelo} — {equipment.Local || 'Sem Localização'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Options Grid */}
                <div className="p-6 grid grid-cols-1 gap-3">
                    {actions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => onAction(action.id, equipment)}
                            className={cn(
                                "flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all text-left group active:scale-[0.98]",
                                action.hover
                            )}
                        >
                            <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-110", action.color)}>
                                <action.icon size={24} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">{action.title}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{action.desc}</p>
                            </div>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors" />
                        </button>
                    ))}
                </div>

                {/* Footer / Quick Info */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ações Rápidas de Manutenção</span>
                    <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">Fechar</button>
                </div>
            </div>
        </div>
    );
}
