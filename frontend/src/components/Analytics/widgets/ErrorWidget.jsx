import { AlertCircle } from 'lucide-react';

export default function ErrorWidget({ message, onRetry }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/30 rounded-xl shadow-sm p-6 flex flex-col items-center gap-3 text-center">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p className="text-sm text-slate-600 dark:text-slate-400">{message || 'Erro ao carregar dados'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
          style={{ backgroundColor: 'rgb(var(--color-primary))' }}
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
