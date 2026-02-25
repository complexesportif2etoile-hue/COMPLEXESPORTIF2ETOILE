import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { CardShell } from '../ui/CardShell';
import { StatPill } from '../ui/StatPill';
import { CountdownTimer } from '../ui/CountdownTimer';
import {
  Plus,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  ArrowUpRight,
  MapPin,
  CreditCard,
  Activity,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const { terrains, reservations } = useData();

  const activeTerrains = useMemo(() => terrains.filter((t) => t.is_active), [terrains]);

  const { todayReservations, recentReservations, upcomingReservations, currentReservations } = useMemo(() => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayISO = today.toISOString();
    const tomorrowISO = tomorrow.toISOString();
    const nowISO = now.toISOString();

    const todayRes = reservations.filter(
      (r) => r.date_debut >= todayISO && r.date_debut < tomorrowISO && r.statut !== 'annulé'
    );
    const recentRes = reservations
      .filter(r => r.statut !== 'annulé')
      .slice(0, 5);

    const upcomingRes = reservations.filter(
      (r) => r.date_debut >= nowISO && r.statut !== 'annulé' && r.statut !== 'terminé'
    ).slice(0, 3);

    const currentRes = reservations.filter(
      (r) => r.date_debut <= nowISO && r.date_fin >= nowISO && r.statut === 'check_in'
    );

    return {
      todayReservations: todayRes,
      recentReservations: recentRes,
      upcomingReservations: upcomingRes,
      currentReservations: currentRes
    };
  }, [reservations]);

  const nonCancelledReservations = useMemo(
    () => reservations.filter((r) => r.statut !== 'annulé'),
    [reservations]
  );

  const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-FR').format(amount);

  const occupiedCount = currentReservations.length;
  const freeCount = activeTerrains.length - occupiedCount;
  const todayRevenue = todayReservations.reduce((sum, r) => sum + Number(r.montant_ttc), 0);
  const totalRevenue = nonCancelledReservations.reduce((sum, r) => sum + Number(r.montant_ttc), 0);
  const occupancyRate =
    activeTerrains.length > 0 ? Math.round((occupiedCount / activeTerrains.length) * 100) : 0;

  const getTerrainName = (id: string) =>
    activeTerrains.find((t) => t.id === id)?.name || terrains.find((t) => t.id === id)?.name || 'Terrain';

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; bg: string; text: string; dot: string }> = {
      'réservé': { label: 'Réservé', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
      'check_in': { label: 'En cours', bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
      'check_out': { label: 'Check-out', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
      'terminé': { label: 'Terminé', bg: 'bg-teal-500/10', text: 'text-teal-400', dot: 'bg-teal-400' },
      'annulé': { label: 'Annulé', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
      'bloqué': { label: 'Bloqué', bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
    };
    return configs[status] || configs['réservé'];
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return "Bon apres-midi";
    return 'Bonsoir';
  };

  return (
    <div className="space-y-4 xs:space-y-5 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col xs:flex-row xs:items-end xs:justify-between gap-3 xs:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-white tracking-tight truncate">
            {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Admin'}
          </h1>
          <p className="text-xs xs:text-sm sm:text-base text-slate-400 mt-1">
            {currentReservations.length > 0
              ? `${currentReservations.length} terrain${currentReservations.length > 1 ? 's' : ''} en cours d'utilisation`
              : upcomingReservations.length > 0
              ? `${upcomingReservations.length} reservation${upcomingReservations.length > 1 ? 's' : ''} à venir`
              : 'Aucune reservation en cours'}
          </p>
        </div>
        <button
          onClick={() => onNavigate('reservations')}
          className="inline-flex items-center justify-center gap-2 px-3 xs:px-4 sm:px-5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs xs:text-sm font-medium rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-[1px] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Reservation</span>
        </button>
      </div>

      {/* Stat Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 xs:gap-3 sm:gap-4 lg:gap-5">
        <StatPill
          label="Libres Maintenant"
          value={String(freeCount)}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-400"
          trend={freeCount > 0 ? 'positive' : 'neutral'}
          badge={`sur ${activeTerrains.length}`}
        />
        <StatPill
          label="En Cours"
          value={String(occupiedCount)}
          icon={<MapPin className="w-5 h-5" />}
          iconBg="bg-rose-500/10"
          iconColor="text-rose-400"
          trend={occupiedCount > 0 ? 'active' : 'neutral'}
          badge={`${occupancyRate}%`}
        />
        <StatPill
          label="Revenus du Jour"
          value={`${formatCurrency(todayRevenue)}`}
          icon={<CreditCard className="w-5 h-5" />}
          iconBg="bg-sky-500/10"
          iconColor="text-sky-400"
          trend={todayRevenue > 0 ? 'positive' : 'neutral'}
          badge="CFA"
        />
        <StatPill
          label="Total Revenus"
          value={`${formatCurrency(totalRevenue)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-400"
          trend="positive"
          badge="CFA cumul"
        />
      </div>

      {/* Recent Reservations + Terrains sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        <CardShell padding="none" className="lg:col-span-2">
          <div className="flex items-center justify-between p-5 sm:p-6 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Dernieres Reservations</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Les 5 plus recentes</p>
            </div>
            <button
              onClick={() => onNavigate('reservations')}
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 hover:gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded-lg px-2 py-1"
            >
              Voir tout
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {recentReservations.length === 0 ? (
            <div className="px-5 sm:px-6 pb-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mb-4 border border-slate-700/50 ring-1 ring-white/5">
                  <Calendar className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-slate-300 font-medium">Aucune reservation</p>
                <p className="text-sm text-slate-500 mt-1">Commencez par creer votre premiere reservation</p>
              </div>
            </div>
          ) : (
            <div className="px-5 sm:px-6 pb-3 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/60">
                    <th className="text-left text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3">
                      Client
                    </th>
                    <th className="text-left text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3 hidden md:table-cell">
                      Terrain
                    </th>
                    <th className="text-left text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3 hidden lg:table-cell">
                      Horaire
                    </th>
                    <th className="text-right text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3">
                      Montant
                    </th>
                    <th className="text-right text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3 hidden sm:table-cell">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {recentReservations.map((res) => {
                    const statusCfg = getStatusConfig(res.statut);
                    return (
                      <tr key={res.id} className="group hover:bg-slate-700/20 transition-colors duration-200">
                        <td className="py-3.5">
                          <p className="text-sm font-medium text-white">{res.client_name}</p>
                          <p className="text-xs text-slate-500">{res.client_phone}</p>
                        </td>
                        <td className="py-3.5 hidden md:table-cell">
                          <span className="text-sm text-slate-300">{getTerrainName(res.terrain_id)}</span>
                        </td>
                        <td className="py-3.5 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5 text-sm text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(res.date_debut)} {formatTime(res.date_debut)}
                          </div>
                        </td>
                        <td className="py-3.5 text-right">
                          <span className="text-sm font-semibold text-white">
                            {formatCurrency(Number(res.montant_ttc))}
                          </span>
                          <span className="text-xs text-slate-500 ml-1 hidden sm:inline">CFA</span>
                        </td>
                        <td className="py-3.5 text-right hidden sm:table-cell">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text} border border-current/10`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardShell>

        <div className="space-y-5 sm:space-y-6">
          <CardShell>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Terrains</h2>
              <button
                onClick={() => onNavigate('terrains')}
                className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded-lg px-2 py-1"
              >
                Gerer
              </button>
            </div>

            {activeTerrains.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 bg-slate-700/50 rounded-2xl flex items-center justify-center mb-3 border border-slate-700/50 ring-1 ring-white/5">
                  <MapPin className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400">Aucun terrain configure</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeTerrains.map((terrain) => {
                  const isOccupied = currentReservations.some(
                    (r) => r.terrain_id === terrain.id
                  );
                  const nextReservation = upcomingReservations.find(
                    (r) => r.terrain_id === terrain.id
                  );
                  return (
                    <div
                      key={terrain.id}
                      className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-all duration-200 border border-slate-700/40"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${isOccupied ? 'bg-rose-400' : 'bg-emerald-400'} ring-4 ${isOccupied ? 'ring-rose-500/20' : 'ring-emerald-500/20'} shrink-0`}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-slate-200 block">{terrain.name}</span>
                          {!isOccupied && nextReservation && (
                            <span className="text-xs text-slate-500 block truncate">
                              Prochain: {formatDate(nextReservation.date_debut)} {formatTime(nextReservation.date_debut)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${isOccupied ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'} shrink-0`}
                      >
                        {isOccupied ? 'Occupe' : 'Libre'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardShell>

          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 sm:p-6 text-white shadow-lg shadow-emerald-900/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-semibold">Actions Rapides</h3>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <QuickActionBtn
                label="Reservation"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => onNavigate('reservations')}
              />
              <QuickActionBtn
                label="Calendrier"
                icon={<Calendar className="w-4 h-4" />}
                onClick={() => onNavigate('calendar')}
              />
              <QuickActionBtn
                label="Terrains"
                icon={<MapPin className="w-4 h-4" />}
                onClick={() => onNavigate('terrains')}
              />
              <QuickActionBtn
                label="Rapports"
                icon={<TrendingUp className="w-4 h-4" />}
                onClick={() => onNavigate('rapports')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Reservations */}
      {upcomingReservations.length > 0 && (
        <CardShell>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Prochaines Reservations</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {upcomingReservations.length} reservation{upcomingReservations.length > 1 ? 's' : ''}{' '}
                à venir
              </p>
            </div>
            <button
              onClick={() => onNavigate('calendar')}
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded-lg px-2 py-1"
            >
              Voir le calendrier
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingReservations.map((res) => {
              const statusCfg = getStatusConfig(res.statut);
              const resDate = new Date(res.date_debut);
              const isToday = resDate.toDateString() === new Date().toDateString();
              const isTomorrow = new Date(resDate.getTime() - 24*60*60*1000).toDateString() === new Date().toDateString();
              const dayLabel = isToday ? "Aujourd'hui" : isTomorrow ? 'Demain' : formatDate(res.date_debut);

              return (
                <div
                  key={res.id}
                  className="relative p-4 rounded-2xl border border-slate-700/60 bg-slate-800/30 hover:border-emerald-500/30 hover:bg-slate-700/30 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md hover:shadow-black/20"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl ${statusCfg.bg} flex items-center justify-center border border-current/10`}
                      >
                        <Clock className={`w-4 h-4 ${statusCfg.text}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{formatTime(res.date_debut)}</p>
                        <p className="text-xs text-slate-500">{dayLabel}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text} border border-current/10`}
                    >
                      <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-200">{res.client_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{getTerrainName(res.terrain_id)}</p>

                  {res.statut === 'check_in' && (
                    <div className="mt-3">
                      <CountdownTimer
                        endDate={res.date_fin}
                        reservationId={res.id}
                      />
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{res.client_phone}</span>
                    <span className="text-sm font-semibold text-white">
                      {formatCurrency(Number(res.montant_ttc))} CFA
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardShell>
      )}
    </div>
  );
};

const QuickActionBtn: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ label, icon, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] bg-white/15 hover:bg-white/25 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 backdrop-blur-sm text-white/90 hover:text-white active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-white/20 border border-white/10"
  >
    {icon}
    <span className="truncate">{label}</span>
  </button>
);
