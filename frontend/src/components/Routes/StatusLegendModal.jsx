import { X, AlertCircle, Droplet, Lightbulb, CheckCircle2 } from 'lucide-react';

export default function StatusLegendModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
                    <div className="absolute inset-0 bg-slate-900 opacity-75"></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-200 dark:border-slate-700">
                    {/* Header */}
                    <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg leading-6 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-primary" />
                                Legenda de Símbolos
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-slate-500 focus:outline-none"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Guia rápido para impressão em Preto e Branco (P&B).
                        </p>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-6 space-y-6">

                        {/* Baixo Estoque */}
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                                <span className="text-xl font-bold">▼</span>
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-slate-900 dark:text-white">Baixo Estoque</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-300">
                                    Indica que o estoque estimado está abaixo do nível seguro (ex: menos de 500 folhas).
                                    Símbolo: <strong>Seta para Baixo</strong> ou <strong>Cor Vermelha</strong>.
                                </p>
                            </div>
                        </div>

                        {/* Toner */}
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                <Droplet className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-slate-900 dark:text-white">Nível de Toner</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-300">
                                    Alertas de toner baixo (BK, CY, MG, YW).
                                    Símbolo: <strong>Gota</strong>. Verifique a coluna específica para saber a cor.
                                </p>
                            </div>
                        </div>

                        {/* Sugestão */}
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                                <Lightbulb className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-slate-900 dark:text-white">Sugestão Manual</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-300">
                                    Indica uma entrega sugerida vinda da <strong>Planilha de Papel</strong>, ignorando o cálculo automático.
                                    Símbolo: <strong>Lâmpada</strong>.
                                </p>
                            </div>
                        </div>

                        {/* OK */}
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-slate-900 dark:text-white">Status OK</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-300">
                                    Nenhum alerta crítico. Operação normal.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
