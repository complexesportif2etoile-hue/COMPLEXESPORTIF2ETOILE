import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CheckCircle,
  Clock,
  XCircle,
  MapPin,
  Calendar,
  Phone,
  CreditCard,
  Star,
  Copy,
  CheckCheck,
  Loader2,
  AlertTriangle,
  Wallet,
  Building2,
  Share2,
  MessageCircle,
  CalendarPlus,
  ChevronRight,
} from 'lucide-react';

interface ReservationDetails {
  id: string;
  code_court: string;
  client_name: string;
  client_phone: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  payment_status: string | null;
  payment_method: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  tarif_total: number;
  notes: string;
  terrain: {
    name: string;
    description: string;
  } | null;
}

const STATUT_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  en_attente: { label: 'En attente', color: 'text-amber-400 bg-amber-500/15 border-amber-500/25', icon: <Clock className="w-4 h-4" /> },
  confirmé: { label: 'Confirmée', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25', icon: <CheckCircle className="w-4 h-4" /> },
  annulé: { label: 'Annulée', color: 'text-red-400 bg-red-500/15 border-red-500/25', icon: <XCircle className="w-4 h-4" /> },
  terminé: { label: 'Terminée', color: 'text-slate-400 bg-slate-500/15 border-slate-500/25', icon: <CheckCircle className="w-4 h-4" /> },
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  UNPAID: { label: 'Paiement sur place', color: 'text-slate-400' },
  PARTIAL: { label: 'Acompte versé', color: 'text-amber-400' },
  PAID: { label: 'Entièrement payé', color: 'text-emerald-400' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ON_SITE: 'Sur place',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function calcDuration(start: string, end: string): string {
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60);
  if (diff <= 0) return '';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

function buildWhatsAppMessage(r: ReservationDetails): string {
  const terrain = r.terrain?.name || 'Terrain';
  const date = formatDate(r.date_debut);
  const heureDebut = formatTime(r.date_debut);
  const heureFin = formatTime(r.date_fin);
  const montant = (r.amount_due || r.tarif_total || 0).toLocaleString();
  const paymentMethod = r.payment_method ? PAYMENT_METHOD_LABELS[r.payment_method] || r.payment_method : 'Sur place';
  const paymentStatus = r.payment_status ? PAYMENT_STATUS_LABELS[r.payment_status]?.label || r.payment_status : 'Sur place';
  const amountPaid = r.amount_paid || 0;
  const amountDue = r.amount_due || r.tarif_total || 0;
  const remaining = amountDue - amountPaid;
  const rsvpUrl = `${window.location.origin}/rsvp/${r.code_court}`;

  let msg = `Bonjour, voici ma réservation :\n\n`;
  msg += `Terrain : ${terrain}\n`;
  msg += `Date : ${date}\n`;
  msg += `Horaire : ${heureDebut} - ${heureFin}\n`;
  msg += `Montant total : ${montant} CFA\n`;
  if (amountPaid > 0) {
    msg += `Payé (${paymentMethod}) : ${amountPaid.toLocaleString()} CFA\n`;
  }
  if (remaining > 0 && r.payment_status !== 'PAID') {
    msg += `Reste à régler sur place : ${remaining.toLocaleString()} CFA\n`;
  }
  if (r.payment_status === 'PAID') {
    msg += `Statut paiement : Entièrement payé\n`;
  } else {
    msg += `Statut paiement : ${paymentStatus}\n`;
  }
  msg += `\nCode de réservation : ${r.code_court}\n`;
  msg += `Lien : ${rsvpUrl}`;
  return msg;
}

function buildCalendarUrl(r: ReservationDetails): string {
  const terrain = r.terrain?.name || 'Terrain';
  const start = new Date(r.date_debut)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const end = new Date(r.date_fin)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const title = encodeURIComponent(`Réservation ${terrain}`);
  const details = encodeURIComponent(`Code: ${r.code_court} | ${PAYMENT_STATUS_LABELS[r.payment_status || 'UNPAID']?.label || ''}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
}

interface RsvpPageProps {
  code: string;
}

export const RsvpPage: React.FC<RsvpPageProps> = ({ code }) => {
  const [reservation, setReservation] = useState<ReservationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [shareError, setShareError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('reservations')
          .select(`
            id, code_court, client_name, client_phone, date_debut, date_fin,
            statut, payment_status, payment_method, amount_due, amount_paid,
            tarif_total, notes,
            terrain:terrains(name, description)
          `)
          .eq('code_court', code.toUpperCase())
          .maybeSingle();

        if (error) throw error;
        if (!data) { setNotFound(true); return; }
        setReservation(data as unknown as ReservationDetails);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [code]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleShare = async () => {
    if (!reservation) return;
    const url = `${window.location.origin}/rsvp/${reservation.code_court}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Réservation ${reservation.terrain?.name}`,
          text: `Ma réservation du ${formatDate(reservation.date_debut)} — Code: ${reservation.code_court}`,
          url,
        });
      } catch {
        copyToClipboard(url, 'link');
      }
    } else {
      copyToClipboard(url, 'link');
    }
  };

  const handleWhatsApp = () => {
    if (!reservation) return;
    const msg = buildWhatsAppMessage(reservation);
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleAddToCalendar = () => {
    if (!reservation) return;
    window.open(buildCalendarUrl(reservation), '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Star className="w-6 h-6 text-white" />
          </div>
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Réservation introuvable</h2>
          <p className="text-slate-400 text-sm mb-6">Le code <span className="font-mono font-bold text-white">{code.toUpperCase()}</span> ne correspond à aucune réservation.</p>
          <a href="/reserver" className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl text-sm">
            Faire une réservation
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  if (!reservation) return null;

  const statutInfo = STATUT_LABELS[reservation.statut] || STATUT_LABELS['en_attente'];
  const paymentInfo = PAYMENT_STATUS_LABELS[reservation.payment_status || 'UNPAID'];
  const amountDue = reservation.amount_due || reservation.tarif_total || 0;
  const amountPaid = reservation.amount_paid || 0;
  const remaining = amountDue - amountPaid;
  const rsvpUrl = `${window.location.origin}/rsvp/${reservation.code_court}`;
  const duration = calcDuration(reservation.date_debut, reservation.date_fin);

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col">
      <header className="bg-[#0d1520]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/30 shrink-0">
            <Star className="w-4 h-4 text-white fill-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Ma réservation</p>
            <p className="text-xs text-slate-500 font-mono">#{reservation.code_court}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 py-6 px-4 pb-16">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="bg-[#111827] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="relative bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent px-6 pt-6 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Terrain</p>
                  <h1 className="text-xl font-bold text-white leading-tight">{reservation.terrain?.name || 'Terrain'}</h1>
                  {reservation.terrain?.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{reservation.terrain.description}</p>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shrink-0 ${statutInfo.color}`}>
                  {statutInfo.icon}
                  {statutInfo.label}
                </span>
              </div>
            </div>

            <div className="px-6 pb-6 space-y-4">
              <div className="bg-[#0d1520] rounded-2xl border border-white/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Date</p>
                    <p className="text-sm font-semibold text-white capitalize">{formatDate(reservation.date_debut)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Horaire</p>
                    <p className="text-sm font-semibold text-white">
                      {formatTime(reservation.date_debut)} — {formatTime(reservation.date_fin)}
                      {duration && <span className="ml-2 text-xs text-slate-500">({duration})</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Client</p>
                    <p className="text-sm font-semibold text-white">{reservation.client_name}</p>
                    <p className="text-xs text-slate-500">{reservation.client_phone}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#0d1520] rounded-2xl border border-white/5 p-4 space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Paiement</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Total</span>
                  <span className="text-base font-bold text-white">{amountDue.toLocaleString()} CFA</span>
                </div>
                {amountPaid > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      {reservation.payment_method === 'WAVE' || reservation.payment_method === 'ORANGE_MONEY'
                        ? <Wallet className="w-3 h-3" />
                        : <Building2 className="w-3 h-3" />}
                      {reservation.payment_method ? PAYMENT_METHOD_LABELS[reservation.payment_method] : 'Versé'}
                    </span>
                    <span className="text-sm font-bold text-emerald-400">- {amountPaid.toLocaleString()} CFA</span>
                  </div>
                )}
                {remaining > 0 && reservation.payment_status !== 'PAID' && (
                  <div className="flex items-center justify-between border-t border-white/5 pt-2">
                    <span className="text-xs text-slate-500">Reste à payer (sur place)</span>
                    <span className="text-sm font-bold text-amber-400">{remaining.toLocaleString()} CFA</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className={`text-xs font-semibold ${paymentInfo?.color || 'text-slate-400'}`}>
                    {paymentInfo?.label || 'Sur place'}
                  </span>
                </div>
              </div>

              <div className="bg-[#0d1520] rounded-2xl border border-white/5 p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Code de réservation</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                    <p className="text-2xl font-bold text-white tracking-[0.2em] font-mono text-center">{reservation.code_court}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(reservation.code_court, 'code')}
                    className="w-12 h-12 flex items-center justify-center bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 rounded-xl transition-all shrink-0"
                    title="Copier le code"
                  >
                    {copied === 'code' ? <CheckCheck className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-emerald-400" />}
                  </button>
                </div>
                <p className="text-xs text-slate-600 text-center mt-2">Présentez ce code à l'accueil</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center gap-4 p-4 bg-[#111827] hover:bg-[#161f30] border border-white/5 hover:border-green-500/20 rounded-2xl transition-all duration-200"
            >
              <div className="w-11 h-11 bg-green-500/15 border border-green-500/25 rounded-xl flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-white">Envoyer sur WhatsApp</p>
                <p className="text-xs text-slate-500">Message pré-rempli avec tous les détails</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
            </button>

            <button
              onClick={handleShare}
              className="w-full flex items-center gap-4 p-4 bg-[#111827] hover:bg-[#161f30] border border-white/5 hover:border-emerald-500/20 rounded-2xl transition-all duration-200"
            >
              <div className="w-11 h-11 bg-blue-500/15 border border-blue-500/25 rounded-xl flex items-center justify-center shrink-0">
                {copied === 'link' ? <CheckCheck className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5 text-blue-400" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-white">
                  {copied === 'link' ? 'Lien copié !' : 'Partager le lien'}
                </p>
                <p className="text-xs text-slate-500 font-mono truncate">{rsvpUrl}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
            </button>

            <button
              onClick={handleAddToCalendar}
              className="w-full flex items-center gap-4 p-4 bg-[#111827] hover:bg-[#161f30] border border-white/5 hover:border-emerald-500/20 rounded-2xl transition-all duration-200"
            >
              <div className="w-11 h-11 bg-amber-500/15 border border-amber-500/25 rounded-xl flex items-center justify-center shrink-0">
                <CalendarPlus className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-white">Ajouter au calendrier</p>
                <p className="text-xs text-slate-500">Google Agenda</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
            </button>
          </div>

          {reservation.notes && (
            <div className="bg-[#111827] border border-white/5 rounded-2xl p-4">
              <p className="text-xs text-slate-500 mb-1.5">Notes</p>
              <p className="text-sm text-slate-300">{reservation.notes}</p>
            </div>
          )}
        </div>
      </main>

      <footer className="py-5 text-center text-xs text-slate-700 border-t border-white/5">
        <a href="/reserver" className="text-emerald-500/60 hover:text-emerald-400 transition-colors">Faire une nouvelle réservation</a>
      </footer>
    </div>
  );
};
