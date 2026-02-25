import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, X, Check, XCircle, Clock, User, Phone, MapPin, Calendar, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { Reservation } from '../../lib/supabase';

interface PendingReservationsPopupProps {
  onViewReservation?: () => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playTone = (freq: number, startTime: number, duration: number, gain: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, startTime);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(880, now, 0.15, 0.3);
    playTone(1100, now + 0.18, 0.15, 0.3);
    playTone(1320, now + 0.36, 0.25, 0.4);
  } catch {
  }
}

export const PendingReservationsPopup: React.FC<PendingReservationsPopupProps> = ({ onViewReservation }) => {
  const { reservations, terrainsMap, refreshReservations, newReservationSignal } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const pending = reservations.filter(r => r.statut === 'en_attente');
  const count = pending.length;

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    playNotificationSound();
    setIsOpen(true);
  }, [newReservationSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen && count === 0) {
      setIsOpen(false);
    }
  }, [count, isOpen]);

  const handleConfirm = useCallback(async (reservation: Reservation) => {
    setProcessingId(reservation.id);
    try {
      await supabase
        .from('reservations')
        .update({ statut: 'réservé' })
        .eq('id', reservation.id);
      await refreshReservations();
    } finally {
      setProcessingId(null);
    }
  }, [refreshReservations]);

  const handleReject = useCallback(async (reservation: Reservation) => {
    setProcessingId(reservation.id);
    try {
      await supabase
        .from('reservations')
        .update({ statut: 'annulé', motif_blocage: 'Refusé par opérateur' })
        .eq('id', reservation.id);
      await refreshReservations();
    } finally {
      setProcessingId(null);
    }
  }, [refreshReservations]);

  if (count === 0 && !isOpen) return null;

  return (
    <>
      {/* Bell button (always visible when there are pending) */}
      {count > 0 && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative inline-flex items-center justify-center h-9 w-9 xs:h-10 xs:w-10 rounded-full bg-amber-500/10 border border-amber-500/30 ring-1 ring-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 animate-pulse shrink-0"
          aria-label="Reservations en attente"
          title={`${count} reservation${count > 1 ? 's' : ''} en attente`}
        >
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-md shadow-amber-500/30 leading-none">
            {count > 9 ? '9+' : count}
          </span>
        </button>
      )}

      {/* Popup overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-end p-3 sm:p-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-sm bg-slate-900/98 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in slide-in-from-top-2 duration-300"
            style={{ marginTop: '4.5rem' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-700/60 bg-amber-500/5">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-amber-400" />
                  </div>
                  {count > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">Reservations en attente</p>
                  <p className="text-xs text-amber-400/80 leading-tight">
                    {count === 0 ? 'Tout est traite' : `${count} demande${count > 1 ? 's' : ''} a valider`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700/60 transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800/60">
              {pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-sm text-slate-400">Aucune reservation en attente.</p>
                </div>
              ) : (
                pending.map((r) => {
                  const isProcessing = processingId === r.id;
                  const terrainName = terrainsMap[r.terrain_id] || 'Terrain inconnu';
                  return (
                    <div key={r.id} className="p-4 space-y-3">
                      {/* Client info */}
                      <div className="flex items-start gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{r.client_name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="text-xs text-slate-400">{r.client_phone}</span>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg shrink-0">
                          En attente
                        </span>
                      </div>

                      {/* Reservation details */}
                      <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-sm text-slate-300 font-medium">{terrainName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="text-xs text-slate-400">
                            {new Date(r.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                          <span className="text-xs text-slate-500">—</span>
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="text-xs text-slate-400 font-mono">
                            {formatTime(r.date_debut)} - {formatTime(r.date_fin)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-700/40">
                          <span className="text-xs text-slate-500">Montant</span>
                          <span className="text-sm font-bold text-emerald-400">{r.montant_ttc.toLocaleString()} CFA</span>
                        </div>
                      </div>

                      {r.notes && (
                        <p className="text-xs text-slate-500 italic px-1">"{r.notes}"</p>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(r)}
                          disabled={isProcessing}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Refuser
                        </button>
                        <button
                          onClick={() => handleConfirm(r)}
                          disabled={isProcessing}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-xs font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isProcessing ? 'En cours...' : 'Confirmer'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {pending.length > 0 && onViewReservation && (
              <div className="border-t border-slate-700/60 p-3">
                <button
                  onClick={() => { setIsOpen(false); onViewReservation(); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all duration-200"
                >
                  Voir toutes les reservations
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
