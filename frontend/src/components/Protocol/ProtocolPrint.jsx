import { forwardRef } from 'react';

// === HELPERS ===

// Standard Box Field (como os do topo do modelo)
const BoxField = ({ label, value, className = "", labelClass = "", valueClass = "", highlight = false }) => (
    <div className={`flex flex-col border-slate-400 p-1 px-2 ${className}`}>
        <span className={`text-[10px] text-slate-500 font-medium mb-1 ${labelClass}`}>{label}</span>
        <span className={`text-[14px] font-bold ${highlight ? 'text-[18px] uppercase font-black' : ''} text-slate-900 leading-tight ${valueClass}`}>
            {value || '-'}
        </span>
    </div>
);

// Indented List Field (como os de Local de Entrega)
const ListItem = ({ label, value, className = "" }) => (
    <div className={`flex items-center gap-1 py-0.5 ${className}`}>
        <span className="text-[10px] font-bold uppercase text-slate-500 min-w-[65px]">{label}:</span>
        <span className="text-[12px] font-bold text-slate-900 border-b border-dotted border-slate-300 flex-1">{value || ''}</span>
    </div>
);

// === LOGO HELPER ===
const SiteLogo = () => {
    const logoUrl = localStorage.getItem('proto_logo_url') || '';
    const logoMode = localStorage.getItem('proto_logo_mode') || 'text';
    const siteTitle = localStorage.getItem('proto_logo_title') || localStorage.getItem('site_title') || 'SUPPLY2026';

    const showLogo = (logoMode === 'logo' || logoMode === 'both_side' || logoMode === 'both_below' || logoMode === 'both') && logoUrl;
    const showText = logoMode === 'text' || logoMode === 'both_side' || logoMode === 'both_below' || logoMode === 'both' || !logoUrl;
    const isBelow = logoMode === 'both_below';

    return (
        <div className={`flex ${isBelow ? 'flex-col items-center gap-0.5' : 'items-center gap-2'}`}>
            {showLogo && (
                <img src={logoUrl} alt="Logo" className="h-9 w-auto object-contain" />
            )}
            {showText && (
                <h1 className={`font-black text-slate-700 tracking-tighter ${isBelow ? 'text-[11px] text-center' : 'text-[28px]'}`}>{siteTitle}</h1>
            )}
        </div>
    );
};

