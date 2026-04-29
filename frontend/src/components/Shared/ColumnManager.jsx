import React, { useState, useRef, useEffect } from 'react';
import { Columns, Check, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

export default function ColumnManager({ columns, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const dropdownRef = useRef(null);
    const dragIndexRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleVisibility = (index) => {
        const newCols = [...columns];
        newCols[index] = { ...newCols[index], visible: !newCols[index].visible };
        onChange(newCols);
    };

    const moveUp = (index, e) => {
        e.stopPropagation();
        if (index === 0) return;
        const newCols = [...columns];
        [newCols[index], newCols[index - 1]] = [newCols[index - 1], newCols[index]];
        onChange(newCols);
    };

    const moveDown = (index, e) => {
        e.stopPropagation();
        if (index === columns.length - 1) return;
        const newCols = [...columns];
        [newCols[index], newCols[index + 1]] = [newCols[index + 1], newCols[index]];
        onChange(newCols);
    };

    // Drag-and-drop handlers
    const handleDragStart = (e, index) => {
        dragIndexRef.current = index;
        e.dataTransfer.effectAllowed = 'move';
        // Minimal ghost image
        e.dataTransfer.setDragImage(e.currentTarget, 12, 12);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleDrop = (e, toIndex) => {
        e.preventDefault();
        const fromIndex = dragIndexRef.current;
        if (fromIndex === null || fromIndex === toIndex) {
            setDragOverIndex(null);
            return;
        }
        const newCols = [...columns];
        const [moved] = newCols.splice(fromIndex, 1);
        newCols.splice(toIndex, 0, moved);
        onChange(newCols);
        dragIndexRef.current = null;
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        dragIndexRef.current = null;
        setDragOverIndex(null);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm border ${
                    isOpen
                        ? 'text-primary bg-primary/10 border-primary/20'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                title="Personalizar Colunas"
            >
                <Columns className="h-4 w-4" />
                <span className="hidden lg:inline">Colunas</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 transition-colors">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                        <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            Configuração de Colunas
                        </h4>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Arraste para reordenar</p>
                    </div>
                    <div className="p-2 max-h-72 overflow-y-auto custom-scrollbar">
                        {columns.map((col, index) => (
                            <div
                                key={col.key}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center justify-between p-1.5 rounded-lg transition-colors group ${
                                    dragOverIndex === index && dragIndexRef.current !== index
                                        ? 'bg-primary/10 border border-primary/30'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                                } ${dragIndexRef.current === index ? 'opacity-40' : 'opacity-100'}`}
                            >
                                {/* Drag handle */}
                                <div className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 mr-1 shrink-0">
                                    <GripVertical size={14} />
                                </div>

                                {/* Visibility toggle */}
                                <button
                                    className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                                    onClick={() => toggleVisibility(index)}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                        col.visible
                                            ? 'bg-primary border-primary'
                                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                    }`}>
                                        {col.visible && <Check size={10} className="text-white" />}
                                    </div>
                                    <span className={`text-xs font-bold truncate ${
                                        col.visible ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
                                    }`}>
                                        {col.label}
                                    </span>
                                </button>

                                {/* Up/Down buttons */}
                                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <button
                                        onClick={(e) => moveUp(index, e)}
                                        disabled={index === 0}
                                        className="text-slate-400 hover:text-primary disabled:opacity-30 p-0.5"
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => moveDown(index, e)}
                                        disabled={index === columns.length - 1}
                                        className="text-slate-400 hover:text-primary disabled:opacity-30 p-0.5"
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
