import { useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { Calendar, Users, CreditCard, TrendingUp, Clock, CheckCircle, AlertCircle, MapPin } from 'lucide-react';
import { format, isToday, parseISO } from '../utils/dateUtils';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { reservations, terrains, clients, encaissements } = useData();

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRes = reservations.filter((r) => {
      const d = new Date(r.date_debut);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime() && r.statut !== 'annulé' && r.statut !== 'bloqué';
    });

    const activeRes = reservations.filter((r) =>
      ['réservé', 'check_in', 'en_attente'].includes(r.statut)
    );

    const thisMonthEnc = encaissements.filter((e) => {
      const d = new Date(e.created_at);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });

    const monthRevenue = thisMonthEnc.reduce((sum, e) => sum + e.montant_total, 0);

    const pendingPayment = reservations.filter((r) =>
      r.payment_status === 'UNPAID' && ['réservé', 'check_in'].includes(r.statut)
    );

    return { todayRes, activeRes, monthRevenue, pendingPayment, clients };
  }, [reservations, clients, encaissements]);

  const upcomingReservations = useMemo(() => {
    const now = new Date();
    return reservations
      .filter((r) => new Date(r.date_debut) >= now && ['réservé', 'check_in', 'en_attente'].includes(r.statut))
      .slice(0, 6);
  }, [reservations]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'check_in': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'réservé': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'en_attente': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-slate-700/50 text-slate-400 border-slate-600/20';
    }
  };

  const getStatusLabel = (statut: string) => {
    const labels: Record<string, string> = {
      réservé: 'Réservé', check_in: 'En cours', en_attente: 'En attente',
      terminé: 'Terminé', annulé: 'Annulé', bloqué: 'Bloqué',
    };
    return labels[statut] || statut;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tableau de bord</h1>
        <p className="text-slate-400 text-sm mt-1">Vue d'ensemble de votre complexe sportif</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Calendar}
          label="Réservations aujourd'hui"
          value={stats.todayRes.length}
          color="emerald"
          onClick={() => onNavigate('calendar')}
        />
        <StatCard
          icon={Clock}
          label="Réservations actives"
          value={stats.activeRes.length}
          color="blue"
          onClick={() => onNavigate('reservations')}
        />
        <StatCard
          icon={TrendingUp}
          label="Revenus ce mois"
          value={formatCurrency(stats.monthRevenue)}
          color="cyan"
          onClick={() => onNavigate('rapports')}
        />
        <StatCard
          icon={AlertCircle}
          label="Paiements en attente"
          value={stats.pendingPayment.length}
          color="amber"
          onClick={() => onNavigate('payments')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">Prochaines réservations</h2>
            <button
              onClick={() => onNavigate('reservations')}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Voir tout
            </button>
          </div>
          <div className="divide-y divide-slate-800">
            {upcomingReservations.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-500 text-sm">
                Aucune réservation à venir
              </div>
            ) : (
              upcomingReservations.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-800/40 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{r.client_name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {r.terrain?.name} — {format(parseISO(r.date_debut), 'dd/MM à HH:mm')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(r.statut)}`}>
                    {getStatusLabel(r.statut)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h2 className="font-semibold text-white mb-4">Terrains</h2>
            <div className="space-y-3">
              {terrains.slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{t.name}</p>
                    <p className="text-xs text-slate-500">{new Intl.NumberFormat('fr-FR').format(t.tarif_horaire)} FCFA/h</p>
                  </div>
                  <span className={`text-xs ${t.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {t.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              ))}
              {terrains.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-3">Aucun terrain</p>
              )}
            </div>
            <button
              onClick={() => onNavigate('terrains')}
              className="mt-4 w-full text-xs text-emerald-400 hover:text-emerald-300 transition-colors text-center"
            >
              Gérer les terrains
            </button>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-white">Clients</h2>
              <span className="text-2xl font-bold text-emerald-400">{clients.length}</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">clients enregistrés</p>
            <button
              onClick={() => onNavigate('clients')}
              className="w-full text-xs text-emerald-400 hover:text-emerald-300 transition-colors text-center"
            >
              Gérer les clients
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'emerald' | 'blue' | 'cyan' | 'amber';
  onClick?: () => void;
}

function StatCard({ icon: Icon, label, value, color, onClick }: StatCardProps) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
    amber: 'bg-amber-500/10 text-amber-400',
  };

  return (
    <button
      onClick={onClick}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left hover:border-slate-700 hover:bg-slate-800/50 transition-all w-full"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-slate-400 leading-tight">{label}</p>
    </button>
  );
}
