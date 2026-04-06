import { useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, TrendingUp, TrendingDown, CheckCircle, MapPin, Plus, ArrowUpRight } from 'lucide-react';
import { format, parseISO } from '../utils/dateUtils';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { reservations, terrains, encaissements, depenses } = useData();
  const { profile } = useAuth();

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

    const freeTerrains = terrains.filter((t) => {
      const hasActiveRes = reservations.some(
        (r) => r.terrain_id === t.id && r.statut === 'check_in'
      );
      return t.is_active && !hasActiveRes;
    });

    const todayEnc = encaissements.filter((e) => {
      const d = new Date(e.created_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    const todayRevenue = todayEnc.reduce((s, e) => s + e.montant_total, 0);

    const totalRevenue = encaissements.reduce((s, e) => s + e.montant_total, 0);

    const thisMonthEnc = encaissements.filter((e) => {
      const d = new Date(e.created_at);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
    const monthRevenue = thisMonthEnc.reduce((s, e) => s + e.montant_total, 0);

    const thisMonthDep = depenses.filter((d) => {
      const parts = d.date_depense.slice(0, 7).split('-');
      return parseInt(parts[1]) - 1 === today.getMonth() && parseInt(parts[0]) === today.getFullYear();
    });
    const monthDepenses = thisMonthDep.reduce((s, d) => s + d.montant, 0);
    const monthBenefice = monthRevenue - monthDepenses;

    const inCours = reservations.filter((r) => r.statut === 'check_in');

    return {
      todayRes, activeRes, freeTerrains, todayRevenue, totalRevenue,
      monthRevenue, monthDepenses, monthBenefice, inCours,
    };
  }, [reservations, terrains, encaissements, depenses]);

  const recentReservations = useMemo(() => {
    return [...reservations]
      .filter((r) => r.statut !== 'annulé')
      .sort((a, b) => new Date(b.created_at || b.date_debut).getTime() - new Date(a.created_at || a.date_debut).getTime())
      .slice(0, 5);
  }, [reservations]);

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

  const upcomingCount = useMemo(() =>
    reservations.filter((r) => new Date(r.date_debut) >= new Date() && ['réservé', 'en_attente'].includes(r.statut)).length,
    [reservations]
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  })();

  const displayName = profile?.full_name
    ? profile.full_name.split(' ')[0]
    : (profile?.role === 'admin' ? 'Administrateur' : 'Gestionnaire');

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting}, {displayName}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {upcomingCount > 0
              ? `${upcomingCount} réservation${upcomingCount > 1 ? 's' : ''} à venir`
              : 'Aucune réservation à venir'}
          </p>
        </div>
      </div>

      <button
        onClick={() => onNavigate('calendar')}
        className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 text-base transition-all shadow-lg shadow-emerald-500/20"
      >
        <Plus className="w-5 h-5" />
        Nouvelle Réservation
      </button>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          badge={`SUR ${terrains.filter(t => t.is_active).length}`}
          badgeColor="emerald"
          icon={CheckCircle}
          iconColor="text-emerald-400"
          value={stats.freeTerrains.length}
          label="LIBRES MAINTENANT"
          onClick={() => onNavigate('terrains')}
        />
        <StatCard
          badge={stats.activeRes.length > 0 ? `${Math.round((stats.inCours.length / Math.max(terrains.filter(t=>t.is_active).length, 1)) * 100)}%` : '0%'}
          badgeColor="red"
          icon={MapPin}
          iconColor="text-red-400"
          value={stats.inCours.length}
          label="EN COURS"
          onClick={() => onNavigate('reservations')}
        />
        <StatCard
          badge="CFA"
          badgeColor="blue"
          icon={TrendingUp}
          iconColor="text-blue-400"
          value={fmt(stats.todayRevenue)}
          label="REVENUS DU JOUR"
          onClick={() => onNavigate('rapports')}
        />
        <StatCard
          badge="CFA CUMUL"
          badgeColor="amber"
          icon={TrendingUp}
          iconColor="text-amber-400"
          value={fmt(stats.totalRevenue)}
          label="TOTAL REVENUS"
          onClick={() => onNavigate('rapports')}
        />
        <StatCard
          badge="CFA"
          badgeColor="red"
          icon={TrendingDown}
          iconColor="text-red-400"
          value={fmt(stats.monthDepenses)}
          label="DÉPENSES CE MOIS"
          onClick={() => onNavigate('depenses')}
        />
        <StatCard
          badge={stats.monthBenefice >= 0 ? 'BÉNÉFICE' : 'DÉFICIT'}
          badgeColor={stats.monthBenefice >= 0 ? 'emerald' : 'red'}
          icon={stats.monthBenefice >= 0 ? TrendingUp : TrendingDown}
          iconColor={stats.monthBenefice >= 0 ? 'text-emerald-400' : 'text-red-400'}
          value={fmt(Math.abs(stats.monthBenefice))}
          label="BÉNÉFICE NET"
          onClick={() => onNavigate('rapports')}
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white text-sm">Dernières Réservations</h2>
            <p className="text-xs text-slate-500 mt-0.5">Les 5 plus récentes</p>
          </div>
          <button
            onClick={() => onNavigate('reservations')}
            className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Voir tout
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-800/60">
          <div className="grid grid-cols-2 px-4 py-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Client</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Montant</span>
          </div>
          {recentReservations.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">Aucune réservation</div>
          ) : (
            recentReservations.map((r) => (
              <div key={r.id} className="grid grid-cols-2 px-4 py-3.5 hover:bg-slate-800/30 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-100">{r.client_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {r.terrain?.name
                      ? r.terrain.name
                      : format(parseISO(r.date_debut), 'dd/MM à HH:mm')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{fmt(r.amount_due)}</p>
                  <p className={`text-xs mt-0.5 ${r.payment_status === 'PAID' ? 'text-emerald-400' : r.payment_status === 'PARTIAL' ? 'text-amber-400' : 'text-red-400'}`}>
                    {r.payment_status === 'PAID' ? 'Payé' : r.payment_status === 'PARTIAL' ? 'Partiel' : 'Impayé'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white text-sm">Terrains</h2>
          <button onClick={() => onNavigate('terrains')} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
            Gérer <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-2.5">
          {terrains.slice(0, 5).map((t) => {
            const isBusy = reservations.some((r) => r.terrain_id === t.id && r.statut === 'check_in');
            return (
              <div key={t.id} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isBusy ? 'bg-red-500' : t.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{t.name}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isBusy ? 'bg-red-500/10 text-red-400' : t.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>
                  {isBusy ? 'Occupé' : t.is_active ? 'Libre' : 'Inactif'}
                </span>
                <span className="text-xs text-slate-500 flex-shrink-0">{fmt(t.tarif_horaire)}/h</span>
              </div>
            );
          })}
          {terrains.length === 0 && <p className="text-slate-500 text-sm text-center py-3">Aucun terrain</p>}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  badge: string;
  badgeColor: 'emerald' | 'blue' | 'cyan' | 'amber' | 'red';
  icon: React.ElementType;
  iconColor: string;
  value: string | number;
  label: string;
  onClick?: () => void;
}

function StatCard({ badge, badgeColor, icon: Icon, iconColor, value, label, onClick }: StatCardProps) {
  const badgeColors = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <button
      onClick={onClick}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left hover:border-slate-700 active:scale-[0.97] transition-all w-full"
    >
      <div className="flex items-start justify-between mb-3">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeColors[badgeColor]}`}>
          {badge}
        </span>
      </div>
      <p className="text-2xl font-bold text-white mb-1 leading-none">{value}</p>
      <p className="text-xs text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
    </button>
  );
}
