import React from 'react';
import { Download } from 'lucide-react';

export default function ChartCard({ title, children, onExport }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{title}</h3>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
