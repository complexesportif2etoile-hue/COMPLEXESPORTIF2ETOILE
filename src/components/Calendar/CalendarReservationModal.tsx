import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, AlertTriangle, Plus, ChevronDown, ChevronUp, Banknote, Smartphone, Wallet, CreditCard, Moon, Sun, CheckCircle, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { CardShell } from '../ui/CardShell';
import { IconPill } from '../ui/IconPill';
import { getTarifForSlot, TARIF_SOIR_WEEKEND } from '../../lib/pricing';

const PAYMENT_METHODS = [
  { id: 'especes', label: 'Especes', icon: Banknote },
  { id: 'orange_money', label: 'Orange Money', icon: Smartphone },
  { id: 'wave', label: 'Wave', icon: Wallet },
  { id: 'autre', label: 'Autre', icon: CreditCard },
];

interface CalendarReservationModalProps {
  selectedDate: string;
  onClose: () => void;
}

interface ExistingReservation {
  id: string;
  terrain_id: string;
  client_name: string;
  client_phone: string;
  date_debut: string;
  date_fin: string;
  statut: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function periodsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

function makeDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getNextDays(fromDate: string, count: number): Date[] {
  const days: Date[] = [];
  const base = new Date(fromDate + 'T12:00:00');
  for (let i = -3; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(d);
  }
  return days;
}

const STATUS_COLORS: Record<string, string> = {
  'réservé': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  'check_in': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  'terminé': 'bg-teal-500/15 text-teal-400 border-teal-500/25',
  'annulé': 'bg-red-500/15 text-red-400 border-red-500/25',
};

const STATUS_LABELS: Record<string, string> = {
  'réservé': 'Reserve',
  'check_in': 'En cours',
  'terminé': 'Termine',
  'annulé': 'Annule',
};

const DAY_ABBR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const MON_ABBR = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aou', 'sep', 'oct', 'nov', 'dec'];

const TOTAL_SLOTS = 24;

export const CalendarReservationModal: React.FC<CalendarReservationModalProps> = ({ selectedDate: initialDate, onClose }) => {
  const { terrains, clients, refreshAll } = useData();
  const { profile } = useAuth();
  const activeTerrains = useMemo(() => terrains.filter((t) => t.is_active), [terrains]);

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const nowHour = now.getHours();

  const [currentDate, setCurrentDate] = useState(initialDate);
  const [dayReservations, setDayReservations] = useState<ExistingReservation[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedTerrain, setExpandedTerrain] = useState<string | null>(null);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedTerrain, setSelectedTerrain] = useState('');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [tvaApplicable, setTvaApplicable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [paymentType, setPaymentType] = useState<'none' | 'acompte' | 'total'>('none');
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [acompteAmount, setAcompteAmount] = useState('');

  const isToday = currentDate === todayStr;

  const visibleDays = useMemo(() => getNextDays(initialDate, 14), [initialDate]);

  const loadDayReservations = useCallback(async (dateStr: string) => {
    setLoadingSlots(true);
    try {
      const dayStart = `${dateStr}T00:00:00`;
      const dayEnd = `${dateStr}T23:59:59`;

      const { data } = await supabase
        .from('reservations')
        .select('id, terrain_id, client_name, client_phone, date_debut, date_fin, statut')
        .not('statut', 'eq', 'annulé')
        .lte('date_debut', dayEnd)
        .gte('date_fin', dayStart)
        .order('date_debut', { ascending: true });

      setDayReservations(data || []);
    } catch {
      setDayReservations([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    loadDayReservations(currentDate);
  }, [currentDate, loadDayReservations]);

  const reservationsByTerrain = useMemo(() => {
    const map: Record<string, ExistingReservation[]> = {};
    for (const t of activeTerrains) map[t.id] = [];
    for (const r of dayReservations) {
      if (map[r.terrain_id]) map[r.terrain_id].push(r);
    }
    return map;
  }, [dayReservations, activeTerrains]);

  const selectedTerrainReservations = useMemo(() => {
    if (!selectedTerrain) return [];
    return dayReservations.filter(r => r.terrain_id === selectedTerrain && r.statut !== 'terminé');
  }, [dayReservations, selectedTerrain]);

  const isSlotBooked = useCallback((terrainId: string, hour: number): boolean => {
    const res = (reservationsByTerrain[terrainId] || []).filter(r => r.statut !== 'terminé');
    const slotStart = new Date(`${currentDate}T${String(hour).padStart(2, '0')}:00:00`);
    const nextHour = hour + 1;
    let slotEnd: Date;
    if (nextHour >= 24) {
      const nextDay = new Date(currentDate + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = makeDateStr(nextDay);
      slotEnd = new Date(`${nextDayStr}T${String(nextHour - 24).padStart(2, '0')}:00:00`);
    } else {
      slotEnd = new Date(`${currentDate}T${String(nextHour).padStart(2, '0')}:00:00`);
    }
    return res.some(r => periodsOverlap(slotStart, slotEnd, new Date(r.date_debut), new Date(r.date_fin)));
  }, [currentDate, reservationsByTerrain]);

  const getSlotStartEnd = (hour: number) => {
    const endHour = (hour + 1) % 24;
    const hStart = String(hour).padStart(2, '0');
    const hEnd = String(endHour).padStart(2, '0');
    return { timeStart: `${hStart}:00`, timeEnd: `${hEnd}:00`, label: `${hStart}:00 - ${hEnd}:00` };
  };

  const overlapConflict = useMemo(() => {
    if (selectedHour === null || !selectedTerrain) return null;
    const { timeStart, timeEnd } = getSlotStartEnd(selectedHour);
    const newStart = new Date(`${currentDate}T${timeStart}:00`);
    let endDate = currentDate;
    if (selectedHour === 23) {
      const d = new Date(currentDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      endDate = makeDateStr(d);
    }
    const newEnd = new Date(`${endDate}T${timeEnd}:00`);
    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime()) || newEnd <= newStart) return null;
    const conflicting = selectedTerrainReservations.filter(r =>
      periodsOverlap(newStart, newEnd, new Date(r.date_debut), new Date(r.date_fin))
    );
    return conflicting.length > 0 ? conflicting : null;
  }, [selectedHour, selectedTerrain, selectedTerrainReservations, currentDate]);

  const handleSlotClick = (terrainId: string, hour: number) => {
    const booked = isSlotBooked(terrainId, hour);
    const isPast = isToday && hour <= nowHour;
    if (booked || isPast) return;
    setSelectedTerrain(terrainId);
    setSelectedHour(hour);
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientPhone || !selectedTerrain || selectedHour === null) {
      setError('Tous les champs sont requis');
      return;
    }
    if (overlapConflict) {
      setError('Impossible : le creneau chevauche une reservation existante.');
      return;
    }

    const { timeStart, timeEnd } = getSlotStartEnd(selectedHour);
    const startDateStr = `${currentDate}T${timeStart}:00`;
    let endDate = currentDate;
    if (selectedHour === 23) {
      const d = new Date(currentDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      endDate = makeDateStr(d);
    }
    const endDateStr = `${endDate}T${timeEnd}:00`;

    setLoading(true);
    setError('');

    try {
      const tarifTotal = getTarifForSlot(currentDate, selectedHour);
      const montantTva = tvaApplicable ? tarifTotal * 0.18 : 0;
      const montantTtc = tarifTotal + montantTva;

      const trimmedName = clientName.trim();
      const trimmedPhone = clientPhone.trim();

      const existingClient = clients.find(
        c => c.name.toLowerCase() === trimmedName.toLowerCase() && c.phone === trimmedPhone
      );

      if (!existingClient && trimmedName && trimmedPhone) {
        await supabase.from('clients').insert({ name: trimmedName, phone: trimmedPhone, email: '', address: '', notes: '' });
      }

      const amountPaid = paymentType === 'total' ? montantTtc : paymentType === 'acompte' ? Number(acompteAmount) || 0 : 0;
      const payStatus = amountPaid <= 0 ? 'UNPAID' : amountPaid >= montantTtc ? 'PAID' : 'PARTIAL';

      const { data: insertedRes, error: insertError } = await supabase.from('reservations').insert({
        terrain_id: selectedTerrain,
        client_name: trimmedName,
        client_phone: trimmedPhone,
        date_debut: startDateStr,
        date_fin: endDateStr,
        tarif_total: tarifTotal,
        tva_applicable: tvaApplicable,
        montant_tva: montantTva,
        montant_ttc: montantTtc,
        notes,
        statut: 'réservé',
        payment_status: payStatus,
        payment_method: paymentType !== 'none' ? (paymentMethod === 'wave' ? 'WAVE' : paymentMethod === 'orange_money' ? 'ORANGE_MONEY' : 'ON_SITE') : 'ON_SITE',
        amount_due: montantTtc,
        amount_paid: amountPaid,
        deposit_amount: paymentType === 'acompte' ? amountPaid : 0,
      }).select('id').single();

      if (insertError) throw insertError;

      if (paymentType !== 'none' && amountPaid > 0 && insertedRes?.id) {
        await supabase.from('encaissements').insert({
          reservation_id: insertedRes.id,
          montant_total: amountPaid,
          mode_paiement: paymentMethod,
          details_paiement: { type: paymentType === 'acompte' ? 'acompte' : 'paiement_total' },
          encaisse_par: profile?.id,
        });
      }

      await refreshAll();
      await loadDayReservations(currentDate);
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('overlap') || msg.includes('existe déjà') || msg.includes('durant cette période')) {
        setError('Ce creneau est deja reserve. Veuillez choisir un autre horaire.');
      } else {
        setError(msg || 'Erreur lors de la creation');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setClientName('');
    setClientPhone('');
    setSelectedTerrain('');
    setSelectedHour(null);
    setNotes('');
    setTvaApplicable(false);
    setPaymentType('none');
    setPaymentMethod('especes');
    setAcompteAmount('');
    setError('');
  };

  const tarifTotal = selectedHour !== null ? getTarifForSlot(currentDate, selectedHour) : 0;
  const montantTva = tvaApplicable ? tarifTotal * 0.18 : 0;
  const montantTtc = tarifTotal + montantTva;
  const selectedSlot = selectedHour !== null ? getSlotStartEnd(selectedHour) : null;

  const inputClass = 'w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5';

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-700/60 sticky top-0 bg-slate-800/95 backdrop-blur-sm rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white capitalize">{formatDateFull(currentDate)}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {dayReservations.length} reservation{dayReservations.length !== 1 ? 's' : ''} ce jour
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Reserver</span>
              </button>
            )}
            <IconPill size="sm" onClick={onClose} title="Fermer">
              <X className="w-4 h-4" />
            </IconPill>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Date strip */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {visibleDays.map(day => {
              const ds = makeDateStr(day);
              const isSel = ds === currentDate;
              const isToday2 = ds === todayStr;
              const isPast = day < new Date(new Date().setHours(0,0,0,0));
              return (
                <button
                  key={ds}
                  onClick={() => { setCurrentDate(ds); setSelectedHour(null); setShowForm(false); }}
                  className={`flex-shrink-0 w-14 flex flex-col items-center py-2.5 px-1.5 rounded-xl transition-all duration-200 border-2 ${
                    isSel
                      ? 'bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-500/30'
                      : isToday2
                        ? 'bg-white/5 border-amber-500/50 hover:bg-white/10'
                        : isPast
                          ? 'bg-transparent border-transparent opacity-40 cursor-default'
                          : 'bg-white/3 border-white/10 hover:border-white/25 hover:bg-white/8'
                  }`}
                >
                  <span className={`text-xl font-bold leading-none mb-0.5 ${isSel ? 'text-white' : 'text-slate-200'}`}>
                    {day.getDate()}
                  </span>
                  <span className={`text-[9px] font-semibold ${isSel ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {MON_ABBR[day.getMonth()]}
                  </span>
                  <span className={`text-[9px] font-medium ${isSel ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {DAY_ABBR[day.getDay()]}
                  </span>
                </button>
              );
            })}
          </div>

          {!showForm && (
            <>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent" />
                </div>
              ) : activeTerrains.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Aucun terrain actif.</p>
              ) : (
                <div className="space-y-4">
                  {/* Legend */}
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/15 border border-emerald-500/25 inline-block" />07h-19h Lun-Ven — 20 000 CFA</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-500/20 border border-violet-500/30 inline-block" />Soir/Nuit/Weekend — 25 000 CFA</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-700 border border-slate-600/50 inline-block" />Réservé</span>
                  </div>

                  {activeTerrains.map(terrain => {
                    const terrainRes = reservationsByTerrain[terrain.id] || [];
                    const activeRes = terrainRes.filter(r => r.statut !== 'terminé');
                    const isExpanded = expandedTerrain === terrain.id;

                    return (
                      <div key={terrain.id} className="rounded-xl border border-slate-700/40 bg-slate-900/30 overflow-hidden">
                        <button
                          onClick={() => setExpandedTerrain(isExpanded ? null : terrain.id)}
                          className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ring-2 ${activeRes.length === 0 ? 'bg-emerald-400 ring-emerald-400/20' : 'bg-amber-400 ring-amber-400/20'}`} />
                            <div className="text-left">
                              <p className="text-sm font-semibold text-white">{terrain.name}</p>
                              <p className="text-xs text-slate-500">
                                {activeRes.length > 0 ? `${activeRes.length} reservation${activeRes.length > 1 ? 's' : ''}` : 'Disponible'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedTerrain(terrain.id); setShowForm(true); setError(''); }}
                              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                            >
                              Reserver
                            </button>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-700/30 p-3.5 space-y-3">
                            {/* Slot grid for this terrain */}
                            <div className="grid grid-cols-4 gap-1.5">
                              {slots.map(hour => {
                                const booked = isSlotBooked(terrain.id, hour);
                                const isPast = isToday && hour <= nowHour;
                                const unavailable = booked || isPast;
                                const tarif = getTarifForSlot(currentDate, hour);
                                const isSoirWeekend = tarif === TARIF_SOIR_WEEKEND;
                                const hStr = String(hour).padStart(2, '0');

                                let cls = '';
                                if (unavailable) {
                                  cls = 'bg-slate-700/50 border-slate-600/40 cursor-not-allowed opacity-50 text-slate-600';
                                } else if (isSoirWeekend) {
                                  cls = 'bg-violet-500/15 border-violet-500/25 hover:bg-violet-500/30 text-violet-300 cursor-pointer';
                                } else {
                                  cls = 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-300 cursor-pointer';
                                }

                                return (
                                  <button
                                    key={hour}
                                    disabled={unavailable}
                                    onClick={() => handleSlotClick(terrain.id, hour)}
                                    className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-[11px] font-bold transition-all ${cls}`}
                                    title={`${hStr}:00 - ${String(hour + 1 >= 24 ? hour + 1 - 24 : hour + 1).padStart(2, '0')}:00 — ${tarif.toLocaleString()} CFA`}
                                  >
                                    <span>{hStr}h</span>
                                    {isSoirWeekend && !unavailable && <Moon className="w-2.5 h-2.5 mt-0.5 opacity-70" />}
                                    {booked && <span className="text-[8px] text-slate-500 font-normal">Res.</span>}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Existing reservations list */}
                            {terrainRes.length > 0 && (
                              <div className="space-y-1.5">
                                {terrainRes.map(r => (
                                  <div
                                    key={r.id}
                                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs border ${STATUS_COLORS[r.statut] || 'bg-slate-800/60 text-slate-400 border-slate-700/30'}`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-semibold truncate">{r.client_name}</span>
                                      <span className="text-[10px] opacity-70 shrink-0">{STATUS_LABELS[r.statut] || r.statut}</span>
                                    </div>
                                    <span className="font-mono shrink-0 font-semibold">
                                      {formatTime(r.date_debut)} - {formatTime(r.date_fin)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Nouvelle reservation</h3>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="text-xs font-medium text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-700/50 transition-all"
                >
                  Retour
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nom Client</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Telephone</label>
                  <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={inputClass} required />
                </div>
              </div>

              <div>
                <label className={labelClass}>Terrain</label>
                <select value={selectedTerrain} onChange={e => { setSelectedTerrain(e.target.value); setSelectedHour(null); }} className={inputClass} required>
                  <option value="">Selectionner un terrain</option>
                  {activeTerrains.map(terrain => (
                    <option key={terrain.id} value={terrain.id}>{terrain.name}</option>
                  ))}
                </select>
              </div>

              {/* Slot picker — créneaux pré-définis 1h */}
              {selectedTerrain && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className={labelClass + ' mb-0'}>Creneaux disponibles</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/15 border border-emerald-500/25 inline-block" />Journee</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-violet-500/20 border border-violet-500/30 inline-block" />Soir/Nuit</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {slots.map(hour => {
                      const booked = isSlotBooked(selectedTerrain, hour);
                      const isPast2 = isToday && hour <= nowHour;
                      const unavailable = booked || isPast2;
                      const tarif = getTarifForSlot(currentDate, hour);
                      const isSoir = tarif === TARIF_SOIR_WEEKEND;
                      const isSel = selectedHour === hour;
                      const endHour = (hour + 1) % 24;
                      const hStart = String(hour).padStart(2, '0');
                      const hEnd = String(endHour).padStart(2, '0');

                      let cls = '';
                      if (isSel) {
                        cls = isSoir
                          ? 'bg-violet-500 border-violet-400 text-white shadow-lg shadow-violet-500/30'
                          : 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/25';
                      } else if (unavailable) {
                        cls = 'bg-slate-800/60 border-slate-700/40 cursor-not-allowed opacity-40 text-slate-600';
                      } else if (isSoir) {
                        cls = 'bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20 text-violet-200 cursor-pointer hover:border-violet-500/40';
                      } else {
                        cls = 'bg-slate-800/40 border-slate-700/30 hover:bg-emerald-500/10 hover:border-emerald-500/25 text-slate-200 cursor-pointer';
                      }

                      return (
                        <button
                          key={hour}
                          type="button"
                          disabled={unavailable}
                          onClick={() => !unavailable && setSelectedHour(isSel ? null : hour)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-150 ${cls}`}
                        >
                          <div className="flex items-center gap-2">
                            {isSoir
                              ? <Moon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              : <Sun className="w-3.5 h-3.5 shrink-0 opacity-50" />
                            }
                            <span className="text-sm font-bold">{hStart}:00 - {hEnd}:00</span>
                            {booked && !isSel && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-500">Res.</span>
                            )}
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-1.5">
                            <div>
                              <p className={`text-xs font-bold ${isSel ? 'text-white' : isSoir ? 'text-violet-300' : 'text-emerald-400'}`}>
                                {tarif.toLocaleString()} CFA
                              </p>
                              <p className={`text-[10px] ${isSel ? 'text-white/70' : 'text-slate-500'}`}>
                                {isSoir ? 'Soiree' : 'Journee'}
                              </p>
                            </div>
                            {isSel && <CheckCircle className="w-4 h-4 shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedHour !== null && selectedSlot && (
                    <div className={`p-3 rounded-xl border flex items-center gap-3 ${overlapConflict ? 'bg-red-500/8 border-red-500/25' : tarifTotal === TARIF_SOIR_WEEKEND ? 'bg-violet-500/8 border-violet-500/20' : 'bg-emerald-500/8 border-emerald-500/20'}`}>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${overlapConflict ? 'text-red-300' : 'text-white'}`}>
                          {selectedSlot.label}
                        </p>
                        <p className={`text-xs mt-0.5 ${overlapConflict ? 'text-red-400' : tarifTotal === TARIF_SOIR_WEEKEND ? 'text-violet-400' : 'text-emerald-400'}`}>
                          {overlapConflict ? 'Creneau indisponible' : `${tarifTotal.toLocaleString()} CFA`}
                        </p>
                      </div>
                      {overlapConflict && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={tvaApplicable} onChange={e => setTvaApplicable(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500/50" />
                  <span className="text-sm font-medium text-slate-300">Appliquer TVA (18%)</span>
                </label>
              </div>

              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inputClass} min-h-0 py-2.5`} placeholder="Notes additionnelles..." />
              </div>

              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Tarif HT:</span>
                  <span className="font-semibold text-white">{tarifTotal.toLocaleString()} CFA</span>
                </div>
                {tvaApplicable && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">TVA (18%):</span>
                    <span className="font-semibold text-white">{montantTva.toLocaleString()} CFA</span>
                  </div>
                )}
                <div className="flex justify-between text-base border-t border-slate-700/50 pt-2">
                  <span className="font-semibold text-white">Total TTC:</span>
                  <span className="font-bold text-emerald-400">{montantTtc.toLocaleString()} CFA</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/50 overflow-hidden">
                <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/40">
                  <p className="text-sm font-semibold text-white">Paiement a la creation</p>
                  <p className="text-xs text-slate-500 mt-0.5">Optionnel — enregistrez un acompte ou le paiement integral maintenant</p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex gap-2">
                    {(['none', 'acompte', 'total'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setPaymentType(t); if (t === 'total') setAcompteAmount(String(montantTtc)); else if (t === 'none') setAcompteAmount(''); }}
                        className={`flex-1 min-h-[40px] rounded-xl text-sm font-medium border transition-all ${
                          paymentType === t
                            ? t === 'none' ? 'bg-slate-700/60 text-slate-200 border-slate-600' : t === 'total' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-slate-800/40 text-slate-400 border-slate-700/40 hover:border-slate-600/60'
                        }`}
                      >
                        {t === 'none' ? 'Aucun' : t === 'acompte' ? 'Acompte' : 'Paiement total'}
                      </button>
                    ))}
                  </div>

                  {paymentType !== 'none' && (
                    <>
                      {paymentType === 'acompte' && (
                        <div>
                          <label className="block text-sm text-slate-400 mb-1.5 font-medium">Montant de l'acompte</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={acompteAmount}
                              onChange={e => setAcompteAmount(e.target.value)}
                              min={1}
                              max={montantTtc - 1}
                              className="w-full px-4 min-h-[44px] pr-16 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                              placeholder={`Max ${montantTtc.toLocaleString()}`}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">CFA</span>
                          </div>
                        </div>
                      )}
                      {paymentType === 'total' && (
                        <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                          <span className="text-sm text-slate-300">Montant a encaisser</span>
                          <span className="text-base font-bold text-emerald-400">{montantTtc.toLocaleString()} CFA</span>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm text-slate-400 mb-1.5 font-medium">Mode de paiement</label>
                        <div className="grid grid-cols-2 gap-2">
                          {PAYMENT_METHODS.map(m => {
                            const Icon = m.icon;
                            const sel = paymentMethod === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setPaymentMethod(m.id)}
                                className={`flex items-center gap-2.5 p-3 min-h-[44px] rounded-xl border transition-all ${sel ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800/40 text-slate-400 border-slate-700/40 hover:border-slate-600/60'}`}
                              >
                                <Icon className="w-4 h-4" />
                                <span className="text-sm font-medium">{m.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 min-h-[44px] text-sm font-medium text-slate-300 bg-slate-700/60 hover:bg-slate-600/70 rounded-xl transition-all border border-slate-600/50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || !!overlapConflict || selectedHour === null}
                  className="px-5 min-h-[44px] text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/20"
                >
                  {loading ? 'Creation...' : overlapConflict ? 'Creneau indisponible' : selectedHour === null ? 'Choisir un creneau' : 'Creer Reservation'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
