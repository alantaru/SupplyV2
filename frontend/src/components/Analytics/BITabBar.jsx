import { cn } from '../../lib/utils';

const TABS = [
  'Visão Geral',
  'Entregas',
  'Insumos',
  'Equipamentos',
  'Estoque',
  'Operacional',
];

export default function BITabBar({ activeTab, onTabChange }) {
  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 shrink-0">
      <div className="flex gap-0 overflow-x-auto custom-scrollbar">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => onTabChange(i)}
            className={cn(
              'px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all',
              activeTab === i
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            {tab}
          </button>
        ))}
      </div>
    </nav>
  );
}
