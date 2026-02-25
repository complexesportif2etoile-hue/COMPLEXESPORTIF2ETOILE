import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getTarifForSlot } from '../../lib/pricing';
import {
  Calendar,
  Clock,
  Phone,
  User,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Wallet,
  CreditCard,
  MessageCircle,
  Share2,
  Copy,
  CheckCheck,
  AlertTriangle,
  Star,
  Zap,
} from 'lucide-react';

interface Terrain {
  id: string;
  name: string;
  description: string;
  tarif_horaire: number;
}

interface Slot {
  label: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

interface ReservationConflict {
  date_debut: string;
  date_fin: string;
}

type PaymentChoice = 'ON_SITE' | 'WAVE' | 'ORANGE_MONEY';

interface DepositSettings {
  deposit_type: 'PERCENTAGE' | 'FIXED';
  deposit_value: number;
  online_payment_enabled: boolean;
  wave_number: string;
  orange_money_number: string;
}

interface SuccessData {
  codeCourt: string;
  terrainName: string;
  dateLabel: string;
  slotLabel: string;
  clientName: string;
  amountDue: number;
  paymentMethod: PaymentChoice;
}

const SLOTS: Slot[] = [
  { label: '08h00 – 09h00', startHour: 8,  startMin: 0, endHour: 9,  endMin: 0  },
  { label: '09h00 – 10h00', startHour: 9,  startMin: 0, endHour: 10, endMin: 0  },
  { label: '10h00 – 11h00', startHour: 10, startMin: 0, endHour: 11, endMin: 0  },
  { label: '11h00 – 12h00', startHour: 11, startMin: 0, endHour: 12, endMin: 0  },
  { label: '14h00 – 15h00', startHour: 14, startMin: 0, endHour: 15, endMin: 0  },
  { label: '15h00 – 16h00', startHour: 15, startMin: 0, endHour: 16, endMin: 0  },
  { label: '16h00 – 17h00', startHour: 16, startMin: 0, endHour: 17, endMin: 0  },
  { label: '17h00 – 18h00', startHour: 17, startMin: 0, endHour: 18, endMin: 0  },
  { label: '18h00 – 19h00', startHour: 18, startMin: 0, endHour: 19, endMin: 0  },
  { label: '19h00 – 20h00', startHour: 19, startMin: 0, endHour: 20, endMin: 0  },
  { label: '20h00 – 21h00', startHour: 20, startMin: 0, endHour: 21, endMin: 0  },
  { label: '21h00 – 22h00', startHour: 21, startMin: 0, endHour: 22, endMin: 0  },
];

function pad(n: number) { return String(n).padStart(2, '0'); }

function dateToLocalISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildSlotDatetimes(date: string, slot: Slot): { start: string; end: string } {
  return {
    start: `${date}T${pad(slot.startHour)}:${pad(slot.startMin)}:00`,
    end:   `${date}T${pad(slot.endHour)}:${pad(slot.endMin)}:00`,
  };
}

function periodsOverlap(sA: Date, eA: Date, sB: Date, eB: Date): boolean {
  return sA < eB && eA > sB;
}

function formatDateFR(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getDatesAround(center: Date, count: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(center);
    d.setDate(center.getDate() + i);
    dates.push(d);
  }
  return dates;
}

const COMPLEX_NAME = 'COMPLEXE SPORTIF 2e ETOILE';
const BANNER_URL = 'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=1200';

export const ComplexeSportif2eEtoilePage: React.FC = () => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [depositSettings, setDepositSettings] = useState<DepositSettings>({
    deposit_type: 'PERCENTAGE',
    deposit_value: 30,
    online_payment_enabled: false,
    wave_number: '',
    orange_money_number: '',
  });
  const [loadingInit, setLoadingInit] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string>(dateToLocalISO(today));
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedTerrain, setSelectedTerrain] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [conflicts, setConflicts] = useState<ReservationConflict[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('ON_SITE');
  const [paymentRef, setPaymentRef] = useState('');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const init = async () => {
      const [terrainsRes, depositRes] = await Promise.all([
        supabase.from('terrains').select('id, name, description, tarif_horaire').eq('is_active', true).order('name'),
        supabase.from('deposit_settings').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (terrainsRes.data && terrainsRes.data.length > 0) {
        setTerrains(terrainsRes.data);
        setSelectedTerrain(terrainsRes.data[0].id);
      }
      if (depositRes.data) setDepositSettings(depositRes.data as DepositSettings);
      setLoadingInit(false);
    };
    init();
  }, []);

  const loadConflicts = useCallback(async (terrainId: string, date: string) => {
    if (!terrainId || !date) { setConflicts([]); return; }
    setLoadingSlots(true);
    try {
      const { data } = await supabase
        .from('reservations')
        .select('date_debut, date_fin')
        .eq('terrain_id', terrainId)
        .not('statut', 'in', '("annulé","terminé")')
        .lte('date_debut', `${date}T23:59:59`)
        .gte('date_fin', `${date}T00:00:00`);
      setConflicts(data || []);
    } catch {
      setConflicts([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    setSelectedSlot(null);
    loadConflicts(selectedTerrain, selectedDate);
  }, [selectedTerrain, selectedDate, loadConflicts]);

  const visibleDates = useMemo(() => getDatesAround(today, 14).slice(dateOffset, dateOffset + 7), [today, dateOffset]);

  const isSlotTaken = useCallback((slot: Slot): boolean => {
    const { start, end } = buildSlotDatetimes(selectedDate, slot);
    const sA = new Date(start);
    const eA = new Date(end);
    const now = new Date();
    if (eA <= now) return true;
    return conflicts.some(c => periodsOverlap(sA, eA, new Date(c.date_debut), new Date(c.date_fin)));
  }, [selectedDate, conflicts]);

  const selectedTerrainData = useMemo(() => terrains.find(t => t.id === selectedTerrain), [terrains, selectedTerrain]);
  const tarifTotal = useMemo(() => {
    if (!selectedSlot || !selectedDate) return 0;
    const durationHours = ((selectedSlot.endHour * 60 + selectedSlot.endMin) - (selectedSlot.startHour * 60 + selectedSlot.startMin)) / 60;
    let total = 0;
    for (let i = 0; i < durationHours; i++) {
      total += getTarifForSlot(selectedDate, selectedSlot.startHour + i);
    }
    return total;
  }, [selectedSlot, selectedDate]);

  const depositAmount = useMemo(() => {
    if (!depositSettings.online_payment_enabled || paymentChoice === 'ON_SITE') return 0;
    if (depositSettings.deposit_type === 'PERCENTAGE') return Math.round(tarifTotal * depositSettings.deposit_value / 100);
    return depositSettings.deposit_value;
  }, [depositSettings, paymentChoice, tarifTotal]);

  const recheckAvailability = async (): Promise<boolean> => {
    if (!selectedSlot) return false;
    const { start, end } = buildSlotDatetimes(selectedDate, selectedSlot);
    const { data } = await supabase
      .from('reservations')
      .select('date_debut, date_fin')
      .eq('terrain_id', selectedTerrain)
      .not('statut', 'in', '("annulé","terminé")')
      .lte('date_debut', `${selectedDate}T23:59:59`)
      .gte('date_fin', `${selectedDate}T00:00:00`);
    if (!data) return true;
    const sA = new Date(start);
    const eA = new Date(end);
    return !data.some(c => periodsOverlap(sA, eA, new Date(c.date_debut), new Date(c.date_fin)));
  };

  const upsertClient = async () => {
    const existing = await supabase.from('clients').select('id').eq('phone', clientPhone.trim()).maybeSingle();
    if (!existing.data) {
      await supabase.from('clients').insert({ name: clientName.trim(), phone: clientPhone.trim(), email: '', address: '', notes: '' });
    }
  };

  const handleConfirm = async () => {
    if (!selectedSlot || !selectedTerrain || !clientName.trim() || !clientPhone.trim()) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (clientPhone.trim().length < 8) {
      setError('Numero de telephone invalide.');
      return;
    }
    if (paymentChoice !== 'ON_SITE' && !paymentRef.trim()) {
      setError('Veuillez saisir votre reference de paiement.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const available = await recheckAvailability();
      if (!available) {
        setError('Ce creneau vient d\'etre reserve. Veuillez en choisir un autre.');
        setLoadingSlots(true);
        loadConflicts(selectedTerrain, selectedDate).finally(() => setLoadingSlots(false));
        return;
      }

      await upsertClient();

      const { start, end } = buildSlotDatetimes(selectedDate, selectedSlot);
      const payStatus = paymentChoice === 'ON_SITE' ? 'UNPAID' : 'PARTIAL';
      const amountPaid = paymentChoice === 'ON_SITE' ? 0 : depositAmount;

      const { data: insertedRes, error: insertError } = await supabase
        .from('reservations')
        .insert({
          terrain_id: selectedTerrain,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
          date_debut: new Date(start).toISOString(),
          date_fin: new Date(end).toISOString(),
          tarif_total: tarifTotal,
          tva_applicable: false,
          montant_tva: 0,
          montant_ttc: tarifTotal,
          notes: paymentChoice !== 'ON_SITE' ? `Ref paiement: ${paymentRef.trim()}` : '',
          statut: 'en_attente',
          created_by: null,
          payment_status: payStatus,
          payment_method: paymentChoice,
          amount_due: tarifTotal,
          amount_paid: amountPaid,
          deposit_amount: depositAmount,
        })
        .select('id, code_court')
        .single();

      if (insertError) throw insertError;

      if (paymentChoice !== 'ON_SITE' && paymentRef.trim()) {
        await supabase.from('payments').insert({
          provider: paymentChoice,
          reference: paymentRef.trim(),
          status: 'PENDING',
          amount: amountPaid,
          phone: clientPhone.trim(),
          client_name: clientName.trim(),
          notes: '',
          reservation_id: insertedRes?.id || null,
        });
      }

      setSuccessData({
        codeCourt: insertedRes?.code_court || '',
        terrainName: selectedTerrainData?.name || '',
        dateLabel: formatDateFR(selectedDate),
        slotLabel: selectedSlot.label,
        clientName: clientName.trim(),
        amountDue: tarifTotal,
        paymentMethod: paymentChoice,
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('overlap') || msg.includes('durant cette')) {
        setError('Ce creneau est deja pris. Veuillez choisir un autre horaire.');
      } else {
        setError(msg || 'Une erreur est survenue. Veuillez reessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!successData?.codeCourt) return;
    navigator.clipboard.writeText(successData.codeCourt).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    });
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone).then(() => {
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 2000);
    });
  };

  const whatsappLink = useMemo(() => {
    if (!successData) return '#';
    const rsvpUrl = `${window.location.origin}/rsvp/${successData.codeCourt}`;
    const msg = encodeURIComponent(
      `Bonjour, ma reservation au ${COMPLEX_NAME} est confirmee.\nCode: ${successData.codeCourt}\nDate: ${successData.dateLabel}\nHoraire: ${successData.slotLabel}\nLien: ${rsvpUrl}`
    );
    return `https://wa.me/?text=${msg}`;
  }, [successData]);

  const shareLink = useMemo(() => {
    if (!successData) return '';
    return `${window.location.origin}/rsvp/${successData.codeCourt}`;
  }, [successData]);

  const handleShare = async () => {
    if (!shareLink) return;
    if (navigator.share) {
      await navigator.share({ title: COMPLEX_NAME, text: `Ma reservation – Code: ${successData?.codeCourt}`, url: shareLink });
    } else {
      navigator.clipboard.writeText(shareLink);
    }
  };

  if (loadingInit) {
    return (
      <div className="min-h-screen bg-[#060d18] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (success && successData) {
    return <SuccessScreen data={successData} whatsappLink={whatsappLink} shareLink={shareLink} onShare={handleShare} onCopyCode={handleCopyCode} copiedCode={copiedCode} />;
  }

  const canConfirm = !!selectedSlot && !!selectedTerrain && clientName.trim().length >= 2 && clientPhone.trim().length >= 8 && (paymentChoice === 'ON_SITE' || paymentRef.trim().length >= 3);

  return (
    <div className="min-h-screen bg-[#060d18] text-white">
      {/* Banner */}
      <div className="relative w-full h-48 sm:h-64 overflow-hidden">
        <img src={BANNER_URL} alt="Complexe Sportif" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-[#060d18]" />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight drop-shadow-lg">
            {COMPLEX_NAME}
          </h1>
          <div className="flex items-center gap-1.5 mt-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-sm text-slate-300">Reservation en ligne</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-12 space-y-6 mt-2">

        {/* Terrain selector (only if multiple) */}
        {terrains.length > 1 && (
          <section>
            <SectionTitle icon={<Zap className="w-4 h-4" />} label="Choisir le terrain" />
            <div className="grid grid-cols-1 gap-2 mt-3">
              {terrains.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTerrain(t.id)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-150 ${
                    selectedTerrain === t.id
                      ? 'bg-emerald-500/15 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/8'
                  }`}
                >
                  <span className="font-semibold text-white text-sm">{t.name}</span>
                  {t.description && <span className="ml-2 text-xs text-slate-400">{t.description}</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Date selector */}
        <section>
          <SectionTitle icon={<Calendar className="w-4 h-4" />} label="Choisir la date" />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setDateOffset(o => Math.max(0, o - 1))}
              disabled={dateOffset === 0}
              className="shrink-0 h-9 w-9 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:bg-white/12 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {visibleDates.map(d => {
                const iso = dateToLocalISO(d);
                const isToday = iso === dateToLocalISO(today);
                const selected = iso === selectedDate;
                return (
                  <button
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border transition-all duration-150 min-w-[52px] ${
                      selected
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-semibold tracking-wide leading-none">
                      {d.toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </span>
                    <span className="text-lg font-bold leading-tight mt-0.5">{d.getDate()}</span>
                    <span className="text-[10px] leading-none opacity-70">
                      {isToday ? "Auj." : d.toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setDateOffset(o => Math.min(7, o + 1))}
              disabled={dateOffset >= 7}
              className="shrink-0 h-9 w-9 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:bg-white/12 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 capitalize">{formatDateFR(selectedDate)}</p>
        </section>

        {/* Slots */}
        <section>
          <div className="flex items-center justify-between">
            <SectionTitle icon={<Clock className="w-4 h-4" />} label="Choisir un creneau" />
            {loadingSlots && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {SLOTS.map(slot => {
              const taken = isSlotTaken(slot);
              const selected = selectedSlot?.label === slot.label;
              return (
                <button
                  key={slot.label}
                  disabled={taken}
                  onClick={() => setSelectedSlot(slot)}
                  className={`relative w-full py-4 px-3 rounded-xl border text-sm font-semibold transition-all duration-150 flex flex-col items-center gap-1 ${
                    taken
                      ? 'bg-white/3 border-white/6 text-slate-600 cursor-not-allowed'
                      : selected
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-[1.02]'
                        : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]'
                  }`}
                >
                  <Clock className={`w-4 h-4 ${taken ? 'text-slate-600' : selected ? 'text-white' : 'text-emerald-400'}`} />
                  <span>{slot.label}</span>
                  {taken && <span className="text-[10px] text-slate-600 font-normal">Occupe</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* Contact form */}
        <section>
          <SectionTitle icon={<User className="w-4 h-4" />} label="Vos coordonnees" />
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Nom complet *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Votre nom complet"
                  autoComplete="name"
                  className="w-full pl-10 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all duration-200 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Telephone *</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  inputMode="tel"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  placeholder="Ex: 77 000 00 00"
                  autoComplete="tel"
                  className="w-full pl-10 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all duration-200 text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Payment */}
        <section>
          <SectionTitle icon={<CreditCard className="w-4 h-4" />} label="Mode de paiement" />
          <div className="mt-3 space-y-2">
            <PaymentOption
              id="ON_SITE"
              selected={paymentChoice === 'ON_SITE'}
              onSelect={() => setPaymentChoice('ON_SITE')}
              icon={<Wallet className="w-5 h-5" />}
              title="Payer sur place"
              description="Reglez le jour de votre reservation"
              badge={null}
            />
            {depositSettings.online_payment_enabled && (
              <>
                <PaymentOption
                  id="WAVE"
                  selected={paymentChoice === 'WAVE'}
                  onSelect={() => setPaymentChoice('WAVE')}
                  icon={<CreditCard className="w-5 h-5 text-blue-400" />}
                  title="Payer avec Wave"
                  description={depositSettings.wave_number ? `Numero: ${depositSettings.wave_number}` : 'Paiement mobile Wave'}
                  badge={depositSettings.wave_number}
                  onCopyNumber={() => handleCopyPhone(depositSettings.wave_number)}
                  copiedNumber={copiedPhone === depositSettings.wave_number}
                />
                <PaymentOption
                  id="ORANGE_MONEY"
                  selected={paymentChoice === 'ORANGE_MONEY'}
                  onSelect={() => setPaymentChoice('ORANGE_MONEY')}
                  icon={<CreditCard className="w-5 h-5 text-orange-400" />}
                  title="Payer avec Orange Money"
                  description={depositSettings.orange_money_number ? `Numero: ${depositSettings.orange_money_number}` : 'Paiement mobile Orange Money'}
                  badge={depositSettings.orange_money_number}
                  onCopyNumber={() => handleCopyPhone(depositSettings.orange_money_number)}
                  copiedNumber={copiedPhone === depositSettings.orange_money_number}
                />
              </>
            )}
          </div>

          {paymentChoice !== 'ON_SITE' && (
            <div className="mt-3">
              <label className="text-xs text-slate-400 mb-1.5 block">Reference de transaction *</label>
              <input
                type="text"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                placeholder="Ex: TXN123456789"
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all text-sm"
              />
              {depositAmount > 0 && (
                <p className="mt-2 text-xs text-amber-400/80">
                  Montant de l'acompte : <span className="font-semibold">{depositAmount.toLocaleString('fr-FR')} FCFA</span>
                </p>
              )}
            </div>
          )}
        </section>

        {/* Summary */}
        {selectedSlot && selectedTerrainData && (
          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-4 py-4 space-y-2">
            <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-3">Recapitulatif</p>
            <SummaryRow label="Terrain" value={selectedTerrainData.name} />
            <SummaryRow label="Date" value={formatDateFR(selectedDate)} />
            <SummaryRow label="Horaire" value={selectedSlot.label} />
            <SummaryRow label="Montant total" value={`${tarifTotal.toLocaleString('fr-FR')} FCFA`} highlight />
            <SummaryRow
              label="Paiement"
              value={paymentChoice === 'ON_SITE' ? 'Sur place' : paymentChoice === 'WAVE' ? 'Wave' : 'Orange Money'}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!canConfirm || loading}
          className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Traitement...</>
          ) : (
            <><CheckCircle className="w-5 h-5" /> Confirmer la reservation</>
          )}
        </button>

        <p className="text-center text-xs text-slate-600 pb-4">
          En reservant, vous acceptez les conditions du complexe sportif.
        </p>
      </div>
    </div>
  );
};

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-emerald-400">{icon}</span>
      <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">{label}</h2>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={highlight ? 'text-emerald-400 font-bold' : 'text-white font-medium'}>{value}</span>
    </div>
  );
}

function PaymentOption({
  id, selected, onSelect, icon, title, description, badge, onCopyNumber, copiedNumber,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string | null;
  onCopyNumber?: () => void;
  copiedNumber?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-150 flex items-center gap-3 ${
        selected
          ? 'bg-emerald-500/12 border-emerald-500/50 ring-1 ring-emerald-500/25'
          : 'bg-white/5 border-white/10 hover:bg-white/8'
      }`}
    >
      <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${selected ? 'bg-emerald-500/20' : 'bg-white/8'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400 truncate">{description}</p>
      </div>
      {selected && badge && onCopyNumber && (
        <button
          onClick={e => { e.stopPropagation(); onCopyNumber(); }}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 border border-white/10 text-xs text-slate-300 hover:bg-white/12 transition-colors"
        >
          {copiedNumber ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          Copier
        </button>
      )}
      <div className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
        selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'
      }`}>
        {selected && <div className="h-2 w-2 rounded-full bg-white" />}
      </div>
    </button>
  );
}

function SuccessScreen({
  data, whatsappLink, shareLink, onShare, onCopyCode, copiedCode,
}: {
  data: SuccessData;
  whatsappLink: string;
  shareLink: string;
  onShare: () => void;
  onCopyCode: () => void;
  copiedCode: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#060d18] flex flex-col items-center justify-start px-4 pt-12 pb-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Success icon */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Reservation confirmee !</h2>
            <p className="text-slate-400 text-sm mt-1">Votre demande est en attente de validation</p>
          </div>
        </div>

        {/* Code */}
        <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-5 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Numero de reservation</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-black text-emerald-400 tracking-widest">{data.codeCourt}</span>
            <button
              onClick={onCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/8 border border-white/10 rounded-lg text-xs text-slate-300 hover:bg-white/12 transition-colors"
            >
              {copiedCode ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Copie' : 'Copier'}
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white/4 border border-white/8 rounded-2xl px-5 py-4 space-y-3">
          <DetailRow icon={<User className="w-4 h-4 text-slate-400" />} label={data.clientName} />
          <DetailRow icon={<Calendar className="w-4 h-4 text-slate-400" />} label={data.dateLabel} />
          <DetailRow icon={<Clock className="w-4 h-4 text-slate-400" />} label={data.slotLabel} />
          <DetailRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label={data.terrainName} />
          <div className="pt-2 border-t border-white/8">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Montant total</span>
              <span className="text-base font-bold text-emerald-400">{data.amountDue.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-500">Paiement</span>
              <span className="text-xs text-slate-300">
                {data.paymentMethod === 'ON_SITE' ? 'Sur place' : data.paymentMethod === 'WAVE' ? 'Wave (acompte)' : 'Orange Money (acompte)'}
              </span>
            </div>
          </div>
        </div>

        {/* Statut badge */}
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <p className="text-sm text-amber-300">En attente de validation par l'equipe du complexe</p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onShare}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-white/8 border border-white/12 text-white font-semibold text-base hover:bg-white/12 transition-all duration-200 active:scale-[0.98]"
          >
            <Share2 className="w-5 h-5 text-slate-300" />
            Partager le lien
          </button>
        </div>

        <p className="text-center text-xs text-slate-600">
          {COMPLEX_NAME}
        </p>
      </div>
    </div>
  );
}

function DetailRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-sm text-slate-300 capitalize">{label}</span>
    </div>
  );
}
