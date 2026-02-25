import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Home, Calendar, FileText, BarChart3, Settings, Users, LogOut, Menu, Zap, X, ChevronRight, UserCircle, CreditCard, HardDrive } from 'lucide-react';
import { PendingReservationsPopup } from '../Notifications/PendingReservationsPopup';
import { MENU_PERMISSION_MAP, Permission } from '../../lib/permissions';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

const ALL_MENU_ITEMS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: Home, section: 'main', showInBottomNav: true },
  { id: 'calendar', label: 'Calendrier', icon: Calendar, section: 'main', showInBottomNav: true },
  { id: 'terrains', label: 'Terrains', icon: FileText, section: 'main', showInBottomNav: true },
  { id: 'clients', label: 'Clients', icon: UserCircle, section: 'main', showInBottomNav: false },
  { id: 'reservations', label: 'Reservations', icon: Calendar, section: 'main', showInBottomNav: false },
  { id: 'rapports', label: 'Rapports', icon: BarChart3, section: 'analytics', showInBottomNav: true },
  { id: 'payments', label: 'Paiements', icon: CreditCard, section: 'analytics', showInBottomNav: false },
  { id: 'users', label: 'Utilisateurs', icon: Users, section: 'admin', showInBottomNav: false },
  { id: 'settings', label: 'Configuration', icon: Settings, section: 'admin', showInBottomNav: true },
  { id: 'backup', label: 'Sauvegarde', icon: HardDrive, section: 'admin', showInBottomNav: false },
];

