import { useState, useEffect } from 'react';
import { MapPin, Calendar, Clock, CreditCard, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Reservation } from '../../types';
import { format, parseISO } from '../utils/dateUtils';

interface RsvpPageProps {
  code: string;
}

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente de confirmation',
  réservé: 'Confirmé',
  check_in: 'En cours',
  terminé: 'Terminé',
  annulé: 'Annulé',
  bloqué: 'Indisponible',
};

const PAYMENT_LABELS: Record<string, string> = { UNPAID: 'Non payé', PARTIAL: 'Partiel', PAID: 'Payé' };

export function RsvpPage({ code }: RsvpPageProps) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from('reservations')
      .select('*, terrain:terrains(*)')
      .eq('code_court', code)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setReservation(data as Reservation);
        else setNotFound(true);
        setLoading(false);
      });
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <MapPin className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Ma Réservation</h1>
          <p className="text-slate-400 text-sm mt-1 font-mono tracking-widest">{code}</p>
        </div>

        {loading ? (
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : notFound ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Réservation introuvable</h2>
            <p className="text-slate-400 text-sm">Le code <span className="font-mono text-slate-300">{code}</span> ne correspond à aucune réservation.</p>
          </div>
        ) : reservation ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className={`px-6 py-4 ${reservation.statut === 'annulé' ? 'bg-red-500/5' : reservation.statut === 'réservé' || reservation.statut === 'check_in' ? 'bg-emerald-500/5' : 'bg-amber-500/5'} border-b border-slate-800`}>
              <div className="flex items-center gap-3">
                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${reservation.statut === 'annulé' ? 'text-red-400' : 'text-emerald-400'}`} />
                <div>
                  <p className="font-semibold text-white">{STATUT_LABELS[reservation.statut] || reservation.statut}</p>
                  <p className="text-xs text-slate-400">{reservation.client_name}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Terrain</p>
                  <p className="text-sm font-medium text-slate-200">{reservation.terrain?.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="text-sm font-medium text-slate-200">{format(parseISO(reservation.date_debut), 'dd/MM/yyyy')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Horaires</p>
                  <p className="text-sm font-medium text-slate-200">
                    {format(parseISO(reservation.date_debut), 'HH:mm')} – {format(parseISO(reservation.date_fin), 'HH:mm')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Paiement</p>
                  <p className="text-sm font-medium text-slate-200">
                    {PAYMENT_LABELS[reservation.payment_status]} — {new Intl.NumberFormat('fr-FR').format(reservation.amount_due)} FCFA
                  </p>
                  {reservation.amount_paid > 0 && (
                    <p className="text-xs text-emerald-400">{new Intl.NumberFormat('fr-FR').format(reservation.amount_paid)} FCFA réglés</p>
                  )}
                </div>
              </div>

              {reservation.notes && (
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-300">{reservation.notes}</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
