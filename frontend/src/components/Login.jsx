import React, { useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
    const { login } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const res = await login(username, password);
        setLoading(false);

        if (res.success) {
            navigate(res.route || '/');
        } else {
            setError(res.msg || 'Falha no login');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 bg-gradient-to-br from-slate-100 via-primary/5 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-700 transition-colors">
            {/* Subtle background decoration */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full" />

            <div className="w-full max-w-md relative z-10">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-10 border border-slate-200/80 dark:border-slate-800 relative overflow-hidden transition-colors">
                    {/* Decorative top accent */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                    
                    <div className="text-center mb-8 relative">
                        <button 
                            type="button"
                            onClick={toggleTheme}
                            className="absolute right-0 top-0 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary dark:hover:text-white transition-all shadow-sm border border-slate-100 dark:border-slate-700"
                            title="Alternar Tema"
                        >
                            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-5 shadow-sm">
                            <Lock className="w-7 h-7 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight mb-1">Supply <span className="text-primary">2026</span></h1>
                        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-[0.3em]">Acesso Restrito</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Usuário</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <User size={18} />
                                </span>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-sm text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                                    placeholder="ex: admin"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Lock size={18} />
                                </span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-sm text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono tracking-widest"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-xs font-bold p-3.5 rounded-xl border border-red-200">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center py-4 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold uppercase tracking-widest overflow-hidden transition-all disabled:opacity-50 shadow-lg shadow-primary/20 active:scale-[0.98]"
                        >
                            {loading ? 'Entrando...' : 'Acessar Sistema'}
                        </button>

                        <div className="text-center pt-2">
                            <Link to="/forgot-password" title="Recuperar Senha" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-white uppercase tracking-widest transition-colors">
                                Esqueci minha senha
                            </Link>
                        </div>
                    </form>
                </div>
                
                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-[0.3em]">Gerenciamento de Suprimentos</p>
                </div>
            </div>
        </div>
    );
}
