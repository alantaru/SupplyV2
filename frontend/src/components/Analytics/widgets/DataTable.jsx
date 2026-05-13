import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function DataTable({ columns = [], rows = [], maxRows = 10 }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows.slice(0, maxRows);
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : String(bv ?? '').localeCompare(String(av ?? ''));
    }).slice(0, maxRows);
  }, [rows, sortKey, sortDir, maxRows]);

  if (!rows.length) {
    return <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Sem dados</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-xs border-separate border-spacing-0">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="px-3 py-2 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[9px] cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 transition-colors"
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  <div className="flex flex-col opacity-30">
                    <ArrowUp className={cn('w-2 h-2', sortKey === col.key && sortDir === 'asc' && 'text-primary opacity-100')} />
                    <ArrowDown className={cn('w-2 h-2', sortKey === col.key && sortDir === 'desc' && 'text-primary opacity-100')} />
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              {columns.map(col => (
                <td key={col.key} className="px-3 py-2 text-slate-700 dark:text-slate-300 border-b border-slate-50 dark:border-slate-800/50">
                  {row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
