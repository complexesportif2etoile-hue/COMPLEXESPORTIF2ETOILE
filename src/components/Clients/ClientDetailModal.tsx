import React, { useMemo } from 'react';
import { X, Phone, Mail, MapPin, FileText, Calendar, Clock } from 'lucide-react';
import { Client } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { IconPill } from '../ui/IconPill';

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  'réservé': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'check_in': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'check_out': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'terminé': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'annulé': 'bg-red-500/10 text-red-400 border-red-500/20',
  'bloqué': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({ client, onClose }) => {
  const { reservations, terrainsMap } = useData();

  const clientReservations = useMemo(() => {
    const q = client.name.toLowerCase();
    return reservations.filter(
      (r) => r.client_name.toLowerCase() === q || r.client_phone === client.phone
    );
  }, [reservations, client]);

  const totalSpent = useMemo(
    () => clientReservations
      .filter((r) => r.statut !== 'annulé')
      .reduce((sum, r) => sum + Number(r.montant_ttc), 0),
    [clientReservations]
  );

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR').format(val);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-700/60 sticky top-0 bg-slate-800/95 backdrop-blur-sm rounded-t-2xl z-10">
          <h2 className="text-lg sm:text-xl font-semibold text-white">Fiche Client</h2>
          <IconPill size="sm" onClick={onClose} title="Fermer">
            <X className="w-4 h-4" />
          </IconPill>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-500/20 ring-1 ring-emerald-500/5">
              <span className="text-xl font-bold text-emerald-400">
                {client.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-white">{client.name}</h3>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2 text-sm text-slate-400">
                {client.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {client.phone}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {client.email}
                  </span>
                )}
                {client.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {client.address}
                  </span>
                )}
              </div>
              {client.notes && (
                <div className="flex items-start gap-1.5 mt-2 text-sm text-slate-500">
                  <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{client.notes}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Reservations</p>
              <p className="text-2xl font-bold text-white">{clientReservations.length}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Total depense</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalSpent)} <span className="text-sm font-normal text-slate-500">CFA</span></p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Historique des reservations
            </h4>
            {clientReservations.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Aucune reservation trouvee</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {clientReservations.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900/40 border border-slate-700/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {terrainsMap[r.terrain_id] || 'Terrain'}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatDate(r.date_debut)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(Number(r.montant_ttc))} CFA
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[r.statut] || STATUS_COLORS['réservé']}`}>
                        {r.statut}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
