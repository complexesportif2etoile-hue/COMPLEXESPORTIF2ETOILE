import { useState, useMemo, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import {
  TrendingUp, TrendingDown, Calendar, DollarSign, CheckCircle,
  XCircle, MapPin, Filter, Download, Printer, BarChart2,
  Globe, Users, Award
} from 'lucide-react';
import { format, parseISO } from '../utils/dateUtils';

type TabId = 'general' | 'terrains' | 'clients' | 'finance' | 'reservations';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'Vue générale' },
  { id: 'terrains', label: 'Terrains' },
  { id: 'clients', label: 'Clients' },
  { id: 'finance', label: 'Finance' },
  { id: 'reservations', label: 'Réserva.' },
];

const STATUT_LABELS: Record<string, string> = {
  réservé: 'Réservé',
  check_in: 'En cours',
  terminé: 'Terminé',
  check_out: 'Terminé',
  annulé: 'Annulé',
  en_attente: 'En attente',
  bloqué: 'Bloqué',
};

const STATUT_COLORS: Record<string, string> = {
  réservé: 'bg-blue-500',
  check_in: 'bg-amber-400',
  terminé: 'bg-emerald-500',
  check_out: 'bg-emerald-500',
  annulé: 'bg-red-500',
  en_attente: 'bg-amber-400',
  bloqué: 'bg-slate-500',
};

const STATUT_DOT: Record<string, string> = {
  réservé: 'bg-blue-500',
  check_in: 'bg-amber-400',
  terminé: 'bg-emerald-500',
  check_out: 'bg-emerald-500',
  annulé: 'bg-red-500',
  en_attente: 'bg-amber-400',
  bloqué: 'bg-slate-500',
};

const DEP_CAT_LABELS: Record<string, string> = {
  salaires: 'Salaires', entretien: 'Entretien', electricite: 'Électricité',
  eau: 'Eau', loyer: 'Loyer', equipement: 'Équipement',
  fournitures: 'Fournitures', autre: 'Autre',
};

const PAY_METHOD_LABELS: Record<string, string> = {
  especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', mixte: 'Mixte', autre: 'Autre',
};

