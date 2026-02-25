import { useState, useMemo } from 'react';
import { Search, Filter, Eye, CreditCard, FileText, CheckCircle, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Reservation } from '../../types';
import { format, parseISO } from '../utils/dateUtils';

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente', libre: 'Libre', réservé: 'Réservé',
  check_in: 'En cours', check_out: 'Check-out', terminé: 'Terminé',
  annulé: 'Annulé', bloqué: 'Bloqué',
};

const STATUT_COLORS: Record<string, string> = {
  réservé: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  check_in: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  en_attente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  terminé: 'bg-slate-700/50 text-slate-400 border-slate-600/20',
  annulé: 'bg-red-500/10 text-red-400 border-red-500/20',
  bloqué: 'bg-slate-800/50 text-slate-500 border-slate-700/20',
};

const PAYMENT_LABELS: Record<string, string> = { UNPAID: 'Non payé', PARTIAL: 'Partiel', PAID: 'Payé' };
const PAYMENT_COLORS: Record<string, string> = {
  UNPAID: 'text-red-400', PARTIAL: 'text-amber-400', PAID: 'text-emerald-400',
};

export function ClientMenu() {
  const { reservations, encaissements, refreshReservations, refreshEncaissements } = useData();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('especes');
  const [loading, setLoading] = useState(false);

  const canManage = hasPermission('manage_reservations');
  const canPay = hasPermission('manage_payments');

  const filtered = useMemo(() => reservations.filter((r) => {
    const matchSearch = r.client_name.toLowerCase().includes(search.toLowerCase()) ||
      r.client_phone.includes(search) ||
      r.code_court?.toLowerCase().includes(search.toLowerCase()) ||
      r.terrain?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === 'all' || r.statut === filterStatut;
    const matchPayment = filterPayment === 'all' || r.payment_status === filterPayment;
    return matchSearch && matchStatut && matchPayment;
  }), [reservations, search, filterStatut, filterPayment]);

  const getEncaissementsForRes = (resId: string) =>
    encaissements.filter((e) => e.reservation_id === resId);

  const handlePay = async () => {
    if (!selected) return;
    setLoading(true);
    const amount = parseFloat(payAmount);
    const total = getEncaissementsForRes(selected.id).reduce((s, e) => s + e.montant_total, 0) + amount;
    const newStatus = total >= selected.amount_due ? 'PAID' : total > 0 ? 'PARTIAL' : 'UNPAID';

    try {
      const { error: encErr } = await supabase.from('encaissements').insert({
        reservation_id: selected.id,
        montant_total: amount,
        mode_paiement: payMethod,
      });
      if (encErr) throw encErr;

      const { error: resErr } = await supabase.from('reservations').update({
        payment_status: newStatus,
        amount_paid: total,
      }).eq('id', selected.id);
      if (resErr) throw resErr;

      await Promise.all([refreshReservations(), refreshEncaissements()]);
      setShowPayModal(false);
      setPayAmount('');
      setSelected(null);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Réservations</h1>
        <p className="text-slate-400 text-sm mt-0.5">{reservations.length} réservation{reservations.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">Tous les paiements</option>
          {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Client</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">Terrain</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Date</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Statut</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Montant</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">Paiement</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-200">{r.client_name}</p>
                    <p className="text-xs text-slate-500">{r.client_phone}</p>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <p className="text-sm text-slate-300">{r.terrain?.name || '-'}</p>
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <p className="text-sm text-slate-300">{format(parseISO(r.date_debut), 'dd/MM HH:mm')}</p>
                    <p className="text-xs text-slate-500">{format(parseISO(r.date_fin), 'HH:mm')}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUT_COLORS[r.statut] || STATUT_COLORS.réservé}`}>
                      {STATUT_LABELS[r.statut] || r.statut}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right hidden sm:table-cell">
                    <p className="text-sm font-medium text-slate-200">{new Intl.NumberFormat('fr-FR').format(r.amount_due)}</p>
                    <p className="text-xs text-slate-500">FCFA</p>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className={`text-xs font-medium ${PAYMENT_COLORS[r.payment_status]}`}>
                      {PAYMENT_LABELS[r.payment_status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canPay && r.payment_status !== 'PAID' && !['annulé', 'terminé'].includes(r.statut) && (
                        <button
                          onClick={() => { setSelected(r); setShowPayModal(true); }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                          title="Encaisser"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500 text-sm">
                    Aucune réservation trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPayModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">Encaisser un paiement</h2>
              <button onClick={() => { setShowPayModal(false); setSelected(null); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-3 text-sm">
                <p className="text-slate-400">{selected.client_name}</p>
                <p className="text-white font-medium">{selected.terrain?.name}</p>
                <p className="text-slate-400 text-xs mt-1">
                  Dû: {new Intl.NumberFormat('fr-FR').format(selected.amount_due)} FCFA —
                  Payé: {new Intl.NumberFormat('fr-FR').format(selected.amount_paid)} FCFA
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Montant (FCFA)</label>
                <input
                  type="number"
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={String(selected.amount_due - selected.amount_paid)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Mode de paiement</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="especes">Espèces</option>
                  <option value="wave">Wave</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="mixte">Mixte</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowPayModal(false); setSelected(null); }} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Annuler</button>
                <button onClick={handlePay} disabled={loading || !payAmount} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Encaisser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
