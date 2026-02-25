import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ArrowRightLeft, CreditCard, FileText,
  Phone, Clock, Search, MapPin, Calendar, Filter, X,
  ChevronDown, CheckCircle2, AlertCircle, Timer, LogIn, LogOut, Ban, Lock,
  Banknote, Smartphone, Wallet, Check, ChevronUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { CountdownTimer } from '../ui/CountdownTimer';
import { ClientReservationForm } from './ClientReservationForm';
import { StatusChangeModal } from './StatusChangeModal';
import { PaymentModal } from './PaymentModal';
import { InvoiceModal } from './InvoiceModal';

interface Reservation {
  id: string;
  client_name: string;
  client_phone: string;
  terrain_id: string;
  date_debut: string;
  date_fin: string;
  tarif_total: number;
  tva_applicable: boolean;
  montant_tva: number;
  montant_ttc: number;
  statut: string;
  notes: string;
  code_court?: string | null;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  dot: string;
  bg: string;
  text: string;
  border: string;
  cardBorder: string;
}> = {
  'en_attente': {
    label: 'En attente',
    icon: AlertCircle,
    dot: 'bg-amber-400 animate-pulse',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    cardBorder: 'border-l-amber-400',
  },
  'réservé': {
    label: 'Reservé',
    icon: CheckCircle2,
    dot: 'bg-blue-400',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    cardBorder: 'border-l-blue-400',
  },
  'check_in': {
    label: 'Check-in',
    icon: LogIn,
    dot: 'bg-emerald-400 animate-pulse',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    cardBorder: 'border-l-emerald-400',
  },
  'check_out': {
    label: 'Check-out',
    icon: LogOut,
    dot: 'bg-teal-400',
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/20',
    cardBorder: 'border-l-teal-400',
  },
  'terminé': {
    label: 'Terminé',
    icon: CheckCircle2,
    dot: 'bg-slate-400',
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/20',
    cardBorder: 'border-l-slate-500',
  },
  'annulé': {
    label: 'Annulé',
    icon: Ban,
    dot: 'bg-red-400',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    cardBorder: 'border-l-red-400',
  },
  'bloqué': {
    label: 'Bloqué',
    icon: Lock,
    dot: 'bg-slate-400',
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/20',
    cardBorder: 'border-l-slate-500',
  },
};

