import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems,
    onPageChange,
    onItemsPerPageChange
}) {
    if (totalItems === 0) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {/* Items Per Page & Stats */}
            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                    <span>Exibir</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                        className="border border-slate-300 dark:border-slate-600 rounded p-1 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
                <span>
                    {startItem}-{endItem} de {totalItems}
                </span>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-300"
                    title="Anterior"
                >
                    <ChevronLeft size={20} />
                </button>

                {/* Simple Page Indicator */}
                <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        // Logic to show generic page window around current
                        let p = i + 1;
                        if (totalPages > 5) {
                            if (currentPage > 3) p = currentPage - 2 + i;
                            if (p > totalPages) p = totalPages - 4 + i; // Stick to end
                        }
                        return p;
                    })
                        .filter(p => p > 0 && p <= totalPages)
                        .map(p => (
                            <button
                                key={p}
                                onClick={() => onPageChange(p)}
                                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${currentPage === p
                                        ? 'bg-primary text-white'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                </div>

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-300"
                    title="Próxima"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
}
