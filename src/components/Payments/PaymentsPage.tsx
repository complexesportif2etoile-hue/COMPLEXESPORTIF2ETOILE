import { useState, useEffect, useMemo } from 'react';
import { CreditCard, Check, X, Loader2, AlertCircle, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Payment } from '../../types';
import { format, parseISO } from '../utils/dateUtils';

const STATUS_LABELS: Record<string, string> = { PENDING: 'En attente', SUCCESS: 'Validé', FAILED: 'Échoué', CANCELLED: 'Annulé' };
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
  CANCELLED: 'bg-slate-700/50 text-slate-400 border-slate-600/20',
};

export function PaymentsPage() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchPayments = async () => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPayments(data);
    setLoading(false);
  };

  useEffect(() => { fetchPayments(); }, []);

  const filtered = useMemo(() =>
    payments.filter((p) => {
      const matchSearch = p.client_name.toLowerCase().includes(search.toLowerCase()) ||
        p.phone.includes(search) ||
        p.reference.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchSearch && matchStatus;
    }), [payments, search, filterStatus]);

  const handleValidate = async (payment: Payment) => {
    setActionLoading(payment.id);
    await supabase.from('payments').update({
      status: 'SUCCESS',
      validated_by: profile?.id,
      validated_at: new Date().toISOString(),
    }).eq('id', payment.id);

    if (payment.reservation_id) {
      const { data: res } = await supabase.from('reservations').select('amount_due, amount_paid').eq('id', payment.reservation_id).maybeSingle();
      if (res) {
        const newPaid = res.amount_paid + payment.amount;
        const newStatus = newPaid >= res.amount_due ? 'PAID' : 'PARTIAL';
        await supabase.from('reservations').update({ amount_paid: newPaid, payment_status: newStatus }).eq('id', payment.reservation_id);
        await supabase.from('encaissements').insert({
          reservation_id: payment.reservation_id,
          montant_total: payment.amount,
          mode_paiement: payment.provider === 'WAVE' ? 'wave' : 'orange_money',
        });
      }
    }
    await fetchPayments();
    setActionLoading(null);
  };

  const handleReject = async (payment: Payment) => {
    setActionLoading(payment.id);
    await supabase.from('payments').update({ status: 'FAILED' }).eq('id', payment.id);
    await fetchPayments();
    setActionLoading(null);
  };

  const pendingCount = payments.filter((p) => p.status === 'PENDING').length;
  const totalSuccess = payments.filter((p) => p.status === 'SUCCESS').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Paiements en ligne</h1>
          <p className="text-slate-400 text-sm mt-0.5">Wave & Orange Money</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center mb-3">
            <AlertCircle className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-white">{pendingCount}</p>
          <p className="text-xs text-slate-500">En attente de validation</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-3">
            <CreditCard className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-white">{new Intl.NumberFormat('fr-FR').format(totalSuccess)} FCFA</p>
          <p className="text-xs text-slate-500">Total validé</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3">
            <CreditCard className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <p className="text-xl font-bold text-white">{payments.length}</p>
          <p className="text-xs text-slate-500">Total paiements</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Fournisseur</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">Montant</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">Référence</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Date</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm text-slate-200">{p.client_name}</p>
                      <p className="text-xs text-slate-500">{p.phone}</p>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.provider === 'WAVE' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {p.provider === 'WAVE' ? 'Wave' : 'Orange Money'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <p className="text-sm font-semibold text-slate-200">{new Intl.NumberFormat('fr-FR').format(p.amount)}</p>
                      <p className="text-xs text-slate-500">FCFA</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 hidden md:table-cell font-mono">{p.reference || '-'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500 hidden lg:table-cell">{format(parseISO(p.created_at), 'dd/MM/yyyy HH:mm')}</td>
                    <td className="px-5 py-3">
                      {p.status === 'PENDING' && (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleValidate(p)}
                            disabled={actionLoading === p.id}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                            title="Valider"
                          >
                            {actionLoading === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleReject(p)}
                            disabled={actionLoading === p.id}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Rejeter"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500 text-sm">Aucun paiement trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
