import { useState, useEffect, useMemo } from 'react';
import { MapPin, CheckCircle, Loader2, Sun, Moon, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Terrain, DepositSettings } from '../../types';
import { calcTarifBySlots } from '../utils/tarifUtils';

type Step = 'terrain' | 'datetime' | 'info' | 'payment' | 'confirm';

export function PublicBookingPage() {
  const [step, setStep] = useState<Step>('terrain');
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [depositSettings, setDepositSettings] = useState<DepositSettings | null>(null);
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain | null>(null);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ON_SITE' | 'WAVE' | 'ORANGE_MONEY'>('ON_SITE');
  const [loading, setLoading] = useState(false);
  const [bookingCode, setBookingCode] = useState('');
  const [error, setError] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    supabase.from('terrains').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setTerrains(data);
    });
    supabase.from('deposit_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setDepositSettings(data);
    });
  }, []);

  const tarifResult = useMemo(() => {
    if (!selectedTerrain || !dateDebut || !dateFin) return null;
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    if (fin <= debut) return null;
    return calcTarifBySlots(debut, fin, selectedTerrain);
  }, [selectedTerrain, dateDebut, dateFin]);

  const tarif = tarifResult?.total || 0;

  const calcDeposit = () => {
    if (!depositSettings) return tarif;
    if (depositSettings.deposit_type === 'PERCENTAGE') {
      return Math.ceil((tarif * depositSettings.deposit_value) / 100);
    }
    return depositSettings.deposit_value;
  };

  const deposit = calcDeposit();

  const formatDatetimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleSelectTerrain = (t: Terrain) => {
    setSelectedTerrain(t);
    const hj = parseInt((t.heure_debut_jour || '08:00').split(':')[0]);
    const hn = parseInt((t.heure_debut_nuit || '18:00').split(':')[0]);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hj, 0, 0, 0);
    const fin = new Date(tomorrow);
    fin.setHours(hn, 0, 0, 0);
    setDateDebut(formatDatetimeLocal(tomorrow));
    setDateFin(formatDatetimeLocal(fin));
    setStep('datetime');
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const { data, error } = await supabase.from('reservations').insert({
        terrain_id: selectedTerrain!.id,
        client_name: clientName,
        client_phone: clientPhone,
        date_debut: new Date(dateDebut).toISOString(),
        date_fin: new Date(dateFin).toISOString(),
        tarif_total: tarif,
        montant_ttc: tarif,
        statut: 'en_attente',
        payment_method: paymentMethod,
        payment_status: 'UNPAID',
        amount_due: tarif,
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

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
  const pad = (n: number) => String(n).padStart(2, '0');

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
              {(['terrain', 'datetime', 'info', 'payment'] as Step[]).map((s, i) => {
                const steps = ['terrain', 'datetime', 'info', 'payment'];
                const currentIdx = steps.indexOf(step);
                const idx = steps.indexOf(s);
                return (
                  <div key={s} className={`flex-1 py-3 text-center text-xs transition-all ${idx === currentIdx ? 'text-emerald-400 border-b-2 border-emerald-500' : idx < currentIdx ? 'text-slate-400' : 'text-slate-600'}`}>
                    {i + 1}
                  </div>
                );
              })}
            </div>

            <div className="p-6">
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl mb-4">{error}</div>}

              {step === 'terrain' && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-white">Choisissez un terrain</h2>
                  <div className="space-y-3">
                    {terrains.map((t) => {
                      const hj = parseInt((t.heure_debut_jour || '08:00').split(':')[0]);
                      const hn = parseInt((t.heure_debut_nuit || '18:00').split(':')[0]);
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleSelectTerrain(t)}
                          className={`w-full text-left bg-slate-800 hover:bg-slate-700 border ${selectedTerrain?.id === t.id ? 'border-emerald-500' : 'border-slate-700'} rounded-xl p-4 transition-all`}
                        >
                          <p className="font-medium text-slate-200 mb-2">{t.name}</p>
                          {t.description && <p className="text-xs text-slate-500 mb-3">{t.description}</p>}
                          <div className="grid grid-cols-2 gap-2">
                            {t.tarif_jour > 0 && (
                              <div className="bg-amber-500/10 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                <Sun className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                <div>
                                  <p className="text-[10px] text-slate-500">{pad(hj)}h–{pad(hn)}h · Sem.</p>
                                  <p className="text-xs font-bold text-amber-400">{fmt(t.tarif_jour)} F</p>
                                </div>
                              </div>
                            )}
                            {t.tarif_nuit > 0 && (
                              <div className="bg-blue-500/10 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                <Moon className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                <div>
                                  <p className="text-[10px] text-slate-500">{pad(hn)}h–{pad(hj)}h · WE</p>
                                  <p className="text-xs font-bold text-blue-400">{fmt(t.tarif_nuit)} F</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 'datetime' && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-white">Choisissez vos horaires</h2>

                  {selectedTerrain && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2 flex items-center gap-2">
                        <Sun className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">Journée (Lun–Ven)</p>
                          <p className="text-xs font-bold text-amber-400">{fmt(selectedTerrain.tarif_jour || selectedTerrain.tarif_horaire)} F/h</p>
                        </div>
                      </div>
                      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-3 py-2 flex items-center gap-2">
                        <Moon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">Soir / Weekend</p>
                          <p className="text-xs font-bold text-blue-400">{fmt(selectedTerrain.tarif_nuit || selectedTerrain.tarif_horaire)} F/h</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Début</label>
                      <input
                        type="datetime-local"
                        value={dateDebut}
                        onChange={(e) => setDateDebut(e.target.value)}
                        min={formatDatetimeLocal(new Date())}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Fin</label>
                      <input
                        type="datetime-local"
                        value={dateFin}
                        onChange={(e) => setDateFin(e.target.value)}
                        min={dateDebut}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {tarifResult && tarif > 0 && (
                      <div className="rounded-xl overflow-hidden border border-slate-700">
                        <button
                          type="button"
                          onClick={() => setShowBreakdown(!showBreakdown)}
                          className="w-full px-4 py-3 flex items-center justify-between bg-slate-800/60 hover:bg-slate-800 transition-all"
                        >
                          <div>
                            <span className="text-xs text-slate-400 block text-left">Tarif estimé</span>
                            <span className="font-bold text-lg text-emerald-400">{fmt(tarif)} FCFA</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{tarifResult.slots.length}h</span>
                            {showBreakdown ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </button>

                        {showBreakdown && (
                          <div className="bg-slate-800/30 border-t border-slate-700/50 max-h-48 overflow-y-auto">
                            <div className="grid grid-cols-2 text-[10px] font-medium text-slate-500 px-4 py-1.5 border-b border-slate-700/30">
                              <span>Créneau</span>
                              <span className="text-right">Tarif</span>
                            </div>
                            {tarifResult.slots.map((slot, i) => (
                              <div key={i} className="flex items-center justify-between px-4 py-1.5 text-xs border-b border-slate-700/20 last:border-0">
                                <div className="flex items-center gap-1.5">
                                  {slot.isNight
                                    ? <Moon className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                    : <Sun className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                  }
                                  <span className="text-slate-300">{slot.label}</span>
                                  {slot.isWeekend && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1 rounded">WE</span>}
                                </div>
                                <span className={`font-medium ${slot.isNight ? 'text-blue-400' : 'text-amber-400'}`}>
                                  {fmt(slot.tarif)} F
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep('terrain')} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Retour</button>
                    <button onClick={() => setStep('info')} disabled={!dateDebut || !dateFin || tarif <= 0} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all">Continuer</button>
                  </div>
                </div>
              )}

              {step === 'info' && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-white">Vos informations</h2>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Nom complet</label>
                      <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Prénom Nom" className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Téléphone</label>
                      <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+221..." className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    {tarif > 0 && (
                      <div className="bg-slate-800/50 rounded-xl p-3 flex justify-between text-sm">
                        <span className="text-slate-400">Montant total</span>
                        <span className="font-bold text-emerald-400">{fmt(tarif)} FCFA</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep('datetime')} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Retour</button>
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

                  <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Terrain</span>
                      <span className="text-slate-200">{selectedTerrain?.name}</span>
                    </div>
                    {tarifResult && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>
                          {tarifResult.breakdown.slotJour > 0 && `${tarifResult.breakdown.slotJour}h jour`}
                          {tarifResult.breakdown.slotJour > 0 && tarifResult.breakdown.slotNuit > 0 && ' + '}
                          {tarifResult.breakdown.slotNuit > 0 && `${tarifResult.breakdown.slotNuit}h nuit/WE`}
                        </span>
                        <span>{tarifResult.slots.length}h total</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm border-t border-slate-700 pt-2">
                      <span className="text-slate-400">Montant total</span>
                      <span className="font-semibold text-white">{fmt(tarif)} FCFA</span>
                    </div>
                    {paymentMethod !== 'ON_SITE' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Acompte à payer</span>
                        <span className="font-bold text-emerald-400">{fmt(deposit)} FCFA</span>
                      </div>
                    )}
                  </div>

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