const ACTIVE_STATUSES = ['en_attente', 'réservé', 'check_in', 'check_out'];
const CLOSED_STATUSES = ['terminé', 'annulé', 'bloqué'];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (same(d, today)) return "Aujourd'hui";
  if (same(d, tomorrow)) return 'Demain';
  if (same(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('fr-FR').format(val);
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export const ClientMenu: React.FC = () => {
  const { reservations, terrainsMap, refreshReservations, refreshClients } = useData();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [statusModal, setStatusModal] = useState<Reservation | null>(null);
  const [paymentModal, setPaymentModal] = useState<Reservation | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<Reservation | null>(null);
  const [filterTerrain, setFilterTerrain] = useState('');

  const terrainOptions = useMemo(() => {
    const ids = [...new Set(reservations.map(r => r.terrain_id))];
    return ids.map(id => ({ id, name: terrainsMap[id] || id })).sort((a, b) => a.name.localeCompare(b.name));
  }, [reservations, terrainsMap]);

  const filtered = useMemo(() => {
    let list = reservations;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.client_name.toLowerCase().includes(q) ||
        r.client_phone.includes(q) ||
        (terrainsMap[r.terrain_id] || '').toLowerCase().includes(q) ||
        (r.code_court && r.code_court.toLowerCase().includes(q))
      );
    }
    if (filterTerrain) {
      list = list.filter(r => r.terrain_id === filterTerrain);
    }
    return list;
  }, [reservations, search, filterTerrain, terrainsMap]);

  const activeReservations = useMemo(() =>
    filtered.filter(r => ACTIVE_STATUSES.includes(r.statut))
      .sort((a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime()),
    [filtered]
  );

  const closedReservations = useMemo(() =>
    filtered.filter(r => CLOSED_STATUSES.includes(r.statut))
      .sort((a, b) => new Date(b.date_debut).getTime() - new Date(a.date_debut).getTime()),
    [filtered]
  );

  const statusCounts = useMemo(() =>
    reservations.reduce<Record<string, number>>((acc, r) => {
      acc[r.statut] = (acc[r.statut] || 0) + 1;
      return acc;
    }, {}),
    [reservations]
  );

  const pendingCount = statusCounts['en_attente'] || 0;
  const activeCount = (statusCounts['check_in'] || 0);

  const deleteReservation = async (id: string) => {
    if (!confirm('Supprimer cette reservation ?')) return;
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (!error) refreshReservations();
  };

  const hasFilters = search.trim() !== '' || filterTerrain !== '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Reservations</h1>
          <div className="flex items-center gap-3 mt-1">
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {pendingCount} en attente
              </span>
            )}
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {activeCount} en cours
              </span>
            )}
            {pendingCount === 0 && activeCount === 0 && (
              <span className="text-xs text-slate-500">{reservations.length} au total</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle</span>
        </button>
      </div>

      {/* Search & Filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Client, telephone, terrain, code..."
            className="w-full pl-9 pr-9 h-10 bg-slate-800/60 border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 text-sm transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {terrainOptions.length > 1 && (
          <div className="relative">
            <select
              value={filterTerrain}
              onChange={e => setFilterTerrain(e.target.value)}
              className="h-10 pl-3 pr-7 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 appearance-none cursor-pointer"
            >
              <option value="">Tous les terrains</option>
              {terrainOptions.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        )}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterTerrain(''); }}
            className="h-10 px-3 text-xs text-slate-400 hover:text-white bg-slate-800/60 border border-slate-700/60 rounded-xl transition-colors"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Active reservations */}
      {activeReservations.length === 0 && closedReservations.length === 0 ? (
        <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-white font-medium">Aucune reservation trouvee</p>
          <p className="text-sm text-slate-500 mt-1">
            {hasFilters ? 'Essayez un autre terme' : 'Commencez par creer une reservation'}
          </p>
          {!hasFilters && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvelle reservation
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {activeReservations.map(reservation => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              terrainName={terrainsMap[reservation.terrain_id] || 'Terrain'}
              isAdmin={isAdmin}
              onStatusChange={() => setStatusModal(reservation as Reservation)}
              onPayment={() => setPaymentModal(reservation as Reservation)}
              onInvoice={() => setInvoiceModal(reservation as Reservation)}
              onDelete={() => deleteReservation(reservation.id)}
              onExpire={refreshReservations}
            />
          ))}

          {/* Closed reservations toggle */}
          {closedReservations.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowClosed(v => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-800/30 border border-slate-700/40 text-sm text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 transition-all duration-200"
              >
                <span className="font-medium">Historique ({closedReservations.length})</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showClosed ? 'rotate-180' : ''}`} />
              </button>
              {showClosed && (
                <div className="mt-2 space-y-2">
                  {closedReservations.map(reservation => (
                    <ReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      terrainName={terrainsMap[reservation.terrain_id] || 'Terrain'}
                      isAdmin={isAdmin}
                      onStatusChange={() => setStatusModal(reservation as Reservation)}
                      onPayment={() => setPaymentModal(reservation as Reservation)}
                      onInvoice={() => setInvoiceModal(reservation as Reservation)}
                      onDelete={() => deleteReservation(reservation.id)}
                      onExpire={refreshReservations}
                      muted
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <ClientReservationForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            refreshReservations();
            refreshClients();
          }}
        />
      )}

      {statusModal && (
        <StatusChangeModal
          reservation={statusModal}
          onClose={() => setStatusModal(null)}
          onSuccess={() => { setStatusModal(null); refreshReservations(); }}
        />
      )}

      {paymentModal && (
        <PaymentModal
          reservation={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => { setPaymentModal(null); refreshReservations(); }}
        />
      )}

      {invoiceModal && (
        <InvoiceModal
          reservation={invoiceModal}
          terrainName={terrainsMap[invoiceModal.terrain_id] || 'Terrain'}
          onClose={() => setInvoiceModal(null)}
        />
      )}
    </div>
  );
};

interface ReservationCardProps {
  reservation: Reservation;
  terrainName: string;
  isAdmin: boolean;
  onStatusChange: () => void;
  onPayment: () => void;
  onInvoice: () => void;
  onDelete: () => void;
  onExpire: () => void;
  muted?: boolean;
}

const INLINE_PAYMENT_METHODS = [
  { id: 'especes', label: 'Espèces', icon: Banknote },
  { id: 'orange_money', label: 'Orange Money', icon: Smartphone },
  { id: 'wave', label: 'Wave', icon: Wallet },
  { id: 'autre', label: 'Autre', icon: CreditCard },
];

interface PaymentSummary {
  totalPaid: number;
  remaining: number;
  count: number;
}

const ReservationCard: React.FC<ReservationCardProps> = ({
  reservation,
  terrainName,
  isAdmin,
  onStatusChange,
  onPayment,
  onInvoice,
  onDelete,
  onExpire,
  muted = false,
}) => {
  const { profile } = useAuth();
  const cfg = STATUS_CONFIG[reservation.statut] || STATUS_CONFIG['réservé'];
  const StatusIcon = cfg.icon;
  const isCheckIn = reservation.statut === 'check_in';
  const isPending = reservation.statut === 'en_attente';
  const isClosed = CLOSED_STATUSES.includes(reservation.statut);

  const dateLabel = formatDate(reservation.date_debut);
  const isMultiDay = reservation.date_debut.split('T')[0] !== reservation.date_fin.split('T')[0];

  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [isDeposit, setIsDeposit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');
  const [paymentHistory, setPaymentHistory] = useState<{ id: string; montant_total: number; mode_paiement: string; created_at: string }[]>([]);

  const loadPayments = useCallback(async () => {
    const { data } = await supabase
      .from('encaissements')
      .select('id, montant_total, mode_paiement, created_at')
      .eq('reservation_id', reservation.id)
      .order('created_at', { ascending: true });
    if (data) {
      const totalPaid = data.reduce((s, p) => s + Number(p.montant_total), 0);
      setPaymentSummary({
        totalPaid,
        remaining: Number(reservation.montant_ttc) - totalPaid,
        count: data.length,
      });
      setPaymentHistory(data);
    }
  }, [reservation.id, reservation.montant_ttc]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const ttc = Number(reservation.montant_ttc);
  const totalPaid = paymentSummary?.totalPaid ?? 0;
  const remaining = paymentSummary?.remaining ?? ttc;
  const progressPercent = ttc > 0 ? Math.min(100, Math.round((totalPaid / ttc) * 100)) : 0;

  const payStatus = totalPaid <= 0
    ? { label: 'Non payé', cls: 'text-red-400 bg-red-500/10 border-red-500/20' }
    : remaining <= 0.01
      ? { label: 'Payé', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
      : { label: 'Partiel', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };

  const handleTogglePanel = () => {
    setShowPaymentPanel(v => !v);
    setPayError('');
    setPaySuccess('');
  };

  const handleFullPayment = () => {
    setIsDeposit(false);
    setPaymentAmount(String(Math.max(0, remaining)));
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(paymentAmount);
    if (!num || num <= 0) { setPayError('Montant invalide'); return; }
    if (num > remaining + 0.01) { setPayError(`Maximum: ${formatCurrency(remaining)} CFA`); return; }
    setSubmitting(true);
    setPayError('');
    setPaySuccess('');
    const { error } = await supabase.from('encaissements').insert({
      reservation_id: reservation.id,
      montant_total: num,
      mode_paiement: paymentMethod,
      details_paiement: { type: isDeposit ? 'acompte' : 'paiement_total' },
      encaisse_par: profile?.id,
    });
    setSubmitting(false);
    if (error) { setPayError(error.message); return; }
    setPaymentAmount('');
    setPaySuccess(isDeposit ? 'Acompte enregistré !' : 'Paiement enregistré !');
    await loadPayments();
    onPayment();
    setTimeout(() => { setPaySuccess(''); setShowPaymentPanel(false); }, 1500);
  };

  const getMethodLabel = (id: string) => INLINE_PAYMENT_METHODS.find(m => m.id === id)?.label || id;

  return (
    <div
      className={`relative bg-slate-800/50 border border-slate-700/50 border-l-4 rounded-2xl overflow-hidden transition-all duration-200 ${cfg.cardBorder} ${muted ? 'opacity-60 hover:opacity-80' : 'hover:border-slate-600/60'}`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Left: avatar */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
            {reservation.client_name.charAt(0).toUpperCase()}
          </div>

          {/* Middle: main info */}
          <div className="flex-1 min-w-0">
            {/* Row 1: client name + payment badge + reste a payer + statut */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-white text-sm leading-tight truncate">{reservation.client_name}</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0 ${payStatus.cls}`}>
                {payStatus.label}
              </span>
              {remaining > 0.01 && (
                <span className="text-[10px] text-amber-400 font-semibold tabular-nums whitespace-nowrap">
                  Reste: {formatCurrency(remaining)} CFA
                </span>
              )}
              <span className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </span>
            </div>

            {/* Row 2: phone + code court */}
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <a
                href={`tel:${reservation.client_phone}`}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <Phone className="w-2.5 h-2.5" />
                {reservation.client_phone}
              </a>
              {reservation.code_court && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/50 border border-slate-600/40 text-[10px] font-mono font-bold text-slate-300 tracking-wider">
                  #{reservation.code_court}
                </span>
              )}
            </div>

            {/* Details row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <MapPin className="w-3 h-3 text-slate-500" />
                {terrainName}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                {isMultiDay
                  ? `${formatFullDate(reservation.date_debut)} → ${formatFullDate(reservation.date_fin)}`
                  : dateLabel
                }
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-slate-500" />
                {formatTime(reservation.date_debut)} – {formatTime(reservation.date_fin)}
              </span>
              <span className="font-semibold text-white ml-auto tabular-nums">
                {formatCurrency(ttc)} <span className="text-slate-500 font-normal">CFA</span>
              </span>
            </div>

            {/* Countdown for check_in */}
            {isCheckIn && (
              <div className="mt-2.5">
                <CountdownTimer endDate={reservation.date_fin} reservationId={reservation.id} onExpire={onExpire} />
              </div>
            )}

            {/* Notes snippet */}
            {reservation.notes && !isClosed && (
              <p className="mt-2 text-xs text-slate-500 italic truncate">{reservation.notes}</p>
            )}
          </div>
        </div>

        {/* Inline payment panel */}
        {showPaymentPanel && (
          <div className="mt-3 border border-slate-700/50 rounded-xl bg-slate-900/60 overflow-hidden">
            {/* Progress bar */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-slate-400 font-medium">Progression</span>
                <span className="text-[10px] font-bold text-emerald-400">{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div>
                  <p className="text-[9px] text-slate-500">Total TTC</p>
                  <p className="text-[11px] font-bold text-white tabular-nums">{formatCurrency(ttc)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500">Payé</p>
                  <p className="text-[11px] font-bold text-emerald-400 tabular-nums">{formatCurrency(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500">Restant</p>
                  <p className={`text-[11px] font-bold tabular-nums ${remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatCurrency(Math.max(0, remaining))}</p>
                </div>
              </div>
            </div>

            {/* Payment history */}
            {paymentHistory.length > 0 && (
              <div className="px-4 pb-2 space-y-1">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Historique</p>
                {paymentHistory.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-1 border-t border-slate-700/30">
                    <span className="text-[10px] text-slate-400">{getMethodLabel(p.mode_paiement)}</span>
                    <span className="text-[10px] text-slate-500">{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                    <span className="text-[11px] font-bold text-emerald-400 tabular-nums">{formatCurrency(Number(p.montant_total))} CFA</span>
                  </div>
                ))}
              </div>
            )}

            {/* Payment form */}
            {remaining > 0.01 ? (
              <form onSubmit={handleSubmitPayment} className="px-4 pb-3 pt-2 border-t border-slate-700/40 space-y-2.5">
                <div className="flex gap-2">
                  <button type="button" onClick={handleFullPayment}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${!isDeposit ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/30 text-slate-400 border-slate-700/50 hover:border-slate-600'}`}>
                    Paiement total
                  </button>
                  <button type="button" onClick={() => { setIsDeposit(true); setPaymentAmount(''); }}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${isDeposit ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-slate-700/30 text-slate-400 border-slate-700/50 hover:border-slate-600'}`}>
                    Acompte
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    min={1}
                    max={remaining}
                    placeholder={isDeposit ? 'Montant acompte' : `${formatCurrency(remaining)}`}
                    className="w-full px-3 py-2 pr-12 bg-slate-800/80 border border-slate-700/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">CFA</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {INLINE_PAYMENT_METHODS.map(m => {
                    const Icon = m.icon;
                    const sel = paymentMethod === m.id;
                    return (
                      <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${sel ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/20 text-slate-400 border-slate-700/40 hover:border-slate-600'}`}>
                        <Icon className="w-3 h-3" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                {payError && <p className="text-[11px] text-red-400 bg-red-500/10 rounded-lg px-3 py-1.5 border border-red-500/20">{payError}</p>}
                {paySuccess && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-1.5 border border-emerald-500/20">
                    <Check className="w-3 h-3" />{paySuccess}
                  </div>
                )}
                <button type="submit" disabled={submitting}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all active:scale-[0.98]">
                  {submitting ? 'Enregistrement...' : 'Enregistrer le paiement'}
                </button>
              </form>
            ) : (
              <div className="px-4 pb-3 pt-2 border-t border-slate-700/40 flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <Check className="w-3.5 h-3.5" />
                Paiement complet
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/40">
          {/* Primary action based on status */}
          {isPending && (
            <button
              onClick={onStatusChange}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-[0.98]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirmer
            </button>
          )}
          {reservation.statut === 'réservé' && (
            <button
              onClick={onStatusChange}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-[0.98]"
            >
              <LogIn className="w-3.5 h-3.5" />
              Check-in
            </button>
          )}
          {reservation.statut === 'check_in' && (
            <button
              onClick={onStatusChange}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-teal-600/90 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-[0.98]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Check-out
            </button>
          )}
          {reservation.statut === 'check_out' && (
            <button
              onClick={onStatusChange}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-600/90 hover:bg-slate-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-[0.98]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Terminer
            </button>
          )}

          {/* Secondary actions */}
          {!isClosed && reservation.statut !== 'check_out' && (
            <button
              onClick={onStatusChange}
              title="Changer le statut"
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-all"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleTogglePanel}
            title="Paiement"
            className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all ${showPaymentPanel ? 'text-teal-400 bg-teal-500/10 border-teal-500/20' : 'text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 border-transparent hover:border-teal-500/20'}`}
          >
            <CreditCard className="w-4 h-4" />
            {showPaymentPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={onInvoice}
            title="Facture"
            className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all"
          >
            <FileText className="w-4 h-4" />
          </button>
          {(isClosed || reservation.statut !== 'check_in' || isAdmin) && (
            <button
              onClick={onDelete}
              title="Supprimer"
              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all ml-auto"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
