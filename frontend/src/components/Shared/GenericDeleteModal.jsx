import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

export default function GenericDeleteModal({ 
    title, 
    message, 
    targetId, 
    onClose, 
    onConfirm,
    icon: Icon = Trash2,
    confirmLabel = "Confirmar Exclusão",
    variant = "danger",
    requireTyping = true   // false = apenas botões, sem campo de texto
}) {
    const [typedId, setTypedId] = useState('');
    const isValid = requireTyping
        ? String(typedId).trim().toLowerCase() === String(targetId || '---').trim().toLowerCase()
        : true;

    const themes = {
        danger: {
            bg: 'bg-red-50',
            text: 'text-red-500',
            border: 'border-red-200',
            focus: 'focus:border-red-400 focus:ring-red-500/20',
        },
        info: {
            bg: 'bg-primary/10',
            text: 'text-primary',
            border: 'border-primary/20',
            focus: 'focus:border-primary/50 focus:ring-primary/20',
        },
        warning: {
            bg: 'bg-amber-50',
            text: 'text-amber-500',
            border: 'border-amber-200',
            focus: 'focus:border-amber-400 focus:ring-amber-500/20',
        }
    };

    const theme = themes[variant] || themes.danger;

    const confirmBtnStyle = isValid
        ? { backgroundColor: variant === 'danger' ? '#dc2626' : variant === 'warning' ? '#d97706' : 'rgb(var(--color-primary))', color: 'white' }
        : {};

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-300">
                <div className="p-8">
                    <div className={`w-14 h-14 ${theme.bg} ${theme.text} rounded-2xl flex items-center justify-center mb-6 border ${theme.border}`}>
                        <Icon size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">{title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        {message}
                    </p>

                    {requireTyping && (
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Digite <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-600 normal-case">{targetId || '---'}</span> para confirmar
                            </label>
                            <input
                                autoFocus
                                className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-lg font-mono font-bold text-slate-800 dark:text-white ${theme.focus} outline-none transition-all placeholder:text-slate-300 text-center tracking-widest`}
                                placeholder="······"
                                value={typedId}
                                onChange={e => setTypedId(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 p-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={!isValid}
                        onClick={onConfirm}
                        style={confirmBtnStyle}
                        className={`flex-[2] py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg ${isValid ? 'active:scale-95' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
