import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { paginateItems } from '../../utils/printUtils';

// === HELPERS ===

// Calcula competência: mês/ano atual em português
const getCompetencia = () => {
    const now = new Date();
    return now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        .replace(' de ', '/');
};

const parseToner = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const n = parseFloat(String(val).replace('%', '').replace(',', '.').trim());
    return isNaN(n) ? null : n;
};

const isColorEquipment = (item) => {
    const cy = parseToner(item.TonerLevel_CY);
    const mg = parseToner(item.TonerLevel_MG);
    const yw = parseToner(item.TonerLevel_YW);
    // Colorido se qualquer canal cor tiver valor > 0
    return (cy !== null && cy > 0) || (mg !== null && mg > 0) || (yw !== null && yw > 0);
};

const getTonerStatus = (item) => {
    const bk = parseToner(item.TonerLevel_BK);
    const cy = parseToner(item.TonerLevel_CY);
    const mg = parseToner(item.TonerLevel_MG);
    const yw = parseToner(item.TonerLevel_YW);
    const levels = [bk, cy, mg, yw].filter(v => v !== null);
    if (levels.length === 0) return 'Toner OK';
    return Math.min(...levels) <= 30 ? 'Mandar Toner' : 'Toner OK';
};

// === CARD COMPONENT ===
const EquipmentCard = ({ item, competencia }) => {
    const tonerStatus = getTonerStatus(item);
    const tonerNeedsAction = tonerStatus === 'Mandar Toner';
    const isColor = isColorEquipment(item);

    const bkPct = parseToner(item.TonerLevel_BK);
    const cyPct = parseToner(item.TonerLevel_CY);
    const mgPct = parseToner(item.TonerLevel_MG);
    const ywPct = parseToner(item.TonerLevel_YW);

    const local = item.LocalInstalacao || item.Local || '-';
    const rua = item.RuaRef || item.Rua || '-';
    const contato = item.Contato || item.ContatoSetor || '-';
    const ramal = item.Ramal || '-';

    // Contador: do Contadores.csv se disponível, senão campo manual
    const contadorRaw = item.Contador_Atual;
    const contadorVal = (contadorRaw !== null && contadorRaw !== undefined && contadorRaw !== '' && Number(contadorRaw) > 0)
        ? Number(contadorRaw).toLocaleString('pt-BR')
        : null;

    // A4: mínimo 1 resma
    const sugestaoA4 = Math.max(1, item.Sugestao_A4 != null ? Number(item.Sugestao_A4) : 1);
    const sugestaoA3 = item.Sugestao_A3 || item.A3 || 0;

    const cellBorder = '1px solid #e2e8f0';
    const cardBorder = '1.5px solid #1e293b';

    return (
        <div style={{ border: cardBorder, borderRadius: '2px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* ROW 1 — Identificação (compacta, tamanho fixo) */}
            <div style={{ display: 'flex', borderBottom: cellBorder, background: '#f8fafc', flexShrink: 0, minHeight: '26px' }}>
                {/* Protocolo */}
                <div style={{ width: '68px', padding: '2px 5px', borderRight: cellBorder, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span className="lbl">Protocolo</span>
                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>&nbsp;</span>
                </div>
                {/* Serie */}
                <div style={{ flex: 2.5, padding: '2px 5px', borderRight: cellBorder, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span className="lbl">Série</span>
                    <span className="val-primary">{item.Serie}</span>
                </div>
                {/* Modelo */}
                <div style={{ flex: 2, padding: '2px 5px', borderRight: cellBorder, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span className="lbl">Modelo</span>
                    <span className="val-sm">{item.Modelo || '-'}</span>
                </div>
                {/* Fila */}
                <div style={{ flex: 2, padding: '2px 5px', borderRight: cellBorder, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span className="lbl">Fila</span>
                    <span className="val-sm">{item.Fila || item.IP || '-'}</span>
                </div>
                {/* Toner */}
                <div style={{ width: isColor ? '128px' : '68px', padding: '2px 5px', borderRight: cellBorder, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <span className="lbl">{isColor ? 'BK / CY / MG / YW' : '% Toner BK'}</span>
                    {isColor ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {[
                                { val: bkPct, color: bkPct !== null && bkPct <= 30 ? '#dc2626' : '#0f172a' },
                                { val: cyPct, color: cyPct !== null && cyPct <= 30 ? '#dc2626' : '#0369a1' },
                                { val: mgPct, color: mgPct !== null && mgPct <= 30 ? '#dc2626' : '#be185d' },
                                { val: ywPct, color: ywPct !== null && ywPct <= 30 ? '#dc2626' : '#92400e' },
                            ].map((t, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <span style={{ fontSize: '7px', color: '#cbd5e1' }}>/</span>}
                                    <span style={{ fontSize: '9px', fontWeight: 900, color: t.color }}>{t.val !== null ? t.val + '%' : '-'}</span>
                                </React.Fragment>
                            ))}
                        </div>
                    ) : (
                        <span style={{ fontSize: '11px', fontWeight: 900, color: bkPct !== null && bkPct <= 30 ? '#dc2626' : '#0f172a' }}>
                            {bkPct !== null ? bkPct + '%' : '-'}
                        </span>
                    )}
                </div>
                {/* Mandar Toner */}
                <div style={{ width: '68px', padding: '2px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <span className="lbl">Toner</span>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: tonerNeedsAction ? '#dc2626' : '#16a34a', textAlign: 'center', lineHeight: 1.1 }}>
                        {tonerStatus}
                    </span>
                </div>
            </div>

            {/* ROW 2 — Local + Estoque no Local (altura fixa) */}
            <div style={{ display: 'flex', borderBottom: cellBorder, height: '14mm', alignItems: 'stretch' }}>
                <div style={{ flex: 1, padding: '4px 7px', borderRight: cellBorder, display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                    <span className="lbl" style={{ whiteSpace: 'nowrap', opacity: 0.5, fontStyle: 'italic' }}>Local -&gt;</span>
                    <span style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {local}
                    </span>
                </div>
                <div style={{ width: '175px', padding: '4px 7px', display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="lbl" style={{ marginBottom: '4px' }}>Estoque no Local &gt;&gt;&gt;&gt;</span>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px' }}>
                        <div style={{ flex: 1, borderBottom: '1.5px solid #1e293b', height: '14px' }}></div>
                        <span className="lbl">resmas</span>
                    </div>
                </div>
            </div>

            {/* ROW 3 — Rua + Competência (altura fixa) */}
            <div style={{ display: 'flex', borderBottom: cellBorder, height: '7mm', alignItems: 'stretch' }}>
                <div style={{ flex: 1, padding: '3px 7px', borderRight: cellBorder, display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                    <span className="lbl" style={{ whiteSpace: 'nowrap', opacity: 0.5, fontStyle: 'italic' }}>Rua -&gt;</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rua}</span>
                </div>
                <div style={{ width: '175px', padding: '3px 7px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span className="lbl">Competência:</span>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#1e293b' }}>{competencia}</span>
                </div>
            </div>

            {/* ROW 4 — Contato / Ramal + A4 + A3 (altura fixa) */}
            <div style={{ display: 'flex', borderBottom: cellBorder, height: '12mm', alignItems: 'stretch' }}>
                <div style={{ flex: 1, padding: '3px 7px', borderRight: cellBorder, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                        <span className="lbl" style={{ whiteSpace: 'nowrap' }}>Contato:</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contato}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="lbl" style={{ whiteSpace: 'nowrap' }}>Ramal:</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{ramal}</span>
                    </div>
                </div>
                {/* A4 */}
                <div style={{ width: '56px', padding: '3px 4px', borderRight: cellBorder, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="lbl">A4</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{sugestaoA4}</span>
                </div>
                {/* A3 */}
                <div style={{ width: '56px', padding: '3px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="lbl">A3</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{sugestaoA3}</span>
                </div>
            </div>

            {/* ROW 5 — Contador + Assinatura/Chave + Data (altura fixa, fundo cinza) */}
            <div style={{ display: 'flex', height: '7mm', alignItems: 'center', padding: '3px 7px', gap: '10px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <span className="lbl">Contador Final:</span>
                    <div style={{ border: '1px solid #cbd5e1', background: 'white', padding: '2px 6px', minWidth: '72px', textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontWeight: 900, fontFamily: 'monospace', color: contadorVal ? '#0f172a' : '#94a3b8' }}>
                            {contadorVal || '__________'}
                        </span>
                    </div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '5px', paddingBottom: '3px' }}>
                    <span className="lbl" style={{ whiteSpace: 'nowrap' }}>Assinatura / Chave:</span>
                    <div style={{ flex: 1, borderBottom: '1.5px solid #1e293b' }}></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', paddingBottom: '3px', flexShrink: 0 }}>
                    <span className="lbl" style={{ whiteSpace: 'nowrap' }}>Data:</span>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
                        <div style={{ borderBottom: '1.5px solid #64748b', width: '24px', height: '12px' }}></div>
                        <span style={{ fontSize: '9px', color: '#64748b' }}>/</span>
                        <div style={{ borderBottom: '1.5px solid #64748b', width: '24px', height: '12px' }}></div>
                        <span style={{ fontSize: '9px', color: '#64748b' }}>/</span>
                        <div style={{ borderBottom: '1.5px solid #64748b', width: '34px', height: '12px' }}></div>
                    </div>
                </div>
            </div>

        </div>
    );
};

// === LOGO HELPER ===
const SiteLogo = ({ style = {} }) => {
    const logoUrl = localStorage.getItem('route_logo_url') || '';
    const logoMode = localStorage.getItem('route_logo_mode') || 'text';
    const siteTitle = localStorage.getItem('route_logo_title') || localStorage.getItem('site_title') || 'SUPPLY2026';

    const showLogo = (logoMode === 'logo' || logoMode === 'both_side' || logoMode === 'both_below' || logoMode === 'both') && logoUrl;
    const showText = logoMode === 'text' || logoMode === 'both_side' || logoMode === 'both_below' || logoMode === 'both' || !logoUrl;
    const isBelow = logoMode === 'both_below';

    return (
        <div style={{ display: 'flex', flexDirection: isBelow ? 'column' : 'row', alignItems: 'center', gap: isBelow ? '2px' : '8px', ...style }}>
            {showLogo && (
                <img src={logoUrl} alt="Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
            )}
            {showText && (
                <span style={{ fontSize: isBelow ? '10px' : '22px', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.03em', textAlign: 'center' }}>
                    {siteTitle}
                </span>
            )}
        </div>
    );
};

// === PRINTABLE DOCUMENT ===
const PrintDocument = ({ route, pages, currentDate, currentTime }) => {
    const competencia = getCompetencia();
    return (
        <div id="print-content" style={{ fontFamily: "'Roboto', sans-serif", color: '#0f172a', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');

                .print-page {
                    background: white;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    padding: 6mm 8mm;
                    font-family: 'Roboto', sans-serif;
                    overflow: hidden;
                }

                @media screen {
                    .print-page {
                        width: 210mm;
                        height: 297mm;
                        margin-bottom: 2rem;
                        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                        border: 1px solid #e2e8f0;
                    }
                }

                @media print {
                    @page { size: A4; margin: 0; }
                    .print-page {
                        width: 100%;
                        max-width: 210mm;
                        height: 297mm;
                        margin: 0 auto;
                        padding: 6mm 8mm;
                        border: none;
                        box-shadow: none;
                        page-break-after: always;
                        overflow: hidden;
                    }
                }

                .lbl {
                    font-size: 8px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #64748b;
                    letter-spacing: 0.04em;
                    line-height: 1.2;
                }
                .val-sm {
                    font-size: 11px;
                    font-weight: 700;
                    color: #0f172a;
                    line-height: 1.2;
                }
                .val-primary {
                    font-size: 12px;
                    font-weight: 900;
                    text-transform: uppercase;
                    color: rgb(var(--color-primary, 79 70 229));
                    line-height: 1.2;
                }
            `}</style>

            {pages.map((pageItems, pageIndex) => (
                <div key={pageIndex} className="print-page">

                    {/* HEADER */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3mm', paddingBottom: '2mm', borderBottom: '2px solid #1e293b', flexShrink: 0 }}>
                        {/* Logo */}
                        <SiteLogo />

                        {/* Título da Rota */}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgb(var(--color-primary, 79 70 229))', marginBottom: '1px' }}>
                                Rota Proativa de Consumíveis
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', color: 'rgb(var(--color-primary, 79 70 229))', lineHeight: 1 }}>
                                {route?.name || 'ROTA'}
                            </div>
                        </div>

                        {/* Data / Paginação */}
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: 900, color: '#1e293b' }}>{currentDate}</div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>{currentTime}</div>
                            <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Pág. {pageIndex + 1} de {pages.length}
                            </div>
                        </div>
                    </div>

                    {/* CARDS — altura fixa para caber exatamente 5 no A4, sem crescer na última página */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2mm', overflow: 'hidden' }}>
                        {pageItems.map((item, index) => (
                            <div key={index} style={{ height: '50mm', flexShrink: 0, overflow: 'hidden' }}>
                                <EquipmentCard item={item} competencia={competencia} />
                            </div>
                        ))}
                    </div>

                </div>
            ))}
        </div>
    );
};

// === MAIN COMPONENT ===
const RoutePrint = ({ route, analysis = [], onBack }) => {
    const [pages, setPages] = useState([]);
    const [mountNode, setMountNode] = useState(null);

    useEffect(() => {
        setPages(paginateItems(analysis, 5));

        const node = document.createElement('div');
        node.id = 'print-portal-root';
        document.body.appendChild(node);
        setMountNode(node);

        const style = document.createElement('style');
        style.id = 'global-print-style';
        style.innerHTML = `
            @media print {
                #root { display: none !important; }
                #print-portal-root { display: block !important; }
                body { overflow: visible !important; height: auto !important; }
            }
            @media screen {
                #print-portal-root { display: none; }
            }
        `;
        document.head.appendChild(style);

        return () => {
            if (document.body.contains(node)) document.body.removeChild(node);
            const s = document.getElementById('global-print-style');
            if (s) document.head.removeChild(s);
        };
    }, [analysis]);

    const handlePrint = () => window.print();
    const currentDate = new Date().toLocaleDateString('pt-BR');
    const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 absolute top-0 left-0 w-full z-50 overflow-hidden">
            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center shadow-sm shrink-0 z-50">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} /> Voltar
                </button>
                <div className="flex gap-2 items-center">
                    <span className="text-sm text-slate-500 mr-4">Verifique o Layout na Pré-impressão</span>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 shadow-sm transition-colors font-medium"
                    >
                        <Printer size={20} /> Imprimir
                    </button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-400/10 flex flex-col items-center gap-8 custom-scrollbar">
                {pages.length > 0 && (
                    <PrintDocument
                        route={route}
                        pages={pages}
                        currentDate={currentDate}
                        currentTime={currentTime}
                    />
                )}
            </div>

            {/* Print Portal */}
            {mountNode && createPortal(
                <PrintDocument
                    route={route}
                    pages={pages}
                    currentDate={currentDate}
                    currentTime={currentTime}
                />,
                mountNode
            )}
        </div>
    );
};

export default RoutePrint;
