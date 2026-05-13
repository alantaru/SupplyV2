import { useState, useEffect } from 'react';
import { Package, History, ArrowUpRight, ArrowDownLeft, Search, Plus, Loader, User, Calendar, Hash } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export default function PartsStockManager() {
    const { addToast } = useToast();
    const [parts, setParts] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [newPart, setNewPart] = useState({
        Codigo: '',
        Nome: '',
        Modelo: '',
        VidaUtil: 0,
        Componente: 'Outros'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [partsRes, histRes] = await Promise.all([
                api.get('maintenance/parts/compatible?modelo='), // Empty model returns all
                api.get('maintenance/parts/history')
            ]);
            setParts(partsRes.data);
            setHistory(histRes.data);
        } catch (error) {
            addToast('Erro ao carregar estoque de peças.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePart = async () => {
        try {
            await api.post('maintenance/parts/catalog', newPart);
            addToast('Peça cadastrada no catálogo!', 'success');
            setShowCatalogModal(false);
            setNewPart({ Codigo: '', Nome: '', Modelo: '', VidaUtil: 0, Componente: 'Outros' });
            fetchData();
        } catch (error) {
            addToast(error.response?.data?.detail || 'Erro ao cadastrar peça.', 'error');
        }
    };

    const filteredParts = parts.filter(p => 
        p.Nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.Codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.Modelo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="flex justify-center p-20"><Loader className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3 text-primary mb-2">
                        <Package size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">Total de Itens</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800 dark:text-white">{parts.length}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3 text-emerald-500 mb-2">
                        <ArrowUpRight size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">Entradas (Mês)</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800 dark:text-white">
                        {history.filter(h => h.Tipo === 'ENTRADA').length}
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3 text-red-500 mb-2">
                        <ArrowDownLeft size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">Saídas / O.S. (Mês)</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800 dark:text-white">
                        {history.filter(h => h.Tipo === 'SAIDA').length}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Inventory Table */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-3">
                            <Package className="text-slate-400" size={18} />
                            <h3 className="font-bold text-slate-800 dark:text-white">Estoque de Peças Técnicas</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input 
                                    type="text"
                                    placeholder="Buscar peça..."
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary w-48"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button 
                                onClick={() => setShowCatalogModal(true)}
                                title="Cadastrar Nova Peça no Catálogo"
                                className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 p-2 rounded-lg hover:bg-slate-200 transition-all"
                            >
                                <Package size={18} />
                            </button>
                            <button 
                                onClick={() => { setMoveData({...moveData, tipo: 'ENTRADA'}); setShowMoveModal(true); }}
                                className="bg-primary text-white p-2 rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peça / Modelo</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Estoque</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredParts.map((p) => (
                                    <tr key={p.Codigo} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-sm text-slate-800 dark:text-white">{p.Nome}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{p.Codigo} • Compatible: {p.Modelo}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.Quantidade <= 2 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                {p.Quantidade} un
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => { setMoveData({...moveData, codigo: p.Codigo, tipo: 'SAIDA'}); setShowMoveModal(true); }}
                                                className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors text-xs font-bold"
                                            >
                                                Lançar Saída
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* History Sidebar */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3">
                        <History className="text-slate-400" size={18} />
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Histórico Recente</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[600px] p-4 space-y-4 custom-scrollbar">
                        {history.map((h, i) => (
                            <div key={i} className="relative pl-6 border-l-2 border-slate-100 dark:border-slate-800 pb-2">
                                <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${h.Tipo === 'ENTRADA' ? 'bg-emerald-500' : 'bg-primary'}`} />
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                        {new Date(h.Data).toLocaleDateString()} {new Date(h.Data).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${h.Tipo === 'ENTRADA' ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                                        {h.Tipo}
                                    </span>
                                </div>
                                <div className="text-xs font-bold text-slate-800 dark:text-white">{h.Codigo}</div>
                                <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-2">
                                    <span className="flex items-center gap-1"><Hash size={10} /> Qtd: {h.Quantidade}</span>
                                    {h.OS && <span className="flex items-center gap-1"><Package size={10} /> O.S: {h.OS}</span>}
                                    {h.Serie && <span className="flex items-center gap-1"><Search size={10} /> S/N: {h.Serie}</span>}
                                    <span className="flex items-center gap-1"><User size={10} /> {h.Usuario}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Move Modal */}
            {showMoveModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                            <h3 className="font-bold text-slate-800 dark:text-white">Lançamento de Estoque</h3>
                            <button onClick={() => setShowMoveModal(false)} className="text-slate-400 hover:text-slate-600">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peça</label>
                                <select 
                                    className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary text-sm"
                                    value={moveData.codigo}
                                    onChange={(e) => setMoveData({...moveData, codigo: e.target.value})}
                                >
                                    <option value="">Selecione a peça...</option>
                                    {parts.map(p => <option key={p.Codigo} value={p.Codigo}>{p.Nome} ({p.Codigo})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</label>
                                    <select 
                                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary text-sm"
                                        value={moveData.tipo}
                                        onChange={(e) => setMoveData({...moveData, tipo: e.target.value})}
                                    >
                                        <option value="ENTRADA">Entrada (+)</option>
                                        <option value="SAIDA">Saída (-)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quantidade</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary text-sm font-bold"
                                        value={moveData.quantidade}
                                        onChange={(e) => setMoveData({...moveData, quantidade: parseInt(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">O.S. (Chamado)</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary text-sm"
                                        placeholder="Opcional"
                                        value={moveData.os_id}
                                        onChange={(e) => setMoveData({...moveData, os_id: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Número de Série</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                                        placeholder="Opcional"
                                        value={moveData.serie}
                                        onChange={(e) => setMoveData({...moveData, serie: e.target.value})}
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={handleMove}
                                disabled={!moveData.codigo || moveData.quantidade <= 0}
                                className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                            >
                                Confirmar Lançamento
                            </button>
                        </div>
                    </div>
                </div>
            {/* Catalog Modal (Create New Part Metadata) */}
            {showCatalogModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                            <h3 className="font-bold text-slate-800 dark:text-white">Cadastrar Nova Peça</h3>
                            <button onClick={() => setShowCatalogModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Part Number (Código)</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                                        placeholder="Ex: 4020-UI"
                                        value={newPart.Codigo}
                                        onChange={(e) => setNewPart({...newPart, Codigo: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Componente</label>
                                    <select 
                                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary text-sm"
                                        value={newPart.Componente}
                                        onChange={(e) => setNewPart({...newPart, Componente: e.target.value})}
                                    >
                                        <option value="UnidImg">Unidade Imagem</option>
                                        <option value="Fusao">Fusão</option>
                                        <option value="Belt">Belt / Transfer</option>
                                        <option value="Disposal">Disposal / Waste</option>
                                        <option value="Outros">Outros / Peça Técnica</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome da Peça</label>
                                <input 
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary text-sm"
                                    placeholder="Ex: Unidade de Imagem Lexmark"
                                    value={newPart.Nome}
                                    onChange={(e) => setNewPart({...newPart, Nome: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Modelo Compatível</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary text-sm"
                                        placeholder="Ex: 4020"
                                        value={newPart.Modelo}
                                        onChange={(e) => setNewPart({...newPart, Modelo: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vida Útil (Páginas)</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary text-sm font-bold"
                                        value={newPart.VidaUtil}
                                        onChange={(e) => setNewPart({...newPart, VidaUtil: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={handleCreatePart}
                                disabled={!newPart.Codigo || !newPart.Nome || !newPart.Modelo}
                                className="w-full bg-slate-800 dark:bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                            >
                                Salvar no Catálogo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