const SECTION_LABELS: Record<string, string> = {
  main: 'Navigation',
  analytics: 'Analyse',
  admin: 'Administration',
};

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  const { signOut, profile, can } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const isAdmin = profile?.role === 'admin';

  const visibleMenuItems = ALL_MENU_ITEMS.filter((item) => {
    if (item.id === 'users' || item.id === 'settings') return isAdmin;
    const permission = MENU_PERMISSION_MAP[item.id] as Permission | undefined;
    if (!permission) return true;
    return can(permission);
  });

  const bottomNavItems = visibleMenuItems.filter(item => item.showInBottomNav);

  const grouped = visibleMenuItems.reduce<Record<string, typeof ALL_MENU_ITEMS>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  const currentLabel = ALL_MENU_ITEMS.find(m => m.id === currentView)?.label || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900">
      {/* ── Topbar ── */}
      <nav className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/60 fixed w-full z-30 top-0">
        <div className="max-w-full mx-auto px-2 xs:px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 xs:gap-3 min-w-0 flex-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`lg:hidden inline-flex items-center justify-center h-9 w-9 xs:h-10 xs:w-10 rounded-full border ring-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 shrink-0 ${
                  sidebarOpen
                    ? 'bg-emerald-500/10 border-emerald-500/30 ring-emerald-500/20 text-emerald-400'
                    : 'bg-slate-900/60 border-slate-700/50 ring-white/5 text-slate-400 hover:bg-slate-800/80 hover:text-white'
                }`}
                aria-label={sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              >
                {sidebarOpen ? <X className="w-4 h-4 xs:w-5 xs:h-5" /> : <Menu className="w-4 h-4 xs:w-5 xs:h-5" />}
              </button>
              <div className="flex items-center gap-2 xs:gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-1.5 xs:p-2 rounded-lg xs:rounded-xl shadow-lg shadow-emerald-500/25 shrink-0">
                  <Zap className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm xs:text-base sm:text-lg font-bold text-white tracking-tight leading-tight truncate">COMPLEXE SPORTIF 2e ETOILE</span>
                  <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase leading-tight hidden sm:block">Gestion de terrains</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 shrink-0">
              <PendingReservationsPopup onViewReservation={() => onViewChange('reservations')} />
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-slate-200 leading-tight">{profile?.full_name}</p>
                <p className="text-[11px] text-emerald-400/80 capitalize font-medium">{profile?.role}</p>
              </div>
              <div className="w-px h-8 bg-slate-700/60 hidden md:block" />
              <button
                onClick={() => signOut()}
                className="inline-flex items-center justify-center h-9 w-9 xs:h-10 xs:w-10 rounded-full bg-slate-900/60 border border-slate-700/50 ring-1 ring-white/5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/30 shrink-0"
                aria-label="Se deconnecter"
                title="Deconnexion"
              >
                <LogOut className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex pt-14 sm:pt-16 pb-24 lg:pb-0">
        {/* ── Mobile overlay ── */}
        <div
          className={`fixed inset-0 bg-black/60 z-30 lg:hidden mt-14 sm:mt-16 transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden={!sidebarOpen}
        />

        {/* ── Sidebar / Drawer ── */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 fixed lg:sticky lg:top-16 inset-y-0 left-0 z-40 w-72 bg-slate-900 lg:bg-slate-900/95 lg:backdrop-blur-xl border-r border-slate-800/60 transition-transform duration-300 ease-out will-change-transform mt-14 sm:mt-16 lg:mt-0 shadow-2xl lg:shadow-none lg:h-[calc(100vh-4rem)] after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gradient-to-b after:from-emerald-500/10 after:via-transparent after:to-emerald-500/10`}
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-800/60 lg:hidden">
            <h2 className="text-base font-semibold text-white">Menu</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-slate-900/60 border border-slate-700/50 ring-1 ring-white/5 text-slate-400 hover:bg-slate-800/80 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="px-3 py-5 space-y-7 overflow-y-auto h-[calc(100vh-8rem)] lg:h-[calc(100vh-5rem)]">
            {Object.entries(grouped).map(([section, items]) => (
              <div key={section}>
                <p className="px-4 mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  {SECTION_LABELS[section]}
                </p>
                <div className="space-y-1.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onViewChange(item.id);
                          setSidebarOpen(false);
                        }}
                        className={`relative w-full flex items-center gap-3.5 px-3.5 py-3.5 min-h-[56px] rounded-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                          isActive
                            ? 'bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5'
                            : 'border border-transparent hover:bg-slate-800/40 hover:border-slate-700/40'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                        )}
                        <span className={`inline-flex items-center justify-center h-10 w-10 rounded-xl border ring-1 transition-all duration-200 shrink-0 ${
                          isActive
                            ? 'bg-emerald-500/15 border-emerald-500/25 ring-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.15)]'
                            : 'bg-slate-900/60 border-slate-700/50 ring-white/5 text-slate-500 group-hover:text-slate-300 group-hover:bg-slate-800/80'
                        }`}>
                          <Icon className="w-[18px] h-[18px]" />
                        </span>
                        <span className={`text-[15px] font-medium flex-1 text-left leading-5 ${
                          isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}>
                          {item.label}
                        </span>
                        {isActive && (
                          <ChevronRight className="w-4 h-4 text-emerald-500/60 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-slate-800/60">
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-3.5 px-3.5 py-3.5 min-h-[56px] rounded-xl transition-all duration-200 group border border-transparent hover:bg-red-500/5 hover:border-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                aria-label="Se deconnecter"
              >
                <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-slate-900/60 border border-slate-700/50 ring-1 ring-white/5 text-slate-500 group-hover:text-red-400 group-hover:bg-red-500/10 group-hover:border-red-500/20 transition-all duration-200 shrink-0">
                  <LogOut className="w-[18px] h-[18px]" />
                </span>
                <span className="text-[15px] font-medium text-slate-400 group-hover:text-red-400 leading-5">Deconnexion</span>
              </button>
            </div>
          </nav>
        </aside>

        <main className="flex-1 p-2.5 xs:p-3 sm:p-4 lg:p-8 min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)]">
          <div className="max-w-7xl mx-auto">
            <div className="hidden lg:flex items-center gap-2 mb-6 text-sm">
              <span className="text-slate-600">COMPLEXE SPORTIF 2e ETOILE</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
              <span className="text-slate-400 font-medium">{currentLabel}</span>
            </div>
            {children}
          </div>
        </main>
      </div>

      {/* ── Bottom nav ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800/60 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
        aria-label="Navigation principale"
      >
        <div className="flex items-center justify-around px-1 py-2 max-w-lg mx-auto">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-[60px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                  isActive ? '-translate-y-0.5' : ''
                }`}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={`inline-flex items-center justify-center h-11 w-11 rounded-xl border ring-1 transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-500/15 border-emerald-500/30 ring-emerald-500/15 text-emerald-400 shadow-[0_2px_12px_rgba(52,211,153,0.25)]'
                    : 'bg-slate-800/50 border-slate-700/30 ring-white/5 text-slate-500'
                }`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className={`text-[10px] font-semibold truncate w-full text-center leading-tight ${
                  isActive ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                  {item.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-[60px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            aria-label="Plus d'options"
          >
            <span className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-slate-800/50 border border-slate-700/30 ring-1 ring-white/5 text-slate-500 transition-all duration-200">
              <Menu className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-semibold text-slate-500 leading-tight">Plus</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
