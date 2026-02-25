import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Smartphone, Wallet, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { IconPill } from '../ui/IconPill';

interface PaymentModalProps {
  reservation: {
    id: string;
    client_name: string;
    montant_ttc: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

interface Encaissement {
  id: string;
  montant_total: number;
  mode_paiement: string;
  created_at: string;
}

const PAYMENT_METHODS = [
  { id: 'especes', label: 'Espèces', icon: Banknote },
  { id: 'orange_money', label: 'Orange Money', icon: Smartphone },
  { id: 'wave', label: 'Wave', icon: Wallet },
  { id: 'autre', label: 'Autre', icon: CreditCard },
];

export const PaymentModal: React.FC<PaymentModalProps> = ({ reservation, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<Encaissement[]>([]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [isDeposit, setIsDeposit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const { data } = await supabase
        .from('encaissements')
        .select('*')
        .eq('reservation_id', reservation.id)
        .order('created_at', { ascending: true });

      if (data) setPayments(data);
    } catch (err) {
      console.error('Error loading payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.montant_total), 0);
  const remaining = Number(reservation.montant_ttc) - totalPaid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      setError('Veuillez entrer un montant valide');
      return;
    }
    if (numAmount > remaining) {
      setError(`Le montant ne peut pas dépasser le restant: ${formatCurrency(remaining)} CFA`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error: insertError } = await supabase
        .from('encaissements')
        .insert({
          reservation_id: reservation.id,
          montant_total: numAmount,
          mode_paiement: paymentMethod,
          details_paiement: { type: isDeposit ? 'acompte' : 'paiement_total' },
          encaisse_par: profile?.id,
        });

      if (insertError) throw insertError;

      await loadPayments();

      const newTotalPaid = payments.reduce((sum, p) => sum + Number(p.montant_total), 0) + numAmount;
      const newRemaining = Number(reservation.montant_ttc) - newTotalPaid;

      if (newRemaining <= 0) {
        setSuccess('Paiement complet - Réservation terminée');
      } else {
        setSuccess(isDeposit ? 'Acompte enregistré' : 'Paiement enregistré');
      }
      setAmount('');
      setTimeout(() => onSuccess(), 800);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR').format(val);

  const getMethodLabel = (method: string) => {
    const m = PAYMENT_METHODS.find((pm) => pm.id === method);
    return m?.label || method;
  };

  const handleFullPayment = () => {
    setIsDeposit(false);
    setAmount(String(remaining));
  };

  const progressPercent = Number(reservation.montant_ttc) > 0
    ? Math.min(100, Math.round((totalPaid / Number(reservation.montant_ttc)) * 100))
    : 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/60 max-w-lg w-full max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-700/60 sticky top-0 bg-slate-800/95 backdrop-blur-sm rounded-t-2xl z-10">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">Paiement</h2>
            <p className="text-xs sm:text-sm text-slate-400">{reservation.client_name}</p>
          </div>
          <IconPill size="sm" onClick={onClose} title="Fermer">
            <X className="w-4 h-4" />
          </IconPill>
        </div>

        <div className="p-4 sm:p-5 space-y-5 sm:space-y-6">
          {/* Progress card */}
          <div className="bg-slate-900/50 rounded-2xl p-4 sm:p-5 border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm text-slate-400 font-medium">Progression du paiement</span>
              <span className="text-xs sm:text-sm font-semibold text-emerald-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-700/50 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 mb-1">Total TTC</p>
                <p className="text-xs sm:text-sm font-bold text-white truncate">{formatCurrency(Number(reservation.montant_ttc))}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 mb-1">Payé</p>
                <p className="text-xs sm:text-sm font-bold text-emerald-400 truncate">{formatCurrency(totalPaid)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 mb-1">Restant</p>
                <p className={`text-xs sm:text-sm font-bold truncate ${remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatCurrency(remaining)}
                </p>
              </div>
            </div>
          </div>

          {/* Payment history */}
          {payments.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-300 mb-3">Historique des paiements</p>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl border border-slate-700/40">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                        <Check className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{formatCurrency(Number(p.montant_total))} CFA</p>
                        <p className="text-xs text-slate-500">{getMethodLabel(p.mode_paiement)}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment form or completed */}
          {remaining > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleFullPayment}
                  className={`flex-1 min-h-[44px] rounded-xl text-sm font-medium border transition-all duration-200 ${
                    !isDeposit
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-700/30 text-slate-400 border-slate-700/50 hover:border-slate-600/60'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
                >
                  Paiement Total
                </button>
                <button
                  type="button"
                  onClick={() => { setIsDeposit(true); setAmount(''); }}
                  className={`flex-1 min-h-[44px] rounded-xl text-sm font-medium border transition-all duration-200 ${
                    isDeposit
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-slate-700/30 text-slate-400 border-slate-700/50 hover:border-slate-600/60'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
                >
                  Acompte
                </button>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2 font-medium">
                  Montant {isDeposit ? "(acompte)" : ""}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    max={remaining}
                    min={1}
                    className="w-full px-4 min-h-[44px] pr-16 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
                    placeholder={isDeposit ? 'Montant de l\'acompte' : `${formatCurrency(remaining)}`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">CFA</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2 font-medium">Mode de paiement</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const isSelected = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`flex items-center gap-2.5 p-3 min-h-[44px] rounded-xl border transition-all duration-200 ${
                          isSelected
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-700/30 text-slate-400 border-slate-700/50 hover:border-slate-600/60'
                        } focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
              )}
              {success && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !amount}
                className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {loading ? 'Traitement...' : isDeposit ? 'Enregistrer l\'Acompte' : 'Enregistrer le Paiement'}
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-3 border border-emerald-500/20 ring-1 ring-emerald-500/5">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-white font-medium">Paiement complet</p>
              <p className="text-sm text-slate-400 mt-1">Cette réservation est entièrement payée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
