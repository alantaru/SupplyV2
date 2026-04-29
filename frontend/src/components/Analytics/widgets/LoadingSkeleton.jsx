import React from 'react';

export default function LoadingSkeleton({ type = 'chart' }) {
  if (type === 'kpi') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 animate-pulse">
        <div className="h-2 w-20 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
        <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    );
  }
  if (type === 'table') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 animate-pulse space-y-2">
        <div className="h-2 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-6 bg-slate-100 dark:bg-slate-800 rounded" />
        ))}
      </div>
    );
  }
  // chart (default)
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 animate-pulse">
      <div className="h-2 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-[280px] bg-slate-100 dark:bg-slate-800 rounded-lg" />
    </div>
  );
}
