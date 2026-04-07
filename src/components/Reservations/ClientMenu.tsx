import { useState, useMemo } from 'react';
import { Search, CreditCard, X, Loader2, LogIn, LogOut, RotateCcw, ChevronDown, FileText, Trash2 } from 'lucide-react';
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
  réservé: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  check_in: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  en_attente: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  terminé: 'bg-slate-700/50 text-slate-400 border border-slate-600/30',
  annulé: 'bg-red-500/20 text-red-300 border border-red-500/30',
  bloqué: 'bg-slate-800/50 text-slate-500 border border-slate-700/30',
};

const PAYMENT_LABELS: Record<string, string> = { UNPAID: 'Non payé', PARTIAL: 'Partiel', PAID: 'Payé' };
const PAYMENT_COLORS: Record<string, string> = {
  UNPAID: 'bg-red-500/20 text-red-400 border border-red-500/30',
  PARTIAL: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  PAID: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
};

const NEW_BADGE_WINDOW_MS = 15 * 60 * 1000;

function isNew(r: Reservation): boolean {
  return r.statut === 'en_attente' && Date.now() - new Date(r.created_at).getTime() < NEW_BADGE_WINDOW_MS;
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n);
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

function formatDate(iso: string) {
  const d = parseISO(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDay.getTime() === today.getTime()) return "Aujourd'hui";
  if (dDay.getTime() === tomorrow.getTime()) return 'Demain';
  return format(d, 'dd/MM/yyyy');
}

function isSameDay(a: string, b: string) {
  const da = parseISO(a); const db = parseISO(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

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
  const canDelete = hasPermission('cancel_reservations');

  const filtered = useMemo(() => {
    const list = reservations.filter((r) => {
      const matchSearch = r.client_name.toLowerCase().includes(search.toLowerCase()) ||
        r.client_phone.includes(search) ||
        r.code_court?.toLowerCase().includes(search.toLowerCase()) ||
        r.terrain?.name?.toLowerCase().includes(search.toLowerCase());
      const matchStatut = filterStatut === 'all' || r.statut === filterStatut;
      const matchPayment = filterPayment === 'all' || r.payment_status === filterPayment;
      return matchSearch && matchStatut && matchPayment;
    });
    return [...list].sort((a, b) => {
      const aNew = isNew(a) ? 1 : 0;
      const bNew = isNew(b) ? 1 : 0;
      if (bNew !== aNew) return bNew - aNew;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [reservations, search, filterStatut, filterPayment]);

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
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleStatusChange = async (r: Reservation, newStatut: string) => {
    await supabase.from('reservations').update({ statut: newStatut }).eq('id', r.id);
    await refreshReservations();
  };

  const handleDelete = async (r: Reservation) => {
    if (!window.confirm('Annuler cette réservation ?')) return;
    await supabase.from('reservations').update({ statut: 'annulé' }).eq('id', r.id);
    await refreshReservations();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Réservations</h1>
        <p className="text-slate-400 text-sm mt-0.5">{reservations.length} réservation{reservations.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher client, téléphone, code..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Tous les paiements</option>
          {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((r) => {
          const reste = r.amount_due - r.amount_paid;
          const sameDay = isSameDay(r.date_debut, r.date_fin);
          const debut = parseISO(r.date_debut);
          const fin = parseISO(r.date_fin);
          const timeStr = `${format(debut, 'HH:mm')} – ${format(fin, 'HH:mm')}`;
          const dateStr = sameDay
            ? formatDate(r.date_debut)
            : `${format(debut, 'dd/MM')} → ${format(fin, 'dd/MM')}`;

          const borderColor =
            r.statut === 'check_in' ? 'border-l-emerald-500' :
            r.statut === 'réservé' ? 'border-l-blue-500' :
            r.statut === 'en_attente' ? 'border-l-amber-500' :
            r.statut === 'annulé' ? 'border-l-red-500' :
            'border-l-slate-600';

          return (
            <div
              key={r.id}
              className={`bg-slate-900 border border-slate-800 border-l-4 ${borderColor} rounded-2xl overflow-hidden`}
            >
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {getInitial(r.client_name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{r.client_name}</span>
                        {isNew(r) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">
                            Nouveau
                          </span>
                        )}
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${PAYMENT_COLORS[r.payment_status]}`}>
                          {PAYMENT_LABELS[r.payment_status]}
                        </span>
                        {reste > 0 && (
                          <span className="text-[11px] font-semibold text-slate-300">
                            Reste: <span className="text-white">{fmt(reste)} CFA</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1 ${STATUT_COLORS[r.statut] || STATUT_COLORS.réservé}`}>
                    {r.statut === 'réservé' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
                    {r.statut === 'check_in' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
                    {STATUT_LABELS[r.statut] || r.statut}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-600">📞</span>
                      {r.client_phone}
                    </span>
                    {r.code_court && (
                      <span className="text-[11px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700">
                        #{r.code_court}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-600">📍</span>
                      {r.terrain?.name || '—'}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-600">📅</span>
                      {dateStr}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-600">🕐</span>
                      {timeStr}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {fmt(r.amount_due)} <span className="text-xs text-slate-400 font-normal">CFA</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-2 flex-wrap">
                {canManage && r.statut === 'réservé' && (
                  <button
                    onClick={() => handleStatusChange(r, 'check_in')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-semibold transition-all"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Check-in
                  </button>
                )}
                {canManage && r.statut === 'check_in' && (
                  <button
                    onClick={() => handleStatusChange(r, 'terminé')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-semibold transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Check-out
                  </button>
                )}
                {canManage && r.statut === 'annulé' && (
                  <button
                    onClick={() => handleStatusChange(r, 'réservé')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Rétablir
                  </button>
                )}

                <div className="flex items-center gap-1.5 ml-auto">
                  {canPay && r.payment_status !== 'PAID' && !['annulé', 'terminé'].includes(r.statut) && (
                    <button
                      onClick={() => { setSelected(r); setShowPayModal(true); }}
                      className="flex items-center gap-1 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition-all border border-slate-700"
                      title="Encaisser"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>
                  )}
                  <button
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs transition-all border border-slate-700"
                    title="Facture"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  {canDelete && !['annulé', 'terminé'].includes(r.statut) && (
                    <button
                      onClick={() => handleDelete(r)}
                      className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl text-xs transition-all border border-slate-700 hover:border-red-500/30"
                      title="Annuler"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm">
            Aucune réservation trouvée
          </div>
        )}
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
                  Dû: {fmt(selected.amount_due)} FCFA — Payé: {fmt(selected.amount_paid)} FCFA
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
