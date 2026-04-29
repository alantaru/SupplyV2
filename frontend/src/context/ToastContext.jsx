import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Math.random().toString(36).substring(2, 9);
        const toast = { id, message, type, duration };
        
        setToasts(prevToasts => [...prevToasts, toast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    useEffect(() => {
        const handleGlobalToast = (event) => {
            const { message, type, duration } = event.detail;
            addToast(message, type, duration);
        };
        window.addEventListener('add-toast', handleGlobalToast);
        return () => window.removeEventListener('add-toast', handleGlobalToast);
    }, [addToast]);

    const removeToast = useCallback((id) => {
        setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    }, []);

    const getIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
            case 'error': return <AlertCircle className="h-5 w-5 text-rose-500" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
            case 'info': default: return <Info className="h-5 w-5 text-sky-500" />;
        }
    };

    const getBgClass = (type) => {
        switch (type) {
            case 'success': return 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';
            case 'error': return 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20';
            case 'warning': return 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20';
            case 'info': default: return 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20';
        }
    };

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-sm transition-all animate-in slide-in-from-right-full fade-in duration-300 w-full max-w-sm ${getBgClass(toast.type)}`}
                        role="alert"
                    >
                        <div className="shrink-0 animate-bounce">{getIcon(toast.type)}</div>
                        <div className="flex-1">
                            {/* <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1 capitalize">{toast.type}</h3> */}
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {toast.message}
                            </p>
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
