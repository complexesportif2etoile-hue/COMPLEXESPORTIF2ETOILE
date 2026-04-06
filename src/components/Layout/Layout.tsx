import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Calendar, MapPin, Users, ClipboardList,
  BarChart2, Settings, CreditCard, Database, Menu, X, LogOut,
  Shield, ChevronRight, TrendingDown, MoreHorizontal
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, permission: 'view_dashboard' },
  { id: 'calendar', label: 'Calendrier', icon: Calendar, permission: 'view_calendar' },
  { id: 'terrains', label: 'Terrains', icon: MapPin, permission: 'view_terrains' },
  { id: 'clients', label: 'Clients', icon: Users, permission: 'view_clients' },
  { id: 'reservations', label: 'Réservations', icon: ClipboardList, permission: 'view_reservations' },
  { id: 'payments', label: 'Paiements', icon: CreditCard, permission: 'view_payments' },
  { id: 'depenses', label: 'Dépenses', icon: TrendingDown, permission: 'view_rapports' },
  { id: 'rapports', label: 'Rapports', icon: BarChart2, permission: 'view_rapports' },
  { id: 'users', label: 'Utilisateurs', icon: Shield, adminOnly: true },
  { id: 'settings', label: 'Paramètres', icon: Settings, adminOnly: true },
  { id: 'backup', label: 'Sauvegarde', icon: Database, permission: 'view_backup' },
];

const BOTTOM_NAV_IDS = ['dashboard', 'calendar', 'terrains', 'rapports', 'settings'];

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const { profile, signOut, hasPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    if (item.adminOnly) return false;
    if (item.permission) return hasPermission(item.permission);
    return true;
  });

  const bottomNavItems = visibleItems.filter((i) => BOTTOM_NAV_IDS.includes(i.id));

  const handleNavClick = (id: string) => {
    onViewChange(id);
    setSidebarOpen(false);
  };

  const currentLabel = visibleItems.find((i) => i.id === currentView)?.label || 'Complexe Sportif';

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col
        bg-slate-900 border-r border-slate-800 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-tight truncate">Complexe Sportif</p>
            <p className="text-xs text-slate-400 truncate">Gestion</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-150 group
                  ${active
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }
                `}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className="truncate">{item.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-emerald-500" />}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-slate-300">
                {profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white text-sm truncate uppercase tracking-wide">
              COMPLEXE SPORTIF 2e ETOILE
            </span>
          </div>

          <button
            onClick={signOut}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors flex-shrink-0"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 lg:pb-6">
          {children}
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-10 safe-area-bottom">
          <div className="flex items-center justify-around px-1 py-2">
            {bottomNavItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className="flex flex-col items-center gap-1 px-3 py-1 min-w-0 flex-1"
                >
                  <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-emerald-500/10' : ''}`}>
                    <Icon className={`w-5 h-5 transition-colors ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </div>
                  <span className={`text-xs truncate max-w-full transition-colors ${active ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    {item.label === 'Tableau de bord' ? 'Tableau' : item.label.slice(0, 7)}
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-1 px-3 py-1 min-w-0 flex-1"
            >
              <div className={`p-1.5 rounded-xl transition-all ${!bottomNavItems.slice(0, 4).some(i => i.id === currentView) ? 'bg-emerald-500/10' : ''}`}>
                <MoreHorizontal className={`w-5 h-5 transition-colors ${!bottomNavItems.slice(0, 4).some(i => i.id === currentView) ? 'text-emerald-400' : 'text-slate-500'}`} />
              </div>
              <span className={`text-xs transition-colors ${!bottomNavItems.slice(0, 4).some(i => i.id === currentView) ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                Plus
              </span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
