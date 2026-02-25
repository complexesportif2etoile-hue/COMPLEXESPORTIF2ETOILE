import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CreditCard,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  ChevronDown,
  Phone,
  User,
  Calendar,
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  Check,
  X,
  FileText,
  Wallet,
} from 'lucide-react';

interface Payment {
  id: string;
  reservation_id: string | null;
  provider: 'WAVE' | 'ORANGE_MONEY';
  reference: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  amount: number;
  phone: string;
  client_name: string;
  notes: string;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
}

type StatusFilter = 'ALL' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
type ProviderFilter = 'ALL' | 'WAVE' | 'ORANGE_MONEY';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  SUCCESS: 'Validé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  SUCCESS: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  FAILED: 'bg-red-500/15 text-red-400 border-red-500/25',
  CANCELLED: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
};

const PROVIDER_LABELS: Record<string, string> = {
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [actionModal, setActionModal] = useState<{ payment: Payment; type: 'validate' | 'reject' } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();

    const channel = supabase
      .channel('payments_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        loadPayments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadPayments]);

  const filtered = payments.filter(p => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (providerFilter !== 'ALL' && p.provider !== providerFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.client_name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.reference.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    ALL: payments.length,
    PENDING: payments.filter(p => p.status === 'PENDING').length,
    SUCCESS: payments.filter(p => p.status === 'SUCCESS').length,
    FAILED: payments.filter(p => p.status === 'FAILED').length,
    CANCELLED: payments.filter(p => p.status === 'CANCELLED').length,
  };

  const totalSuccessAmount = payments
    .filter(p => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingAmount = payments
    .filter(p => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amount, 0);

  const handleValidate = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    setActionError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newStatus = actionModal.type === 'validate' ? 'SUCCESS' : 'FAILED';

      const { error: payErr } = await supabase
        .from('payments')
        .update({
          status: newStatus,
          notes: actionNotes.trim(),
          validated_by: user?.id ?? null,
          validated_at: new Date().toISOString(),
        })
        .eq('id', actionModal.payment.id);

      if (payErr) throw payErr;

      if (actionModal.type === 'validate' && actionModal.payment.reservation_id) {
        const { data: resData } = await supabase
          .from('reservations')
          .select('amount_paid, amount_due')
          .eq('id', actionModal.payment.reservation_id)
          .maybeSingle();

        if (resData) {
          const newAmountPaid = (resData.amount_paid || 0) + actionModal.payment.amount;
          const newPaymentStatus =
            newAmountPaid >= resData.amount_due ? 'PAID' : 'PARTIAL';

          await supabase
            .from('reservations')
            .update({
              amount_paid: newAmountPaid,
              payment_status: newPaymentStatus,
            })
            .eq('id', actionModal.payment.reservation_id);
        }
      }

      setActionModal(null);
      setActionNotes('');
      loadPayments();
    } catch (err: any) {
      setActionError(err.message || 'Une erreur est survenue.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Paiements mobiles</h1>
          <p className="text-sm text-slate-400 mt-1">Wave & Orange Money — validation et suivi</p>
        </div>
        <button
          onClick={loadPayments}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 text-sm font-medium rounded-xl transition-all duration-200 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="En attente"
          value={counts.PENDING}
          sub={counts.PENDING > 0 ? `${pendingAmount.toLocaleString()} CFA` : undefined}
          color="amber"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Validés"
          value={counts.SUCCESS}
          sub={`${totalSuccessAmount.toLocaleString()} CFA`}
          color="emerald"
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <StatCard
          label="Échoués"
          value={counts.FAILED}
          color="red"
          icon={<XCircle className="w-5 h-5" />}
        />
        <StatCard
          label="Total"
          value={counts.ALL}
          color="slate"
          icon={<CreditCard className="w-5 h-5" />}
        />
      </div>

      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, téléphone, référence..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40"
            />
          </div>
          <div className="flex gap-2">
            <FilterSelect
              value={providerFilter}
              onChange={(v) => setProviderFilter(v as ProviderFilter)}
              options={[
                { value: 'ALL', label: 'Tous opérateurs' },
                { value: 'WAVE', label: 'Wave' },
                { value: 'ORANGE_MONEY', label: 'Orange Money' },
              ]}
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['ALL', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                statusFilter === s
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800/60 border-slate-700/40 text-slate-500 hover:text-slate-300'
              }`}
            >
              {s === 'ALL' ? 'Tous' : STATUS_LABELS[s]}
              <span className="ml-1.5 text-[10px] opacity-70">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucun paiement trouvé</p>
            <p className="text-xs mt-1 opacity-60">Modifiez vos filtres ou attendez de nouvelles transactions</p>
          </div>
        ) : (
          filtered.map(payment => (
            <PaymentRow
              key={payment.id}
              payment={payment}
              onValidate={() => { setActionModal({ payment, type: 'validate' }); setActionNotes(''); setActionError(''); }}
              onReject={() => { setActionModal({ payment, type: 'reject' }); setActionNotes(''); setActionError(''); }}
              onDetail={() => setSelectedPayment(payment)}
            />
          ))
        )}
      </div>

      {selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onValidate={() => { setSelectedPayment(null); setActionModal({ payment: selectedPayment, type: 'validate' }); setActionNotes(''); setActionError(''); }}
          onReject={() => { setSelectedPayment(null); setActionModal({ payment: selectedPayment, type: 'reject' }); setActionNotes(''); setActionError(''); }}
        />
      )}

      {actionModal && (
        <ActionModal
          payment={actionModal.payment}
          type={actionModal.type}
          notes={actionNotes}
          onNotesChange={setActionNotes}
          onConfirm={handleValidate}
          onCancel={() => { setActionModal(null); setActionNotes(''); setActionError(''); }}
          loading={actionLoading}
          error={actionError}
        />
      )}
    </div>
  );
};

function StatCard({ label, value, sub, color, icon }: {
  label: string;
  value: number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    slate: 'bg-slate-700/30 border-slate-600/30 text-slate-400',
  };
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-emerald-400 font-medium mt-0.5">{sub}</p>}
    </div>
  );
}

function FilterSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
    </div>
  );
}

function PaymentRow({ payment, onValidate, onReject, onDetail }: {
  payment: Payment;
  onValidate: () => void;
  onReject: () => void;
  onDetail: () => void;
}) {
  const isPending = payment.status === 'PENDING';
  return (
    <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-4 hover:border-slate-700/60 transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
          payment.provider === 'WAVE'
            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
        }`}>
          <Wallet className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{payment.client_name || 'Client inconnu'}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[payment.status]}`}>
                  {STATUS_LABELS[payment.status]}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  payment.provider === 'WAVE'
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                }`}>
                  {PROVIDER_LABELS[payment.provider]}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {payment.phone}
                </span>
                {payment.reference && (
                  <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                    <FileText className="w-3 h-3" />
                    {payment.reference}
                  </span>
                )}
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(payment.created_at)}
                </span>
              </div>
            </div>
            <span className="text-lg font-bold text-white shrink-0">{payment.amount.toLocaleString()} <span className="text-xs font-normal text-slate-400">CFA</span></span>
          </div>

          {payment.notes && (
            <p className="mt-2 text-xs text-slate-500 bg-slate-800/40 rounded-lg px-2.5 py-1.5 border border-slate-700/30">
              {payment.notes}
            </p>
          )}

          {isPending && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={onValidate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-xs font-semibold rounded-lg transition-all duration-200"
              >
                <Check className="w-3.5 h-3.5" />
                Valider
              </button>
              <button
                onClick={onReject}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg transition-all duration-200"
              >
                <X className="w-3.5 h-3.5" />
                Rejeter
              </button>
              <button
                onClick={onDetail}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 text-slate-400 text-xs font-semibold rounded-lg transition-all duration-200 ml-auto"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
                Détail
              </button>
            </div>
          )}

          {!isPending && (
            <button
              onClick={onDetail}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 text-slate-400 text-xs font-semibold rounded-lg transition-all duration-200 mt-2"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              Voir le détail
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentDetailModal({ payment, onClose, onValidate, onReject }: {
  payment: Payment;
  onClose: () => void;
  onValidate: () => void;
  onReject: () => void;
}) {
  const isPending = payment.status === 'PENDING';
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Détail du paiement</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <DetailRow label="Statut" value={
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLORS[payment.status]}`}>
              {STATUS_LABELS[payment.status]}
            </span>
          } />
          <DetailRow label="Opérateur" value={
            <span className={`text-sm font-semibold ${payment.provider === 'WAVE' ? 'text-blue-400' : 'text-orange-400'}`}>
              {PROVIDER_LABELS[payment.provider]}
            </span>
          } />
          <DetailRow label="Client" value={payment.client_name} />
          <DetailRow label="Téléphone" value={payment.phone} />
          <DetailRow label="Montant" value={`${payment.amount.toLocaleString()} CFA`} highlight />
          {payment.reference && <DetailRow label="Référence" value={<span className="font-mono text-xs">{payment.reference}</span>} />}
          <DetailRow label="Date" value={formatDate(payment.created_at)} />
          {payment.reservation_id && <DetailRow label="Réservation" value={<span className="font-mono text-xs opacity-60">{payment.reservation_id.slice(0, 8)}…</span>} />}
          {payment.notes && <DetailRow label="Notes" value={payment.notes} />}
          {payment.validated_at && <DetailRow label="Validé le" value={formatDate(payment.validated_at)} />}
        </div>

        {isPending && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={onValidate}
              className="flex-1 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Valider
            </button>
            <button
              onClick={onReject}
              className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Rejeter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800/50 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`text-xs text-right ${highlight ? 'text-emerald-400 font-bold text-sm' : 'text-slate-300 font-medium'}`}>{value}</span>
    </div>
  );
}

function ActionModal({ payment, type, notes, onNotesChange, onConfirm, onCancel, loading, error }: {
  payment: Payment;
  type: 'validate' | 'reject';
  notes: string;
  onNotesChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string;
}) {
  const isValidate = type === 'validate';
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
            isValidate ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {isValidate ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{isValidate ? 'Valider le paiement' : 'Rejeter le paiement'}</h2>
            <p className="text-xs text-slate-500">{payment.client_name} — {payment.amount.toLocaleString()} CFA</p>
          </div>
        </div>

        <div className="bg-slate-800/40 rounded-xl p-3 mb-4 text-xs text-slate-400 leading-relaxed">
          {isValidate
            ? 'En validant, le paiement sera marqué comme réussi et la réservation mise à jour automatiquement (montant payé, statut paiement).'
            : 'En rejetant, le paiement sera marqué comme échoué. La réservation restera inchangée.'}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Notes (optionnel)
          </label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
            placeholder={isValidate ? 'Ex: Virement confirmé — ref. WAVE-12345' : 'Ex: Numéro invalide, montant incorrect…'}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs mb-4">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 text-sm font-semibold rounded-xl transition-all duration-200"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 ${
              isValidate
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-400'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isValidate ? (
              <><Check className="w-4 h-4" />Confirmer la validation</>
            ) : (
              <><X className="w-4 h-4" />Confirmer le rejet</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