export function Reports() {
  const { reservations, encaissements, terrains, clients, depenses } = useData();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterTerrain, setFilterTerrain] = useState('all');
  const [filterStatut, setFilterStatut] = useState('all');
  const [showFilters, setShowFilters] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      const d = new Date(r.date_debut);
      if (filterStart) {
        const s = new Date(filterStart);
        s.setHours(0, 0, 0, 0);
        if (d < s) return false;
      }
      if (filterEnd) {
        const e = new Date(filterEnd);
        e.setHours(23, 59, 59, 999);
        if (d > e) return false;
      }
      if (filterTerrain !== 'all' && r.terrain_id !== filterTerrain) return false;
      if (filterStatut !== 'all' && r.statut !== filterStatut) return false;
      return true;
    });
  }, [reservations, filterStart, filterEnd, filterTerrain, filterStatut]);

  const filteredEncaissements = useMemo(() => {
    return encaissements.filter((e) => {
      if (!filterStart && !filterEnd) return true;
      const d = new Date(e.created_at);
      if (filterStart) {
        const s = new Date(filterStart); s.setHours(0, 0, 0, 0);
        if (d < s) return false;
      }
      if (filterEnd) {
        const end = new Date(filterEnd); end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    });
  }, [encaissements, filterStart, filterEnd]);

  const filteredDepenses = useMemo(() => {
    return depenses.filter((d) => {
      const dt = new Date(d.date_depense);
      if (filterStart) {
        const s = new Date(filterStart); s.setHours(0, 0, 0, 0);
        if (dt < s) return false;
      }
      if (filterEnd) {
        const e = new Date(filterEnd); e.setHours(23, 59, 59, 999);
        if (dt > e) return false;
      }
      return true;
    });
  }, [depenses, filterStart, filterEnd]);

  const stats = useMemo(() => {
    const totalRevenue = filteredEncaissements.reduce((s, e) => s + e.montant_total, 0);
    const totalDepenses = filteredDepenses.reduce((s, d) => s + d.montant, 0);
    const tva = filteredReservations.reduce((s, r) => s + (r.tva_applicable ? r.montant_tva : 0), 0);
    const ht = totalRevenue - tva;

    const completed = filteredReservations.filter((r) => ['terminé', 'check_out'].includes(r.statut)).length;
    const cancelled = filteredReservations.filter((r) => r.statut === 'annulé').length;
    const inProgress = filteredReservations.filter((r) => r.statut === 'check_in').length;
    const pending = filteredReservations.filter((r) => r.statut === 'en_attente').length;
    const total = filteredReservations.length;

    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
    const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0.0';
    const avgRevenue = total > 0 ? Math.round(totalRevenue / total) : 0;

    const activeTerrains = terrains.filter((t) => t.is_active).length;

    const byStatut: Record<string, number> = {};
    filteredReservations.forEach((r) => {
      const key = r.statut === 'check_out' ? 'terminé' : r.statut;
      byStatut[key] = (byStatut[key] || 0) + 1;
    });

    const byTerrain = terrains.map((t) => {
      const tres = filteredReservations.filter((r) => r.terrain_id === t.id && r.statut !== 'annulé');
      const trev = filteredEncaissements
        .filter((e) => tres.some((r) => r.id === e.reservation_id))
        .reduce((s, e) => s + e.montant_total, 0);
      return { terrain: t, count: tres.length, revenue: trev };
    }).sort((a, b) => b.revenue - a.revenue);

    const hourCounts: number[] = Array(24).fill(0);
    filteredReservations.forEach((r) => {
      const h = new Date(r.date_debut).getHours();
      hourCounts[h]++;
    });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakCount = hourCounts[peakHour];

    const online = filteredReservations.filter((r) => r.code_court && r.code_court.length > 0);
    const direct = filteredReservations.filter((r) => !r.code_court || r.code_court.length === 0);
    const onlineRevenue = filteredEncaissements
      .filter((e) => online.some((r) => r.id === e.reservation_id))
      .reduce((s, e) => s + e.montant_total, 0);
    const directRevenue = totalRevenue - onlineRevenue;

    const payMethods: Record<string, number> = {};
    filteredEncaissements.forEach((e) => {
      payMethods[e.mode_paiement] = (payMethods[e.mode_paiement] || 0) + e.montant_total;
    });

    const depByCategorie: Record<string, number> = {};
    filteredDepenses.forEach((d) => {
      depByCategorie[d.categorie] = (depByCategorie[d.categorie] || 0) + d.montant;
    });

    const topClients = (() => {
      const clientMap: Record<string, { name: string; phone: string; count: number; revenue: number }> = {};
      filteredReservations.forEach((r) => {
        const key = r.client_phone || r.client_name;
        if (!clientMap[key]) clientMap[key] = { name: r.client_name, phone: r.client_phone, count: 0, revenue: 0 };
        clientMap[key].count++;
      });
      filteredEncaissements.forEach((e) => {
        const res = filteredReservations.find((r) => r.id === e.reservation_id);
        if (res) {
          const key = res.client_phone || res.client_name;
          if (clientMap[key]) clientMap[key].revenue += e.montant_total;
        }
      });
      return Object.values(clientMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    })();

    return {
      totalRevenue, totalDepenses, beneficeNet: totalRevenue - totalDepenses,
      ht, tva, completed, cancelled, inProgress, pending, total,
      completionRate, cancellationRate, avgRevenue, activeTerrains,
      byStatut, byTerrain, hourCounts, peakHour, peakCount,
      online, direct, onlineRevenue, directRevenue,
      payMethods, depByCategorie, topClients,
    };
  }, [filteredReservations, filteredEncaissements, filteredDepenses, terrains]);

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

  const periodLabel = (() => {
    if (filterStart && filterEnd) return `${filterStart} — ${filterEnd}`;
    if (filterStart) return `Depuis ${filterStart}`;
    if (filterEnd) return `Jusqu'au ${filterEnd}`;
    return 'Toutes périodes';
  })();

  const handlePrint = () => window.print();

  const handlePDF = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-6" ref={printRef}>
      <div>
        <h1 className="text-2xl font-bold text-white">Rapports & Analyses</h1>
        <p className="text-slate-400 text-sm mt-0.5">Rapport complet de l'activité — {periodLabel}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handlePDF}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.97] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20"
        >
          <Download className="w-4 h-4" />
          PDF
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border border-slate-700"
        >
          <Printer className="w-4 h-4" />
          Imprimer
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-4 py-3 flex items-center gap-2 text-left"
        >
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-white text-sm">Filtres</span>
          <span className={`ml-auto text-slate-500 transition-transform ${showFilters ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {showFilters && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-800">
            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Début</label>
                <div className="relative">
                  <input
                    type="date"
                    value={filterStart}
                    onChange={(e) => setFilterStart(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Fin</label>
                <input
                  type="date"
                  value={filterEnd}
                  onChange={(e) => setFilterEnd(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Terrain</label>
                <select
                  value={filterTerrain}
                  onChange={(e) => setFilterTerrain(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Tous les terrains</option>
                  {terrains.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Statut</label>
                <select
                  value={filterStatut}
                  onChange={(e) => setFilterStatut(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Tous statuts</option>
                  <option value="réservé">Réservé</option>
                  <option value="check_in">En cours</option>
                  <option value="terminé">Terminé</option>
                  <option value="annulé">Annulé</option>
                  <option value="en_attente">En attente</option>
                </select>
              </div>
            </div>
            {(filterStart || filterEnd || filterTerrain !== 'all' || filterStatut !== 'all') && (
              <button
                onClick={() => { setFilterStart(''); setFilterEnd(''); setFilterTerrain('all'); setFilterStatut('all'); }}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? 'text-white bg-emerald-500/10 border-emerald-500'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              } ${tab.id === 'general' ? 'rounded-tl-2xl' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'general' && <GeneralTab stats={stats} fmt={fmt} terrains={terrains} />}
      {activeTab === 'terrains' && <TerrainsTab stats={stats} fmt={fmt} />}
      {activeTab === 'clients' && <ClientsTab stats={stats} fmt={fmt} />}
      {activeTab === 'finance' && <FinanceTab stats={stats} fmt={fmt} filteredDepenses={filteredDepenses} />}
      {activeTab === 'reservations' && <ReservationsTab reservations={filteredReservations} fmt={fmt} format={format} parseISO={parseISO} />}
    </div>
  );
}

function GeneralTab({ stats, fmt, terrains }: { stats: ReturnType<typeof computeStats>; fmt: (n: number) => string; terrains: any[] }) {
  const totalStatut = Object.values(stats.byStatut).reduce((s, n) => s + n, 0) || 1;
  const statutOrder = ['terminé', 'réservé', 'check_in', 'annulé', 'en_attente', 'bloqué'];
  const statutColors: Record<string, string> = {
    terminé: 'bg-emerald-500', réservé: 'bg-blue-500', check_in: 'bg-amber-400',
    annulé: 'bg-red-500', en_attente: 'bg-amber-400', bloqué: 'bg-slate-500',
  };
  const statutDots: Record<string, string> = {
    terminé: 'bg-emerald-500', réservé: 'bg-blue-500', check_in: 'bg-amber-400',
    annulé: 'bg-red-500', en_attente: 'bg-amber-400', bloqué: 'bg-slate-500',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <BigStatCard
          icon={Calendar}
          iconBg="bg-blue-500/20"
          iconColor="text-blue-400"
          value={String(stats.total)}
          label="Total Réservations"
          sub={`${stats.inProgress} en cours · ${stats.pending} en attente`}
        />
        <BigStatCard
          icon={DollarSign}
          iconBg="bg-emerald-500/20"
          iconColor="text-emerald-400"
          value={fmt(stats.totalRevenue)}
          valueSub="CFA"
          label="Revenus TTC"
          sub={`HT: ${fmt(stats.ht)} · TVA: ${fmt(stats.tva)}`}
          topRight
        />
        <BigStatCard
          icon={CheckCircle}
          iconBg="bg-teal-500/20"
          iconColor="text-teal-400"
          value={`${stats.completionRate}%`}
          label="Taux de Complétion"
          sub={`${stats.completed} terminées sur ${stats.total}`}
        />
        <BigStatCard
          icon={XCircle}
          iconBg="bg-red-500/20"
          iconColor="text-red-400"
          value={`${stats.cancellationRate}%`}
          label="Taux d'Annulation"
          sub={`${stats.cancelled} annulées`}
        />
        <BigStatCard
          icon={TrendingUp}
          iconBg="bg-emerald-500/20"
          iconColor="text-emerald-400"
          value={`${fmt(stats.avgRevenue)} CFA`}
          label="Revenu Moyen / Rés."
          sub="Toutes réservations actives"
        />
        <BigStatCard
          icon={MapPin}
          iconBg="bg-amber-500/20"
          iconColor="text-amber-400"
          value={String(stats.activeTerrains)}
          label="Terrains actifs"
          sub={`sur ${terrains.length} terrains`}
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
            <BarChart2 className="w-4 h-4 text-slate-400" />
          </div>
          <h3 className="font-semibold text-white">Répartition par Statut</h3>
        </div>
        <div className="space-y-3">
          {statutOrder.filter((s) => stats.byStatut[s] > 0).map((statut) => {
            const count = stats.byStatut[statut] || 0;
            const pct = ((count / totalStatut) * 100).toFixed(1);
            return (
              <div key={statut}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statutDots[statut] || 'bg-slate-500'}`} />
                    <span className="text-sm text-slate-200">{STATUT_LABELS[statut] || statut}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-300 font-medium">{count}</span>
                    <span className="text-sm text-slate-400 w-12 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${statutColors[statut] || 'bg-slate-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {Object.keys(stats.byStatut).length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">Aucune donnée</p>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <h3 className="font-semibold text-white">Activité par heure</h3>
        </div>
        <HourBarChart hourCounts={stats.hourCounts} />
        {stats.peakCount > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2.5 border border-slate-700/50">
            <Award className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <p className="text-xs text-slate-300">
              Créneau le plus demandé : <span className="text-white font-bold">{stats.peakHour}h</span>
              <span className="text-slate-400"> ({stats.peakCount} rés.)</span>
            </p>
          </div>
        )}
      </div>

      <OnlineVsDirectCard stats={stats} fmt={fmt} />
    </div>
  );
}

