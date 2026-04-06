import { useState, useEffect, useMemo } from 'react';
import { MapPin, CheckCircle, Loader2, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Terrain, DepositSettings } from '../../types';
import {
  TARIF_JOUR, TARIF_NUIT,
  SlotHour, buildDaySlots,
  calcTotalFromSlots, slotsToRange, areConsecutive, fmt,
} from '../utils/tarifUtils';

type Step = 'terrain' | 'slots' | 'info' | 'payment' | 'confirm';

const MONTH_NAMES = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const DAY_NAMES = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

function isSlotBlocked(slot: SlotHour, nowMs: number, bookedRanges: { debut: Date; fin: Date }[]): boolean {
  if (slot.startDate.getTime() < nowMs) return true;
  return bookedRanges.some(r => slot.startDate.getTime() < r.fin.getTime() && slot.endDate.getTime() > r.debut.getTime());
}

export function PublicBookingPage() {
  const [step, setStep] = useState<Step>('terrain');
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [depositSettings, setDepositSettings] = useState<DepositSettings | null>(null);
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<SlotHour[]>([]);
  const [calDate, setCalDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ON_SITE' | 'WAVE' | 'ORANGE_MONEY'>('ON_SITE');
  const [loading, setLoading] = useState(false);
  const [bookingCode, setBookingCode] = useState('');
  const [error, setError] = useState('');
  const [bookedRanges, setBookedRanges] = useState<{ debut: Date; fin: Date }[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase.from('terrains').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setTerrains(data);
    });
    supabase.from('deposit_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setDepositSettings(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedTerrain) { setBookedRanges([]); return; }
    supabase
      .from('reservations')
      .select('date_debut, date_fin')
      .eq('terrain_id', selectedTerrain.id)
      .not('statut', 'in', '("annulé","terminé")')
      .then(({ data }) => {
        if (data) {
          setBookedRanges(data.map(r => ({ debut: new Date(r.date_debut), fin: new Date(r.date_fin) })));
        }
      });
  }, [selectedTerrain]);

  const daySlots = useMemo(() => buildDaySlots(calDate), [calDate]);
  const nextDaySlots = useMemo(() => {
    const next = new Date(calDate);
    next.setDate(next.getDate() + 1);
    return buildDaySlots(next);
  }, [calDate]);
  const allVisibleSlots = useMemo(() => [...daySlots, ...nextDaySlots.slice(0, 8)], [daySlots, nextDaySlots]);

  const isSlotSelected = (slot: SlotHour) =>
    selectedSlots.some(s => s.startDate.getTime() === slot.startDate.getTime());

  const toggleSlot = (slot: SlotHour) => {
    if (isSlotSelected(slot)) {
      setSelectedSlots(prev => prev.filter(s => s.startDate.getTime() !== slot.startDate.getTime()));
    } else {
      setSelectedSlots(prev => [...prev, slot]);
    }
  };

  const total = calcTotalFromSlots(selectedSlots);
  const range = slotsToRange(selectedSlots);
  const consecutive = areConsecutive(selectedSlots);

  const calcDeposit = () => {
    if (!depositSettings) return total;
    if (depositSettings.deposit_type === 'PERCENTAGE') {
      return Math.ceil((total * depositSettings.deposit_value) / 100);
    }
    return depositSettings.deposit_value;
  };
  const deposit = calcDeposit();

  const pad = (n: number) => String(n).padStart(2, '0');

  const navigateDate = (dir: number) => {
    const d = new Date(calDate);
    d.setDate(d.getDate() + dir);
    setCalDate(d);
    setSelectedSlots([]);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const calDayLabel = `${DAY_NAMES[calDate.getDay()]} ${calDate.getDate()} ${MONTH_NAMES[calDate.getMonth()]}`;

  const handleSubmit = async () => {
    if (!range || !selectedTerrain) return;
    setError('');
    setLoading(true);
    try {
      const { data, error } = await supabase.from('reservations').insert({
        terrain_id: selectedTerrain.id,
        client_name: clientName,
        client_phone: clientPhone,
        date_debut: range.debut.toISOString(),
        date_fin: range.fin.toISOString(),
        tarif_total: total,
        montant_ttc: total,
        statut: 'en_attente',
        payment_method: paymentMethod,
        payment_status: 'UNPAID',
        amount_due: total,
        amount_paid: 0,
        deposit_amount: deposit,
        created_by: null,
      }).select('code_court').single();

      if (error) throw error;
      setBookingCode(data.code_court);
      setStep('confirm');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la réservation');
    }
    setLoading(false);
  };

  const STEPS: Step[] = ['terrain', 'slots', 'info', 'payment'];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <MapPin className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Réserver un terrain</h1>
          <p className="text-slate-400 text-sm mt-1">Complexe Sportif</p>
        </div>

        {step === 'confirm' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Réservation enregistrée !</h2>
            <p className="text-slate-400 text-sm mb-6">Votre demande est en attente de confirmation.</p>
            <div className="bg-slate-800 rounded-xl p-4 mb-6">
              <p className="text-xs text-slate-500 mb-1">Code de réservation</p>
              <p className="text-3xl font-mono font-bold text-emerald-400 tracking-widest">{bookingCode}</p>
              <p className="text-xs text-slate-500 mt-2">Conservez ce code pour suivre votre réservation</p>
            </div>
            <p className="text-xs text-slate-500">
              Accédez à votre réservation sur:{' '}
              <span className="text-emerald-400 font-mono">/rsvp/{bookingCode}</span>
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex border-b border-slate-800">
              {STEPS.map((s, i) => {
                const currentIdx = STEPS.indexOf(step);
                const idx = STEPS.indexOf(s);
                return (
                  <div key={s} className={`flex-1 py-3 text-center text-xs transition-all ${idx === currentIdx ? 'text-emerald-400 border-b-2 border-emerald-500' : idx < currentIdx ? 'text-slate-400' : 'text-slate-600'}`}>
                    {i + 1}
                  </div>
                );
              })}
            </div>

            <div className="p-5">
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl mb-4">{error}</div>}

              {step === 'terrain' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-semibold text-white mb-1">Choisissez un terrain</h2>
                    <div className="grid grid-cols-2 gap-2 mb-4">
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
                  </div>
                  <div className="space-y-3">
                    {terrains.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTerrain(t); setStep('slots'); }}
                        className={`w-full text-left bg-slate-800 hover:bg-slate-700 border ${selectedTerrain?.id === t.id ? 'border-emerald-500' : 'border-slate-700'} rounded-xl p-4 transition-all`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-200">{t.name}</p>
                            {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'slots' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-white">Choisissez vos créneaux</h2>
                    <span className="text-xs text-slate-500">{selectedTerrain?.name}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => navigateDate(-1)}
                      disabled={calDate.getTime() <= today.getTime()}
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

                  <p className="text-[11px] text-slate-500">Sélectionnez des créneaux consécutifs (min. 1h)</p>

                  <div className="grid grid-cols-2 gap-1.5">
                    {allVisibleSlots.map((slot, i) => {
                      const selected = isSlotSelected(slot);
                      const blocked = isSlotBlocked(slot, nowMs, bookedRanges);
                      const isNextDay = slot.startDate.getDate() !== calDate.getDate();
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
                                  ? 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-blue-400/50 hover:bg-blue-500/5'
                                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-amber-400/50 hover:bg-amber-500/5'
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

                  {!consecutive && selectedSlots.length > 1 && (
                    <p className="text-xs text-red-400">Les créneaux doivent être consécutifs.</p>
                  )}

                  {selectedSlots.length > 0 && range && consecutive && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-400">
                            {pad(range.debut.getDate())}/{pad(range.debut.getMonth() + 1)} {pad(range.debut.getHours())}h00
                            {' → '}
                            {pad(range.fin.getDate())}/{pad(range.fin.getMonth() + 1)} {pad(range.fin.getHours())}h00
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{selectedSlots.length} heure{selectedSlots.length > 1 ? 's' : ''}</p>
                        </div>
                        <p className="text-lg font-bold text-white">{fmt(total)} <span className="text-xs font-normal text-slate-400">FCFA</span></p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setStep('terrain')} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Retour</button>
                    <button
                      onClick={() => setStep('info')}
                      disabled={selectedSlots.length === 0 || !consecutive}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all"
                    >
                      Continuer
                    </button>
                  </div>
                </div>
              )}

              {step === 'info' && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-white">Vos informations</h2>
                  {range && (
                    <div className="bg-slate-800/50 rounded-xl p-3 text-xs text-slate-400">
                      {selectedTerrain?.name} · {pad(range.debut.getHours())}h00 → {pad(range.fin.getHours())}h00 · {selectedSlots.length}h · <span className="text-white font-semibold">{fmt(total)} FCFA</span>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Nom complet</label>
                      <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Prénom Nom" className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Téléphone</label>
                      <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+221..." className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep('slots')} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Retour</button>
                    <button onClick={() => setStep('payment')} disabled={!clientName || !clientPhone} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all">Continuer</button>
                  </div>
                </div>
              )}

              {step === 'payment' && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-white">Mode de paiement</h2>
                  <div className="space-y-3">
                    {(['ON_SITE', ...(depositSettings?.online_payment_enabled ? ['WAVE', 'ORANGE_MONEY'] : [])] as const).map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method as 'ON_SITE' | 'WAVE' | 'ORANGE_MONEY')}
                        className={`w-full text-left bg-slate-800 border ${paymentMethod === method ? 'border-emerald-500' : 'border-slate-700'} rounded-xl p-4 transition-all hover:bg-slate-700`}
                      >
                        <p className="font-medium text-slate-200">
                          {method === 'ON_SITE' ? 'Paiement sur place' : method === 'WAVE' ? 'Wave' : 'Orange Money'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {method === 'ON_SITE' ? 'Payez à votre arrivée' : `Acompte: ${fmt(deposit)} FCFA`}
                        </p>
                      </button>
                    ))}
                  </div>

                  {range && (
                    <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Terrain</span>
                        <span className="text-slate-200">{selectedTerrain?.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Horaires</span>
                        <span className="text-slate-300">
                          {pad(range.debut.getDate())}/{pad(range.debut.getMonth() + 1)} {pad(range.debut.getHours())}h → {pad(range.fin.getDate())}/{pad(range.fin.getMonth() + 1)} {pad(range.fin.getHours())}h
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-slate-700 pt-2">
                        <span className="text-slate-400">Total ({selectedSlots.length}h)</span>
                        <span className="font-bold text-white">{fmt(total)} FCFA</span>
                      </div>
                      {paymentMethod !== 'ON_SITE' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Acompte à payer</span>
                          <span className="font-bold text-emerald-400">{fmt(deposit)} FCFA</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setStep('info')} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Retour</button>
                    <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Confirmer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
