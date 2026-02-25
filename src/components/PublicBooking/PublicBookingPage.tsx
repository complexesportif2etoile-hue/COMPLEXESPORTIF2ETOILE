import { useState, useEffect } from 'react';
import { MapPin, Calendar, Phone, User, CreditCard, CheckCircle, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Terrain, DepositSettings } from '../../types';

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

  useEffect(() => {
    supabase.from('terrains').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setTerrains(data);
    });
    supabase.from('deposit_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setDepositSettings(data);
    });
  }, []);

  const calcTarif = () => {
    if (!selectedTerrain || !dateDebut || !dateFin) return 0;
    const hours = (new Date(dateFin).getTime() - new Date(dateDebut).getTime()) / 3600000;
    return Math.max(0, hours * selectedTerrain.tarif_horaire);
  };

  const calcDeposit = () => {
    if (!depositSettings) return calcTarif();
    if (depositSettings.deposit_type === 'PERCENTAGE') {
      return Math.ceil((calcTarif() * depositSettings.deposit_value) / 100);
    }
    return depositSettings.deposit_value;
  };

  const formatDatetimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    const tarif = calcTarif();
    const deposit = calcDeposit();
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

  const tarif = calcTarif();
  const deposit = calcDeposit();

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
                    {terrains.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTerrain(t); setStep('datetime'); }}
                        className={`w-full text-left bg-slate-800 hover:bg-slate-700 border ${selectedTerrain?.id === t.id ? 'border-emerald-500' : 'border-slate-700'} rounded-xl p-4 transition-all`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-200">{t.name}</p>
                            {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-emerald-400 font-semibold">{new Intl.NumberFormat('fr-FR').format(t.tarif_horaire)}</p>
                            <p className="text-xs text-slate-500">FCFA/h</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'datetime' && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-white">Choisissez vos horaires</h2>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Début</label>
                      <input type="datetime-local" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} min={formatDatetimeLocal(new Date())} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Fin</label>
                      <input type="datetime-local" value={dateFin} onChange={(e) => setDateFin(e.target.value)} min={dateDebut} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    {tarif > 0 && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-slate-400">Tarif estimé</p>
                        <p className="text-xl font-bold text-emerald-400">{new Intl.NumberFormat('fr-FR').format(tarif)} FCFA</p>
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
                          {method === 'ON_SITE' ? 'Payez à votre arrivée' : `Acompte: ${new Intl.NumberFormat('fr-FR').format(deposit)} FCFA`}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Terrain</span>
                      <span className="text-slate-200">{selectedTerrain?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Montant total</span>
                      <span className="font-semibold text-white">{new Intl.NumberFormat('fr-FR').format(tarif)} FCFA</span>
                    </div>
                    {paymentMethod !== 'ON_SITE' && (
                      <div className="flex justify-between text-sm border-t border-slate-700 pt-2">
                        <span className="text-slate-400">Acompte à payer</span>
                        <span className="font-bold text-emerald-400">{new Intl.NumberFormat('fr-FR').format(deposit)} FCFA</span>
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
