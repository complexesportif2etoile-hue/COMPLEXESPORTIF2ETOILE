import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { calculateTarifForPublicSlot, getTarifForSlot, TARIF_SOIR_WEEKEND } from '../../lib/pricing';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Phone,
  User,
  MapPin,
  FileText,
  Star,
  Shield,
  CreditCard,
  Loader2,
  Wallet,
  Building2,
  Info,
  Copy,
  CheckCheck,
  XCircle,
  RefreshCw,
  ArrowRight,
  Share2,
  MessageCircle,
  CalendarPlus,
  Moon,
  Sun,
} from 'lucide-react';

interface Terrain {
  id: string;
  name: string;
  description: string;
  tarif_horaire: number;
}

interface ExistingReservation {
  id: string;
  client_name: string;
  terrain_id: string;
  date_debut: string;
  date_fin: string;
  statut: string;
}

interface DepositSettings {
  deposit_type: 'PERCENTAGE' | 'FIXED';
  deposit_value: number;
  online_payment_enabled: boolean;
  wave_number: string;
  orange_money_number: string;
}

type PaymentChoice = 'ON_SITE' | 'WAVE' | 'ORANGE_MONEY';
type DepositChoice = 'DEPOSIT' | 'FULL';
type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
type PaymentFlowStatus = 'idle' | 'pending' | 'success' | 'failed';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function periodsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

function calcDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60);
  if (diff <= 0) return '';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const inputClass =
  'w-full px-4 py-3.5 bg-[#0d1520] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all duration-200 text-sm';


