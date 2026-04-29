import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Settings, Menu, ChevronLeft, LogOut, Shield, FileClock, Package, Map, Printer, Users } from 'lucide-react';
import UserProfileModal from './components/Settings/UserProfileModal';
import ContractSwitcher from './components/Shared/ContractSwitcher';
// import NotificationBell from './components/Shared/NotificationBell'; // If needed, can be restored later

import Dashboard from './components/Dashboard';
import ProtocolWizard from './components/Wizard/ProtocolWizard';
import ProtocolEditor from './components/Protocol/ProtocolEditor';
import { DeliveryPage } from './components/Protocol/ProtocolDelivery';
import DataManagement from './components/Settings/DataManagement';
import Login from './components/Login';
import ForgotPassword from './components/Login/ForgotPassword';
import History from './components/History/History';
import AdminPanel from './components/Admin/AdminPanel';
import StockDashboard from './components/Stock/StockDashboard';
import RouteDashboard from './components/Routes/RouteDashboard';
import EquipmentDashboard from './components/Equipment/EquipmentDashboard';
import SolicitantesDashboard from './components/Solicitantes/SolicitantesDashboard';
import BIDashboard from './components/Analytics/BIDashboard';
import ContractSetupWizard from './components/Wizard/ContractSetupWizard';
import FullPageWizard from './components/Wizard/FullPageWizard';
import { AuthProvider, useAuth } from './context/AuthProvider';
import { ThemeProvider } from './context/ThemeContext';
import { cn } from './lib/utils';

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const { user, logout, loading } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const avatar = localStorage.getItem(`user_avatar_${user?.username}`);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  useEffect(() => {
    const handleOpenProfile = () => setIsProfileOpen(true);
    window.addEventListener('open-user-profile', handleOpenProfile);
    return () => window.removeEventListener('open-user-profile', handleOpenProfile);
  }, []);

  // 1. Loading State
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-sans">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="font-medium tracking-wide">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  // 2. Public Routes
  if (location.pathname === '/login' || location.pathname === '/forgot-password') {
    if (user && location.pathname === '/login') return <Navigate to={user.initial_route || '/'} replace />;

    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    );
  }

  // 3. Auth Guard
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 4. No-contract guard
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const hasContract = user.activeContract && user.contracts?.length > 0;

  if (!hasContract) {
    if (isAdmin) {
      // Admin with no contracts → redirect to contract creation wizard
      // Allow /contracts/new, /admin, and /setup-contract/* to pass through
      const allowedPaths = ['/contracts/new', '/admin'];
      const isAllowed = allowedPaths.includes(location.pathname) || location.pathname.startsWith('/setup-contract/');
      if (!isAllowed) {
        return <Navigate to="/contracts/new" replace />;
      }
    } else {
      // Regular user with no contracts → show informational screen
      return (
        <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-10 text-center space-y-6">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
              <Package size={32} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Nenhum contrato disponível</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {user.contracts?.length === 0
                  ? 'Sua conta ainda não está associada a nenhum contrato.'
                  : 'Nenhum dos contratos associados à sua conta está disponível no momento.'}
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Entre em contato com o administrador do sistema para solicitar acesso.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-left space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Usuário</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{user.username}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Perfil</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="w-full py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-2"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      );
    }
  }

  // 4. Protected Legacy Layout
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-slate-900 dark:bg-slate-950 text-white flex flex-col transition-all duration-300 ease-in-out shadow-xl relative z-30 border-r border-slate-800",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-800 h-16 shrink-0">
          {isSidebarOpen && (
            <div className="flex items-center gap-2 px-2">
              {(() => {
                const customLogo = localStorage.getItem('site_logo_url');
                const customTitle = localStorage.getItem('site_title') || 'SUPPLY2026';
                const logoMode = localStorage.getItem('site_logo_mode') || 'text';
                const showLogo = (logoMode === 'logo' || logoMode === 'both_side' || logoMode === 'both_below' || logoMode === 'both') && customLogo;
                const showText = logoMode === 'text' || logoMode === 'both_side' || logoMode === 'both_below' || logoMode === 'both' || !customLogo;
                const isBelow = logoMode === 'both_below';
                return (
                  <div className={isBelow ? 'flex flex-col items-center gap-0.5' : 'flex items-center gap-2'}>
                    {showLogo && <img src={customLogo} alt="Logo" className="max-h-8 max-w-[100px] object-contain" />}
                    {showText && (
                      <span className={`font-bold tracking-tighter text-white whitespace-nowrap ${isBelow ? 'text-[11px]' : 'text-xl'}`}>
                        {customTitle.includes('2026')
                          ? <>{customTitle.replace('2026', '')}<span className="text-primary">2026</span></>
                          : customTitle
                        }
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors mx-auto">
            {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 custom-scrollbar">
          <ul className="space-y-1.5 px-3">
            {[
              { to: "/", icon: LayoutDashboard, label: "Pendências" },
              { to: "/history", icon: FileClock, label: "Histórico" },
              { to: "/stock", icon: Package, label: "Estoque" },
              { to: "/routes", icon: Map, label: "Rotas" },
              { to: "/solicitantes", icon: Users, label: "Solicitantes" },
              { to: "/equipment", icon: Printer, label: "Equipamentos" },
            ].map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex items-center p-3 rounded-xl transition-all group",
                    location.pathname === item.to
                      ? "bg-primary text-white shadow-lg"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <item.icon size={20} className="shrink-0" />
                  {isSidebarOpen && <span className="ml-3 font-medium text-sm">{item.label}</span>}
                </Link>
              </li>
            ))}

            {(user.role === 'admin' || user.role === 'superadmin') && (
              <li className="pt-4 mt-4 border-t border-slate-800">
                <Link
                  to="/admin"
                  className={cn(
                    "flex items-center p-3 rounded-xl transition-all group",
                    location.pathname === '/admin'
                      ? "bg-primary text-white shadow-lg"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Shield size={20} className="shrink-0" />
                  {isSidebarOpen && <span className="ml-3 font-medium text-sm">Administração</span>}
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2 shrink-0">
          <Link to="/settings" className={cn("flex items-center p-2 rounded-lg hover:text-white hover:bg-slate-800 transition-all", !isSidebarOpen && "justify-center")}>
            <Settings size={20} className="text-slate-400" />
            {isSidebarOpen && <span className="ml-3 text-xs font-bold uppercase tracking-wider text-slate-400">Configurações</span>}
          </Link>
          <button
            onClick={logout}
            className={cn("w-full flex items-center p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-all", !isSidebarOpen && "justify-center")}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="ml-3 text-sm font-bold">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Vertical Stack */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-8 z-20 shrink-0 shadow-sm transition-colors duration-300">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight transition-colors duration-300">
            {location.pathname === '/' ? 'Pedidos Pendentes' :
              location.pathname.startsWith('/wizard') ? 'Novo Pedido' :
              location.pathname.startsWith('/setup-contract') ? 'Configuração de Contrato' :
                location.pathname === '/settings' ? 'Configurações' :
                  location.pathname === '/history' ? 'Histórico de Entregas' :
                    location.pathname === '/stock' ? 'Controle de Estoque' :
                      location.pathname === '/routes' ? 'Logística de Rotas' :
                        location.pathname === '/equipment' ? 'Equipamentos' :
                          location.pathname === '/equipment/bi' ? 'BI Dashboard' :
                          location.pathname === '/admin' ? 'Administração' :
                            location.pathname.includes('/protocol/') ? 'Editar Pedido' : 'Supply 2026'}
          </h2>
          
          <div className="flex items-center gap-6">
            <ContractSwitcher />

            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 px-3 rounded-full transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <div className="text-right hidden sm:block transition-colors duration-300">
                <p className="text-xs font-bold text-slate-800 dark:text-white leading-none">{user.username}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest mt-1 leading-none">{user.role}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-md border-2 border-white dark:border-slate-800 overflow-hidden">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{user?.username?.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 p-6 relative transition-colors duration-300">
          <div className="max-w-[1600px] mx-auto h-full overflow-auto custom-scrollbar">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/wizard" element={<ProtocolWizard />} />
              <Route path="/wizard/:id" element={<ProtocolWizard />} />
              <Route path="/setup-contract/:contractId" element={<ContractSetupWizard />} />
              <Route path="/new-protocol" element={<Navigate to="/wizard" replace />} />
              <Route path="/protocol/:id" element={<ProtocolEditor />} />
              <Route path="/protocol/:id/deliver" element={<DeliveryPage />} />
              <Route path="/settings" element={<DataManagement />} />
              <Route path="/history" element={<History />} />
              <Route path="/stock" element={<StockDashboard />} />
              <Route path="/routes" element={<RouteDashboard />} />
              <Route path="/solicitantes" element={<SolicitantesDashboard />} />
              <Route path="/equipment" element={<EquipmentDashboard />} />
              <Route path="/equipment/bi" element={<BIDashboard />} />
              <Route path="/admin" element={(user.role === 'admin' || user.role === 'superadmin') ? <AdminPanel /> : <Navigate to="/" />} />
              <Route path="/contracts/new" element={(user.role === 'admin' || user.role === 'superadmin') ? <FullPageWizard /> : <Navigate to="/" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