function TerrainsTab({ stats, fmt }: { stats: any; fmt: (n: number) => string }) {
  const maxRev = Math.max(...stats.byTerrain.map((b: any) => b.revenue), 1);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="font-semibold text-white">Performance par terrain</h3>
        </div>
        <div className="space-y-4">
          {stats.byTerrain.map(({ terrain, count, revenue }: any) => {
            const pct = Math.round((revenue / maxRev) * 100);
            return (
              <div key={terrain.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-200">{terrain.name}</span>
                  <span className="text-xs text-slate-500">{count} rés.</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{fmt(terrain.tarif_horaire)} CFA/h</span>
                  <span className="text-sm font-bold text-emerald-400">{fmt(revenue)} CFA</span>
                </div>
              </div>
            );
          })}
          {stats.byTerrain.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Aucune donnée</p>}
        </div>
      </div>
    </div>
  );
}

function ClientsTab({ stats, fmt }: { stats: any; fmt: (n: number) => string }) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="font-semibold text-white">Top clients</h3>
        </div>
        <div className="space-y-3">
          {stats.topClients.map((c: any, i: number) => (
            <div key={c.phone || c.name} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-300">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                <p className="text-xs text-slate-500">{c.phone} · {c.count} rés.</p>
              </div>
              <span className="text-sm font-bold text-emerald-400 flex-shrink-0">{fmt(c.revenue)}</span>
            </div>
          ))}
          {stats.topClients.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Aucun client</p>}
        </div>
      </div>
    </div>
  );
}

