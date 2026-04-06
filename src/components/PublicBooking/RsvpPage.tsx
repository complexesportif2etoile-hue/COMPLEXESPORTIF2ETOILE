import { useState, useEffect, useMemo } from 'react';
import { MapPin, Calendar, Clock, CreditCard, CheckCircle, AlertCircle, Loader2, Sun, Moon, ChevronLeft, ChevronRight, X, CreditCard as Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Reservation } from '../../types';
import { format, parseISO } from '../utils/dateUtils';
import {
  TARIF_JOUR, TARIF_NUIT,
  SlotHour, buildDaySlots, buildRangeSlots,
  calcTotalFromSlots, slotsToRange, areConsecutive, fmt,
} from '../utils/tarifUtils';

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
const MONTH_NAMES = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const DAY_NAMES = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const EDIT_WINDOW_MS = 5 * 60 * 1000;

function isSlotBlockedEdit(slot: SlotHour, currentResId: string, nowMs: number, bookedRanges: { id: string; debut: Date; fin: Date }[]): boolean {
  if (slot.startDate.getTime() < nowMs) return true;
  return bookedRanges.some(r => r.id !== currentResId && slot.startDate < r.fin && slot.endDate > r.debut);
}

export function RsvpPage({ code }: RsvpPageProps) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showCancel, setShowCancel] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editSlots, setEditSlots] = useState<SlotHour[]>([]);
  const [editCalDate, setEditCalDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [bookedRanges, setBookedRanges] = useState<{ id: string; debut: Date; fin: Date }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchReservation = () => {
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
  };

  useEffect(() => { fetchReservation(); }, [code]);

  const createdAt = reservation ? new Date(reservation.created_at).getTime() : null;
  const msElapsed = createdAt ? now - createdAt : Infinity;
  const msRemaining = createdAt ? Math.max(0, EDIT_WINDOW_MS - msElapsed) : 0;
  const canModify = msElapsed < EDIT_WINDOW_MS && reservation?.statut === 'en_attente';

  const remainingLabel = () => {
    const secs = Math.ceil(msRemaining / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleCancel = async () => {
    if (!reservation) return;
    setCancelling(true);
    setActionError('');
    const { error } = await supabase.from('reservations').update({ statut: 'annulé', motif_annulation: 'Annulé par le client' }).eq('id', reservation.id);
    if (error) { setActionError(error.message); }
    else { fetchReservation(); setShowCancel(false); }
    setCancelling(false);
  };

  const openEdit = () => {
    if (!reservation) return;
    const debut = new Date(reservation.date_debut);
    setEditCalDate(new Date(debut.getFullYear(), debut.getMonth(), debut.getDate()));
    setEditSlots(buildRangeSlots(debut, new Date(reservation.date_fin)));
    supabase
      .from('reservations')
      .select('id, date_debut, date_fin')
      .eq('terrain_id', reservation.terrain_id)
      .not('statut', 'in', '("annulé","terminé")')
      .then(({ data }) => {
        if (data) {
          setBookedRanges(data.map(r => ({ id: r.id, debut: new Date(r.date_debut), fin: new Date(r.date_fin) })));
        }
      });
    setShowEdit(true);
  };

  const daySlots = useMemo(() => buildDaySlots(editCalDate), [editCalDate]);
  const nextDaySlots = useMemo(() => {
    const next = new Date(editCalDate);
    next.setDate(next.getDate() + 1);
    return buildDaySlots(next);
  }, [editCalDate]);
  const allVisibleSlots = useMemo(() => [...daySlots, ...nextDaySlots.slice(0, 8)], [daySlots, nextDaySlots]);

  const isSlotSelected = (slot: SlotHour) =>
    editSlots.some(s => s.startDate.getTime() === slot.startDate.getTime());

  const toggleSlot = (slot: SlotHour) => {
    if (isSlotSelected(slot)) {
      setEditSlots(prev => prev.filter(s => s.startDate.getTime() !== slot.startDate.getTime()));
    } else {
      setEditSlots(prev => [...prev, slot]);
    }
  };

  const editTotal = calcTotalFromSlots(editSlots);
  const editRange = slotsToRange(editSlots);
  const editConsecutive = areConsecutive(editSlots);

  const navigateDate = (dir: number) => {
    const d = new Date(editCalDate);
    d.setDate(d.getDate() + dir);
    setEditCalDate(d);
    setEditSlots([]);
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  const handleSaveEdit = async () => {
    if (!reservation || !editRange || !editConsecutive) return;
    setSaving(true);
    setActionError('');
    const { error } = await supabase.from('reservations').update({
      date_debut: editRange.debut.toISOString(),
      date_fin: editRange.fin.toISOString(),
      tarif_total: editTotal,
      montant_ttc: editTotal,
      amount_due: editTotal,
    }).eq('id', reservation.id);
    if (error) { setActionError(error.message); }
    else { fetchReservation(); setShowEdit(false); }
    setSaving(false);
  };

  const calDayLabel = `${DAY_NAMES[editCalDate.getDay()]} ${editCalDate.getDate()} ${MONTH_NAMES[editCalDate.getMonth()]}`;
  const today = new Date(); today.setHours(0,0,0,0);

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
          <>
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
                      {PAYMENT_LABELS[reservation.payment_status]} — {fmt(reservation.amount_due)} FCFA
                    </p>
                    {reservation.amount_paid > 0 && (
                      <p className="text-xs text-emerald-400">{fmt(reservation.amount_paid)} FCFA réglés</p>
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

              {canModify && (
                <div className="px-6 pb-5 space-y-3">
                  <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2.5">
                    <p className="text-xs text-amber-400">Modification possible encore</p>
                    <p className="text-sm font-mono font-bold text-amber-300">{remainingLabel()}</p>
                  </div>
                  {actionError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">{actionError}</div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={openEdit}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Modifier
                    </button>
                    <button
                      onClick={() => setShowCancel(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Annuler
                    </button>
                  </div>
                </div>
              )}

              {!canModify && reservation.statut === 'en_attente' && msRemaining === 0 && (
                <div className="px-6 pb-5">
                  <p className="text-xs text-slate-500 text-center">La fenêtre de modification (5 min) est expirée.</p>
                </div>
              )}
            </div>

            {showCancel && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <h2 className="font-semibold text-white">Annuler la réservation</h2>
                    <button onClick={() => setShowCancel(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-400">Êtes-vous sûr de vouloir annuler votre réservation ? Cette action est irréversible.</p>
                    {actionError && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">{actionError}</div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => setShowCancel(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Non, garder</button>
                      <button onClick={handleCancel} disabled={cancelling} className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                        {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                        Oui, annuler
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showEdit && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                    <h2 className="font-semibold text-white">Modifier les créneaux</h2>
                    <button onClick={() => setShowEdit(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    {actionError && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">{actionError}</div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                        <Sun className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">08h–19h · Lun–Ven</p>
                          <p className="text-xs font-bold text-amber-400">{fmt(TARIF_JOUR)} F/h</p>
                        </div>
                      </div>
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                        <Moon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">19h–08h · WE</p>
                          <p className="text-xs font-bold text-blue-400">{fmt(TARIF_NUIT)} F/h</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => navigateDate(-1)}
                        disabled={editCalDate.getTime() <= today.getTime()}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-slate-400 hover:text-white transition-all"
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

                    <p className="text-[11px] text-slate-500">Sélectionnez de nouveaux créneaux consécutifs</p>

                    <div className="grid grid-cols-2 gap-1.5">
                      {allVisibleSlots.map((slot, i) => {
                        const selected = isSlotSelected(slot);
                        const blocked = reservation ? isSlotBlockedEdit(slot, reservation.id, now, bookedRanges) : true;
                        const isNextDay = slot.startDate.getDate() !== editCalDate.getDate();
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={blocked}
                            onClick={() => !blocked && toggleSlot(slot)}
                            className={`
                              flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs transition-all
                              ${blocked
                                ? 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed opacity-50 line-through'
                                : selected
                                  ? slot.isNight
                                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                    : 'bg-amber-500/20 border-amber-500 text-amber-300'
                                  : slot.isNight
                                    ? 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-blue-400/50'
                                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-amber-400/50'
                              }
                            `}
                          >
                            <div className="flex items-center gap-1.5">
                              {slot.isNight
                                ? <Moon className={`w-3 h-3 flex-shrink-0 ${blocked ? 'text-slate-600' : 'text-blue-400'}`} />
                                : <Sun className={`w-3 h-3 flex-shrink-0 ${blocked ? 'text-slate-600' : 'text-amber-400'}`} />
                              }
                              <span className="font-medium">{slot.label}</span>
                              {isNextDay && (
                                <span className="text-[9px] text-slate-500 bg-slate-700 px-1 rounded">+1j</span>
                              )}
                            </div>
                            {blocked
                              ? <span className="text-[10px] text-slate-600">Indispo</span>
                              : <span className={`font-bold text-[11px] ${slot.isNight ? 'text-blue-400' : 'text-amber-400'}`}>{fmt(slot.tarif)}</span>
                            }
                          </button>
                        );
                      })}
                    </div>

                    {!editConsecutive && editSlots.length > 1 && (
                      <p className="text-xs text-red-400">Les créneaux doivent être consécutifs.</p>
                    )}

                    {editSlots.length > 0 && editRange && editConsecutive && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-xs text-slate-400">
                              {pad(editRange.debut.getDate())}/{pad(editRange.debut.getMonth() + 1)} {pad(editRange.debut.getHours())}h00
                              {' → '}
                              {pad(editRange.fin.getDate())}/{pad(editRange.fin.getMonth() + 1)} {pad(editRange.fin.getHours())}h00
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{editSlots.length} heure{editSlots.length > 1 ? 's' : ''}</p>
                          </div>
                          <p className="text-base font-bold text-white">{fmt(editTotal)} <span className="text-xs font-normal text-slate-400">FCFA</span></p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setShowEdit(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Annuler</button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving || editSlots.length === 0 || !editConsecutive}
                        className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                      >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
