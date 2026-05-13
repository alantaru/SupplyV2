import { useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useReactToPrint } from 'react-to-print';
import { X, Printer, MapPin, User, FileText, CheckCircle, PackageCheck } from 'lucide-react';
import ProtocolPrint from '../Protocol/ProtocolPrint';
import DeliveryModal from '../Protocol/ProtocolDelivery';

const ReadOnlyField = ({ label, value, icon: Icon, className = "" }) => (
    <div className={`flex flex-col ${className}`}>
        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1">
            {Icon && <Icon size={10} />} {label}
        </label>
        <div className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 min-h-[32px] flex items-center">
            {value || '-'}
        </div>
    </div>
);

export default function HistoryDetailModal({ protocol, onClose }) {
    const { addToast } = useToast();
    const printRef = useRef(null);
    const [showDelivery, setShowDelivery] = useState(false);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Protocolo_${protocol?.Protocolo}`,
        onAfterPrint: () => {},
        onPrintError: (_error) => {
            addToast("Erro ao imprimir: Verifique as configurações da impressora.", "error");
        }
    });

    if (!protocol) return null;

    return (
        <>
            <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-white dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                            <FileText className="text-purple-600 dark:text-purple-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Protocolo #{protocol.Protocolo}</h2>
                            <p className="text-xs text-slate-500">{protocol.DataEntrega ? `Entregue em: ${protocol.DataEntrega}` : 'Pendente de Entrega'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!protocol.DataEntrega && (
                            <button
                                onClick={() => setShowDelivery(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium text-sm"
                            >
                                <PackageCheck size={16} /> Dar Baixa
                            </button>
                        )}
                        <button
                            onClick={() => {
                                handlePrint();
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors font-medium text-sm"
                        >
                            <Printer size={16} /> Imprimir Comprovante
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">

                    {/* Equipment Section */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                            Equipamento
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <ReadOnlyField label="Série" value={protocol.Serie} icon={Printer} />
                            <ReadOnlyField label="Modelo" value={protocol.Modelo} />
                            <ReadOnlyField label="Fila" value={protocol.Fila} icon={CheckCircle} />
                            <ReadOnlyField label="Status Atual" value={protocol.StatusEmprestimo} />
                            <ReadOnlyField label="Contador Inicial" value={protocol.ContadorInicial} />
                            <ReadOnlyField label="Contador Final" value={protocol.ContadorFinal} />
                            <ReadOnlyField label="Produção" value={protocol.Producao} />
                            <ReadOnlyField label="% Toner" value={protocol.PorcentagemToner} />
                        </div>
                    </div>

                    {/* Location Section */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                            Localização & Contato
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <ReadOnlyField label="Empresa" value={protocol.Empresa} icon={MapPin} />
                            <ReadOnlyField label="Solicitante" value={protocol.Solicitante} icon={User} />
                            <ReadOnlyField label="Ramal" value={protocol.Ramal} />
                            <ReadOnlyField label="Local de Entrega" value={protocol.LocalEntrega} className="md:col-span-3" />
                        </div>
                    </div>

                    {/* Supplies Table */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                            Suprimentos Entregues
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { name: 'Papel A4', key: 'A4' },
                                { name: 'Papel A3', key: 'A3' },
                                { name: 'Toner Preto', key: 'TonerPreto' },
                                { name: 'Toner Ciano', key: 'TonerCiano' },
                                { name: 'Toner Magenta', key: 'TonerMagenta' },
                                { name: 'Toner Amarelo', key: 'TonerAmarelo' },
                                { name: 'Outros', key: 'Outros' }
                            ].map(item => (
                                <div key={item.key} className={`flex justify-between items-center p-2 rounded-lg border ${protocol[item.key] > 0 ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                    <span className="text-xs font-bold">{item.name}</span>
                                    <span className="text-sm font-black">{protocol[item.key] > 0 ? protocol[item.key] : '-'}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Observations */}
                    {protocol.Obs && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                            <h3 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-2">
                                Observações
                            </h3>
                            <p className="text-sm text-amber-900 dark:text-amber-200">{protocol.Obs}</p>
                        </div>
                    )}

                </div>
            </div>

            {/* Hidden Print Component - Kept in DOM but hidden */}
            <div style={{ position: 'absolute', top: -9999, left: -9999, width: 0, height: 0, overflow: 'hidden' }}>
                <ProtocolPrint ref={printRef} data={protocol} />
            </div>

            {/* DeliveryModal */}
            <DeliveryModal
                protocolId={protocol.Protocolo}
                isOpen={showDelivery}
                onClose={() => setShowDelivery(false)}
                onSuccess={() => { setShowDelivery(false); onClose(); }}
            />
        </>
    );

}
