import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { IconPill } from '../ui/IconPill';

interface StatusChangeModalProps {
  reservation: {
    id: string;
    client_name: string;
    statut: string;
    date_debut: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const STATUS_FLOW: Record<string, string[]> = {
  'en_attente': ['réservé', 'annulé'],
  'réservé': ['check_in', 'annulé', 'bloqué'],
  'check_in': ['check_out', 'annulé'],
  'check_out': ['terminé'],
  'terminé': [],
  'annulé': ['réservé'],
  'bloqué': ['réservé', 'annulé'],
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'en_attente': { label: 'En attente', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  'réservé': { label: 'Réservé', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  'check_in': { label: 'Check-in', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  'check_out': { label: 'Check-out', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  'terminé': { label: 'Terminé', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  'annulé': { label: 'Annulé', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  'bloqué': { label: 'Bloqué', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
};

export const StatusChangeModal: React.FC<StatusChangeModalProps> = ({ reservation, onClose, onSuccess }) => {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setMotif('');
    setError('');
  };

  const availableStatuses = STATUS_FLOW[reservation.statut] || [];
  const currentConfig = STATUS_CONFIG[reservation.statut];

  const canCheckIn = true;

  const handleConfirm = async () => {
    if (!selectedStatus) return;

    if ((selectedStatus === 'annulé' || selectedStatus === 'bloqué') && !motif.trim()) {
      setError('Veuillez indiquer un motif');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updateData: Record<string, string> = {
        statut: selectedStatus,
        updated_at: new Date().toISOString(),
      };
      if (selectedStatus === 'bloqué') {
        updateData.motif_blocage = motif;
      }
      if (selectedStatus === 'annulé') {
        updateData.motif_annulation = motif;
      }

      const { error: updateError } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservation.id);

      if (updateError) throw updateError;
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de statut');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/60 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-700/60 sticky top-0 bg-slate-800/95 backdrop-blur-sm z-10 rounded-t-2xl">
          <h2 className="text-base sm:text-lg font-semibold text-white">Changer le Statut</h2>
          <IconPill size="sm" onClick={onClose} title="Fermer">
            <X className="w-4 h-4" />
          </IconPill>
        </div>

        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
          <div>
            <p className="text-sm text-slate-500 mb-1">Réservation de</p>
            <p className="text-white font-medium">{reservation.client_name}</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Statut actuel:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${currentConfig.bg} ${currentConfig.color} border ${currentConfig.border}`}>
              {currentConfig.label}
            </span>
          </div>

          {availableStatuses.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-700/30 border border-slate-700/50">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-slate-300">Aucune transition disponible depuis ce statut.</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm text-slate-400 mb-3">Nouveau statut:</p>
                <div className="grid grid-cols-1 gap-2">
                  {availableStatuses.map((status) => {
                    const config = STATUS_CONFIG[status];
                    const isSelected = selectedStatus === status;
                    const isDisabled = status === 'check_in' && !canCheckIn;
                    return (
                      <button
                        key={status}
                        onClick={() => !isDisabled && handleStatusChange(status)}
                        disabled={isDisabled}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 min-h-[44px] ${
                          isDisabled
                            ? 'border-slate-700/30 text-slate-600 bg-slate-800/30 cursor-not-allowed opacity-50'
                            : isSelected
                            ? `${config.bg} ${config.border} ${config.color} ring-1 ring-current/20`
                            : 'border-slate-700/50 text-slate-300 hover:border-slate-600/60 hover:bg-slate-700/30'
                        } focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
                      >
                        <ArrowRight className={`w-4 h-4 ${isDisabled ? 'text-slate-600' : isSelected ? config.color : 'text-slate-500'}`} />
                        <span className="font-medium">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedStatus === 'bloqué' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-2 font-medium">Motif de blocage *</label>
                  <textarea
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
                    placeholder="Raison du blocage..."
                    required
                  />
                </div>
              )}

              {selectedStatus === 'annulé' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-2 font-medium">Motif d'annulation *</label>
                  <textarea
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
                    placeholder="Raison de l'annulation..."
                    required
                  />
                </div>
              )}
            </>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 sm:gap-3 p-4 sm:p-5 border-t border-slate-700/60 sticky bottom-0 bg-slate-800/95 backdrop-blur-sm rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-3 sm:px-4 min-h-[44px] text-sm font-medium text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-600/70 rounded-xl transition-all duration-200 border border-slate-600/50 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
          >
            Annuler
          </button>
          {availableStatuses.length > 0 && (
            <button
              onClick={handleConfirm}
              disabled={!selectedStatus || loading}
              className="px-4 sm:px-5 min-h-[44px] text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {loading ? 'En cours...' : 'Confirmer'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