export const PublicBookingPage: React.FC = () => {
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [company, setCompany] = useState<Record<string, any>>({});
  const [depositSettings, setDepositSettings] = useState<DepositSettings>({
    deposit_type: 'PERCENTAGE',
    deposit_value: 30,
    online_payment_enabled: false,
    wave_number: '',
    orange_money_number: '',
  });
  const [loadingInit, setLoadingInit] = useState(true);
  const [step, setStep] = useState(0);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTerrain, setSelectedTerrain] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [notes, setNotes] = useState('');

  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('ON_SITE');
  const [depositChoice, setDepositChoice] = useState<DepositChoice>('DEPOSIT');
  const [paymentReference, setPaymentReference] = useState('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  const [dayReservations, setDayReservations] = useState<ExistingReservation[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [paymentFlowStatus, setPaymentFlowStatus] = useState<PaymentFlowStatus>('idle');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{
    paymentMethod: PaymentChoice;
    paymentStatus: PaymentStatus;
    amountPaid: number;
    amountDue: number;
    codeCourt: string;
  } | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState<string | null>(null);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
  const isSelectedToday = selectedDate === todayStr;

  useEffect(() => {
    const init = async () => {
      const [terrainsResult, settingsResult, depositResult] = await Promise.all([
        supabase.from('terrains').select('id, name, description, tarif_horaire').eq('is_active', true).order('name'),
        supabase.from('company_settings').select('*').limit(1).maybeSingle(),
        supabase.from('deposit_settings').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (terrainsResult.data) setTerrains(terrainsResult.data);
      if (settingsResult.data) setCompany(settingsResult.data as Record<string, any>);
      if (depositResult.data) setDepositSettings(depositResult.data as DepositSettings);
      setLoadingInit(false);
    };
    init();
  }, []);

  const loadDayReservations = useCallback(async (date: string) => {
    if (!date) { setDayReservations([]); return; }
    setLoadingSlots(true);
    try {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      const { data } = await supabase
        .from('reservations')
        .select('id, client_name, terrain_id, date_debut, date_fin, statut')
        .not('statut', 'in', '("annulé","terminé")')
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
    if (selectedDate) loadDayReservations(selectedDate);
  }, [selectedDate, loadDayReservations]);

  const selectedTerrainReservations = useMemo(() => {
    if (!selectedTerrain) return [];
    return dayReservations.filter(r => r.terrain_id === selectedTerrain);
  }, [dayReservations, selectedTerrain]);

  const overlapConflict = useMemo(() => {
    if (!timeStart || !timeEnd || !selectedTerrain || !selectedDate) return null;
    const newStart = new Date(`${selectedDate}T${timeStart}:00`);
    const endDate = timeEnd === '00:00' && timeStart !== '00:00' ? getNextDayStr(selectedDate) : selectedDate;
    const newEnd = new Date(`${endDate}T${timeEnd}:00`);
    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime()) || newEnd <= newStart) return null;
    const conflicting = selectedTerrainReservations.filter(r =>
      periodsOverlap(newStart, newEnd, new Date(r.date_debut), new Date(r.date_fin))
    );
    return conflicting.length > 0 ? conflicting : null;
  }, [selectedDate, timeStart, timeEnd, selectedTerrain, selectedTerrainReservations]);

  const selectedTerrainData = terrains.find(t => t.id === selectedTerrain);

  const tarifTotal = useMemo(() => {
    if (!timeStart || !timeEnd || !selectedDate) return 0;
    return calculateTarifForPublicSlot(selectedDate, timeStart, timeEnd);
  }, [timeStart, timeEnd, selectedDate]);

  const depositAmount = useMemo(() => {
    if (!depositSettings.online_payment_enabled || paymentChoice === 'ON_SITE') return 0;
    if (depositSettings.deposit_type === 'PERCENTAGE') {
      return Math.round(tarifTotal * depositSettings.deposit_value / 100);
    }
    return depositSettings.deposit_value;
  }, [depositSettings, paymentChoice, tarifTotal]);

  const amountToPay = depositChoice === 'FULL' ? tarifTotal : depositAmount;

  const datetimeDebut = selectedDate && timeStart ? `${selectedDate}T${timeStart}:00` : '';
  const finDate = selectedDate && timeStart && timeEnd && timeEnd === '00:00' && timeStart !== '00:00'
    ? getNextDayStr(selectedDate)
    : selectedDate;
  const datetimeFin = finDate && timeEnd ? `${finDate}T${timeEnd}:00` : '';
  const duration = calcDuration(datetimeDebut, datetimeFin);

  const companyName = company.company_name || company.nom || 'FootField Pro';
  const companyAddress = company.company_address || company.adresse || '';
  const companyPhone = company.company_phone || company.telephone || '';
  const logoUrl = company.logo_url || '';

  const canProceedStep0 = clientName.trim().length >= 2 && clientPhone.trim().length >= 8;
  const canProceedStep1 = selectedDate && selectedTerrain && timeStart && timeEnd && !overlapConflict &&
    new Date(datetimeFin) > new Date(datetimeDebut);

  const hasOnlinePayment = depositSettings.online_payment_enabled &&
    (depositSettings.wave_number?.trim() || depositSettings.orange_money_number?.trim());

  const totalSteps = hasOnlinePayment ? 3 : 2;
  const STEPS = hasOnlinePayment
    ? ['Coordonnées', 'Terrain & Horaire', 'Paiement', 'Confirmation']
    : ['Coordonnées', 'Terrain & Horaire', 'Confirmation'];

  const handleNextStep = () => {
    setError('');
    if (step === 0 && !canProceedStep0) {
      setError('Veuillez remplir votre nom complet et votre numero de telephone.');
      return;
    }
    if (step === 1 && !canProceedStep1) {
      if (overlapConflict) setError('Ce creneau est deja reserve. Veuillez choisir un autre horaire.');
      else setError('Veuillez selectionner un terrain et des horaires valides.');
      return;
    }
    setStep(s => s + 1);
  };

  const handleCopyNumber = (number: string) => {
    navigator.clipboard.writeText(number).then(() => {
      setCopiedNumber(number);
      setTimeout(() => setCopiedNumber(null), 2000);
    });
  };

  const recheckAvailability = async (): Promise<boolean> => {
    const recheckStart = `${selectedDate}T00:00:00`;
    const endCheckDate = timeEnd === '00:00' && timeStart !== '00:00' ? getNextDayStr(selectedDate) : selectedDate;
    const recheckEnd = `${endCheckDate}T23:59:59`;
    const { data } = await supabase
      .from('reservations')
      .select('id, date_debut, date_fin')
      .eq('terrain_id', selectedTerrain)
      .not('statut', 'in', '("annulé","terminé")')
      .lte('date_debut', recheckEnd)
      .gte('date_fin', recheckStart);
    if (!data) return true;
    const newStart = new Date(datetimeDebut);
    const newEnd = new Date(datetimeFin);
    return !data.some(r => periodsOverlap(newStart, newEnd, new Date(r.date_debut), new Date(r.date_fin)));
  };

  const upsertClient = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', clientPhone.trim())
      .maybeSingle();
    if (!data) {
      await supabase.from('clients').insert({
        name: clientName.trim(),
        phone: clientPhone.trim(),
        email: '',
        address: '',
        notes: '',
      });
    }
  };

  const handleSubmitOnSite = async () => {
    setLoading(true);
    setError('');
    try {
      const available = await recheckAvailability();
      if (!available) {
        setError('Ce creneau vient d\'etre reserve. Veuillez choisir un autre horaire.');
        return;
      }
      await upsertClient();
      const { data: insertedRes, error: insertError } = await supabase.from('reservations').insert({
        terrain_id: selectedTerrain,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        date_debut: new Date(datetimeDebut).toISOString(),
        date_fin: new Date(datetimeFin).toISOString(),
        tarif_total: tarifTotal,
        tva_applicable: false,
        montant_tva: 0,
        montant_ttc: tarifTotal,
        notes: notes.trim(),
        statut: 'en_attente',
        created_by: null,
        payment_status: 'UNPAID',
        payment_method: 'ON_SITE',
        amount_due: tarifTotal,
        amount_paid: 0,
        deposit_amount: 0,
      }).select('id, code_court').single();
      if (insertError) throw insertError;
      setSuccessData({ paymentMethod: 'ON_SITE', paymentStatus: 'UNPAID', amountPaid: 0, amountDue: tarifTotal, codeCourt: insertedRes?.code_court || '' });
      setSuccess(true);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('overlap') || msg.includes('durant cette période')) {
        setError('Ce creneau est deja reserve. Veuillez choisir un autre horaire.');
      } else {
        setError(msg || 'Une erreur est survenue. Veuillez reessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateOnlinePayment = async () => {
    setLoading(true);
    setError('');
    try {
      const available = await recheckAvailability();
      if (!available) {
        setError('Ce creneau vient d\'etre reserve. Veuillez choisir un autre horaire.');
        setLoading(false);
        return;
      }

      const { data: paymentData, error: payErr } = await supabase
        .from('payments')
        .insert({
          provider: paymentChoice,
          reference: paymentReference.trim(),
          status: 'PENDING',
          amount: amountToPay,
          phone: clientPhone.trim(),
          client_name: clientName.trim(),
          notes: '',
          reservation_id: null,
        })
        .select('id')
        .single();

      if (payErr) throw payErr;
      setPaymentId(paymentData.id);
      setPaymentFlowStatus('pending');
    } catch (err: any) {
      setError(err.message || 'Impossible d\'initier le paiement.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPaymentReceived = async () => {
    if (!paymentId) return;
    setLoading(true);
    setError('');
    try {
      const available = await recheckAvailability();
      if (!available) {
        setPaymentFlowStatus('failed');
        await supabase.from('payments').update({ status: 'FAILED', notes: 'Creneau plus disponible' }).eq('id', paymentId);
        setLoading(false);
        return;
      }

      await upsertClient();

      const paymentStatus: PaymentStatus = depositChoice === 'FULL' ? 'PAID' : 'PARTIAL';
      const finalDepositAmount = depositChoice === 'DEPOSIT' ? depositAmount : 0;

      const { data: resData, error: resErr } = await supabase
        .from('reservations')
        .insert({
          terrain_id: selectedTerrain,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
          date_debut: new Date(datetimeDebut).toISOString(),
          date_fin: new Date(datetimeFin).toISOString(),
          tarif_total: tarifTotal,
          tva_applicable: false,
          montant_tva: 0,
          montant_ttc: tarifTotal,
          notes: notes.trim(),
          statut: 'en_attente',
          created_by: null,
          payment_status: paymentStatus,
          payment_method: paymentChoice,
          amount_due: tarifTotal,
          amount_paid: amountToPay,
          deposit_amount: finalDepositAmount,
        })
        .select('id, code_court')
        .single();

      if (resErr) throw resErr;

      await supabase
        .from('payments')
        .update({
          status: 'SUCCESS',
          reservation_id: resData.id,
          notes: paymentReference.trim() ? `Ref: ${paymentReference.trim()}` : 'Paiement confirme par le client',
        })
        .eq('id', paymentId);

      setPaymentFlowStatus('success');
      setSuccessData({
        paymentMethod: paymentChoice,
        paymentStatus,
        amountPaid: amountToPay,
        amountDue: tarifTotal,
        codeCourt: resData.code_court || '',
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('overlap') || msg.includes('durant cette période')) {
        setPaymentFlowStatus('failed');
        await supabase.from('payments').update({ status: 'FAILED', notes: 'Creneau plus disponible' }).eq('id', paymentId);
      } else {
        setError(msg || 'Une erreur est survenue.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = async () => {
    if (paymentId) {
      await supabase.from('payments').update({ status: 'CANCELLED' }).eq('id', paymentId);
    }
    setPaymentId(null);
    setPaymentFlowStatus('idle');
    setPaymentReference('');
    setError('');
  };

  const resetForm = () => {
    setSuccess(false);
    setSuccessData(null);
    setStep(0);
    setClientName('');
    setClientPhone('');
    setSelectedDate('');
    setSelectedTerrain('');
    setTimeStart('');
    setTimeEnd('');
    setNotes('');
    setPaymentChoice('ON_SITE');
    setDepositChoice('DEPOSIT');
    setPaymentReference('');
    setPaymentFlowStatus('idle');
    setPaymentId(null);
    setError('');
    setDayReservations([]);
  };

  if (loadingInit) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Star className="w-6 h-6 text-white" />
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (paymentFlowStatus === 'pending') {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col">
        <Header logoUrl={logoUrl} companyName={companyName} companyAddress={companyAddress} />
        <div className="flex-1 flex items-center justify-center p-4 py-12">
          <div className="w-full max-w-md">
            <div className="bg-[#111827] border border-white/5 rounded-3xl p-8 shadow-2xl text-center">
              <div className="w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10 text-amber-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Paiement en cours...</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Effectuez le virement de <span className="text-white font-bold">{amountToPay.toLocaleString()} CFA</span> vers le numéro ci-dessous, puis confirmez.
              </p>
              <div className={`p-4 rounded-xl border mb-5 ${paymentChoice === 'WAVE' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                <p className={`text-xs font-semibold mb-3 ${paymentChoice === 'WAVE' ? 'text-blue-300' : 'text-orange-300'}`}>
                  {paymentChoice === 'WAVE' ? 'Virement Wave' : 'Virement Orange Money'}
                </p>
                <NumberRow label="Numéro destinataire" value={paymentChoice === 'WAVE' ? depositSettings.wave_number : depositSettings.orange_money_number} copiedNumber={copiedNumber} onCopy={handleCopyNumber} />
                <NumberRow label="Montant à envoyer" value={`${amountToPay.toLocaleString()} CFA`} rawValue={String(amountToPay)} copiedNumber={copiedNumber} onCopy={handleCopyNumber} highlight />
              </div>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 text-left">Référence du virement (optionnel)</label>
                <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className={inputClass} placeholder="Ex: TXN-123456" />
              </div>
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs mb-4 text-left">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{error}
                </div>
              )}
              <div className="space-y-3">
                <button onClick={handleConfirmPaymentReceived} disabled={loading} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  J'ai effectué le virement — Confirmer
                </button>
                <button onClick={handleRetryPayment} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-sm font-medium rounded-xl transition-all">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (paymentFlowStatus === 'failed') {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col">
        <Header logoUrl={logoUrl} companyName={companyName} companyAddress={companyAddress} />
        <div className="flex-1 flex items-center justify-center p-4 py-12">
          <div className="w-full max-w-md">
            <div className="bg-[#111827] border border-white/5 rounded-3xl p-8 shadow-2xl text-center">
              <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Paiement échoué</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">Le creneau n'est plus disponible. Votre paiement n'a pas été débité.</p>
              <div className="space-y-3">
                <button onClick={handleRetryPayment} className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" />Choisir un autre créneau
                </button>
                <button onClick={resetForm} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-sm font-medium rounded-xl transition-all">Recommencer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if ((paymentFlowStatus === 'success' || success) && successData) {
    const remaining = successData.amountDue - successData.amountPaid;
    const rsvpUrl = successData.codeCourt ? `${window.location.origin}/rsvp/${successData.codeCourt}` : '';
    const whatsappMsg = buildSuccessWhatsAppMessage({
      terrain: selectedTerrainData?.name || '',
      dateDebut: datetimeDebut,
      dateFin: datetimeFin,
      amountDue: successData.amountDue,
      amountPaid: successData.amountPaid,
      paymentMethod: successData.paymentMethod,
      paymentStatus: successData.paymentStatus,
      codeCourt: successData.codeCourt,
      rsvpUrl,
    });
    const isOnSite = successData.paymentMethod === 'ON_SITE';
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col">
        <Header logoUrl={logoUrl} companyName={companyName} companyAddress={companyAddress} />
        <div className="flex-1 py-8 px-4 pb-16">
          <div className="max-w-md mx-auto space-y-4">
            <div className="relative bg-[#111827] border border-white/5 rounded-3xl p-6 text-center shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                {isOnSite && <div className="flex items-center justify-center gap-1 mb-2">{[1, 2].map(i => <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}</div>}
                <h2 className="text-xl font-bold text-white mb-1">{isOnSite ? 'Demande envoyée !' : 'Paiement réussi !'}</h2>
                <p className="text-slate-400 mb-5 text-sm leading-relaxed">
                  {isOnSite
                    ? 'Votre demande est en attente de validation. Un opérateur vous contactera par téléphone.'
                    : 'Votre paiement a été enregistré. Un opérateur confirmera votre réservation par téléphone.'
                  }
                </p>
                <div className="bg-[#0d1520] rounded-2xl border border-white/5 p-4 mb-4 text-left space-y-2.5">
                  <SummaryRow label="Client" value={clientName} />
                  <SummaryRow label="Terrain" value={selectedTerrainData?.name || ''} />
                  <SummaryRow label="Créneau" value={`${formatDateTime(datetimeDebut)} — ${formatTime(datetimeFin)}${duration ? ` (${duration})` : ''}`} />
                  {tarifTotal > 0 && (
                    <>
                      <div className="h-px bg-white/5" />
                      <SummaryRow label="Total" value={`${successData.amountDue.toLocaleString()} CFA`} />
                      {!isOnSite && <SummaryRow label="Payé" value={`${successData.amountPaid.toLocaleString()} CFA`} highlight />}
                      {remaining > 0 && !isOnSite && <SummaryRow label="Reste sur place" value={`${remaining.toLocaleString()} CFA`} />}
                    </>
                  )}
                  <div className="h-px bg-white/5" />
                  <SummaryRow label="Paiement" value={isOnSite ? 'Sur place' : successData.paymentMethod === 'WAVE' ? 'Wave' : 'Orange Money'} />
                </div>
                {successData.codeCourt && (
                  <ReservationCodeBlock codeCourt={successData.codeCourt} copied={copiedSuccess} onCopy={(v) => { setCopiedSuccess(v); setTimeout(() => setCopiedSuccess(null), 2000); }} />
                )}
              </div>
            </div>
            <SuccessActions whatsappMsg={whatsappMsg} rsvpUrl={rsvpUrl} dateDebut={datetimeDebut} dateFin={datetimeFin} terrainName={selectedTerrainData?.name || ''} codeCourt={successData.codeCourt} copied={copiedSuccess} onCopy={(v) => { setCopiedSuccess(v); setTimeout(() => setCopiedSuccess(null), 2000); }} />
            {companyPhone && (
              <a href={`tel:${companyPhone}`} className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#111827] hover:bg-[#161f30] border border-white/5 rounded-2xl text-sm text-slate-300 transition-all">
                <Phone className="w-4 h-4 text-emerald-400" />{companyPhone}
              </a>
            )}
            <button onClick={resetForm} className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-xl transition-all text-sm">
              Nouvelle réservation
            </button>
          </div>
        </div>
      </div>
    );
  }

  const confirmStep = hasOnlinePayment ? 3 : 2;

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col">
      <Header logoUrl={logoUrl} companyName={companyName} companyAddress={companyAddress} />

      <main className="flex-1 py-8 px-4 pb-16">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-1 mb-3">
              {[1, 2].map(i => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">Réserver un terrain</h1>
            <p className="text-slate-400 text-sm">Remplissez le formulaire — nous confirmons par téléphone.</p>
          </div>

          <StepIndicator current={step} steps={STEPS} />

          <div className="mt-6">
            {error && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 0 && (
              <StepCard title="Vos coordonnées" icon={<User className="w-4 h-4" />}>
                <div className="space-y-4">
                  <Field label="Nom complet" icon={<User className="w-3.5 h-3.5 text-emerald-400" />}>
                    <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} placeholder="Votre nom complet" autoComplete="name" />
                  </Field>
                  <Field label="Numéro de téléphone" icon={<Phone className="w-3.5 h-3.5 text-emerald-400" />}>
                    <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputClass} placeholder="Ex: 77 000 00 00" autoComplete="tel" />
                  </Field>
                  <div className="pt-1">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: <Shield className="w-3.5 h-3.5 text-emerald-400" />, label: 'Données sécurisées' },
                        { icon: <CreditCard className="w-3.5 h-3.5 text-emerald-400" />, label: depositSettings.online_payment_enabled ? 'Paiement mobile' : 'Paiement sur place' },
                        { icon: <Phone className="w-3.5 h-3.5 text-emerald-400" />, label: 'Confirmation rapide' },
                      ].map((b, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5 p-2.5 bg-white/3 border border-white/5 rounded-xl text-center">
                          {b.icon}
                          <span className="text-[10px] text-slate-500 leading-tight">{b.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </StepCard>
            )}

            {step === 1 && (
              <CalendarStep
                terrains={terrains}
                selectedDate={selectedDate}
                setSelectedDate={(d) => {
                  setSelectedDate(d);
                  setSelectedTerrain(terrains.length === 1 ? terrains[0].id : '');
                  setTimeStart('');
                  setTimeEnd('');
                }}
                selectedTerrain={selectedTerrain}
                setSelectedTerrain={(t) => {
                  setSelectedTerrain(t);
                  setTimeStart('');
                  setTimeEnd('');
                }}
                timeStart={timeStart}
                setTimeStart={setTimeStart}
                timeEnd={timeEnd}
                setTimeEnd={setTimeEnd}
                notes={notes}
                setNotes={setNotes}
                dayReservations={dayReservations}
                loadingSlots={loadingSlots}
                selectedTerrainReservations={selectedTerrainReservations}
                tarifTotal={tarifTotal}
                todayStr={todayStr}
                isSelectedToday={isSelectedToday}
                currentTime={currentTime}
              />
            )}

            {step === 2 && hasOnlinePayment && (
              <PaymentStep
                tarifTotal={tarifTotal}
                depositSettings={depositSettings}
                paymentChoice={paymentChoice}
                setPaymentChoice={(v) => setPaymentChoice(v)}
                depositChoice={depositChoice}
                setDepositChoice={setDepositChoice}
                depositAmount={depositAmount}
                amountToPay={amountToPay}
                copiedNumber={copiedNumber}
                onCopyNumber={handleCopyNumber}
              />
            )}

            {step === confirmStep && (
              <StepCard title="Récapitulatif" icon={<CheckCircle className="w-4 h-4" />}>
                <div className="space-y-3">
                  <div className="bg-[#0d1520] rounded-2xl border border-white/5 p-4 space-y-3">
                    <SummaryRow label="Client" value={clientName} />
                    <SummaryRow label="Téléphone" value={clientPhone} />
                    <div className="h-px bg-white/5" />
                    <SummaryRow label="Terrain" value={selectedTerrainData?.name || ''} />
                    <SummaryRow label="Date" value={selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''} />
                    <SummaryRow label="Horaire" value={`${timeStart} — ${timeEnd}${duration ? ` (${duration})` : ''}`} />
                    {notes.trim() && <SummaryRow label="Notes" value={notes} />}
                    {tarifTotal > 0 && (
                      <>
                        <div className="h-px bg-white/5" />
                        <SummaryRow label="Total" value={`${tarifTotal.toLocaleString()} CFA`} />
                        {paymentChoice !== 'ON_SITE' && (
                          <>
                            <SummaryRow label={depositChoice === 'FULL' ? 'À payer maintenant (total)' : 'Acompte à payer'} value={`${amountToPay.toLocaleString()} CFA`} highlight />
                            {depositChoice === 'DEPOSIT' && <SummaryRow label="Reste sur place" value={`${(tarifTotal - amountToPay).toLocaleString()} CFA`} />}
                          </>
                        )}
                        {paymentChoice === 'ON_SITE' && <p className="text-xs text-slate-500">Le paiement se fait sur place à votre arrivée.</p>}
                      </>
                    )}
                    <div className="h-px bg-white/5" />
                    <SummaryRow label="Mode de paiement" value={paymentChoice === 'ON_SITE' ? 'Sur place' : paymentChoice === 'WAVE' ? 'Wave' : 'Orange Money'} />
                  </div>
                  {paymentChoice !== 'ON_SITE' && (
                    <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-300/80 leading-relaxed">
                        En cliquant sur "Confirmer", vous serez guidé pour effectuer le virement {paymentChoice === 'WAVE' ? 'Wave' : 'Orange Money'} de {amountToPay.toLocaleString()} CFA.
                      </p>
                    </div>
                  )}
                  <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-300/80 leading-relaxed">Votre réservation est soumise à validation. Un opérateur vous appellera pour confirmer.</p>
                  </div>
                </div>
              </StepCard>
            )}

            <div className="mt-5 flex gap-3">
              {step > 0 && (
                <button onClick={() => { setStep(s => s - 1); setError(''); }} className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold rounded-xl transition-all text-sm">
                  Retour
                </button>
              )}

              {step < confirmStep ? (
                <button onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm flex items-center justify-center gap-2">
                  Continuer
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : paymentChoice === 'ON_SITE' ? (
                <button onClick={handleSubmitOnSite} disabled={loading} className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 text-sm flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Confirmer la réservation
                </button>
              ) : (
                <button onClick={handleInitiateOnlinePayment} disabled={loading} className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 text-sm flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Passer au paiement
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-600 border-t border-white/5">
        <span>{companyName}</span>
        {companyAddress && <span> · {companyAddress}</span>}
        {companyPhone && <span> · <a href={`tel:${companyPhone}`} className="text-slate-500 hover:text-emerald-400 transition-colors">{companyPhone}</a></span>}
      </footer>
    </div>
  );
};

const SLOT_START_HOUR = 0;
const SLOT_END_HOUR = 24;

function getNextDayStr(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSlotBooked(hour: number, date: string, reservations: ExistingReservation[]): boolean {
  const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
  let slotEnd: Date;
  if (hour + 1 >= 24) {
    slotEnd = new Date(`${getNextDayStr(date)}T00:00:00`);
  } else {
    slotEnd = new Date(`${date}T${String(hour + 1).padStart(2, '0')}:00:00`);
  }
  return reservations.some(r => periodsOverlap(slotStart, slotEnd, new Date(r.date_debut), new Date(r.date_fin)));
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

function CalendarStep({
  terrains, selectedDate, setSelectedDate,
  selectedTerrain, setSelectedTerrain, timeStart, setTimeStart, timeEnd, setTimeEnd,
  notes, setNotes, dayReservations, loadingSlots,
  selectedTerrainReservations, tarifTotal, todayStr, isSelectedToday, currentTime,
}: {
  terrains: Terrain[];
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  selectedTerrain: string;
  setSelectedTerrain: (t: string) => void;
  timeStart: string;
  setTimeStart: (t: string) => void;
  timeEnd: string;
  setTimeEnd: (t: string) => void;
  notes: string;
  setNotes: (n: string) => void;
  dayReservations: ExistingReservation[];
  loadingSlots: boolean;
  selectedTerrainReservations: ExistingReservation[];
  tarifTotal: number;
  todayStr: string;
  isSelectedToday: boolean;
  currentTime: string;
}) {
  const DAY_ABBR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const MON_ABBR = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aou', 'sep', 'oct', 'nov', 'dec'];

  const nextDays = getNextDays(14);
  const selectedTerrainData = terrains.find(t => t.id === selectedTerrain);

  const selectedSlotHour = timeStart ? parseInt(timeStart.split(':')[0]) : null;

  const nowHour = isSelectedToday ? parseInt(currentTime.split(':')[0]) : -1;

  const formattedSelectedDate = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

  const handleSlotClick = (hour: number) => {
    const booked = isSlotBooked(hour, selectedDate, selectedTerrainReservations);
    const isPast = isSelectedToday && hour <= nowHour;
    if (booked || isPast) return;
    const hStr = String(hour).padStart(2, '0');
    const endHour = hour + 1;
    const h1Str = endHour >= 24 ? '00' : String(endHour).padStart(2, '0');
    setTimeStart(`${hStr}:00`);
    setTimeEnd(`${h1Str}:00`);
  };

  const slots = Array.from({ length: SLOT_END_HOUR - SLOT_START_HOUR }, (_, i) => SLOT_START_HOUR + i);

  return (
    <div className="space-y-4">
      <StepCard title="Disponibilités" icon={<Calendar className="w-4 h-4" />}>
        <div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {nextDays.map((day) => {
              const dateStr = makeDateStr(day);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex-shrink-0 w-16 flex flex-col items-center py-3 px-2 rounded-2xl transition-all duration-200 border-2 ${
                    isSelected
                      ? 'bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-500/30'
                      : isToday
                        ? 'bg-white/5 border-amber-500/50'
                        : 'bg-white/3 border-white/10 hover:border-white/25 hover:bg-white/8'
                  }`}
                >
                  <span className={`text-2xl font-bold leading-none mb-1 ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {day.getDate()}
                  </span>
                  <span className={`text-[10px] font-semibold ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {MON_ABBR[day.getMonth()]}
                  </span>
                  <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {DAY_ABBR[day.getDay()]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </StepCard>

      {selectedDate && (
        <div className="space-y-3">
          {terrains.length > 1 && (
            <StepCard title="Choisir un terrain" icon={<MapPin className="w-4 h-4" />}>
              <div className="space-y-2">
                {terrains.map(terrain => {
                  const terrainRes = dayReservations.filter(r => r.terrain_id === terrain.id);
                  const isSel = selectedTerrain === terrain.id;
                  return (
                    <button
                      key={terrain.id}
                      type="button"
                      onClick={() => { setSelectedTerrain(terrain.id); setTimeStart(''); setTimeEnd(''); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        isSel ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-white/3 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${terrainRes.length === 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <p className={`text-sm font-bold flex-1 ${isSel ? 'text-emerald-300' : 'text-slate-200'}`}>{terrain.name}</p>
                    </button>
                  );
                })}
              </div>
            </StepCard>
          )}

          {terrains.length === 1 && !selectedTerrain && (
            <button
              type="button"
              onClick={() => setSelectedTerrain(terrains[0].id)}
              className="w-full py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-all"
            >
              Terrain : {terrains[0].name}
            </button>
          )}

          {(selectedTerrain || terrains.length === 1) && (() => {
            const activeTerrain = selectedTerrainData || terrains[0];
            const activeTerrainRes = dayReservations.filter(r => r.terrain_id === activeTerrain?.id);

            return (
              <StepCard
                title={`Créneaux disponibles — ${formattedSelectedDate}`}
                icon={<Clock className="w-4 h-4" />}
              >
                <div className="space-y-4">
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-800/80 border border-slate-600/50 inline-block" />Nuit 00h-07h</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/15 border border-emerald-500/25 inline-block" />Lun-Ven 08h-19h — 20 000 FCFA</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-500/20 border border-violet-500/30 inline-block" />Soir &amp; Weekend — 25 000 FCFA</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-700/80 border border-slate-600/50 inline-block" />Réservé</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        {slots.map(hour => {
                          const booked = isSlotBooked(hour, selectedDate, activeTerrainRes);
                          const isPast = isSelectedToday && hour <= nowHour;
                          const unavailable = booked || isPast;
                          const slotTarif = getTarifForSlot(selectedDate, hour);
                          const isSoirWeekend = slotTarif === TARIF_SOIR_WEEKEND;
                          const isNight = hour >= 0 && hour < 7;
                          const isSelectedSlot = selectedSlotHour === hour;
                          const hStart = String(hour).padStart(2, '0');
                          const hEnd = String((hour + 1) % 24).padStart(2, '0');

                          let periodLabel = 'Journée';
                          if (isNight) periodLabel = 'Nuit';
                          else if (isSoirWeekend) periodLabel = 'Soirée / Weekend';

                          let baseClass = '';
                          let textClass = '';
                          let priceClass = '';
                          if (unavailable) {
                            baseClass = 'bg-slate-800/60 border-slate-700/50 cursor-not-allowed opacity-50';
                            textClass = 'text-slate-600';
                            priceClass = 'text-slate-600';
                          } else if (isSelectedSlot) {
                            baseClass = isNight
                              ? 'bg-slate-600 border-slate-500 shadow-lg shadow-slate-500/30'
                              : isSoirWeekend
                                ? 'bg-violet-500 border-violet-400 shadow-lg shadow-violet-500/30'
                                : 'bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/30';
                            textClass = 'text-white';
                            priceClass = 'text-white font-extrabold';
                          } else if (isNight) {
                            baseClass = 'bg-slate-800/80 border-slate-700/60 hover:bg-slate-700/60 hover:border-slate-600/80';
                            textClass = 'text-slate-300';
                            priceClass = 'text-slate-400 font-bold';
                          } else if (isSoirWeekend) {
                            baseClass = 'bg-violet-500/15 border-violet-500/30 hover:bg-violet-500/25 hover:border-violet-500/50';
                            textClass = 'text-slate-200';
                            priceClass = 'text-violet-300 font-bold';
                          } else {
                            baseClass = 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/40';
                            textClass = 'text-slate-200';
                            priceClass = 'text-emerald-400 font-bold';
                          }

                          return (
                            <button
                              key={hour}
                              type="button"
                              disabled={unavailable}
                              onClick={() => handleSlotClick(hour)}
                              className={`relative flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all duration-150 ${baseClass}`}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`text-sm font-bold tracking-wide ${textClass}`}>
                                  {hStart}:00 - {hEnd}:00
                                </span>
                                {isNight && !unavailable && (
                                  <Moon className={`w-3.5 h-3.5 ${isSelectedSlot ? 'text-white' : 'text-slate-400'}`} />
                                )}
                                {isSoirWeekend && !isNight && !unavailable && (
                                  <Moon className={`w-3.5 h-3.5 ${isSelectedSlot ? 'text-white' : 'text-violet-400'}`} />
                                )}
                              </div>
                              {!unavailable && (
                                <span className={`text-xs ${priceClass}`}>
                                  {isNight ? `${slotTarif.toLocaleString()} FCFA` : `${slotTarif.toLocaleString()} FCFA`}
                                </span>
                              )}
                              <span className={`text-[10px] mt-0.5 ${isSelectedSlot ? 'text-white/80' : 'text-slate-500'}`}>
                                {unavailable ? (booked ? 'Réservé' : 'Passé') : periodLabel}
                              </span>
                              {isSelectedSlot && (
                                <div className="absolute top-2 right-2">
                                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {timeStart && timeEnd && (
                    <div className="mt-2 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{timeStart} — {timeEnd}</p>
                        {tarifTotal > 0 && <p className="text-xs text-emerald-400 font-semibold">{tarifTotal.toLocaleString()} CFA</p>}
                      </div>
                    </div>
                  )}

                  <Field label="Notes (optionnel)" icon={<FileText className="w-3.5 h-3.5 text-emerald-400" />}>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Ex: tournoi, besoin de maillots..." />
                  </Field>
                </div>
              </StepCard>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function NumberRow({ label, value, rawValue, copiedNumber, onCopy, highlight }: {
  label: string; value: string; rawValue?: string; copiedNumber: string | null; onCopy: (v: string) => void; highlight?: boolean;
}) {
  const copyValue = rawValue ?? value;
  return (
    <div className="flex items-center justify-between gap-3 bg-black/20 rounded-xl px-3 py-2.5 mb-2">
      <div>
        <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
        <p className={`text-sm font-bold font-mono ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
      </div>
      <button type="button" onClick={() => onCopy(copyValue)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all shrink-0">
        {copiedNumber === copyValue ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
      </button>
    </div>
  );
}

function PaymentStep({
  tarifTotal, depositSettings, paymentChoice, setPaymentChoice,
  depositChoice, setDepositChoice, depositAmount, amountToPay,
  copiedNumber, onCopyNumber,
}: {
  tarifTotal: number;
  depositSettings: DepositSettings;
  paymentChoice: PaymentChoice;
  setPaymentChoice: (v: PaymentChoice) => void;
  depositChoice: DepositChoice;
  setDepositChoice: (v: DepositChoice) => void;
  depositAmount: number;
  amountToPay: number;
  copiedNumber: string | null;
  onCopyNumber: (n: string) => void;
}) {
  const hasWave = depositSettings.online_payment_enabled && depositSettings.wave_number?.trim();
  const hasOrangeMoney = depositSettings.online_payment_enabled && depositSettings.orange_money_number?.trim();
  const depositLabel = depositSettings.deposit_type === 'PERCENTAGE' ? `Acompte ${depositSettings.deposit_value}%` : 'Acompte fixe';

  return (
    <StepCard title="Mode de paiement" icon={<CreditCard className="w-4 h-4" />}>
      <div className="space-y-4">
        <div className="space-y-2.5">
          <PaymentOptionButton active={paymentChoice === 'ON_SITE'} onClick={() => setPaymentChoice('ON_SITE')} icon={<Building2 className="w-5 h-5" />} title="Payer sur place" subtitle="Réglez directement à l'accueil le jour J" color="emerald" />
          {hasWave && <PaymentOptionButton active={paymentChoice === 'WAVE'} onClick={() => setPaymentChoice('WAVE')} icon={<Wallet className="w-5 h-5" />} title="Payer avec Wave" subtitle="Virement mobile rapide" color="blue" />}
          {hasOrangeMoney && <PaymentOptionButton active={paymentChoice === 'ORANGE_MONEY'} onClick={() => setPaymentChoice('ORANGE_MONEY')} icon={<Wallet className="w-5 h-5" />} title="Payer avec Orange Money" subtitle="Virement mobile Orange" color="orange" />}
        </div>

        {(paymentChoice === 'WAVE' || paymentChoice === 'ORANGE_MONEY') && (
          <>
            <div className="h-px bg-white/5" />
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Montant à payer</p>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => setDepositChoice('DEPOSIT')} className={`p-3.5 rounded-xl border-2 transition-all text-left ${depositChoice === 'DEPOSIT' ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-white/3 border-white/10 hover:border-white/20'}`}>
                  <p className={`text-xs font-bold mb-1 ${depositChoice === 'DEPOSIT' ? 'text-emerald-400' : 'text-slate-400'}`}>{depositLabel}</p>
                  <p className={`text-lg font-bold ${depositChoice === 'DEPOSIT' ? 'text-white' : 'text-slate-500'}`}>{depositAmount.toLocaleString()} <span className="text-xs font-normal">CFA</span></p>
                  {depositSettings.deposit_type === 'PERCENTAGE' && <p className="text-[10px] text-slate-600 mt-0.5">{depositSettings.deposit_value}% du total</p>}
                </button>
                <button type="button" onClick={() => setDepositChoice('FULL')} className={`p-3.5 rounded-xl border-2 transition-all text-left ${depositChoice === 'FULL' ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-white/3 border-white/10 hover:border-white/20'}`}>
                  <p className={`text-xs font-bold mb-1 ${depositChoice === 'FULL' ? 'text-emerald-400' : 'text-slate-400'}`}>Total complet</p>
                  <p className={`text-lg font-bold ${depositChoice === 'FULL' ? 'text-white' : 'text-slate-500'}`}>{tarifTotal.toLocaleString()} <span className="text-xs font-normal">CFA</span></p>
                  <p className="text-[10px] text-slate-600 mt-0.5">Rien à payer sur place</p>
                </button>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-800/60 border border-white/5 rounded-xl">
              <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500 leading-relaxed">Après confirmation, vous serez guidé pour effectuer le virement de <span className="text-white font-semibold">{amountToPay.toLocaleString()} CFA</span>.</p>
            </div>
          </>
        )}

        {paymentChoice === 'ON_SITE' && (
          <div className="flex items-start gap-3 p-3 bg-slate-800/60 border border-white/5 rounded-xl">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500 leading-relaxed">Vous réglerez le montant de {tarifTotal.toLocaleString()} CFA directement à l'accueil le jour de votre réservation.</p>
          </div>
        )}
      </div>
    </StepCard>
  );
}

function PaymentOptionButton({ active, onClick, icon, title, subtitle, color }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; color: 'emerald' | 'blue' | 'orange';
}) {
  const colors = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', icon: 'text-emerald-400', active: 'bg-emerald-500/10 border-emerald-500/50', radio: 'border-emerald-500 bg-emerald-500' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-300', icon: 'text-blue-400', active: 'bg-blue-500/10 border-blue-500/50', radio: 'border-blue-500 bg-blue-500' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-300', icon: 'text-orange-400', active: 'bg-orange-500/10 border-orange-500/50', radio: 'border-orange-500 bg-orange-500' },
  };
  const c = colors[color];
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${active ? c.active : 'bg-white/3 border-white/10 hover:border-white/20'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? c.bg : 'bg-white/5'}`}>
        <span className={active ? c.icon : 'text-slate-500'}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${active ? c.text : 'text-slate-300'}`}>{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? c.radio : 'border-slate-600'}`}>
        {active && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
    </button>
  );
}

function Header({ logoUrl, companyName, companyAddress }: { logoUrl: string; companyName: string; companyAddress: string }) {
  return (
    <header className="bg-[#0d1520]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-10">
      <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName} className="w-9 h-9 rounded-xl object-cover" />
        ) : (
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/30 shrink-0">
            <Star className="w-4 h-4 text-white fill-white" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight">{companyName}</p>
          {companyAddress && (
            <p className="text-xs text-slate-500 truncate leading-tight flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />{companyAddress}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {[1, 2].map(i => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
        </div>
      </div>
    </header>
  );
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              i < current ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                : i === current ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-110'
                : 'bg-white/5 text-slate-600 border border-white/10'
            }`}>
              {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-[10px] font-medium transition-colors ${i === current ? 'text-emerald-400' : i < current ? 'text-slate-500' : 'text-slate-700'}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-1 transition-all duration-300 ${i < current ? 'bg-emerald-500' : 'bg-white/10'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function StepCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#111827] border border-white/5 rounded-3xl overflow-hidden shadow-2xl shadow-black/40">
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2.5">
        <div className="w-7 h-7 bg-emerald-500/15 rounded-lg flex items-center justify-center text-emerald-400">{icon}</div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{icon}{label}</label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`text-xs text-right font-medium ${highlight ? 'text-emerald-400 font-bold text-sm' : 'text-slate-300'}`}>{value}</span>
    </div>
  );
}

function buildSuccessWhatsAppMessage(opts: {
  terrain: string; dateDebut: string; dateFin: string; amountDue: number; amountPaid: number;
  paymentMethod: string; paymentStatus: string; codeCourt: string; rsvpUrl: string;
}): string {
  const date = new Date(opts.dateDebut).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const heureDebut = new Date(opts.dateDebut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const heureFin = new Date(opts.dateFin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const methodLabels: Record<string, string> = { ON_SITE: 'Sur place', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' };
  const statusLabels: Record<string, string> = { UNPAID: 'Sur place', PARTIAL: 'Acompte versé', PAID: 'Entièrement payé' };
  const remaining = opts.amountDue - opts.amountPaid;

  let msg = `Bonjour, voici ma réservation :\n\n`;
  msg += `Terrain : ${opts.terrain}\n`;
  msg += `Date : ${date}\n`;
  msg += `Horaire : ${heureDebut} - ${heureFin}\n`;
  msg += `Montant : ${opts.amountDue.toLocaleString()} CFA\n`;
  if (opts.amountPaid > 0) msg += `Payé (${methodLabels[opts.paymentMethod] || opts.paymentMethod}) : ${opts.amountPaid.toLocaleString()} CFA\n`;
  if (remaining > 0 && opts.paymentStatus !== 'PAID') msg += `Reste à régler sur place : ${remaining.toLocaleString()} CFA\n`;
  msg += `Statut paiement : ${statusLabels[opts.paymentStatus] || opts.paymentStatus}\n`;
  if (opts.codeCourt) {
    msg += `\nCode réservation : ${opts.codeCourt}\n`;
    if (opts.rsvpUrl) msg += `Détails : ${opts.rsvpUrl}`;
  }
  return msg;
}

function ReservationCodeBlock({ codeCourt, copied, onCopy }: { codeCourt: string; copied: string | null; onCopy: (v: string) => void; }) {
  return (
    <div className="bg-[#0d1520] rounded-2xl border border-white/5 p-4 mt-2">
      <p className="text-xs text-slate-500 mb-2">Code de réservation</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5">
          <p className="text-2xl font-bold text-white tracking-[0.2em] font-mono text-center">{codeCourt}</p>
        </div>
        <button onClick={() => onCopy(codeCourt)} className="w-11 h-11 flex items-center justify-center bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 rounded-xl transition-all shrink-0" title="Copier le code">
          {copied === codeCourt ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>
      <p className="text-[10px] text-slate-600 text-center mt-1.5">Présentez ce code à l'accueil</p>
    </div>
  );
}

function SuccessActions({ whatsappMsg, rsvpUrl, dateDebut, dateFin, terrainName, codeCourt, copied, onCopy }: {
  whatsappMsg: string; rsvpUrl: string; dateDebut: string; dateFin: string;
  terrainName: string; codeCourt: string; copied: string | null; onCopy: (v: string) => void;
}) {
  const handleWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`, '_blank');

  const handleShare = async () => {
    if (navigator.share && rsvpUrl) {
      try { await navigator.share({ title: `Réservation ${terrainName}`, text: `Mon code: ${codeCourt}`, url: rsvpUrl }); return; } catch {}
    }
    if (rsvpUrl) onCopy('share_link');
    navigator.clipboard.writeText(rsvpUrl).catch(() => {});
  };

  const handleCalendar = () => {
    const start = new Date(dateDebut).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = new Date(dateFin).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const title = encodeURIComponent(`Réservation ${terrainName}`);
    const details = encodeURIComponent(`Code: ${codeCourt}`);
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`, '_blank');
  };

  return (
    <div className="space-y-3">
      <button onClick={handleWhatsApp} className="w-full flex items-center gap-4 p-4 bg-[#111827] hover:bg-[#161f30] border border-white/5 hover:border-green-500/20 rounded-2xl transition-all duration-200">
        <div className="w-11 h-11 bg-green-500/15 border border-green-500/25 rounded-xl flex items-center justify-center shrink-0"><MessageCircle className="w-5 h-5 text-green-400" /></div>
        <div className="flex-1 text-left"><p className="text-sm font-bold text-white">Envoyer sur WhatsApp</p><p className="text-xs text-slate-500">Message pré-rempli avec tous les détails</p></div>
        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
      </button>
      <button onClick={handleShare} className="w-full flex items-center gap-4 p-4 bg-[#111827] hover:bg-[#161f30] border border-white/5 hover:border-blue-500/20 rounded-2xl transition-all duration-200">
        <div className="w-11 h-11 bg-blue-500/15 border border-blue-500/25 rounded-xl flex items-center justify-center shrink-0">
          {copied === 'share_link' ? <CheckCheck className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5 text-blue-400" />}
        </div>
        <div className="flex-1 text-left"><p className="text-sm font-bold text-white">{copied === 'share_link' ? 'Lien copié !' : 'Partager le lien'}</p>{rsvpUrl && <p className="text-xs text-slate-500 font-mono truncate">{rsvpUrl}</p>}</div>
        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
      </button>
      <button onClick={handleCalendar} className="w-full flex items-center gap-4 p-4 bg-[#111827] hover:bg-[#161f30] border border-white/5 hover:border-amber-500/20 rounded-2xl transition-all duration-200">
        <div className="w-11 h-11 bg-amber-500/15 border border-amber-500/25 rounded-xl flex items-center justify-center shrink-0"><CalendarPlus className="w-5 h-5 text-amber-400" /></div>
        <div className="flex-1 text-left"><p className="text-sm font-bold text-white">Ajouter au calendrier</p><p className="text-xs text-slate-500">Google Agenda</p></div>
        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
      </button>
    </div>
  );
}
