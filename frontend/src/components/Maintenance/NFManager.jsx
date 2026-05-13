import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Trash2, Download, Calendar, Tag, DollarSign, X, Upload } from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import { useToast } from '../../context/ToastContext';

const NFManager = () => {
    const { addToast } = useToast();
    const [nfs, setNfs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        numero: '',
        data: '',
        fornecedor: '',
        valor: '',
        serie: ''
    });
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        fetchNFs();
    }, []);

    const fetchNFs = async () => {
        try {
            setLoading(true);
            const response = await api.get('maintenance/nf');
            setNfs(Array.isArray(response.data) ? response.data : []);
        } catch (_error) {
            console.error("Failed to fetch NFs", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) return alert("Selecione um arquivo (PDF/Imagem)");

        const form = new FormData();
        form.append('file', selectedFile);
        form.append('numero', formData.numero);
        form.append('data', formData.data);
        form.append('fornecedor', formData.fornecedor);
        form.append('valor', formData.valor);
        form.append('serie', formData.serie);

        try {
            setUploading(true);
            await api.post('maintenance/nf', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            addToast("Nota Fiscal registrada!", "success");
            setIsModalOpen(false);
            fetchNFs();
            setFormData({ numero: '', data: '', fornecedor: '', valor: '', serie: '' });
            setSelectedFile(null);
        } catch (_error) {
            addToast("Erro ao registrar NF.", "error");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (filename) => {
        if (!window.confirm("Excluir esta Nota Fiscal permanentemente?")) return;
        try {
            await api.delete(`/maintenance/nf/${filename}`);
            addToast("NF excluída.", "info");
            fetchNFs();
        } catch (_error) {
            addToast("Erro ao excluir.", "error");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Registro de Notas Fiscais</h3>
                    <p className="text-xs text-slate-400">Controle simples de faturamento de peças e serviços.</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary text-white px-6 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus size={16} /> Registrar NF
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />)}
                </div>
            ) : nfs.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-400 font-medium">Nenhuma NF registrada para este contrato.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nfs.map((nf, idx) => (
                        <div key={idx} className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-2xl rounded-full -mr-12 -mt-12" />
                            
                            <div className="flex items-start justify-between mb-4 relative">
                                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                                    <FileText size={20} />
                                </div>
                                <button 
                                    onClick={() => handleDelete(nf.Filename)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="space-y-3 relative">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NF #{nf.Numero}</p>
                                    <p className="font-bold text-slate-800 dark:text-white truncate">{nf.Fornecedor}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Calendar size={12} />
                                        <span>{nf.Data}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                        <DollarSign size={12} />
                                        <span>R$ {parseFloat(nf.Valor).toLocaleString()}</span>
                                    </div>
                                </div>

                                {nf.Serie && (
                                    <div className="flex items-center gap-1.5 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg w-fit text-slate-500">
                                        <Tag size={10} />
                                        <span>Série: {nf.Serie}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Novo Registro de NF</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleUpload} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Número NF</label>
                                    <input 
                                        type="text" required
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary"
                                        value={formData.numero}
                                        onChange={e => setFormData({...formData, numero: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Emissão</label>
                                    <input 
                                        type="date" required
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary"
                                        value={formData.data}
                                        onChange={e => setFormData({...formData, data: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor</label>
                                <input 
                                    type="text" required
                                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary"
                                    value={formData.fornecedor}
                                    onChange={e => setFormData({...formData, fornecedor: e.target.value})}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor (R$)</label>
                                    <input 
                                        type="number" step="0.01" required
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary font-bold text-emerald-600"
                                        value={formData.valor}
                                        onChange={e => setFormData({...formData, valor: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipamento (Série)</label>
                                    <input 
                                        type="text"
                                        placeholder="Opcional"
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border-none outline-none focus:ring-2 focus:ring-primary"
                                        value={formData.serie}
                                        onChange={e => setFormData({...formData, serie: e.target.value.toUpperCase()})}
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload size={24} className="text-slate-400 mb-2" />
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                                            {selectedFile ? selectedFile.name : 'Anexar Arquivo (PDF/IMG)'}
                                        </p>
                                    </div>
                                    <input type="file" className="hidden" onChange={e => setSelectedFile(e.target.files[0])} accept="image/*,.pdf" />
                                </label>
                            </div>

                            <button 
                                type="submit"
                                disabled={uploading}
                                className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                            >
                                {uploading ? 'Registrando...' : 'Finalizar Registro'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NFManager;
