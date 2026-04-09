import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, LogIn, LogOut, Ban, Sun, Moon, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Reservation } from '../../types';
import {
  TARIF_JOUR, TARIF_NUIT,
  SlotHour, buildDaySlots, buildRangeSlots,
  calcTotalFromSlots, slotsToRange, areConsecutive, fmt,
} from '../utils/tarifUtils';

interface ReservationModalProps {
  reservation: Reservation | null;
  initialDate?: Date;
  initialTerrainId?: string;
  onClose: () => void;
}

const MONTH_NAMES = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const DAY_NAMES = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

export function ReservationModal({ reservation, initialDate, initialTerrainId, onClose }: ReservationModalProps) {
  const { terrains, reservations, refreshReservations } = useData();
  const { profile, hasPermission } = useAuth();
  const isEdit = !!reservation;

  const activeTerrain = terrains.filter(t => t.is_active);
  const defaultTerrain = activeTerrain.find(t => t.id === initialTerrainId) || activeTerrain[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [selectedTerrainId, setSelectedTerrainId] = useState(defaultTerrain?.id || '');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [statut, setStatut] = useState<Reservation['statut']>('réservé');
  const [selectedSlots, setSelectedSlots] = useState<SlotHour[]>([]);
  const [calDate, setCalDate] = useState<Date>(initialDate ? new Date(initialDate) : new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canDelete = hasPermission('cancel_reservations') || profile?.role === 'admin';
  const now = useMemo(() => new Date(), []);

  const isSlotPast = (slot: SlotHour) => slot.startDate.getTime() < now.getTime();

  const isSlotBooked = (slot: SlotHour): boolean => {
    const slotStart = slot.startDate.getTime();
    const slotEnd = slot.endDate.getTime();
    return reservations.some((r) => {
      if (r.terrain_id !== selectedTerrainId) return false;
      if (['annulé', 'terminé', 'check_out'].includes(r.statut)) return false;
      if (isEdit && r.id === reservation?.id) return false;
      const rStart = new Date(r.date_debut).getTime();
      const rEnd = new Date(r.date_fin).getTime();
      return slotStart < rEnd && slotEnd > rStart;
    });
  };

  const isSlotBlocked = (slot: SlotHour) => isSlotPast(slot) || isSlotBooked(slot);

  useEffect(() => {
    if (reservation) {
      setSelectedTerrainId(reservation.terrain_id);
      setClientName(reservation.client_name);
      setClientPhone(reservation.client_phone);
      setNotes(reservation.notes || '');
      setStatut(reservation.statut);
      const debut = new Date(reservation.date_debut);
      const fin = new Date(reservation.date_fin);
      setCalDate(debut);
      const slots = buildRangeSlots(debut, fin);
      setSelectedSlots(slots);
    }
  }, [reservation]);

  const daySlots = useMemo(() => buildDaySlots(calDate), [calDate]);

  const nextDaySlots = useMemo(() => {
    const next = new Date(calDate);
    next.setDate(next.getDate() + 1);
    return buildDaySlots(next);
  }, [calDate]);

  const allVisibleSlots = useMemo(() => [
    ...daySlots,
    ...nextDaySlots.slice(0, 8),
  ], [daySlots, nextDaySlots]);

  const isSlotSelected = (slot: SlotHour) =>
    selectedSlots.some(s => s.startDate.getTime() === slot.startDate.getTime());

  const toggleSlot = (slot: SlotHour) => {
    if (isSlotBlocked(slot)) return;
    if (isSlotSelected(slot)) {
      setSelectedSlots(prev => prev.filter(s => s.startDate.getTime() !== slot.startDate.getTime()));
    } else {
      const next = [...selectedSlots, slot];
      setSelectedSlots(next);
    }
  };

  const sortedSlots = useMemo(
    () => [...selectedSlots].sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    [selectedSlots]
  );

  const total = calcTotalFromSlots(selectedSlots);
  const range = slotsToRange(selectedSlots);
  const consecutive = areConsecutive(selectedSlots);

  const pad = (n: number) => String(n).padStart(2, '0');

  const navigateDate = (dir: number) => {
    const d = new Date(calDate);
    d.setDate(d.getDate() + dir);
    setCalDate(d);
    setSelectedSlots([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!range) { setError('Sélectionnez au moins un créneau'); return; }
    if (!consecutive) { setError('Les créneaux doivent être consécutifs'); return; }
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        const { error } = await supabase.from('reservations').update({
          terrain_id: selectedTerrainId,
          client_name: clientName,
          client_phone: clientPhone,
          date_debut: range.debut.toISOString(),
          date_fin: range.fin.toISOString(),
          notes,
          statut,
          tarif_total: total,
          montant_ttc: total,
          amount_due: total,
        }).eq('id', reservation!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reservations').insert({
          terrain_id: selectedTerrainId,
          client_name: clientName,
          client_phone: clientPhone,
          date_debut: range.debut.toISOString(),
          date_fin: range.fin.toISOString(),
          notes,
          statut: 'réservé',
          tarif_total: total,
          montant_ttc: total,
          amount_due: total,
          created_by: profile?.id,
        });
        if (error) throw error;
      }
      await refreshReservations();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
    setLoading(false);
  };

  const handleStatusChange = async (newStatut: Reservation['statut']) => {
    if (!reservation) return;
    setLoading(true);
    const { error } = await supabase.from('reservations').update({ statut: newStatut }).eq('id', reservation.id);
    if (!error) { await refreshReservations(); onClose(); }
    else setError(error.message);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!reservation || !window.confirm('Annuler cette réservation ?')) return;
    setLoading(true);
    const { error } = await supabase.from('reservations').update({ statut: 'annulé' }).eq('id', reservation.id);
    if (!error) { await refreshReservations(); onClose(); }
    setLoading(false);
  };

  const calDayLabel = `${DAY_NAMES[calDate.getDay()]} ${calDate.getDate()} ${MONTH_NAMES[calDate.getMonth()]} ${calDate.getFullYear()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[96vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="font-semibold text-white">
            {isEdit ? 'Modifier la réservation' : 'Nouvelle réservation'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isEdit && reservation && (
          <div className="px-5 py-3 border-b border-slate-800 flex gap-2 flex-wrap">
            {reservation.statut === 'réservé' && (
              <button onClick={() => handleStatusChange('check_in')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs transition-all">
                <LogIn className="w-3.5 h-3.5" /> Check-in
              </button>
            )}
            {reservation.statut === 'check_in' && (
              <button onClick={() => handleStatusChange('terminé')} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-lg text-xs transition-all">
                <LogOut className="w-3.5 h-3.5" /> Check-out
              </button>
            )}
            {canDelete && !['annulé', 'terminé'].includes(reservation.statut) && (
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-all ml-auto">
                <Ban className="w-3.5 h-3.5" /> Annuler
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">{error}</div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Terrain</label>
            <select
              value={selectedTerrainId}
              onChange={(e) => { setSelectedTerrainId(e.target.value); setSelectedSlots([]); }}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {activeTerrain.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">08h – 19h · Lun–Ven</p>
                <p className="text-xs font-bold text-amber-400">{fmt(TARIF_JOUR)} F/h</p>
              </div>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">19h – 08h · WE</p>
                <p className="text-xs font-bold text-blue-400">{fmt(TARIF_NUIT)} F/h</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => navigateDate(-1)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-white">{calDayLabel}</span>
              <button
                type="button"
                onClick={() => navigateDate(1)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[10px] text-slate-500 mb-2">Cliquez pour sélectionner des créneaux consécutifs</p>

            <div className="grid grid-cols-2 gap-1.5">
              {allVisibleSlots.map((slot, i) => {
                const selected = isSlotSelected(slot);
                const past = isSlotPast(slot);
                const booked = isSlotBooked(slot);
                const blocked = past || booked;
                const isNextDay = slot.startDate.getDate() !== calDate.getDate();
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleSlot(slot)}
                    disabled={blocked}
                    title={past ? 'Créneau passé' : booked ? 'Déjà réservé' : undefined}
                    className={`
                      relative flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all
                      ${blocked
                        ? booked
                          ? 'bg-red-500/10 border-red-500/30 text-red-400/60 cursor-not-allowed'
                          : 'bg-slate-800/30 border-slate-700/30 text-slate-600 cursor-not-allowed'
                        : selected
                          ? slot.isNight
                            ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                            : 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : slot.isNight
                            ? 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-blue-500/40 hover:bg-blue-500/5'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-amber-500/40 hover:bg-amber-500/5'
                      }
                    `}
                  >
                    <div className="flex items-center gap-1.5">
                      {blocked
                        ? <Lock className="w-3 h-3 flex-shrink-0 opacity-50" />
                        : slot.isNight
                          ? <Moon className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          : <Sun className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      }
                      <span className={`font-medium ${blocked ? 'line-through opacity-60' : ''}`}>{slot.label}</span>
                      {isNextDay && !blocked && (
                        <span className="text-[9px] text-slate-500 bg-slate-700 px-1 rounded">+1j</span>
                      )}
                      {booked && (
                        <span className="text-[9px] text-red-400/70 bg-red-500/10 px-1 rounded">Réservé</span>
                      )}
                    </div>
                    {!blocked && (
                      <span className={`font-semibold text-[11px] ${slot.isNight ? 'text-blue-400' : 'text-amber-400'}`}>
                        {fmt(slot.tarif)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {!consecutive && selectedSlots.length > 0 && (
              <p className="text-xs text-red-400 mt-2">Les créneaux doivent être consécutifs.</p>
            )}
          </div>

          {selectedSlots.length > 0 && range && (
            <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-2 border-emerald-500/40 rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-emerald-300">Résumé de la réservation</h4>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg font-semibold">{selectedSlots.length}h</span>
              </div>

              <div className="space-y-2.5 mb-3">
                <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-slate-500 mb-1">Période</p>
                  <p className="text-sm font-semibold text-white">
                    {pad(range.debut.getDate())}/{pad(range.debut.getMonth() + 1)} à {pad(range.debut.getHours())}h00
                    <span className="text-slate-400 mx-2">→</span>
                    {pad(range.fin.getDate())}/{pad(range.fin.getMonth() + 1)} à {pad(range.fin.getHours())}h00
                  </p>
                </div>

                <div className="bg-emerald-500/10 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-slate-500 mb-1">Tarif total</p>
                  <p className="text-lg font-bold text-emerald-300">{fmt(total)} FCFA</p>
                </div>
              </div>

              <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                <p className="text-[11px] text-slate-500 mb-2">Créneaux sélectionnés</p>
                <div className="flex flex-wrap gap-2">
                  {sortedSlots.map((s, i) => (
                    <span key={i} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${s.isNight ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Nom client</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                placeholder="Prénom Nom"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Téléphone</label>
              <input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                required
                placeholder="+221..."
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations supplémentaires..."
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || selectedSlots.length === 0 || !consecutive}
              className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isEdit ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
