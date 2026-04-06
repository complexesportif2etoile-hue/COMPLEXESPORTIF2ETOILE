import { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { TrendingUp, TrendingDown, Calendar, CreditCard, BarChart2 } from 'lucide-react';
import { format, parseISO } from '../utils/dateUtils';

type Period = 'today' | 'week' | 'month' | 'year';

export function Reports() {
  const { reservations, encaissements, terrains, clients, depenses } = useData();
  const [period, setPeriod] = useState<Period>('month');

  const periodRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    switch (period) {
      case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        d.setHours(0, 0, 0, 0);
        start = d;
        break;
      }
      case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'year': start = new Date(now.getFullYear(), 0, 1); break;
    }
    return { start, end: now };
  }, [period]);

  const stats = useMemo(() => {
    const { start, end } = periodRange;

    const periodRes = reservations.filter((r) => {
      const d = new Date(r.date_debut);
      return d >= start && d <= end;
    });

    const periodEnc = encaissements.filter((e) => {
      const d = new Date(e.created_at);
      return d >= start && d <= end;
    });

    const periodDep = depenses.filter((d) => {
      const dep = new Date(d.date_depense);
      return dep >= start && dep <= end;
    });

    const totalRevenue = periodEnc.reduce((s, e) => s + e.montant_total, 0);
    const totalDepenses = periodDep.reduce((s, d) => s + d.montant, 0);
    const beneficeNet = totalRevenue - totalDepenses;

    const completed = periodRes.filter((r) => ['terminé', 'check_out'].includes(r.statut)).length;
    const cancelled = periodRes.filter((r) => r.statut === 'annulé').length;
    const unpaid = periodRes.filter((r) => r.payment_status === 'UNPAID' && !['annulé'].includes(r.statut)).length;

    const byTerrain = terrains.map((t) => {
      const tres = periodRes.filter((r) => r.terrain_id === t.id && r.statut !== 'annulé');
      const trev = periodEnc
        .filter((e) => tres.some((r) => r.id === e.reservation_id))
        .reduce((s, e) => s + e.montant_total, 0);
      return { terrain: t, count: tres.length, revenue: trev };
    }).sort((a, b) => b.revenue - a.revenue);

    const payMethods: Record<string, number> = {};
    periodEnc.forEach((e) => {
      payMethods[e.mode_paiement] = (payMethods[e.mode_paiement] || 0) + e.montant_total;
    });

    const depByCategorie: Record<string, number> = {};
    periodDep.forEach((d) => {
      depByCategorie[d.categorie] = (depByCategorie[d.categorie] || 0) + d.montant;
    });

    return { periodRes, totalRevenue, totalDepenses, beneficeNet, completed, cancelled, unpaid, byTerrain, payMethods, depByCategorie };
  }, [reservations, encaissements, depenses, terrains, periodRange]);

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

  const PERIOD_LABELS: Record<Period, string> = { today: "Aujourd'hui", week: '7 derniers jours', month: 'Ce mois', year: 'Cette année' };

  const PAY_METHOD_LABELS: Record<string, string> = {
    especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', mixte: 'Mixte', autre: 'Autre',
  };

  const DEP_CAT_LABELS: Record<string, string> = {
    salaires: 'Salaires', entretien: 'Entretien', electricite: 'Électricité',
    eau: 'Eau', loyer: 'Loyer', equipement: 'Équipement', fournitures: 'Fournitures', autre: 'Autre',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Rapports</h1>
          <p className="text-slate-400 text-sm mt-0.5">Analyse des performances</p>
        </div>
        <div className="flex bg-slate-800 rounded-xl border border-slate-700 p-1 gap-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Encaissements" value={`${fmt(stats.totalRevenue)} FCFA`} icon={TrendingUp} color="emerald" />
        <StatCard label="Dépenses" value={`${fmt(stats.totalDepenses)} FCFA`} icon={TrendingDown} color="red" />
        <StatCard label="Réservations" value={stats.periodRes.length} icon={Calendar} color="blue" />
        <StatCard label="Impayées" value={stats.unpaid} icon={CreditCard} color="amber" />
      </div>

      <div className={`rounded-2xl border p-5 ${stats.beneficeNet >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">Bénéfice net ({PERIOD_LABELS[period]})</p>
            <p className={`text-3xl font-bold ${stats.beneficeNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stats.beneficeNet >= 0 ? '+' : ''}{fmt(stats.beneficeNet)} FCFA
            </p>
          </div>
          <div className={`text-xs px-3 py-1.5 rounded-full border font-medium ${stats.beneficeNet >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {stats.totalRevenue > 0 ? `${Math.round((stats.beneficeNet / stats.totalRevenue) * 100)}% de marge` : 'Aucun encaissement'}
          </div>
        </div>
        <div className="mt-3 flex gap-6 text-xs text-slate-500">
          <span>Encaissements : <span className="text-emerald-400 font-medium">{fmt(stats.totalRevenue)} FCFA</span></span>
          <span>Dépenses : <span className="text-red-400 font-medium">{fmt(stats.totalDepenses)} FCFA</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            Dépenses par catégorie
          </h2>
          <div className="space-y-3">
            {Object.entries(stats.depByCategorie).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => {
              const pct = stats.totalDepenses > 0 ? Math.round((amount / stats.totalDepenses) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{DEP_CAT_LABELS[cat] || cat}</span>
                    <span className="text-slate-400">{pct}% — <span className="text-red-400 font-medium">{fmt(amount)} FCFA</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(stats.depByCategorie).length === 0 && <p className="text-slate-500 text-sm">Aucune dépense</p>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4">Revenus par terrain</h2>
          <div className="space-y-3">
            {stats.byTerrain.map(({ terrain, count, revenue }) => {
              const maxRev = Math.max(...stats.byTerrain.map((b) => b.revenue), 1);
              const pct = Math.round((revenue / maxRev) * 100);
              return (
                <div key={terrain.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{terrain.name}</span>
                    <span className="text-slate-400">{count} rés. — <span className="text-emerald-400 font-medium">{fmt(revenue)} FCFA</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {stats.byTerrain.length === 0 && <p className="text-slate-500 text-sm">Aucune donnée</p>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4">Modes de paiement</h2>
          <div className="space-y-3">
            {Object.entries(stats.payMethods).map(([method, amount]) => {
              const total = Object.values(stats.payMethods).reduce((s, a) => s + a, 0) || 1;
              const pct = Math.round((amount / total) * 100);
              return (
                <div key={method}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{PAY_METHOD_LABELS[method] || method}</span>
                    <span className="text-slate-400">{pct}% — <span className="text-blue-400 font-medium">{fmt(amount)} FCFA</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(stats.payMethods).length === 0 && <p className="text-slate-500 text-sm">Aucun encaissement</p>}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Réservations récentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Client</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">Terrain</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Date</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">Montant</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Paiement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {stats.periodRes.slice(0, 10).map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm text-slate-200">{r.client_name}</p>
                    <p className="text-xs text-slate-500">{r.statut}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-300 hidden md:table-cell">{r.terrain?.name}</td>
                  <td className="px-5 py-3 text-sm text-slate-300 hidden sm:table-cell">{format(parseISO(r.date_debut), 'dd/MM/yyyy')}</td>
                  <td className="px-5 py-3 text-right text-sm font-medium text-slate-200">{fmt(r.amount_due)} FCFA</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${r.payment_status === 'PAID' ? 'text-emerald-400' : r.payment_status === 'PARTIAL' ? 'text-amber-400' : 'text-red-400'}`}>
                      {r.payment_status === 'PAID' ? 'Payé' : r.payment_status === 'PARTIAL' ? 'Partiel' : 'Impayé'}
                    </span>
                  </td>
                </tr>
              ))}
              {stats.periodRes.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500 text-sm">Aucune réservation sur cette période</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
    amber: 'bg-amber-500/10 text-amber-400',
    red: 'bg-red-500/10 text-red-400',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <p className="text-xl font-bold text-white mb-0.5">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