const ProtocolPrint = forwardRef(({ data }, ref) => {
    // Data/Hora de geração
    const now = new Date();
    const generatedDate = now.toLocaleDateString('pt-BR');
    const generatedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Seção de Suprimentos (Mapeada para o layout do modelo)
    const supplies = [
        { name: "A4:", qty: data.resmas || data.A4 },
        { name: "A3:", qty: data.A3 || 0 },
        { name: "Outros:", qty: data.Outros || 0 },
        { name: "Toner Preto:", qty: data.tonerBk || data.TonerPreto },
        { name: "Toner Ciano:", qty: data.tonerCy || data.TonerCiano },
        { name: "Toner Amarelo:", qty: data.tonerYw || data.TonerAmarelo },
        { name: "Toner Magenta:", qty: data.tonerMg || data.TonerMagenta },
    ];

    return (
        <div
            ref={ref}
            id="protocol-print-root"
            className="bg-white text-slate-900 font-sans w-[210mm] min-w-fit min-h-[297mm] mx-auto p-[8mm] box-border leading-none subpixel-antialiased flex flex-col relative print:p-[5mm]"
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');
                
                @media print {
                    @page { 
                        size: A4; 
                        margin: 0 !important; 
                    }
                    #protocol-print-root {
                        width: 210mm !important;
                        min-height: 297mm !important;
                        margin: 0 !important;
                        padding: 10mm !important;
                        background: white !important;
                    }
                }
                
                #protocol-print-root { font-family: 'Roboto', sans-serif; }
                .border-all { border: 1px solid #94a3b8; }
                .border-b-only { border-bottom: 1px solid #e2e8f0; }
                .border-r-only { border-right: 1px solid #cbd5e1; }
            `}</style>

            <div className="flex-1 flex flex-col">
                
                {/* 1. HEADER */}
                <div className="flex justify-between items-start mb-2 px-1">
                    <SiteLogo />
                    
                    <div className="text-center">
                        <h2 className="text-[20px] font-bold text-slate-800 leading-tight">
                            Protocolo de Entrega de<br/>Consumíveis
                        </h2>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 border border-slate-300 p-1 px-2 bg-slate-50">
                            <span className="text-[10px] font-bold uppercase text-slate-500">Pedido gerado em:</span>
                            <div className="flex gap-2">
                                <span className="bg-white border border-slate-200 px-2 font-bold text-[12px]">{generatedDate}</span>
                                <span className="bg-white border border-slate-200 px-2 font-bold text-[12px]">{generatedTime}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. TOP FIELDS (Grid 4x2) */}
                <div className="border-all grid grid-cols-4 divide-x divide-slate-300 mb-4">
                    <BoxField label="Número de Série do Equipamento" value={data.Serie} highlight={true} className="border-b" />
                    <BoxField label="Modelo" value={data.Modelo} className="border-b" />
                    <BoxField label="Tipo de Pedido" value={data.Solicitacao} className="border-b" />
                    <BoxField label="Número do Protocolo" value={data.Protocolo} highlight={true} className="border-b" />
                    
                    <BoxField label="Status do Equipamento" value={data.StatusEmprestimo || "Em Produção"} valueClass="text-[16px] uppercase font-black" />
                    <BoxField label="Porcentagem Toner" value={data.PorcentagemToner} valueClass="text-[20px] text-center font-black" />
                    <BoxField label="Número do Incidente/ RD" value={data.IncidenteRds} valueClass="text-center" />
                    <BoxField label="Fila de Impressão" value={data.Fila} valueClass="text-[22px] uppercase font-black text-right tracking-tight" />
                </div>

                {/* 3. LOCAL DE ENTREGA (Indented style) */}
                <div className="border-all p-3 mb-4">
                    <div className="flex gap-2 items-baseline mb-3">
                        <span className="text-[14px] font-black text-slate-500 uppercase tracking-tight whitespace-nowrap">Local de Entrega:</span>
                        <span className="text-[18px] font-black text-slate-900 border-b-2 border-slate-200 flex-1 pl-2 uppercase">
                            {data.local || data.LocalInstalacao || data.LocalEntrega}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 px-8">
                        <div className="flex flex-col">
                            <ListItem label="Empresa" value={data.Empresa} />
                            <ListItem label="Planta Instalada" value={data.PlantaInstalada} />
                            <ListItem label="Contato" value={data.ContatoSetor || data.Contato} />
                            <ListItem label="Ramal" value={data.Ramal || data.telefone} />
                            
                            {/* Extras Endereço */}
                            {(data.extras_meta || []).filter(m => m.category === 'endereco').map(m => (
                                <ListItem key={m.key} label={m.label} value={data[m.key]} />
                            ))}
                        </div>
                        <div className="flex flex-col">
                            <ListItem label="Rua" value={data.rua || data.RuaRef || data.RUAREF || data.Rua} />
                            <ListItem label="Área" value={data.area || data.AREA || data.Area} />
                            <div className="flex justify-between">
                                <ListItem label="Horário" value={data.horario || data.Horario} className="flex-1" />
                                <ListItem label="Contrato" value={data.contrato || data.Contrato} className="flex-1 justify-end pr-4" />
                            </div>
                            
                            {/* Extras Contato */}
                            {(data.extras_meta || []).filter(m => m.category === 'contato').map(m => (
                                <ListItem key={m.key} label={m.label} value={data[m.key]} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* 4. COUNTERS (3 Cols) */}
                <div className="border-all grid grid-cols-3 divide-x divide-slate-300 mb-4 bg-slate-50/20">
                    <div className="flex flex-col p-2 gap-2">
                        <div className="flex justify-between items-center"><span className="text-[11px] font-bold">Contador Inicial:</span> <span className="border-b border-slate-300 min-w-[60px] text-right font-bold text-[14px]">{data.counterInitial || data.ContadorInicial}</span></div>
                        <div className="flex justify-between items-center"><span className="text-[11px] font-bold">Contador Final:</span> <span className="border-b border-slate-300 min-w-[60px] text-right font-bold text-[14px]">{data.counterFinal || data.ContadorFinal}</span></div>
                        <div className="flex justify-between items-center"><span className="text-[11px] font-bold">Analise F/V:</span> <span className="border-b border-slate-300 min-w-[60px] text-right font-bold">{data.analiseFV || data.AnaliseFV}</span></div>
                    </div>
                    <div className="flex flex-col p-2 gap-2">
                        <div className="flex justify-between items-center"><span className="text-[11px] font-bold">Cont Final PB:</span> <span className="border-b border-slate-300 min-w-[60px] text-right font-bold">-</span></div>
                        <div className="flex justify-between items-center"><span className="text-[11px] font-bold">Cont Final Cor:</span> <span className="border-b border-slate-300 min-w-[60px] text-right font-bold">-</span></div>
                        <div className="flex justify-between items-center"><span className="text-[11px] font-bold">Produção:</span> <span className="border-b border-slate-300 min-w-[60px] text-right font-bold">{data.production || data.Producao}</span></div>
                    </div>
                    <div className="flex flex-col p-2 gap-2">
                        <div className="flex justify-between items-center"><span className="text-[11px] font-bold">Prod. (Resmas):</span> <span className="border-b border-slate-300 min-w-[60px] text-right font-bold italic">{((data.production || data.Producao || 0) / 500).toFixed(1)}</span></div>
                        <div className="flex justify-between items-center"><span className="text-[11px] font-bold">Competência:</span> <span className="border-b border-slate-300 min-w-[60px] text-right font-bold uppercase">Simpress</span></div>
                        <div className="flex justify-between items-center"><span className="text-[11px] font-bold">Almoxarifado:</span> <span className="border-b border-slate-300 min-w-[60px] text-right font-bold uppercase">{data.recolha === 'Sim' ? 'SIM' : 'NÃO'}</span></div>
                    </div>
                </div>

                {/* 5. SUPPLIES GRID (Main Table + Lateral Panels) */}
                <div className="flex border-all flex-1 min-h-[250px]">
                    {/* Items List */}
                    <div className="w-[45%] flex flex-col border-r divide-y divide-slate-200">
                        <div className="bg-slate-100 flex p-1 px-3">
                            <span className="text-[11px] font-bold flex-1">Suprimento</span>
                            <span className="text-[11px] font-bold w-24 text-center">Quantidade</span>
                        </div>
                        {supplies.map((s, i) => (
                            <div key={i} className="flex p-1 px-3 items-center h-9">
                                <span className="text-[12px] font-medium flex-1">{s.name}</span>
                                <span className="text-[16px] font-black w-24 text-center bg-slate-50 h-full flex items-center justify-center">
                                    {s.qty > 0 ? s.qty : ''}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Solicitor + Obs + Stock Columns */}
                    <div className="flex-1 flex divide-x divide-slate-200">
                        {/* Solicitante */}
                        <div className="w-[45%] flex flex-col">
                            <div className="bg-slate-50 p-1 px-2 text-[10px] font-bold border-b border-slate-200 uppercase tracking-widest text-slate-400">Solicitante:</div>
                            <div className="p-4 flex flex-col items-center justify-center relative flex-1">
                                <span className="text-[40px] font-black text-slate-100 uppercase select-none absolute z-0">Obs</span>
                                <div className="text-[11px] font-bold text-slate-800 leading-tight z-10 w-full text-center italic">
                                    {data.Obs}
                                </div>
                            </div>
                            
                            <div className="border-t border-slate-200 p-2 pt-4 space-y-4">
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col"><div className="border-b-2 border-slate-800 mb-1"></div><span className="text-[9px] font-black uppercase text-slate-600">Assinatura do Cliente:</span></div>
                                    <div className="flex flex-col"><div className="border-b border-slate-300 mb-1"></div><span className="text-[9px] font-bold uppercase text-slate-500">Chave de Rede/ Matrícula:</span></div>
                                    <div className="flex flex-col"><div className="border-b border-slate-300 mb-1"></div><span className="text-[9px] font-bold uppercase text-slate-500">Data de Recebimento:</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Stock Box */}
                        <div className="flex-1 flex flex-col">
                            <div className="bg-slate-50 p-1 px-2 text-[10px] font-bold border-b border-slate-200 uppercase tracking-widest text-slate-400">Estoque no Local:</div>
                            <div className="flex-1 p-2"></div>
                        </div>
                    </div>
                </div>

                {/* 6. BOTTOM JUSTIFICATION + FINAL SIGNS */}
                <div className="mt-4 border-all p-3 bg-white">
                    <h3 className="text-[12px] font-black uppercase text-center border-b border-slate-200 pb-1 mb-3 text-slate-800">Justificativa de Não Entrega</h3>
                    
                    <div className="grid grid-cols-2 gap-8 mb-6">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-slate-600">Toner com Porcentagem:</span>
                            <div className="flex-1 border-b border-slate-300 h-3"></div>
                            <div className="flex items-center gap-3 ml-2">
                                <div className="flex items-center gap-1.5"><div className="w-5 h-5 border border-slate-400"></div><span className="text-[10px] font-bold text-slate-400">%</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-5 h-5 border border-slate-400"></div><span className="text-[10px] font-bold text-slate-400">%</span></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold uppercase text-slate-600">Papel Existente no Local:</span>
                            <div className="flex gap-6">
                                <div className="flex items-center gap-1.5 font-bold"><div className="w-5 h-5 border border-slate-400"></div><span className="text-[10px] uppercase text-slate-400">Sim</span></div>
                                <div className="flex items-center gap-1.5 font-bold"><div className="w-5 h-5 border border-slate-400"></div><span className="text-[10px] uppercase text-slate-400">Não</span></div>
                                <div className="flex items-center gap-2 font-bold text-slate-400"><span className="text-[10px] uppercase">Quantidade:</span><div className="w-16 border-b border-slate-300 h-3"></div></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-6">
                        <div className="flex flex-col"><div className="border-b-2 border-slate-800 mb-1"></div><span className="text-[9px] font-black uppercase text-slate-700">Assinatura do Responsável:</span></div>
                        <div className="flex flex-col"><div className="border-b border-slate-300 mb-1"></div><span className="text-[9px] font-bold uppercase text-slate-500">Chave de Rede/ Matrícula:</span></div>
                        <div className="flex-1"></div>
                    </div>

                    <div className="grid grid-cols-[1.5fr_1fr] gap-6 mt-6">
                        <div className="flex flex-col"><div className="border-b-2 border-slate-800 mb-1"></div><span className="text-[9px] font-black uppercase text-slate-700">Técnico Responsável:</span></div>
                        <div className="flex flex-col"><div className="border-b border-slate-300 mb-1"></div><div className="flex justify-between px-1"><span className="text-[9px] font-bold uppercase text-slate-500">Matrícula:</span><div className="w-32 border-all h-6 mt-[-10px] bg-slate-50"></div></div></div>
                    </div>
                </div>

                <div className="mt-auto pt-2 text-center border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[8px] text-slate-300 font-bold tracking-widest uppercase">Absolute Perfection Protocol • V4 Hybrid Architecture</span>
                    <span className="text-[9px] text-slate-400 italic">Documento confidencial gerado pelo Supply Manager System</span>
                </div>

            </div>
        </div>
    );
});

ProtocolPrint.displayName = 'ProtocolPrint';

export default ProtocolPrint;

