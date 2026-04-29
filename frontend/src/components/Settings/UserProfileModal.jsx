import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { X, User, Lock, Palette, Camera, RefreshCw, Save, Check, Download, Folder, Laptop, AlertCircle, CheckCircle2 } from 'lucide-react';
import { downloadFileFromAPI, cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import api from '../../lib/api';

export default function UserProfileModal({ isOpen, onClose, user }) {
    const { addToast } = useToast();
    if (!isOpen) return null;

    const [activeTab, setActiveTab] = useState('profile');
    const { theme, toggleTheme, accent, setAccent, ACCENT_COLORS } = useTheme();

    // Profile State
    const [avatar, setAvatar] = useState(user?.avatar || localStorage.getItem(`user_avatar_${user?.username}`) || null);
    const [initialRoute, setInitialRoute] = useState(user?.initial_route || '/');
    const fileInputRef = useRef(null);

    // Security State
    const [pwdData, setPwdData] = useState({ old: '', new: '', confirm: '' });
    const [recoveryPwd, setRecoveryPwd] = useState('');
    const [recoveryKey, setRecoveryKey] = useState(null);
    const [loadingKey, setLoadingKey] = useState(false);

    // Download Logic (Moved from DownloadSettings)
    const [customDestEnabled, setCustomDestEnabled] = useState(() => {
        const saved = localStorage.getItem('VITE_INTERNAL_DOWNLOADS');
        return saved === null ? true : saved === 'true';
    });
    const [targetPath, setTargetPath] = useState(localStorage.getItem('VITE_INTERNAL_DOWNLOAD_PATH') || '');
    const [isSavingDownloads, setIsSavingDownloads] = useState(false);

    useEffect(() => {
        const handleSetTab = (e) => {
            if (e.detail?.tab) setActiveTab(e.detail.tab);
        };
        window.addEventListener('set-user-profile-tab', handleSetTab);
        return () => window.removeEventListener('set-user-profile-tab', handleSetTab);
    }, []);

    // Initial Route Options
    const routes = [
        { label: 'Painel Principal (Dashboard)', value: '/' },
        { label: 'Gestão de Rotas', value: '/routes' },
        { label: 'Estoque', value: '/inventory' }, // Future
    ];

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result;
                setAvatar(base64);
                // Persist
                try {
                    await api.put('auth/me', { avatar: base64 });
                    localStorage.setItem(`user_avatar_${user?.username}`, base64); // Fallback/Cache
                } catch (error) {
                    addToast("Erro ao salvar avatar (mas foi atualizado localmente)", "error");
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveProfile = async () => {
        try {
            await api.put('auth/me', { initial_route: initialRoute });
            addToast('Preferências salvas com sucesso!', "success");
        } catch (error) {
            addToast('Erro ao salvar preferências.', "error");
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (pwdData.new !== pwdData.confirm) return addToast("As senhas não coincidem.", "warning");
        try {
            await api.put('auth/change-password', {
                old_password: pwdData.old,
                new_password: pwdData.new
            });
            addToast('Senha alterada com sucesso!', "success");
            setPwdData({ old: '', new: '', confirm: '' });
        } catch (error) {
            addToast(error.response?.data?.detail || 'Erro ao alterar senha', "error");
        }
    };

    const handleRegenerateKey = async () => {
        if (!recoveryPwd) return addToast("Digite sua senha atual.", "warning");
        setLoadingKey(true);
        try {
            const res = await api.post('auth/regenerate-recovery-key', { password: recoveryPwd });
            setRecoveryKey(res.data.recovery_key);
            setRecoveryPwd('');
        } catch (error) {
            addToast(error.response?.data?.detail || 'Erro ao gerar chave', "error");
        } finally {
            setLoadingKey(false);
        }
    };

    const handleSaveDownloads = () => {
        setIsSavingDownloads(true);
        try {
            localStorage.setItem('VITE_INTERNAL_DOWNLOADS', customDestEnabled.toString());
            localStorage.setItem('VITE_INTERNAL_DOWNLOAD_PATH', targetPath);
            window.INTERNAL_DOWNLOAD_AUDIT = customDestEnabled;
            addToast("Configurações de download atualizadas.", "success");
        } catch (err) {
            addToast("Erro ao salvar configurações.", "error");
        } finally {
            setTimeout(() => setIsSavingDownloads(false), 500);
        }
    };

    const runDownloadTest = async () => {
        if (!customDestEnabled) return addToast("Ative o destino customizado antes de testar.", "warning");
        addToast("Iniciando teste de exportação local...", "info");
        downloadFileFromAPI('/debug/test-save', 'teste_perfil.csv', { test: true });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md transition-colors duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" /> Perfil do Usuário
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6">
                    {['profile', 'security', 'downloads', 'appearance'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            {tab === 'profile' && 'Perfil e Dados'}
                            {tab === 'security' && 'Segurança'}
                            {tab === 'downloads' && 'Downloads'}
                            {tab === 'appearance' && 'Aparência'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">

                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-primary/20">
                                        {(avatar && avatar !== 'default') ? (
                                            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-primary text-2xl font-bold">
                                                {user?.username?.substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => fileInputRef.current.click()}
                                        className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full transition-opacity"
                                    >
                                        <Camera size={24} />
                                    </button>
                                    <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{user?.username}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 capitalize">{user?.role}</p>
                                </div>
                            </div>

                            <div className="grid gap-4 max-w-sm">
                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Página Inicial</span>
                                    <select
                                        value={initialRoute}
                                        onChange={(e) => setInitialRoute(e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        {routes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </label>
                                <button onClick={handleSaveProfile} className="flex items-center gap-2 justify-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                                    <Save size={16} /> Salvar Preferências
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SECURITY TAB */}
                    {activeTab === 'security' && (
                        <div className="space-y-8">
                            {/* Change Password */}
                            <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Lock size={18} /> Alterar Senha
                                </h3>
                                <input
                                    type="password" placeholder="Senha Atual" required
                                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-primary/50"
                                    value={pwdData.old} onChange={e => setPwdData({ ...pwdData, old: e.target.value })}
                                />
                                <input
                                    type="password" placeholder="Nova Senha" required
                                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-primary/50"
                                    value={pwdData.new} onChange={e => setPwdData({ ...pwdData, new: e.target.value })}
                                />
                                <input
                                    type="password" placeholder="Confirmar Nova Senha" required
                                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-primary/50"
                                    value={pwdData.confirm} onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                                />
                                <button type="submit" className="w-full py-2 bg-slate-800 dark:bg-slate-600 text-white rounded-md hover:bg-slate-700">
                                    Atualizar Senha
                                </button>
                            </form>

                            <hr className="border-slate-200 dark:border-slate-700" />

                            {/* Recovery Code */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-amber-600 flex items-center gap-2">
                                    <RefreshCw size={18} /> Código de Recuperação
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Se você perder sua senha, este código será a única forma de recuperar sua conta.
                                    Gere um novo código caso tenha perdido o anterior.
                                </p>

                                {!recoveryKey ? (
                                    <div className="flex gap-2 max-w-sm">
                                        <input
                                            type="password" placeholder="Senha para confirmar"
                                            className="flex-1 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 outline-none"
                                            value={recoveryPwd} onChange={e => setRecoveryPwd(e.target.value)}
                                        />
                                        <button onClick={handleRegenerateKey} disabled={loadingKey} className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50">
                                            {loadingKey ? 'Gerando...' : 'Gerar Novo'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                                        <p className="text-amber-800 dark:text-amber-200 font-bold mb-2">SEU NOVO CÓDIGO:</p>
                                        <code className="block text-2xl font-mono bg-white dark:bg-black/20 p-2 rounded text-center tracking-widest select-all">
                                            {recoveryKey}
                                        </code>
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                            Copie e guarde em local seguro. Ele não será exibido novamente.
                                        </p>
                                        <button onClick={() => setRecoveryKey(null)} className="mt-2 text-sm underline text-amber-700">Fechar</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* APPEARANCE TAB */}
                    {activeTab === 'appearance' && (
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                    <Palette size={18} /> Tema
                                </h3>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => theme !== 'light' && toggleTheme()}
                                        className={`flex-1 p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${theme === 'light' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800/50'}`}
                                    >
                                        <div className="w-full h-20 bg-white rounded border border-slate-200" />
                                        <span className="font-medium text-slate-900 dark:text-white">Claro</span>
                                    </button>
                                    <button
                                        onClick={() => theme !== 'dark' && toggleTheme()}
                                        className={`flex-1 p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${theme === 'dark' ? 'border-primary bg-slate-900' : 'border-slate-200 dark:border-slate-700'}`}
                                    >
                                        <div className="w-full h-20 bg-slate-900 rounded border border-slate-700" />
                                        <span className="font-medium text-slate-900 dark:text-white">Escuro</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-3">Cor de Destaque</h3>
                                <div className="flex gap-3 flex-wrap">
                                    {Object.entries(ACCENT_COLORS).map(([key, data]) => (
                                        <button
                                            key={key}
                                            onClick={() => setAccent(key)}
                                            className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${accent === key ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                                            style={{ backgroundColor: `rgb(${data.value})` }}
                                            title={data.name}
                                        >
                                            {accent === key && <Check className="text-white" size={20} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DOWNLOADS TAB */}
                    {activeTab === 'downloads' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                <div className="p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm text-primary">
                                    <Laptop size={32} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Exportação Local Personalizada</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Salve arquivos CSV diretamente em uma pasta do seu computador sem passar pelo navegador.
                                    </p>
                                    <div className="mt-2 flex items-center gap-2 text-[9px] font-bold text-primary uppercase tracking-wider bg-white/50 dark:bg-slate-700/50 w-fit px-2 py-0.5 rounded-full border border-primary/10">
                                        <AlertCircle size={10} /> Requer Assistente Local (Porta 8000)
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <button
                                        onClick={() => user?.role === 'superadmin' && setCustomDestEnabled(!customDestEnabled)}
                                        disabled={user?.role !== 'superadmin'}
                                        className={cn(
                                            "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                            customDestEnabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-600",
                                            user?.role !== 'superadmin' && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <span className={cn(
                                            "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out",
                                            customDestEnabled ? "translate-x-7" : "translate-x-0"
                                        )} />
                                    </button>
                                    {user?.role !== 'superadmin' && (
                                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                                            <Lock size={8} /> Restrito
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Folder size={16} className="text-primary" />
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pasta de Destino</h5>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Ex: C:\MeusProjetos\Exportacoes"
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        value={targetPath}
                                        onChange={(e) => setTargetPath(e.target.value)}
                                    />
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={handleSaveDownloads} disabled={isSavingDownloads} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20">
                                            <Save size={14} /> {isSavingDownloads ? "Salvando..." : "Salvar Caminho"}
                                        </button>
                                        <button onClick={runDownloadTest} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-95">
                                            <Download size={14} /> Testar Conexão
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex gap-3">
                                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                                    <div>
                                        <h6 className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">Backup Automático Ativo</h6>
                                        <p className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80">Se o assistente falhar, o download nativo do navegador assumirá em instantes.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
