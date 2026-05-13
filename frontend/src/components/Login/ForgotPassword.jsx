import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Key, Lock, User, ArrowLeft } from 'lucide-react';
import api from '../../lib/api';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [recoveryKey, setRecoveryKey] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [status, setStatus] = useState({ type: '', msg: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', msg: '' });

        try {
            await api.post('recover-password', {
                username,
                recovery_key: recoveryKey,
                new_password: newPassword
            });
            setStatus({ type: 'success', msg: 'Senha redefinida com sucesso!' });
            setTimeout(() => navigate('/login'), 2000);
        } catch (_error) {


            const msg = error.response?.data?.detail || "Erro ao redefinir senha";
            setStatus({ type: 'error', msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-8 relative border border-slate-200 dark:border-slate-800 transition-colors">
                <Link to="/login" className="absolute top-4 left-4 text-slate-400 hover:text-slate-600">
                    <ArrowLeft size={24} />
                </Link>

                <div className="text-center mb-8 mt-4">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Recuperação de Senha</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                        Use sua Chave de Segurança (ex: XXXX-XXXX)
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Usuário</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-slate-400"><User size={18} /></span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="pl-10 block w-full rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm focus:border-primary py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                                placeholder="ex: admin"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Chave de Recuperação</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-slate-400"><Key size={18} /></span>
                            <input
                                type="text"
                                value={recoveryKey}
                                onChange={(e) => setRecoveryKey(e.target.value)}
                                className="pl-10 block w-full rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm focus:border-primary py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none uppercase"
                                placeholder="XXXX-XXXX"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-slate-400"><Lock size={18} /></span>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="pl-10 block w-full rounded-lg border-slate-300 shadow-sm focus:border-primary py-2.5 bg-slate-50"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    {status.msg && (
                        <div className={`text-sm p-3 rounded-lg border ${status.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {status.msg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                    >
                        {loading ? 'Redefinindo...' : 'Redefinir Senha'}
                    </button>

                    <div className="text-center text-xs text-slate-400">
                        Não tem a chave? Contate o Administrador.
                    </div>
                </form>
            </div>
        </div>
    );
}
