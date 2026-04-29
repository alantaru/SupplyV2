import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';

const PRESETS = [
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Últimos 90 dias', days: 90 },
  { label: 'Este ano', year: true },
  { label: 'Tudo', all: true },
];

function toISODate(d) {
  return d.toISOString().split('T')[0];
}

export default function BIHeader({ contractId, dateFilter, onFilterChange, onClose }) {
  const [localStart, setLocalStart] = useState(dateFilter.start || '');
  const [localEnd, setLocalEnd] = useState(dateFilter.end || '');
  const [dateError, setDateError] = useState('');

  const applyFilter = (start, end) => {
    if (start && end && start > end) {
      setDateError('A data inicial não pode ser posterior à data final.');
      return;
    }
    setDateError('');
    onFilterChange({ start: start || null, end: end || null });
  };

  const handleStartChange = (val) => {
    setLocalStart(val);
    setDateError('');
  };

  const handleEndChange = (val) => {
    setLocalEnd(val);
    setDateError('');
  };

  const handleApply = () => applyFilter(localStart, localEnd);

  const handlePreset = (preset) => {
    if (preset.all) {
      setLocalStart('');
      setLocalEnd('');
      setDateError('');
      onFilterChange({ start: null, end: null });
      return;
    }
    const end = new Date();
    let start;
    if (preset.year) {
      start = new Date(end.getFullYear(), 0, 1);
    } else {
      start = new Date();
      start.setDate(start.getDate() - preset.days);
    }
    const s = toISODate(start);
    const e = toISODate(end);
    setLocalStart(s);
    setLocalEnd(e);
    setDateError('');
    onFilterChange({ start: s, end: e });
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 flex flex-col gap-2 shrink-0 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-white leading-none">BI Dashboard</h1>
            {contractId && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                Contrato: {contractId}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset buttons */}
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              {p.label}
            </button>
          ))}

          {/* Date inputs */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={localStart}
              onChange={(e) => handleStartChange(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 outline-none"
            />
            <span className="text-slate-400 text-xs">→</span>
            <input
              type="date"
              value={localEnd}
              onChange={(e) => handleEndChange(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 outline-none"
            />
            <button
              onClick={handleApply}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all"
              style={{ backgroundColor: 'rgb(var(--color-primary))' }}
            >
              Aplicar
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {dateError && (
        <p className="text-xs text-red-500 font-medium px-1">{dateError}</p>
      )}
    </header>
  );
}