function FinanceTab({ stats, fmt, filteredDepenses }: { stats: any; fmt: (n: number) => string; filteredDepenses: any[] }) {
  const totalDep = stats.totalDepenses || 1;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${stats.beneficeNet >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
        <p className="text-xs text-slate-400 mb-1">Bénéfice net</p>
        <p className={`text-3xl font-bold ${stats.beneficeNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {stats.beneficeNet >= 0 ? '+' : ''}{fmt(stats.beneficeNet)} CFA
        </p>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span>Revenus : <span className="text-emerald-400 font-medium">{fmt(stats.totalRevenue)} CFA</span></span>
          <span>Dépenses : <span className="text-red-400 font-medium">{fmt(stats.totalDepenses)} CFA</span></span>
        </div>
        {stats.totalRevenue > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            Marge : <span className={`font-medium ${stats.beneficeNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {Math.round((stats.beneficeNet / stats.totalRevenue) * 100)}%
            </span>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <h3 className="font-semibold text-white">Dépenses par catégorie</h3>
        </div>
        <div className="space-y-3">
          {Object.entries(stats.depByCategorie).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([cat, amount]) => {
            const pct = Math.round(((amount as number) / totalDep) * 100);
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-200">{DEP_CAT_LABELS[cat] || cat}</span>
                  <span className="text-xs text-slate-400">{pct}% · <span className="text-red-400 font-medium">{fmt(amount as number)}</span></span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {Object.keys(stats.depByCategorie).length === 0 && <p className="text-slate-500 text-sm text-center py-4">Aucune dépense</p>}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="font-semibold text-white">Modes de paiement</h3>
        </div>
        <div className="space-y-3">
          {Object.entries(stats.payMethods).map(([method, amount]) => {
            const total = Object.values(stats.payMethods as Record<string, number>).reduce((s, a) => s + a, 0) || 1;
            const pct = Math.round(((amount as number) / total) * 100);
            return (
              <div key={method}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-200">{PAY_METHOD_LABELS[method] || method}</span>
                  <span className="text-xs text-slate-400">{pct}% · <span className="text-blue-400 font-medium">{fmt(amount as number)}</span></span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {Object.keys(stats.payMethods).length === 0 && <p className="text-slate-500 text-sm text-center py-4">Aucun encaissement</p>}
        </div>
      </div>
    </div>
  );
}

function ReservationsTab({ reservations, fmt, format, parseISO }: {
  reservations: any[];
  fmt: (n: number) => string;
  format: (d: Date, fmt: string) => string;
  parseISO: (s: string) => Date;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reservations.filter((r) =>
      r.client_name?.toLowerCase().includes(q) ||
      r.client_phone?.includes(q) ||
      r.terrain?.name?.toLowerCase().includes(q)
    );
  }, [reservations, search]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Rechercher un client, terrain..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-600"
      />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm">Liste des réservations</h3>
          <span className="text-xs text-slate-500">{filtered.length} entrées</span>
        </div>

        <div className="grid grid-cols-2 px-4 py-2 border-b border-slate-800/50">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Client</span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Montant</span>
        </div>

        <div className="divide-y divide-slate-800/40 max-h-96 overflow-y-auto">
          {filtered.slice(0, 30).map((r) => (
            <div key={r.id} className="grid grid-cols-2 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{r.client_name}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {r.terrain?.name || ''} · {format(parseISO(r.date_debut), 'dd/MM')}
                </p>
                <span className={`text-xs font-medium mt-0.5 inline-block ${
                  r.statut === 'terminé' || r.statut === 'check_out' ? 'text-emerald-400' :
                  r.statut === 'annulé' ? 'text-red-400' :
                  r.statut === 'check_in' ? 'text-amber-400' : 'text-blue-400'
                }`}>
                  {STATUT_LABELS[r.statut] || r.statut}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{fmt(r.amount_due)}</p>
                <p className={`text-xs mt-0.5 ${r.payment_status === 'PAID' ? 'text-emerald-400' : r.payment_status === 'PARTIAL' ? 'text-amber-400' : 'text-red-400'}`}>
                  {r.payment_status === 'PAID' ? 'Payé' : r.payment_status === 'PARTIAL' ? 'Partiel' : 'Impayé'}
                </p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">Aucune réservation trouvée</div>
          )}
        </div>
      </div>
    </div>
  );
}

function OnlineVsDirectCard({ stats, fmt }: { stats: any; fmt: (n: number) => string }) {
  const total = (stats.online.length + stats.direct.length) || 1;
  const onlinePct = Math.round((stats.online.length / total) * 100);
  const directPct = 100 - onlinePct;
  const totalRev = (stats.onlineRevenue + stats.directRevenue) || 1;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
          <Globe className="w-4 h-4 text-blue-400" />
        </div>
        <h3 className="font-semibold text-white">Réservations en ligne vs Direct</h3>
      </div>

      <div className="h-3 bg-slate-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-700"
          style={{ width: `${onlinePct}%` }}
        />
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs text-slate-400">En ligne</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-400">Direct</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-blue-400">En ligne</span>
          </div>
          <p className="text-lg font-bold text-white">{onlinePct.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmt(stats.onlineRevenue)} CFA</p>
          <p className="text-xs text-slate-500">{stats.online.length} rés. ({onlinePct.toFixed(1)}%)</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Direct</span>
          </div>
          <p className="text-lg font-bold text-white">{directPct.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmt(stats.directRevenue)} CFA</p>
          <p className="text-xs text-slate-500">{stats.direct.length} rés. ({directPct.toFixed(1)}%)</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <span className="text-xs text-slate-500">CA total</span>
        <span className="text-sm font-bold text-white">{fmt(stats.totalRevenue)} CFA</span>
      </div>
    </div>
  );
}

function HourBarChart({ hourCounts }: { hourCounts: number[] }) {
  const max = Math.max(...hourCounts, 1);
  const displayHours = [0, 6, 12, 18, 23];

  return (
    <div className="relative">
      <div className="flex items-end gap-0.5 h-24">
        {hourCounts.map((count, h) => {
          const heightPct = (count / max) * 100;
          return (
            <div
              key={h}
              className="flex-1 rounded-t-sm transition-all duration-500"
              style={{
                height: `${Math.max(heightPct, count > 0 ? 4 : 1)}%`,
                backgroundColor: count > 0 ? '#22d3ee' : '#1e293b',
                opacity: count > 0 ? 0.8 + (heightPct / 500) : 0.3,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {displayHours.map((h) => (
          <span key={h} className="text-xs text-slate-500">{String(h).padStart(2, '0')}h</span>
        ))}
      </div>
    </div>
  );
}

function BigStatCard({ icon: Icon, iconBg, iconColor, value, valueSub, label, sub, topRight }: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  value: string;
  valueSub?: string;
  label: string;
  sub?: string;
  topRight?: boolean;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative">
      {topRight && (
        <div className="absolute top-3 right-3">
          <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
        </div>
      )}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <p className="text-2xl font-bold text-white leading-none">
        {value}
        {valueSub && <span className="text-lg ml-1">{valueSub}</span>}
      </p>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function computeStats(args: any) { return args; }

function useState2<T>(v: T): [T, (x: T) => void] { return [v, () => {}]; }
