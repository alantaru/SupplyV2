import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KPICard({ label, value, icon, trend }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</p>
        {icon && (
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{value ?? '—'}</p>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trend.direction === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{trend.value}</span>
          </div>
        )}
      </div>
    </div>
  );
}
