import { useState, useEffect } from 'react';
import { Wrench, AlertTriangle, CheckCircle, Clock, Copy, Plus, Filter, Search, ChevronRight, Map as MapIcon, Package, Clipboard as ClipboardIcon } from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthProvider';
import OSWizard from './OSWizard';
import NFManager from './NFManager';
import PartsStockManager from './PartsStockManager';
import EquipmentModal from '../Equipment/EquipmentModal';
import MaintenanceOptionsModal from './MaintenanceOptionsModal';

function MapDivergencesView() {
    const [divergences, setDivergences] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchDivergences = async () => {
        try {
            const res = await api.get('maintenance/divergences/list');
            setDivergences(res.data);
            setLoading(false);
        } catch (_error) {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDivergences();
    }, []);

    const copyDivergenceScript = (div) => {
        const script = `📌 *SOLICITAÇÃO DE ALTERAÇÃO DE MAPA*
---------------------------------------
Série: ${div.Serie}
Campo Alterado: ${div.Campo}
Novo Valor: ${div.ValorTecnico}
Data da Alteração: ${new Date(div.DataAlteracao).toLocaleString()}
---------------------------------------
Favor atualizar na Base Oficial.`;
        navigator.clipboard.writeText(script);
        alert("Script copiado para o Teams!");
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <MapIcon size={24} />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-slate-800 dark:text-white">Inventário em Divergência</h4>
                        <p className="text-xs text-slate-400">Alterações feitas por técnicos que ainda não foram sincronizadas com o Mapa Oficial.</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Equipamento</th>
                                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Campo</th>
                                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Valor Técnico</th>
                                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Ação Teams</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan="4" className="p-10 text-center text-xs text-slate-400 italic">Carregando divergências...</td></tr>
                            ) : divergences.length === 0 ? (
                                <tr><td colSpan="4" className="p-10 text-center text-xs text-slate-400 italic">O mapa técnico está 100% sincronizado com o oficial.</td></tr>
                            ) : divergences.map((div, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4 font-bold text-xs text-slate-700 dark:text-slate-300">{div.Serie}</td>
                                    <td className="p-4 text-xs text-slate-500">{div.Campo}</td>
                                    <td className="p-4">
                                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">{div.ValorTecnico}</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => copyDivergenceScript(div)}
                                            className="flex items-center gap-1.5 ml-auto text-[10px] font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
                                        >
                                            <Copy size={12} /> Copiar Script
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function MaintenanceDashboard() {

    const { user } = useAuth();
    const activeContract = user?.activeContract;
    const [equipments, setEquipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [isOSModalOpen, setIsOSModalOpen] = useState(false);
    const [selectedSerie, setSelectedSerie] = useState(null);
    const [selectedEquipmentForOptions, setSelectedEquipmentForOptions] = useState(null);
    const [activeTab, setActiveTab] = useState('preventive');
    const [backups, setBackups] = useState([]);

    const fetchStatus = async () => {
        try {
            const [statusRes, backupsRes] = await Promise.all([
                api.get('maintenance/status'),
                api.get('maintenance/backups-aging')
            ]);
            setEquipments(statusRes.data);
            setBackups(backupsRes.data);
            setLoading(false);
        } catch (_error) {
            console.error("Failed to fetch maintenance status", _error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'CRITICAL': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'WARNING': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            default: return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        }
    };

    const filteredEquipments = equipments.filter(eq => {
        const matchesSearch = eq.Serie.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (eq.Local || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const hasWarning = eq.Componentes.some(c => c.Status === 'WARNING' || c.Status === 'CRITICAL');
        const hasCritical = eq.Componentes.some(c => c.Status === 'CRITICAL');
        const isOperational = eq.Componentes.every(c => c.Status === 'OK');

        if (filterStatus === 'CRITICAL') return matchesSearch && hasCritical;
        if (filterStatus === 'WARNING') return matchesSearch && hasWarning;
        if (filterStatus === 'OPERATIONAL') return matchesSearch && isOperational;
        return matchesSearch;
    });

    const handleAction = (actionId, equipment) => {
        setSelectedEquipmentForOptions(null);
        if (actionId === 'os') {
            setSelectedSerie(equipment.Serie); // This might need to be adjusted if OSWizard expects more than just serie
            setIsOSModalOpen(true);
        } else if (actionId === 'details' || actionId === 'history') {
            setSelectedSerie(equipment.Serie);
        } else if (actionId === 'parts') {
            setActiveTab('parts');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Tab Navigation */}
            <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
                <button 
                    onClick={() => setActiveTab('preventive')}
                    className={cn(
                        "pb-4 px-2 text-sm font-bold transition-all relative",
                        activeTab === 'preventive' ? "text-primary" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    Monitoramento Preventivo
                    {activeTab === 'preventive' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                </button>
                <button 
                    onClick={() => setActiveTab('finance')}
                    className={cn(
                        "pb-4 px-2 text-sm font-bold transition-all relative",
                        activeTab === 'finance' ? "text-primary" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    Notas Fiscais
                    {activeTab === 'finance' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                </button>
                <button 
                    onClick={() => setActiveTab('backups')}
                    className={cn(
                        "pb-4 px-2 text-sm font-bold transition-all relative",
                        activeTab === 'backups' ? "text-primary" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    Monitoramento Backups (SLA)
                    {backups.some(b => b.Status === 'CRITICAL') && (
                        <span className="absolute top-0 -right-2 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                    {activeTab === 'backups' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                </button>
                <button 
                    onClick={() => setActiveTab('divergences')}
                    className={cn(
                        "pb-4 px-2 text-sm font-bold transition-all relative",
                        activeTab === 'divergences' ? "text-primary" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    Divergências de Mapa
                    {activeTab === 'divergences' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                </button>
                <button 
                    onClick={() => setActiveTab('parts')}
                    className={cn(
                        "pb-4 px-2 text-sm font-bold transition-all relative",
                        activeTab === 'parts' ? "text-primary" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    Estoque de Peças
                    {activeTab === 'parts' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                </button>
            </div>

            {activeTab === 'preventive' ? (
                <>
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                        { id: 'ALL', label: 'Total Monitorado', value: equipments.length, icon: Wrench, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
                        { id: 'CRITICAL', label: 'Críticos (>90%)', value: equipments.filter(e => e.Componentes.some(c => c.Status === 'CRITICAL')).length, icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
                        { id: 'WARNING', label: 'Atenção (>80%)', value: equipments.filter(e => e.Componentes.some(c => c.Status === 'WARNING')).length, icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
                        { id: 'OPERATIONAL', label: 'Operacionais', value: equipments.filter(e => e.Componentes.every(c => c.Status === 'OK')).length, icon: CheckCircle, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
                    ].map((stat, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => setFilterStatus(stat.id)}
                            className={cn(
                                "bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border shadow-sm transition-all text-left group",
                                filterStatus === stat.id 
                                    ? "border-primary ring-2 ring-primary/20 scale-[1.02]" 
                                    : "border-slate-200 dark:border-slate-800 hover:scale-[1.02]"
                            )}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={cn("p-3 rounded-2xl", stat.bgColor, stat.color)}>
                                    <stat.icon size={24} />
                                </div>
                                {filterStatus === stat.id && (
                                    <div className="bg-primary/10 text-primary p-1 rounded-full">
                                        <Filter size={14} />
                                    </div>
                                )}
                            </div>
                            <p className="text-3xl font-black text-slate-800 dark:text-white">{stat.value}</p>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">{stat.label}</p>
                        </button>
                    ))}
                </div>

                {/* Main Controls */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/50 dark:bg-slate-900/30 backdrop-blur-md p-4 rounded-3xl border border-slate-200 dark:border-slate-800">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por Série ou Local..."
                            className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {['ALL', 'WARNING', 'CRITICAL', 'OPERATIONAL'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={cn(
                                    "px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border",
                                    filterStatus === status 
                                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                                        : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-primary"
                                )}
                            >
                                {status === 'ALL' ? 'Todos' : status === 'WARNING' ? 'Atenção' : status === 'CRITICAL' ? 'Crítico' : 'Operacionais'}
                            </button>
                        ))}
                        <button 
                            onClick={() => setIsOSModalOpen(true)}
                            className="ml-4 bg-primary text-white px-6 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                            <Plus size={16} /> Nova O.S.
                        </button>
                    </div>
                </div>

                {/* Preventive Maintenance Table */}
                <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Equipamento</th>
                                <th className="p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Localização</th>
                                <th className="p-6 text-xs font-bold uppercase tracking-widest text-slate-400 text-center">Desgaste por Componente</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan="3" className="p-20 text-center text-slate-400 font-medium italic">Sincronizando dados de manutenção...</td></tr>
                            ) : filteredEquipments.length === 0 ? (
                                <tr><td colSpan="3" className="p-20 text-center text-slate-400 font-medium italic">Nenhum alerta de manutenção encontrado.</td></tr>
                            ) : filteredEquipments.map((eq) => (
                                <tr 
                                    key={eq.Serie} 
                                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                    onClick={() => setSelectedEquipmentForOptions(eq)}
                                >
                                    <td className="p-6">
                                        <p className="font-bold text-slate-800 dark:text-white">{eq.Serie}</p>
                                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider mt-0.5">{eq.Modelo}</p>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-sm text-slate-600 dark:text-slate-400">{eq.Local || 'Sem Localização'}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Contador: {eq.ContadorAtual.toLocaleString()}</p>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center justify-center gap-4">
                                            {eq.Componentes.map((comp) => (
                                                <div key={comp.Tipo} className="flex flex-col items-center gap-2">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-xl flex items-center justify-center border transition-all group-hover:scale-110",
                                                        getStatusColor(comp.Status)
                                                    )}>
                                                        <span className="text-[10px] font-black">{comp.Uso}%</span>
                                                    </div>
                                                    <span className="text-[8px] font-bold uppercase tracking-tighter text-slate-400">{comp.Tipo}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                </>
            ) : activeTab === 'finance' ? (
                <NFManager />
            ) : activeTab === 'parts' ? (
                <PartsStockManager />
            ) : activeTab === 'backups' ? (
                <div className="space-y-6">
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl flex items-center gap-3">
                        <AlertTriangle className="text-amber-500" size={20} />
                        <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                            Máquinas configuradas como **BACKUP** não devem permanecer em campo por mais de **10 dias**. 
                            Valores em vermelho indicam estouro de SLA.
                        </p>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <th className="p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Série</th>
                                    <th className="p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Localização</th>
                                    <th className="p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Dias em Campo</th>
                                    <th className="p-6 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {backups.length === 0 ? (
                                    <tr><td colSpan="4" className="p-20 text-center text-slate-400 font-medium italic">Nenhum backup em campo identificado.</td></tr>
                                ) : backups.map((b) => (
                                    <tr key={b.Serie} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="p-6 font-bold text-slate-800 dark:text-white">{b.Serie}</td>
                                        <td className="p-6 text-sm text-slate-600 dark:text-slate-400">{b.Local}</td>
                                        <td className="p-6">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-xs font-black",
                                                b.Status === 'CRITICAL' ? "bg-red-500 text-white animate-pulse" : 
                                                b.Status === 'WARNING' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                            )}>
                                                {b.DiasEmCampo} dias
                                            </span>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button className="text-xs font-bold text-primary hover:underline">Registrar Retorno</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <MapDivergencesView />
            )}

            <OSWizard 
                isOpen={isOSModalOpen} 
                onClose={() => setIsOSModalOpen(false)} 
                preSelectedSerie={selectedSerie}
                onSuccess={() => {
                    setIsOSModalOpen(false);
                    fetchStatus();
                }}
            />

            {selectedSerie && (
                <EquipmentModal 
                    serie={selectedSerie}
                    activeContract={activeContract}
                    onClose={() => setSelectedSerie(null)}
                />
            )}

            <MaintenanceOptionsModal 
                isOpen={!!selectedEquipmentForOptions}
                equipment={selectedEquipmentForOptions}
                onClose={() => setSelectedEquipmentForOptions(null)}
                onAction={handleAction}
            />
        </div>
    );
}




