import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, AlertTriangle, ChevronDown, Banknote, Smartphone, Wallet, CreditCard, Moon, Sun, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { IconPill } from '../ui/IconPill';
import { getTarifForSlot, TARIF_SOIR_WEEKEND, TARIF_JOUR } from '../../lib/pricing';

const PAYMENT_METHODS = [
  { id: 'especes', label: 'Especes', icon: Banknote },
  { id: 'orange_money', label: 'Orange Money', icon: Smartphone },
  { id: 'wave', label: 'Wave', icon: Wallet },
  { id: 'autre', label: 'Autre', icon: CreditCard },
];

interface ClientReservationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Terrain {
  id: string;
  name: string;
  tarif_horaire: number;
}

interface ExistingReservation {
  id: string;
  client_name: string;
  date_debut: string;
  date_fin: string;
  statut: string;
}

function periodsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

function makeDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getNextDays(count: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAY_ABBR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const MON_ABBR = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aou', 'sep', 'oct', 'nov', 'dec'];

export const ClientReservationForm: React.FC<ClientReservationFormProps> = ({ onClose, onSuccess }) => {
  const { clients } = useData();
  const { profile } = useAuth();
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLDivElement>(null);

  const [selectedTerrain, setSelectedTerrain] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const [notes, setNotes] = useState('');
  const [tvaApplicable, setTvaApplicable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingReservations, setExistingReservations] = useState<ExistingReservation[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [paymentType, setPaymentType] = useState<'none' | 'acompte' | 'total'>('none');
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [acompteAmount, setAcompteAmount] = useState('');

  const today = new Date();
  const todayStr = makeDateStr(today);
  const nowHour = today.getHours();
  const isSelectedToday = selectedDate === todayStr;

  const nextDays = useMemo(() => getNextDays(14), []);

  useEffect(() => {
    supabase.from('terrains').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setTerrains(data);
    });
  }, []);

  const clientSuggestions = useMemo(() => {
    if (!clientName.trim() || clientName.length < 1) return [];
    const q = clientName.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [clientName, clients]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientInputRef.current && !clientInputRef.current.contains(e.target as Node)) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectClient = (c: { name: string; phone: string }) => {
    setClientName(c.name);
    setClientPhone(c.phone);
    setShowClientSuggestions(false);
  };

  const loadExistingReservations = useCallback(async (terrainId: string, date: string) => {
    if (!terrainId || !date) { setExistingReservations([]); return; }
    setLoadingSlots(true);
    try {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      const { data } = await supabase
        .from('reservations')
        .select('id, client_name, date_debut, date_fin, statut')
        .eq('terrain_id', terrainId)
        .not('statut', 'in', '("annulé","terminé")')
        .lte('date_debut', dayEnd)
        .gte('date_fin', dayStart)
        .order('date_debut', { ascending: true });
      setExistingReservations(data || []);
    } catch {
      setExistingReservations([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    loadExistingReservations(selectedTerrain, selectedDate);
  }, [selectedTerrain, selectedDate, loadExistingReservations]);

  const isSlotBooked = useCallback((hour: number): boolean => {
    const slotStart = new Date(`${selectedDate}T${String(hour).padStart(2, '0')}:00:00`);
    const nextHour = hour + 1;
    let slotEnd: Date;
    if (nextHour >= 24) {
      const nd = new Date(selectedDate + 'T00:00:00');
      nd.setDate(nd.getDate() + 1);
      slotEnd = new Date(`${makeDateStr(nd)}T00:00:00`);
    } else {
      slotEnd = new Date(`${selectedDate}T${String(nextHour).padStart(2, '0')}:00:00`);
    }
    return existingReservations.some(r =>
      periodsOverlap(slotStart, slotEnd, new Date(r.date_debut), new Date(r.date_fin))
    );
  }, [selectedDate, existingReservations]);

  const getSlotStartEnd = (hour: number) => {
    const endHour = (hour + 1) % 24;
    const hStart = String(hour).padStart(2, '0');
    const hEnd = String(endHour).padStart(2, '0');
    return { timeStart: `${hStart}:00`, timeEnd: `${hEnd}:00`, label: `${hStart}:00 - ${hEnd}:00` };
  };

  const selectedSlot = selectedHour !== null ? getSlotStartEnd(selectedHour) : null;
  const tarifSlot = selectedDate && selectedHour !== null ? getTarifForSlot(selectedDate, selectedHour) : 0;
  const montantTva = tvaApplicable ? tarifSlot * 0.18 : 0;
  const montantTtc = tarifSlot + montantTva;

  const overlapConflict = useMemo(() => {
    if (selectedHour === null || !selectedDate || existingReservations.length === 0) return null;
    const { timeStart, timeEnd } = getSlotStartEnd(selectedHour);
    const newStart = new Date(`${selectedDate}T${timeStart}:00`);
    let endDate = selectedDate;
    if (selectedHour === 23) {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      endDate = makeDateStr(d);
    }
    const newEnd = new Date(`${endDate}T${timeEnd}:00`);
    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime()) || newEnd <= newStart) return null;
    const conflicting = existingReservations.filter(r =>
      periodsOverlap(newStart, newEnd, new Date(r.date_debut), new Date(r.date_fin))
    );
    return conflicting.length > 0 ? conflicting : null;
  }, [selectedHour, selectedDate, existingReservations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientPhone || !selectedTerrain || !selectedDate || selectedHour === null) {
      setError('Tous les champs sont requis');
      return;
    }
    if (overlapConflict) {
      setError('Impossible de creer la reservation : le creneau chevauche une reservation existante.');
      return;
    }

    const { timeStart, timeEnd } = getSlotStartEnd(selectedHour);
    const startDateStr = `${selectedDate}T${timeStart}:00`;
    let endDate = selectedDate;
    if (selectedHour === 23) {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      endDate = makeDateStr(d);
    }
    const endDateStr = `${endDate}T${timeEnd}:00`;

    setLoading(true);
    setError('');

    try {
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
        tarif_total: tarifSlot,
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

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('existe déjà') || msg.includes('overlap') || msg.includes('durant cette période')) {
        setError('Ce creneau est deja reserve pour ce terrain. Veuillez choisir un autre horaire.');
      } else {
        setError(msg || 'Erreur lors de la creation');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5';
  const slots = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-700/60 sticky top-0 bg-slate-800/95 backdrop-blur-sm rounded-t-2xl z-10">
          <h2 className="text-lg sm:text-xl font-semibold text-white">Nouvelle Reservation</h2>
          <IconPill size="sm" onClick={onClose} title="Fermer">
            <X className="w-4 h-4" />
          </IconPill>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div ref={clientInputRef} className="relative">
              <label className={labelClass}>Nom Client</label>
              <div className="relative">
                <input
                  type="text"
                  value={clientName}
                  onChange={e => { setClientName(e.target.value); setShowClientSuggestions(true); }}
                  onFocus={() => setShowClientSuggestions(true)}
                  className={inputClass}
                  placeholder="Tapez pour rechercher..."
                  required
                />
                {clients.length > 0 && <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />}
              </div>
              {showClientSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-800 border border-slate-700/60 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {clientSuggestions.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-emerald-500/10 transition-colors text-left"
                    >
                      <span className="text-sm text-white font-medium truncate">{c.name}</span>
                      {c.phone && <span className="text-xs text-slate-500 shrink-0 ml-2">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={labelClass}>Telephone</label>
              <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={inputClass} required />
            </div>
          </div>

          {/* Terrain */}
          <div>
            <label className={labelClass}>Terrain</label>
            <select
              value={selectedTerrain}
              onChange={e => { setSelectedTerrain(e.target.value); setSelectedHour(null); }}
              className={inputClass}
              required
            >
              <option value="">Selectionner un terrain</option>
              {terrains.map(terrain => (
                <option key={terrain.id} value={terrain.id}>
                  {terrain.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date strip */}
          <div>
            <label className={labelClass}>Date</label>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {nextDays.map(day => {
                const ds = makeDateStr(day);
                const isSel = ds === selectedDate;
                const isToday2 = ds === todayStr;
                return (
                  <button
                    key={ds}
                    type="button"
                    onClick={() => { setSelectedDate(ds); setSelectedHour(null); }}
                    className={`flex-shrink-0 w-14 flex flex-col items-center py-2.5 px-1.5 rounded-xl transition-all duration-200 border-2 ${
                      isSel
                        ? 'bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-500/30'
                        : isToday2
                          ? 'bg-white/5 border-amber-500/50 hover:bg-white/10'
                          : 'bg-white/3 border-white/10 hover:border-white/25 hover:bg-white/8'
                    }`}
                  >
                    <span className={`text-xl font-bold leading-none mb-0.5 ${isSel ? 'text-white' : 'text-slate-200'}`}>{day.getDate()}</span>
                    <span className={`text-[9px] font-semibold ${isSel ? 'text-emerald-100' : 'text-slate-500'}`}>{MON_ABBR[day.getMonth()]}</span>
                    <span className={`text-[9px] font-medium ${isSel ? 'text-emerald-100' : 'text-slate-500'}`}>{DAY_ABBR[day.getDay()]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot picker — créneaux pré-définis 1h */}
          {selectedDate && selectedTerrain && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={labelClass + ' mb-0'}>Creneaux disponibles</label>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/15 border border-emerald-500/25 inline-block" />Journee — 20 000</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-violet-500/20 border border-violet-500/30 inline-block" />Soir/Nuit — 25 000</span>
                </div>
              </div>

              {loadingSlots ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map(hour => {
                    const booked = isSlotBooked(hour);
                    const isPast = isSelectedToday && hour <= nowHour;
                    const unavailable = booked || isPast;
                    const tarif = getTarifForSlot(selectedDate, hour);
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
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150 ${cls}`}
                      >
                        <div className="flex items-center gap-2">
                          {isSoir
                            ? <Moon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                            : <Sun className="w-3.5 h-3.5 shrink-0 opacity-50" />
                          }
                          <span className="text-sm font-bold">
                            {hStart}:00 - {hEnd}:00
                          </span>
                          {booked && !isSel && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-500">
                              Reserve
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-bold ${isSel ? 'text-white' : isSoir ? 'text-violet-300' : 'text-emerald-400'}`}>
                            {tarif.toLocaleString()} CFA
                          </p>
                          <p className={`text-[10px] ${isSel ? 'text-white/70' : 'text-slate-500'}`}>
                            {isSoir ? 'Soiree' : 'Journee'}
                          </p>
                        </div>
                        {isSel && <CheckCircle className="w-4 h-4 ml-2 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedHour !== null && selectedSlot && (
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${overlapConflict ? 'bg-red-500/8 border-red-500/25' : tarifSlot === TARIF_SOIR_WEEKEND ? 'bg-violet-500/8 border-violet-500/20' : 'bg-emerald-500/8 border-emerald-500/20'}`}>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${overlapConflict ? 'text-red-300' : 'text-white'}`}>
                      {selectedSlot.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${overlapConflict ? 'text-red-400' : tarifSlot === TARIF_SOIR_WEEKEND ? 'text-violet-400' : 'text-emerald-400'}`}>
                      {overlapConflict ? 'Creneau indisponible' : `${tarifSlot.toLocaleString()} CFA`}
                    </p>
                  </div>
                  {overlapConflict && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
                </div>
              )}
            </div>
          )}

          {/* TVA */}
          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={tvaApplicable} onChange={e => setTvaApplicable(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500/50" />
              <span className="text-sm font-medium text-slate-300">Appliquer TVA (18%)</span>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inputClass} min-h-0 py-2.5`} placeholder="Notes additionnelles..." />
          </div>

          {/* Summary */}
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Tarif HT:</span>
              <span className="font-semibold text-white">{tarifSlot.toLocaleString()} CFA</span>
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

          {/* Payment */}
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
                          className={`${inputClass} pr-16`}
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

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
            <button type="button" onClick={onClose} className="px-4 min-h-[44px] text-sm font-medium text-slate-300 bg-slate-700/60 hover:bg-slate-600/70 rounded-xl transition-all border border-slate-600/50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !!overlapConflict || !selectedDate || selectedHour === null}
              className="px-5 min-h-[44px] text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/20"
            >
              {loading ? 'Creation...' : overlapConflict ? 'Creneau indisponible' : selectedHour === null ? 'Choisir un creneau' : 'Creer Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
