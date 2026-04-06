import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { LoginForm } from './components/Auth/LoginForm';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { TerrainsList } from './components/Terrains/TerrainsList';
import { CalendarView } from './components/Calendar/CalendarView';
import { ClientMenu } from './components/Reservations/ClientMenu';
import { Reports } from './components/Reports/Reports';
import { UserManagement } from './components/Users/UserManagement';
import { Settings } from './components/Settings/Settings';
import { ClientManagement } from './components/Clients/ClientManagement';
import { PublicBookingPage } from './components/PublicBooking/PublicBookingPage';
import { RsvpPage } from './components/PublicBooking/RsvpPage';
import { ComplexeSportif2eEtoilePage } from './components/PublicBooking/ComplexeSportif2eEtoilePage';
import { PaymentsPage } from './components/Payments/PaymentsPage';
import { BackupRestorePage } from './components/Backup/BackupRestorePage';
import { DepensesPage } from './components/Depenses/DepensesPage';

const getPublicRoute = (): { type: 'booking' | 'rsvp' | 'complexe2etoile' | null; code?: string } => {
  const path = window.location.pathname;
  if (path === '/r/complexe-sportif-2e-etoile') return { type: 'complexe2etoile' };
  if (path === '/reserver' || window.location.search.includes('booking=1')) return { type: 'booking' };
  const rsvpMatch = path.match(/^\/rsvp\/([A-Z0-9]{4,8})$/i);
  if (rsvpMatch) return { type: 'rsvp', code: rsvpMatch[1].toUpperCase() };
  return { type: null };
};

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('calendar');
  const publicRoute = getPublicRoute();

  if (publicRoute.type === 'complexe2etoile') return <ComplexeSportif2eEtoilePage />;
  if (publicRoute.type === 'booking') return <PublicBookingPage />;
  if (publicRoute.type === 'rsvp' && publicRoute.code) return <RsvpPage code={publicRoute.code} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <DataProvider>
      <AppViews currentView={currentView} onViewChange={setCurrentView} />
    </DataProvider>
  );
}

function AppViews({ currentView, onViewChange }: { currentView: string; onViewChange: (v: string) => void }) {
  const { ready } = useData();

  if (!ready) {
    return (
      <Layout currentView={currentView} onViewChange={onViewChange}>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-64 bg-slate-800 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-800 rounded-2xl p-6 h-36" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-800 rounded-2xl p-6 h-80" />
            <div className="bg-slate-800 rounded-2xl p-6 h-80" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentView={currentView} onViewChange={onViewChange}>
      <div className={currentView === 'dashboard' ? '' : 'hidden'}>
        <Dashboard onNavigate={onViewChange} />
      </div>
      <div className={currentView === 'calendar' ? '' : 'hidden'}>
        <CalendarView />
      </div>
      <div className={currentView === 'terrains' ? '' : 'hidden'}>
        <TerrainsList />
      </div>
      <div className={currentView === 'clients' ? '' : 'hidden'}>
        <ClientManagement />
      </div>
      <div className={currentView === 'reservations' ? '' : 'hidden'}>
        <ClientMenu />
      </div>
      <div className={currentView === 'rapports' ? '' : 'hidden'}>
        <Reports />
      </div>
      <div className={currentView === 'users' ? '' : 'hidden'}>
        <UserManagement />
      </div>
      <div className={currentView === 'payments' ? '' : 'hidden'}>
        <PaymentsPage />
      </div>
      <div className={currentView === 'depenses' ? '' : 'hidden'}>
        <DepensesPage />
      </div>
      <div className={currentView === 'settings' ? '' : 'hidden'}>
        <Settings />
      </div>
      <div className={currentView === 'backup' ? '' : 'hidden'}>
        <BackupRestorePage />
      </div>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
