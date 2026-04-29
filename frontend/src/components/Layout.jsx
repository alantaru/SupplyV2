import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Package, Truck, Settings, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import UserProfileModal from './Settings/UserProfileModal';
import { useAuth } from '../context/AuthProvider';

export default function Layout() {
    const location = useLocation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { user } = useAuth();

    const navItems = [
        { name: 'Pendências', icon: LayoutDashboard, path: '/' },
        { name: 'Novo Protocolo', icon: PlusCircle, path: '/wizard' },
        { name: 'Entregas', icon: Truck, path: '/deliveries' }, 
        { name: 'Estoque', icon: Package, path: '/inventory' },
    ];

    const currentTitle = navItems.find(item => item.path === location.pathname)?.name || 'Supply 2026';
    const activeContractId = user?.activeContract?.contract_id || user?.activeContract || '00000000';

    return (
        <div className="flex h-screen bg-[#020617] text-slate-100 font-sans selection:bg-[#D18BFF]/30 selection:text-white">
            {/* Sidebar v12 Glassmorphism */}
            <aside className="w-72 bg-black/40 backdrop-blur-3xl border-r border-white/5 hidden md:flex flex-col relative z-[50]">
                <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-transparent via-[#D18BFF]/20 to-transparent" />
                
                <div className="h-24 flex items-center px-8 border-b border-white/5">
                    <div className="flex items-center gap-4 group cursor-pointer">
                        <div className="p-2 bg-[#D18BFF] rounded-lg shadow-[0_0_15px_rgba(209,139,255,0.4)] group-hover:scale-110 transition-transform">
                            <Package className="h-6 w-6 text-black" />
                        </div>
                        <div>
                            <span className="text-xl font-bold text-white font-display tracking-tight block">SUPPLY 2026</span>
                            <span className="text-[9px] font-bold text-[#D18BFF] uppercase tracking-[0.3em] block -mt-1 opacity-70">Logistics Control</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 py-10 px-6 space-y-3">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em] mb-6 ml-2">Menu Principal</div>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center gap-4 px-4 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 relative group overflow-hidden",
                                    isActive
                                        ? "bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.1)] scale-[1.02]"
                                        : "text-slate-500 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive ? "text-black" : "text-[#D18BFF]/60")} />
                                {item.name}
                                {isActive && <div className="absolute left-0 w-1.5 h-full bg-[#D18BFF]" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-8 border-t border-white/5">
                    <button 
                        onClick={() => window.location.href = '/settings'}
                        className="flex items-center gap-4 px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#D18BFF] bg-[#D18BFF]/5 border border-[#D18BFF]/20 w-full rounded-xl hover:bg-[#D18BFF] hover:text-black transition-all group"
                    >
                        <Settings className="h-4 w-4 group-hover:rotate-90 transition-transform duration-500" />
                        Gestão de Dados
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Background Blobs for Atmosphere */}
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#D18BFF]/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#4D91FF]/5 blur-[100px] rounded-full pointer-events-none" />

                {/* Header v12 Fluid Interface */}
                <header className="h-24 bg-black/20 backdrop-blur-md border-b border-white/5 flex items-center px-10 justify-between relative z-40">
                    <div className="flex items-center gap-6">
                        <button className="md:hidden p-3 bg-white/5 rounded-xl border border-white/10 text-white">
                            <Menu className="h-6 w-6" />
                        </button>
                        <div className="hidden md:block">
                            <h2 className="text-sm font-bold text-white font-display flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[#4DFF88] shadow-[0_0_8px_#4DFF88]" />
                                {currentTitle}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        {/* Monitoramento de Status */}
                        <div className="hidden lg:flex items-center gap-6 pr-6 border-r border-white/5">
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-[0.2em] mb-1">Contrato Ativo</span>
                                <span className="text-xs font-mono font-bold text-[#D18BFF] bg-[#D18BFF]/10 px-2 py-0.5 rounded border border-[#D18BFF]/20">#{activeContractId}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-[0.2em] mb-1">Estado de Rede</span>
                                <span className="text-[10px] font-bold text-[#4DFF88] flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#4DFF88] animate-pulse" /> SÍNCRONO
                                </span>
                            </div>
                        </div>

                        {/* User Identity Chip */}
                        <button
                            onClick={() => setIsProfileOpen(true)}
                            className="flex items-center gap-4 bg-white/5 border border-white/10 hover:border-[#D18BFF]/40 p-2 pr-6 rounded-full transition-all group scale-100 hover:scale-[1.02]"
                        >
                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#D18BFF] to-[#4D91FF] p-[2px] shadow-lg group-hover:shadow-[#D18BFF]/20 transition-all">
                                <div className="w-full h-full rounded-full bg-[#020617] flex items-center justify-center font-bold text-xs text-white overflow-hidden border border-black/20">
                                    {user?.avatar ? (
                                        <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{user?.username?.substring(0, 2).toUpperCase()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="text-left hidden sm:block">
                                <span className="text-xs font-bold text-white block leading-tight">{user?.username}</span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">{user?.role || 'Agente'}</span>
                            </div>
                        </button>
                    </div>
                </header>

                <UserProfileModal
                    isOpen={isProfileOpen}
                    onClose={() => setIsProfileOpen(false)}
                    user={user}
                />

                {/* Main Dynamic Stage */}
                <main className="flex-1 overflow-auto p-12 custom-scrollbar relative z-10 transition-all duration-500">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
