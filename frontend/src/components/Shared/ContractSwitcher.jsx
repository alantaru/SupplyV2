import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { ChevronDown, Check, Building2, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

export default function ContractSwitcher() {
    const { user, updateActiveContract } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [availableContracts, setAvailableContracts] = useState([]);
    const [loadingContracts, setLoadingContracts] = useState(false);

    const isPrivileged = user?.role === 'superadmin' || user?.role === 'admin';

    useEffect(() => {
        if (!user) return;

        if (isPrivileged) {
            // Superadmin/admin: fetch ALL contracts from the server
            setLoadingContracts(true);
            api.get('admin/contracts')
                .then(res => {
                    const list = Array.isArray(res.data) ? res.data : [];
                    setAvailableContracts(list.map(c => ({ id: c.id, name: c.name || c.id })));
                })
                .catch(() => {
                    // Fallback to JWT contracts
                    setAvailableContracts((user.contracts || []).map(id => ({ id, name: id })));
                })
                .finally(() => setLoadingContracts(false));
        } else {
            // Regular user: use their assigned contracts
            setAvailableContracts((user.contracts || []).map(id => ({ id, name: id })));
        }
    }, [user?.username, user?.role]);

    const handleSelect = (contractId) => {
        if (contractId === user?.activeContract) {
            setIsOpen(false);
            return;
        }
        updateActiveContract(contractId);
        setIsOpen(false);
        // Reload to refresh all data for the new contract
        window.location.reload();
    };

    if (!user) return null;

    // Single contract or no contracts — just show the label
    if (!isPrivileged && availableContracts.length <= 1) {
        return (
            <div className="flex flex-col items-end mr-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contrato Ativo</span>
                <span className="text-sm font-mono font-bold text-primary">
                    {user?.activeContract || <span className="text-amber-500">Nenhum</span>}
                </span>
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex flex-col items-end mr-4 group cursor-pointer"
            >
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 group-hover:text-primary transition-colors">
                    Contrato Ativo
                    <ChevronDown size={10} className={cn("transition-transform", isOpen && "rotate-180")} />
                </span>
                <span className="text-sm font-mono font-bold text-primary bg-primary/10 px-2 rounded group-hover:bg-primary/20 transition-colors">
                    {user?.activeContract || <span className="text-amber-500">Nenhum</span>}
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="py-2">
                        <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 mb-1">
                            Selecionar Contrato
                        </div>
                        {loadingContracts ? (
                            <div className="flex items-center justify-center py-6 text-slate-400">
                                <Loader2 size={18} className="animate-spin" />
                            </div>
                        ) : (
                            <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                {availableContracts.length === 0 ? (
                                    <div className="px-4 py-3 text-xs text-slate-400 italic">Nenhum contrato disponível</div>
                                ) : (
                                    availableContracts.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => handleSelect(c.id)}
                                            className={cn(
                                                "w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-all hover:bg-slate-50 dark:hover:bg-slate-800",
                                                c.id === user.activeContract
                                                    ? "text-primary font-bold bg-primary/10"
                                                    : "text-slate-600 dark:text-slate-300"
                                            )}
                                        >
                                            <span className="flex items-center gap-3">
                                                <Building2 size={15} className={cn(
                                                    c.id === user.activeContract ? "text-primary" : "text-slate-400"
                                                )} />
                                                <span>
                                                    <span className="font-mono font-bold">{c.id}</span>
                                                    {c.name && c.name !== c.id && (
                                                        <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1.5">{c.name}</span>
                                                    )}
                                                </span>
                                            </span>
                                            {c.id === user.activeContract && <Check size={15} className="text-primary shrink-0" />}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
            )}
        </div>
    );
}
