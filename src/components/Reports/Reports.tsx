import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { CardShell } from '../ui/CardShell';
import {
  Calendar, TrendingUp, DollarSign, MapPin, Filter, Download,
  BarChart3, Users, CheckCircle, XCircle, Printer, FileText,
  Clock, Activity, Award, CreditCard, ArrowUpRight,
  ChevronDown, RefreshCw, Globe,
} from 'lucide-react';
import {
  computeStats, formatCurrency, formatDate, formatDateTime, formatDuration,
  STATUS_CONFIG, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL,
  type ReportStats,
} from './reportUtils';

type Tab = 'overview' | 'terrains' | 'clients' | 'reservations' | 'finance';

export const Reports: React.FC = () => {
  const { reservations, terrains } = useData();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedTerrain, setSelectedTerrain] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [companyName, setCompanyName] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useMemo(() => {
    supabase.from('company_settings').select('company_name').maybeSingle().then(({ data }) => {
      if (data?.company_name) setCompanyName(data.company_name);
    });
  }, []);

  const filteredReservations = useMemo(() => {
    let r = [...reservations];
    if (dateRange.start) r = r.filter(x => x.date_debut >= dateRange.start);
    if (dateRange.end) {
      const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999);
      r = r.filter(x => x.date_debut <= end.toISOString());
    }
    if (selectedTerrain !== 'all') r = r.filter(x => x.terrain_id === selectedTerrain);
    if (selectedStatus !== 'all') r = r.filter(x => x.statut === selectedStatus);
    return r.sort((a, b) => new Date(b.date_debut).getTime() - new Date(a.date_debut).getTime());
  }, [reservations, dateRange, selectedTerrain, selectedStatus]);

  const stats = useMemo(() => computeStats(filteredReservations, terrains), [filteredReservations, terrains]);

  const hasFilters = dateRange.start !== '' || dateRange.end !== '' || selectedTerrain !== 'all' || selectedStatus !== 'all';

  const resetFilters = () => {
    setDateRange({ start: '', end: '' });
    setSelectedTerrain('all');
    setSelectedStatus('all');
  };

  const handlePrint = () => window.print();

  const handlePDFExport = () => {
    const originalTitle = document.title;
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '-');
    document.title = `Rapport-Activite-${dateStr}`;
    window.print();
    document.title = originalTitle;
  };

  const inputClass = "w-full px-3 min-h-[42px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all";

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Vue générale', icon: <Activity className="w-4 h-4" /> },
    { id: 'terrains', label: 'Terrains', icon: <MapPin className="w-4 h-4" /> },
    { id: 'clients', label: 'Clients', icon: <Users className="w-4 h-4" /> },
    { id: 'finance', label: 'Finance', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'reservations', label: 'Réservations', icon: <Calendar className="w-4 h-4" /> },
  ];

  const periodLabel = dateRange.start && dateRange.end
    ? `${formatDate(dateRange.start + 'T00:00:00')} — ${formatDate(dateRange.end + 'T00:00:00')}`
    : dateRange.start
    ? `Depuis le ${formatDate(dateRange.start + 'T00:00:00')}`
    : dateRange.end
    ? `Jusqu'au ${formatDate(dateRange.end + 'T00:00:00')}`
    : 'Toutes périodes';

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Rapports & Analyses</h1>
          <p className="text-sm text-slate-400 mt-1">Rapport complet de l'activité — {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePDFExport}
            className="inline-flex items-center gap-2 px-4 min-h-[42px] bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 min-h-[42px] bg-slate-700/60 hover:bg-slate-600/70 text-white text-sm font-medium rounded-xl transition-all duration-200 border border-slate-600/50"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
        </div>
      </div>

      {/* Filters */}
      <CardShell padding="md" className="print:hidden">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-white">Filtres</span>
          {hasFilters && (
            <button onClick={resetFilters} className="ml-auto flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
              <RefreshCw className="w-3 h-3" /> Réinitialiser
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Début</label>
            <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Fin</label>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Terrain</label>
            <select value={selectedTerrain} onChange={e => setSelectedTerrain(e.target.value)} className={inputClass}>
              <option value="all">Tous les terrains</option>
              {terrains.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Statut</label>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className={inputClass}>
              <option value="all">Tous statuts</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
      </CardShell>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-1 overflow-x-auto print:hidden">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* PRINTABLE DOCUMENT                                           */}
      {/* ============================================================ */}
      <div ref={printRef} className="print-document">

        {/* Print-only header */}
        <div className="hidden print:block print-header mb-8">
          <div className="flex items-start justify-between border-b-2 border-gray-200 pb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Rapport d'activité</p>
                  {companyName && <p className="text-lg font-bold text-gray-900">{companyName}</p>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700">Généré le {formatDateTime(new Date().toISOString())}</p>
              <p className="text-sm text-gray-500 mt-1">Période : {periodLabel}</p>
              {selectedTerrain !== 'all' && (
                <p className="text-sm text-gray-500">Terrain : {terrains.find(t => t.id === selectedTerrain)?.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* ---- OVERVIEW TAB ---- */}
        {(activeTab === 'overview') && (
          <section className="space-y-6 print:space-y-8">
            <KPIGrid stats={stats} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print:grid-cols-2 print:gap-6">
              <StatusBreakdownCard stats={stats} />
              <MonthlyRevenueCard stats={stats} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print:grid-cols-2 print:gap-6">
              <HourlyDistributionCard stats={stats} />
              <OnlineRevenueCard stats={stats} />
            </div>
          </section>
        )}

        {/* ---- TERRAINS TAB ---- */}
        {(activeTab === 'terrains') && (
          <section className="space-y-6">
            <TerrainPerformanceCard stats={stats} />
          </section>
        )}

        {/* ---- CLIENTS TAB ---- */}
        {(activeTab === 'clients') && (
          <section className="space-y-6">
            <TopClientsCard stats={stats} />
          </section>
        )}

        {/* ---- FINANCE TAB ---- */}
        {(activeTab === 'finance') && (
          <section className="space-y-6">
            <FinanceSummaryCard stats={stats} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <OnlineRevenueCard stats={stats} />
              <PaymentMethodsCard stats={stats} />
            </div>
            <MonthlyRevenueCard stats={stats} />
          </section>
        )}

        {/* ---- RESERVATIONS TAB ---- */}
        {(activeTab === 'reservations') && (
          <section className="space-y-6">
            <ReservationsTableCard reservations={filteredReservations} terrains={terrains} />
          </section>
        )}

        {/* PRINT: render ALL sections */}
        <div className="hidden print:block space-y-10">
          <PrintSection title="Vue générale" icon={<Activity className="w-4 h-4" />}>
            <KPIGrid stats={stats} />
            <div className="grid grid-cols-2 gap-6 mt-6">
              <StatusBreakdownCard stats={stats} />
              <FinanceSummaryCard stats={stats} />
            </div>
            <div className="grid grid-cols-2 gap-6 mt-6">
              <MonthlyRevenueCard stats={stats} />
              <HourlyDistributionCard stats={stats} />
            </div>
          </PrintSection>

          <PrintSection title="Performance par Terrain" icon={<MapPin className="w-4 h-4" />}>
            <TerrainPerformanceCard stats={stats} />
          </PrintSection>

          <PrintSection title="Top Clients" icon={<Users className="w-4 h-4" />}>
            <TopClientsCard stats={stats} />
          </PrintSection>

          <PrintSection title="Analyse Financière" icon={<DollarSign className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-6">
              <OnlineRevenueCard stats={stats} />
              <PaymentMethodsCard stats={stats} />
            </div>
          </PrintSection>

          <PrintSection title="Détail des Réservations" icon={<Calendar className="w-4 h-4" />}>
            <ReservationsTableCard reservations={filteredReservations} terrains={terrains} printAll />
          </PrintSection>
        </div>
      </div>
    </div>
  );
};

/* ============================================================ */
/* KPI GRID                                                      */
/* ============================================================ */
const KPIGrid: React.FC<{ stats: ReportStats }> = ({ stats }) => {
  const kpis = [
    {
      label: 'Total Réservations', value: String(stats.total),
      sub: `${stats.active} en cours · ${stats.pending} en attente`,
      icon: <Calendar className="w-5 h-5" />, color: 'blue',
    },
    {
      label: 'Revenus TTC', value: `${formatCurrency(stats.totalRevenueTTC)} CFA`,
      sub: `HT: ${formatCurrency(stats.totalRevenueBrut)} · TVA: ${formatCurrency(stats.totalTVA)}`,
      icon: <DollarSign className="w-5 h-5" />, color: 'emerald', badge: <ArrowUpRight className="w-3 h-3" />,
    },
    {
      label: 'Taux de Complétion', value: `${stats.completionRate.toFixed(1)}%`,
      sub: `${stats.completed} terminées sur ${stats.total}`,
      icon: <CheckCircle className="w-5 h-5" />, color: 'teal',
    },
    {
      label: 'Taux d\'Annulation', value: `${stats.cancellationRate.toFixed(1)}%`,
      sub: `${stats.cancelled} annulées`,
      icon: <XCircle className="w-5 h-5" />, color: 'red',
    },
    {
      label: 'Revenu Moyen / Rés.', value: `${formatCurrency(stats.averageRevenueTTC)} CFA`,
      sub: 'Toutes réservations actives',
      icon: <TrendingUp className="w-5 h-5" />, color: 'sky',
    },
    {
      label: 'Terrains actifs', value: String(stats.terrainStats.filter(t => t.count > 0).length),
      sub: `sur ${stats.terrainStats.length} terrains`,
      icon: <MapPin className="w-5 h-5" />, color: 'amber',
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  const printColorMap: Record<string, string> = {
    blue: 'text-blue-600', emerald: 'text-emerald-600', teal: 'text-teal-600',
    red: 'text-red-600', sky: 'text-sky-600', amber: 'text-amber-600',
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3 print:gap-4">
      {kpis.map((k, i) => (
        <div key={i} className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 print:bg-white print:border print:border-gray-200 print:rounded-xl print:p-4 print:shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${colorMap[k.color]} print:bg-gray-50 print:border-gray-200 print:${printColorMap[k.color]}`}>
              {k.icon}
            </div>
            {k.badge && <span className="text-emerald-400 print:text-emerald-600">{k.badge}</span>}
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white print:text-gray-900 leading-none mb-1">{k.value}</p>
          <p className="text-xs text-slate-400 print:text-gray-500 font-medium mb-1">{k.label}</p>
          <p className="text-[11px] text-slate-500 print:text-gray-400 leading-relaxed">{k.sub}</p>
        </div>
      ))}
    </div>
  );
};

/* ============================================================ */
/* STATUS BREAKDOWN                                              */
/* ============================================================ */
const StatusBreakdownCard: React.FC<{ stats: ReportStats }> = ({ stats }) => {
  const barColors: Record<string, string> = {
    terminé: 'bg-teal-500', réservé: 'bg-blue-500', check_in: 'bg-amber-500',
    check_out: 'bg-purple-500', en_attente: 'bg-orange-500', annulé: 'bg-red-500', bloqué: 'bg-slate-500',
  };
  const printBarColors: Record<string, string> = {
    terminé: 'print-bar-teal', réservé: 'print-bar-blue', check_in: 'print-bar-amber',
    check_out: 'print-bar-purple', en_attente: 'print-bar-orange', annulé: 'print-bar-red', bloqué: 'print-bar-slate',
  };

  return (
    <ReportCard title="Répartition par Statut" icon={<BarChart3 className="w-4 h-4" />}>
      <div className="space-y-3">
        {stats.statusBreakdown.map(item => (
          <div key={item.status}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_CONFIG[item.status]?.dot ?? '#6b7280' }}
                />
                <span className="text-sm text-slate-300 print:text-gray-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 print:text-gray-400">{item.count}</span>
                <span className="text-sm font-semibold text-white print:text-gray-900 w-12 text-right">{item.percentage.toFixed(1)}%</span>
              </div>
            </div>
            <div className="w-full h-2 bg-slate-700/50 print:bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColors[item.status] ?? 'bg-slate-500'}`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
        {stats.statusBreakdown.length === 0 && (
          <p className="text-sm text-slate-500 print:text-gray-400 text-center py-4">Aucune donnée</p>
        )}
      </div>
    </ReportCard>
  );
};

/* ============================================================ */
/* MONTHLY REVENUE                                               */
/* ============================================================ */
const MonthlyRevenueCard: React.FC<{ stats: ReportStats }> = ({ stats }) => {
  const data = stats.monthlyRevenue;
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <ReportCard title="Revenus Mensuels" icon={<TrendingUp className="w-4 h-4" />}>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500 print:text-gray-400 text-center py-4">Aucune donnée</p>
      ) : (
        <div className="space-y-2">
          {data.map(m => (
            <div key={m.monthKey} className="flex items-center gap-3">
              <div className="w-28 shrink-0">
                <p className="text-xs text-slate-400 print:text-gray-500 capitalize">{m.month}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="w-full h-6 bg-slate-700/40 print:bg-gray-100 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-emerald-600/80 print:bg-emerald-500 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${(m.revenue / maxRevenue) * 100}%`, minWidth: m.revenue > 0 ? '32px' : '0' }}
                  >
                    {m.revenue > 0 && (
                      <span className="text-[10px] font-bold text-white">{formatCurrency(m.revenue)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-14 text-right shrink-0">
                <p className="text-xs text-slate-400 print:text-gray-500">{m.count} rés.</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ReportCard>
  );
};

/* ============================================================ */
/* HOURLY DISTRIBUTION                                           */
/* ============================================================ */
const HourlyDistributionCard: React.FC<{ stats: ReportStats }> = ({ stats }) => {
  const data = stats.hourlyDistribution;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const peakHour = data.reduce((a, b) => a.count > b.count ? a : b, data[0] ?? { label: '-', count: 0 });

  return (
    <ReportCard title="Créneaux les plus demandés" icon={<Clock className="w-4 h-4" />}>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500 print:text-gray-400 text-center py-4">Aucune donnée</p>
      ) : (
        <>
          <div className="flex items-end gap-1 h-24 mb-3">
            {Array.from({ length: 24 }, (_, i) => {
              const d = data.find(x => x.hour === i);
              const h = d?.count ?? 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-sm transition-all duration-300 bg-sky-500/60 print:bg-sky-400 hover:bg-sky-400"
                    style={{ height: `${h > 0 ? Math.max((h / maxCount) * 88, 4) : 0}px` }}
                  />
                  {h > 0 && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      {String(i).padStart(2, '0')}h · {h}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 print:text-gray-400 mb-3">
            <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
          {peakHour && (
            <div className="flex items-center gap-2 bg-sky-500/5 border border-sky-500/15 rounded-xl px-3 py-2">
              <Award className="w-4 h-4 text-sky-400 print:text-sky-600 shrink-0" />
              <p className="text-xs text-sky-300 print:text-sky-700">
                Créneau le plus demandé : <span className="font-bold">{peakHour.label}</span> ({peakHour.count} rés.)
              </p>
            </div>
          )}
        </>
      )}
    </ReportCard>
  );
};

/* ============================================================ */
/* ONLINE REVENUE                                                */
/* ============================================================ */
const OnlineRevenueCard: React.FC<{ stats: ReportStats }> = ({ stats }) => {
  const offlineRevenue = stats.totalRevenueTTC - stats.onlineRevenueTTC;
  const offlineCount = stats.total - stats.onlineTotal;
  const offlineCountShare = stats.total > 0 ? (offlineCount / stats.total) * 100 : 0;
  const offlineRevenueShare = 100 - stats.onlineRevenueShare;

  return (
    <ReportCard title="Réservations en ligne vs Direct" icon={<Globe className="w-4 h-4" />}>
      {stats.total === 0 ? (
        <p className="text-sm text-slate-500 print:text-gray-400 text-center py-4">Aucune donnée</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-slate-700/50 print:bg-gray-100 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-sky-500 print:bg-sky-500 rounded-l-full transition-all duration-500"
                style={{ width: `${stats.onlineRevenueShare}%` }}
              />
              <div
                className="h-full bg-emerald-600 print:bg-emerald-500 rounded-r-full transition-all duration-500"
                style={{ width: `${offlineRevenueShare}%` }}
              />
            </div>
          </div>
          <div className="flex gap-3 text-[11px] text-slate-400 print:text-gray-500 -mt-2 mb-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />En ligne</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />Direct</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3 print:bg-sky-50 print:border-sky-200">
              <div className="flex items-center gap-1.5 mb-2">
                <Globe className="w-3.5 h-3.5 text-sky-400 print:text-sky-600" />
                <span className="text-xs font-semibold text-sky-300 print:text-sky-700">En ligne</span>
              </div>
              <p className="text-xl font-bold text-white print:text-gray-900 tabular-nums leading-none">
                {stats.onlineRevenueShare.toFixed(1)}%
              </p>
              <p className="text-[11px] text-slate-400 print:text-gray-500 mt-1 tabular-nums">
                {formatCurrency(stats.onlineRevenueTTC)} CFA
              </p>
              <p className="text-[11px] text-slate-500 print:text-gray-400 mt-0.5">
                {stats.onlineTotal} rés. ({stats.onlineCountShare.toFixed(1)}%)
              </p>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 print:bg-emerald-50 print:border-emerald-200">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-emerald-400 print:text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-300 print:text-emerald-700">Direct</span>
              </div>
              <p className="text-xl font-bold text-white print:text-gray-900 tabular-nums leading-none">
                {offlineRevenueShare.toFixed(1)}%
              </p>
              <p className="text-[11px] text-slate-400 print:text-gray-500 mt-1 tabular-nums">
                {formatCurrency(offlineRevenue)} CFA
              </p>
              <p className="text-[11px] text-slate-500 print:text-gray-400 mt-0.5">
                {offlineCount} rés. ({offlineCountShare.toFixed(1)}%)
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-700/40 print:border-gray-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 print:text-gray-400">CA total</span>
            <span className="text-sm font-bold text-white print:text-gray-900 tabular-nums">
              {formatCurrency(stats.totalRevenueTTC)} CFA
            </span>
          </div>
        </div>
      )}
    </ReportCard>
  );
};

/* ============================================================ */
/* FINANCE SUMMARY                                               */
/* ============================================================ */
const FinanceSummaryCard: React.FC<{ stats: ReportStats }> = ({ stats }) => {
  const rows = [
    { label: 'Revenus bruts HT', value: `${formatCurrency(stats.totalRevenueBrut)} CFA`, bold: false },
    { label: 'TVA collectée', value: `${formatCurrency(stats.totalTVA)} CFA`, bold: false },
    { label: 'Revenus TTC', value: `${formatCurrency(stats.totalRevenueTTC)} CFA`, bold: true },
    { label: 'Revenu moyen / réservation', value: `${formatCurrency(stats.averageRevenueTTC)} CFA`, bold: false },
    { label: 'Taux de complétion', value: `${stats.completionRate.toFixed(1)}%`, bold: false },
    { label: 'Taux d\'annulation', value: `${stats.cancellationRate.toFixed(1)}%`, bold: false },
  ];

  return (
    <ReportCard title="Synthèse Financière" icon={<DollarSign className="w-4 h-4" />}>
      <div className="space-y-0 divide-y divide-slate-700/40 print:divide-gray-100">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-center justify-between py-2.5 ${r.bold ? 'bg-emerald-500/5 print:bg-emerald-50 -mx-0 px-0 rounded-xl' : ''}`}>
            <span className={`text-sm print:text-sm ${r.bold ? 'font-semibold text-white print:text-gray-900' : 'text-slate-400 print:text-gray-500'}`}>{r.label}</span>
            <span className={`text-sm tabular-nums print:text-sm ${r.bold ? 'font-bold text-emerald-400 print:text-emerald-600' : 'text-white print:text-gray-800 font-medium'}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </ReportCard>
  );
};

/* ============================================================ */
/* TERRAIN PERFORMANCE                                           */
/* ============================================================ */
const TerrainPerformanceCard: React.FC<{ stats: ReportStats }> = ({ stats }) => {
  const maxRevenue = Math.max(...stats.terrainStats.map(t => t.revenue), 1);

  return (
    <ReportCard title="Performance par Terrain" icon={<MapPin className="w-4 h-4" />} fullWidth>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/60 print:border-gray-200">
              {['Terrain', 'Réservations', 'Terminées', 'Annulées', 'Part (%)', 'Rev. Moyen', 'Revenu TTC', 'Barre'].map(h => (
                <th key={h} className={`pb-3 text-xs font-semibold text-slate-500 print:text-gray-400 uppercase tracking-wide ${h === 'Terrain' ? 'text-left' : 'text-right'} ${h === 'Barre' ? 'hidden sm:table-cell' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30 print:divide-gray-100">
            {stats.terrainStats.map((t, i) => (
              <tr key={t.id} className="hover:bg-slate-700/20 print:hover:bg-transparent transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-700 print:bg-gray-100 text-xs font-bold text-slate-400 print:text-gray-500 flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="font-medium text-white print:text-gray-900">{t.name}</span>
                  </div>
                </td>
                <td className="py-3 text-right text-slate-300 print:text-gray-700 font-medium">{t.count}</td>
                <td className="py-3 text-right text-teal-400 print:text-teal-600 font-medium">{t.completed}</td>
                <td className="py-3 text-right text-red-400 print:text-red-500 font-medium">{t.cancelled}</td>
                <td className="py-3 text-right text-slate-400 print:text-gray-500">{t.share.toFixed(1)}%</td>
                <td className="py-3 text-right text-slate-300 print:text-gray-600 tabular-nums">{formatCurrency(t.avgRevenue)}</td>
                <td className="py-3 text-right font-bold text-emerald-400 print:text-emerald-600 tabular-nums">{formatCurrency(t.revenue)}</td>
                <td className="py-3 pl-4 w-32 hidden sm:table-cell">
                  <div className="w-full h-2 bg-slate-700/40 print:bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 print:bg-emerald-500 rounded-full" style={{ width: `${(t.revenue / maxRevenue) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
            {stats.terrainStats.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 print:text-gray-400">Aucun terrain avec des données</td>
              </tr>
            )}
          </tbody>
          {stats.terrainStats.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-700/60 print:border-gray-300">
                <td className="pt-3 pb-1 font-semibold text-white print:text-gray-900">Total</td>
                <td className="pt-3 pb-1 text-right font-semibold text-white print:text-gray-900">{stats.total}</td>
                <td className="pt-3 pb-1 text-right font-semibold text-teal-400 print:text-teal-600">{stats.completed}</td>
                <td className="pt-3 pb-1 text-right font-semibold text-red-400 print:text-red-500">{stats.cancelled}</td>
                <td className="pt-3 pb-1 text-right text-slate-400 print:text-gray-500">100%</td>
                <td className="pt-3 pb-1 text-right font-semibold text-white print:text-gray-900 tabular-nums">{formatCurrency(stats.averageRevenueTTC)}</td>
                <td className="pt-3 pb-1 text-right font-bold text-emerald-400 print:text-emerald-600 tabular-nums">{formatCurrency(stats.totalRevenueTTC)}</td>
                <td className="hidden sm:table-cell" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportCard>
  );
};

/* ============================================================ */
/* TOP CLIENTS                                                   */
/* ============================================================ */
const TopClientsCard: React.FC<{ stats: ReportStats }> = ({ stats }) => (
  <ReportCard title="Top 10 Clients" icon={<Users className="w-4 h-4" />} fullWidth>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/60 print:border-gray-200">
            {['#', 'Client', 'Téléphone', 'Réservations', 'Revenu TTC', 'Dernière visite'].map(h => (
              <th key={h} className={`pb-3 text-xs font-semibold text-slate-500 print:text-gray-400 uppercase tracking-wide ${['#', 'Client', 'Téléphone'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30 print:divide-gray-100">
          {stats.topClients.map((c, i) => (
            <tr key={i} className="hover:bg-slate-700/20 print:hover:bg-transparent transition-colors">
              <td className="py-3 pr-3">
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                  i === 0 ? 'bg-amber-500/20 text-amber-400 print:bg-amber-100 print:text-amber-600'
                  : i === 1 ? 'bg-slate-500/20 text-slate-400 print:bg-gray-100 print:text-gray-500'
                  : i === 2 ? 'bg-orange-500/20 text-orange-400 print:bg-orange-50 print:text-orange-500'
                  : 'bg-slate-700/40 text-slate-500 print:bg-gray-50 print:text-gray-400'
                }`}>{i + 1}</span>
              </td>
              <td className="py-3">
                <p className="font-medium text-white print:text-gray-900">{c.name}</p>
              </td>
              <td className="py-3 text-slate-400 print:text-gray-500">{c.phone || '—'}</td>
              <td className="py-3 text-right font-medium text-white print:text-gray-800">{c.count}</td>
              <td className="py-3 text-right font-bold text-emerald-400 print:text-emerald-600 tabular-nums">{formatCurrency(c.revenue)} CFA</td>
              <td className="py-3 text-right text-slate-400 print:text-gray-500">{formatDate(c.lastVisit)}</td>
            </tr>
          ))}
          {stats.topClients.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-slate-500 print:text-gray-400">Aucun client enregistré</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </ReportCard>
);

/* ============================================================ */
/* PAYMENT METHODS                                               */
/* ============================================================ */
const PaymentMethodsCard: React.FC<{ stats: ReportStats }> = ({ stats }) => (
  <ReportCard title="Modes de Paiement" icon={<CreditCard className="w-4 h-4" />}>
    <div className="space-y-3">
      {stats.paymentMethodStats.map(m => (
        <div key={m.method}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-slate-300 print:text-gray-700">{m.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 print:text-gray-400 tabular-nums">{formatCurrency(m.revenue)} CFA</span>
              <span className="text-sm font-semibold text-white print:text-gray-900 w-12 text-right">{m.percentage.toFixed(1)}%</span>
            </div>
          </div>
          <div className="w-full h-2 bg-slate-700/50 print:bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 print:bg-sky-500 rounded-full" style={{ width: `${m.percentage}%` }} />
          </div>
        </div>
      ))}
      {stats.paymentMethodStats.length === 0 && (
        <p className="text-sm text-slate-500 print:text-gray-400 text-center py-4">Aucune donnée de paiement</p>
      )}
    </div>
  </ReportCard>
);

/* ============================================================ */
/* RESERVATIONS TABLE                                            */
/* ============================================================ */
interface ReservationsTableCardProps {
  reservations: import('../../lib/supabase').Reservation[];
  terrains: import('../../lib/supabase').Terrain[];
  printAll?: boolean;
}

const ReservationsTableCard: React.FC<ReservationsTableCardProps> = ({ reservations, terrains, printAll }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = printAll || showAll ? reservations : reservations.slice(0, 50);

  return (
    <ReportCard title={`Détail des Réservations (${reservations.length})`} icon={<FileText className="w-4 h-4" />} fullWidth padding="none">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/60 print:border-gray-200">
              {['Date/Heure début', 'Durée', 'Client', 'Téléphone', 'Terrain', 'Montant HT', 'TVA', 'Montant TTC', 'Paiement', 'Statut'].map(h => (
                <th key={h} className={`py-3 px-3 text-[10px] sm:text-xs font-semibold text-slate-500 print:text-gray-400 uppercase tracking-wide whitespace-nowrap ${['Date/Heure début', 'Client', 'Téléphone', 'Terrain'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/20 print:divide-gray-100">
            {visible.map(r => {
              const terrain = terrains.find(t => t.id === r.terrain_id);
              const sc = STATUS_CONFIG[r.statut];
              const pm = (r as Record<string, unknown>)['payment_method'] as string | undefined;
              const ps = (r as Record<string, unknown>)['payment_status'] as string | undefined;
              return (
                <tr key={r.id} className="hover:bg-slate-700/10 print:hover:bg-transparent transition-colors">
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <p className="text-slate-200 print:text-gray-800 font-medium text-xs">{formatDate(r.date_debut)}</p>
                    <p className="text-slate-500 print:text-gray-400 text-[10px]">
                      {new Date(r.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400 print:text-gray-500 text-xs whitespace-nowrap">
                    {formatDuration(r.date_debut, r.date_fin)}
                  </td>
                  <td className="py-2.5 px-3">
                    <p className="font-medium text-white print:text-gray-900 text-xs">{r.client_name}</p>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 print:text-gray-500 text-xs whitespace-nowrap">{r.client_phone || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-300 print:text-gray-700 text-xs whitespace-nowrap">{terrain?.name ?? '—'}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300 print:text-gray-600 tabular-nums text-xs whitespace-nowrap">
                    {r.statut !== 'annulé' ? formatCurrency(Number(r.tarif_total)) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500 print:text-gray-400 tabular-nums text-xs whitespace-nowrap">
                    {r.tva_applicable && r.statut !== 'annulé' ? formatCurrency(Number(r.montant_tva)) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-white print:text-gray-900 tabular-nums text-xs whitespace-nowrap">
                    {r.statut !== 'annulé' ? `${formatCurrency(Number(r.montant_ttc))} CFA` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs whitespace-nowrap">
                    {ps ? (
                      <span className={`text-[10px] font-medium ${
                        ps === 'PAID' ? 'text-emerald-400 print:text-emerald-600'
                        : ps === 'PARTIAL' ? 'text-amber-400 print:text-amber-600'
                        : 'text-slate-400 print:text-gray-400'
                      }`}>{PAYMENT_STATUS_LABEL[ps] ?? ps}</span>
                    ) : '—'}
                    {pm && <p className="text-[10px] text-slate-500 print:text-gray-400">{PAYMENT_METHOD_LABEL[pm] ?? pm}</p>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
                      style={{
                        backgroundColor: `${sc?.dot ?? '#6b7280'}20`,
                        color: sc?.dot ?? '#6b7280',
                        border: `1px solid ${sc?.dot ?? '#6b7280'}40`,
                      }}
                    >
                      {sc?.label ?? r.statut}
                    </span>
                  </td>
                </tr>
              );
            })}
            {reservations.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-500 print:text-gray-400">
                  Aucune réservation trouvée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!printAll && reservations.length > 50 && !showAll && (
        <div className="px-5 py-4 border-t border-slate-700/40 print:hidden flex items-center justify-between">
          <p className="text-xs text-slate-500">Affichage de 50 sur {reservations.length} réservations</p>
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
          >
            <ChevronDown className="w-3.5 h-3.5" /> Tout afficher
          </button>
        </div>
      )}
    </ReportCard>
  );
};

/* ============================================================ */
/* SHARED CARD WRAPPER                                           */
/* ============================================================ */
interface ReportCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
  padding?: 'none' | 'default';
}

const ReportCard: React.FC<ReportCardProps> = ({ title, icon, children, padding = 'default' }) => (
  <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl print:bg-white print:border print:border-gray-200 print:shadow-sm overflow-hidden">
    <div className={`flex items-center gap-2.5 px-5 py-4 border-b border-slate-700/40 print:border-gray-100 ${padding === 'none' ? '' : ''}`}>
      <div className="w-8 h-8 rounded-xl bg-slate-700/60 print:bg-gray-50 print:border print:border-gray-200 flex items-center justify-center text-slate-400 print:text-gray-500 shrink-0">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-white print:text-gray-900">{title}</h3>
    </div>
    <div className={padding === 'none' ? '' : 'p-5'}>
      {children}
    </div>
  </div>
);

/* ============================================================ */
/* PRINT SECTION WRAPPER                                         */
/* ============================================================ */
const PrintSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="print-section">
    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-gray-100">
      <span className="text-gray-400">{icon}</span>
      <h2 className="text-base font-bold text-gray-800 uppercase tracking-wider">{title}</h2>
    </div>
    {children}
  </div>
);
