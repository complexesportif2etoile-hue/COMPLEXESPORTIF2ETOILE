import { useState, useMemo } from 'react';
import { Search, CreditCard, X, Loader2, LogIn, LogOut, RotateCcw, ChevronDown, FileText, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Reservation } from '../../types';
import { format, parseISO } from '../utils/dateUtils';
import jsPDF from 'jspdf';

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente', libre: 'Libre', réservé: 'Réservé',
  check_in: 'En cours', check_out: 'Check-out', terminé: 'Terminé',
  annulé: 'Annulé', bloqué: 'Bloqué',
};

const STATUT_COLORS: Record<string, string> = {
  réservé: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  check_in: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  en_attente: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  terminé: 'bg-slate-700/50 text-slate-400 border border-slate-600/30',
  annulé: 'bg-red-500/20 text-red-300 border border-red-500/30',
  bloqué: 'bg-slate-800/50 text-slate-500 border border-slate-700/30',
};

const PAYMENT_LABELS: Record<string, string> = { UNPAID: 'Non payé', PARTIAL: 'Partiel', PAID: 'Payé' };
const PAYMENT_COLORS: Record<string, string> = {
  UNPAID: 'bg-red-500/20 text-red-400 border border-red-500/30',
  PARTIAL: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  PAID: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
};

const NEW_BADGE_WINDOW_MS = 15 * 60 * 1000;

function isNew(r: Reservation): boolean {
  return r.statut === 'en_attente' && Date.now() - new Date(r.created_at).getTime() < NEW_BADGE_WINDOW_MS;
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n);
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

function formatDate(iso: string) {
  const d = parseISO(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDay.getTime() === today.getTime()) return "Aujourd'hui";
  if (dDay.getTime() === tomorrow.getTime()) return 'Demain';
  return format(d, 'dd/MM/yyyy');
}

function isSameDay(a: string, b: string) {
  const da = parseISO(a); const db = parseISO(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function ClientMenu() {
  const { reservations, encaissements, refreshReservations, refreshEncaissements } = useData();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('especes');
  const [payType, setPayType] = useState('solde');
  const [loading, setLoading] = useState(false);

  const canManage = hasPermission('manage_reservations');
  const canPay = hasPermission('manage_payments');
  const canDelete = hasPermission('cancel_reservations');

  const filtered = useMemo(() => {
    const now = new Date();
    const list = reservations.filter((r) => {
      const isPast = new Date(r.date_fin) < now;
      if (isPast) return false;
      const matchSearch = r.client_name.toLowerCase().includes(search.toLowerCase()) ||
        r.client_phone.includes(search) ||
        r.code_court?.toLowerCase().includes(search.toLowerCase()) ||
        r.terrain?.name?.toLowerCase().includes(search.toLowerCase());
      const matchStatut = filterStatut === 'all' || r.statut === filterStatut;
      const matchPayment = filterPayment === 'all' || r.payment_status === filterPayment;
      return matchSearch && matchStatut && matchPayment;
    });
    return [...list].sort((a, b) => {
      const aNew = isNew(a) ? 1 : 0;
      const bNew = isNew(b) ? 1 : 0;
      if (bNew !== aNew) return bNew - aNew;
      return new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime();
    });
  }, [reservations, search, filterStatut, filterPayment]);

  const getEncaissementsForRes = (resId: string) =>
    encaissements.filter((e) => e.reservation_id === resId);

  const handlePay = async () => {
    if (!selected) return;
    setLoading(true);
    const amount = parseFloat(payAmount);
    const total = getEncaissementsForRes(selected.id).reduce((s, e) => s + e.montant_total, 0) + amount;
    const newStatus = total >= selected.amount_due ? 'PAID' : total > 0 ? 'PARTIAL' : 'UNPAID';
    try {
      const { error: encErr } = await supabase.from('encaissements').insert({
        reservation_id: selected.id,
        montant_total: amount,
        mode_paiement: payMethod,
        type_versement: payType,
      });
      if (encErr) throw encErr;
      const { error: resErr } = await supabase.from('reservations').update({
        payment_status: newStatus,
        amount_paid: total,
      }).eq('id', selected.id);
      if (resErr) throw resErr;
      await Promise.all([refreshReservations(), refreshEncaissements()]);
      setShowPayModal(false);
      setPayAmount('');
      setPayType('solde');
      setSelected(null);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleStatusChange = async (r: Reservation, newStatut: string) => {
    await supabase.from('reservations').update({ statut: newStatut }).eq('id', r.id);
    await refreshReservations();
  };

  const handleDelete = async (r: Reservation) => {
    if (!window.confirm('Annuler cette réservation ?')) return;
    await supabase.from('reservations').update({ statut: 'annulé' }).eq('id', r.id);
    await refreshReservations();
  };

  const TYPE_VERSEMENT_LABELS: Record<string, string> = {
    avance: 'Avance', acompte: 'Acompte', solde: 'Solde', autre: 'Autre',
  };
  const MODE_LABELS: Record<string, string> = {
    especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', mixte: 'Mixte', autre: 'Autre',
  };

  const handleGenerateInvoice = (r: Reservation) => {
    const resEncaissements = getEncaissementsForRes(r.id);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    const code = r.code_court || r.id.slice(0, 8);
    const dateRes = format(parseISO(r.date_debut), 'dd/MM/yyyy');
    const dateFin = format(parseISO(r.date_fin), 'dd/MM/yyyy HH:mm');
    const dateNow = new Date().toLocaleDateString('fr-FR');
    const reste = r.amount_due - r.amount_paid;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, W, 297, 'F');

    pdf.setFontSize(26);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(33, 33, 33);
    pdf.text('FACTURE', W / 2, 25, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(102, 102, 102);
    pdf.text(`#${code}`, W / 2, 32, { align: 'center' });

    pdf.setDrawColor(51, 51, 51);
    pdf.setLineWidth(0.5);
    pdf.line(15, 37, W - 15, 37);

    pdf.setFontSize(9);
    pdf.setTextColor(102, 102, 102);
    pdf.text('FACTURÉ À', 15, 47);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(33, 33, 33);
    pdf.text(r.client_name, 15, 54);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(102, 102, 102);
    pdf.text(r.client_phone || '', 15, 60);

    pdf.setFontSize(10);
    pdf.setTextColor(102, 102, 102);
    pdf.text(`Date: ${dateNow}`, W - 15, 47, { align: 'right' });
    pdf.text(`Réservation: ${dateRes}`, W - 15, 54, { align: 'right' });
    pdf.text(`Fin: ${dateFin}`, W - 15, 60, { align: 'right' });

    const tableY = 72;
    pdf.setFillColor(240, 240, 240);
    pdf.rect(15, tableY, W - 30, 9, 'F');
    pdf.setDrawColor(51, 51, 51);
    pdf.setLineWidth(0.4);
    pdf.line(15, tableY, W - 15, tableY);
    pdf.line(15, tableY + 9, W - 15, tableY + 9);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(33, 33, 33);
    pdf.text('Description', 20, tableY + 6.5);
    pdf.text('Montant', W - 20, tableY + 6.5, { align: 'right' });

    const rowY = tableY + 9;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(33, 33, 33);
    pdf.text(r.terrain?.name || 'Terrain', 20, rowY + 7);
    pdf.text(`${fmt(r.amount_due)} FCFA`, W - 20, rowY + 7, { align: 'right' });
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(15, rowY + 10, W - 15, rowY + 10);

    let encY = rowY + 20;
    if (resEncaissements.length > 0) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(102, 102, 102);
      pdf.text('HISTORIQUE DES VERSEMENTS', 15, encY);
      encY += 6;

      pdf.setFillColor(240, 240, 240);
      pdf.rect(15, encY, W - 30, 8, 'F');
      pdf.setDrawColor(51, 51, 51);
      pdf.setLineWidth(0.3);
      pdf.line(15, encY, W - 15, encY);
      pdf.line(15, encY + 8, W - 15, encY + 8);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(33, 33, 33);
      pdf.text('Date', 20, encY + 5.5);
      pdf.text('Type', 65, encY + 5.5);
      pdf.text('Mode', 105, encY + 5.5);
      pdf.text('Montant', W - 20, encY + 5.5, { align: 'right' });
      encY += 8;

      pdf.setFont('helvetica', 'normal');
      for (const enc of resEncaissements) {
        const d = new Date(enc.created_at).toLocaleDateString('fr-FR');
        const tv = enc.type_versement || 'solde';
        const typeLabel = TYPE_VERSEMENT_LABELS[tv] || 'Solde';
        const modeLabel = MODE_LABELS[enc.mode_paiement] || enc.mode_paiement;
        pdf.setTextColor(33, 33, 33);
        pdf.text(d, 20, encY + 5.5);
        pdf.setTextColor(
          tv === 'avance' ? 234 : tv === 'acompte' ? 245 : 33,
          tv === 'avance' ? 88 : tv === 'acompte' ? 158 : 33,
          tv === 'avance' ? 12 : tv === 'acompte' ? 11 : 33
        );
        pdf.text(typeLabel, 65, encY + 5.5);
        pdf.setTextColor(33, 33, 33);
        pdf.text(modeLabel, 105, encY + 5.5);
        pdf.text(`${fmt(enc.montant_total)} FCFA`, W - 20, encY + 5.5, { align: 'right' });
        pdf.setDrawColor(220, 220, 220);
        pdf.line(15, encY + 8, W - 15, encY + 8);
        encY += 8;
      }
      encY += 5;
    }

    const summaryY = encY + 5;
    const colLeft = W / 2 + 5;
    pdf.setDrawColor(51, 51, 51);
    pdf.setLineWidth(0.5);
    pdf.line(colLeft, summaryY, W - 15, summaryY);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(102, 102, 102);
    pdf.text('Montant dû:', colLeft, summaryY + 7);
    pdf.text('Montant payé:', colLeft, summaryY + 14);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(33, 33, 33);
    pdf.text(`${fmt(r.amount_due)} FCFA`, W - 15, summaryY + 7, { align: 'right' });
    pdf.setTextColor(16, 185, 129);
    pdf.text(`${fmt(r.amount_paid)} FCFA`, W - 15, summaryY + 14, { align: 'right' });

    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(colLeft, summaryY + 18, W - 15, summaryY + 18);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(102, 102, 102);
    pdf.text('Reste:', colLeft, summaryY + 25);
    pdf.text('Statut:', colLeft, summaryY + 32);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(reste > 0 ? 239 : 16, reste > 0 ? 68 : 185, reste > 0 ? 68 : 129);
    pdf.text(`${fmt(reste)} FCFA`, W - 15, summaryY + 25, { align: 'right' });
    pdf.setTextColor(33, 33, 33);
    pdf.text(PAYMENT_LABELS[r.payment_status], W - 15, summaryY + 32, { align: 'right' });

    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(15, 270, W - 15, 270);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(153, 153, 153);
    pdf.text('Merci pour votre réservation', W / 2, 277, { align: 'center' });

    pdf.save(`Facture_${code}.pdf`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Réservations</h1>
        <p className="text-slate-400 text-sm mt-0.5">{reservations.length} réservation{reservations.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher client, téléphone, code..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Tous les paiements</option>
          {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((r) => {
          const reste = r.amount_due - r.amount_paid;
          const sameDay = isSameDay(r.date_debut, r.date_fin);
          const debut = parseISO(r.date_debut);
          const fin = parseISO(r.date_fin);
          const timeStr = `${format(debut, 'HH:mm')} – ${format(fin, 'HH:mm')}`;
          const dateStr = sameDay
            ? formatDate(r.date_debut)
            : `${format(debut, 'dd/MM')} → ${format(fin, 'dd/MM')}`;

          const borderColor =
            r.statut === 'check_in' ? 'border-l-emerald-500' :
            r.statut === 'réservé' ? 'border-l-blue-500' :
            r.statut === 'en_attente' ? 'border-l-amber-500' :
            r.statut === 'annulé' ? 'border-l-red-500' :
            'border-l-slate-600';

          return (
            <div
              key={r.id}
              className={`bg-slate-900 border border-slate-800 border-l-4 ${borderColor} rounded-2xl overflow-hidden`}
            >
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {getInitial(r.client_name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{r.client_name}</span>
                        {isNew(r) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">
                            Nouveau
                          </span>
                        )}
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${PAYMENT_COLORS[r.payment_status]}`}>
                          {PAYMENT_LABELS[r.payment_status]}
                        </span>
                        {reste > 0 && (
                          <span className="text-[11px] font-semibold text-slate-300">
                            Reste: <span className="text-white">{fmt(reste)} CFA</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1 ${STATUT_COLORS[r.statut] || STATUT_COLORS.réservé}`}>
                    {r.statut === 'réservé' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
                    {r.statut === 'check_in' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
                    {STATUT_LABELS[r.statut] || r.statut}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-600">📞</span>
                      {r.client_phone}
                    </span>
                    {r.code_court && (
                      <span className="text-[11px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700">
                        #{r.code_court}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-600">📍</span>
                      {r.terrain?.name || '—'}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-600">📅</span>
                      {dateStr}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-600">🕐</span>
                      {timeStr}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {fmt(r.amount_due)} <span className="text-xs text-slate-400 font-normal">CFA</span>
                    </span>
                  </div>
                  {(() => {
                    const resEnc = getEncaissementsForRes(r.id);
                    if (resEnc.length === 0) return null;
                    return (
                      <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                        {resEnc.map((enc) => {
                          const tv = enc.type_versement || 'solde';
                          const tvLabel = { avance: 'Avance', acompte: 'Acompte', solde: 'Solde', autre: 'Autre' }[tv] || tv;
                          const modeLabel = { especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', mixte: 'Mixte', autre: 'Autre' }[enc.mode_paiement] || enc.mode_paiement;
                          const tvColor =
                            tv === 'avance' ? 'bg-orange-500/15 text-orange-300 border-orange-500/30' :
                            tv === 'acompte' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' :
                            'bg-slate-700/50 text-slate-400 border-slate-600/30';
                          return (
                            <div key={enc.id} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${tvColor}`}>
                                  {tvLabel}
                                </span>
                                <span className="text-[10px] text-slate-500">{modeLabel}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-emerald-400">{fmt(enc.montant_total)} CFA</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-2 flex-wrap">
                {canManage && r.statut === 'réservé' && (
                  <button
                    onClick={() => handleStatusChange(r, 'check_in')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-semibold transition-all"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Check-in
                  </button>
                )}
                {canManage && r.statut === 'check_in' && (
                  <button
                    onClick={() => handleStatusChange(r, 'terminé')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-semibold transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Check-out
                  </button>
                )}
                {canManage && r.statut === 'annulé' && (
                  <button
                    onClick={() => handleStatusChange(r, 'réservé')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Rétablir
                  </button>
                )}

                <div className="flex items-center gap-1.5 ml-auto">
                  {canPay && r.payment_status !== 'PAID' && !['annulé', 'terminé'].includes(r.statut) && (
                    <button
                      onClick={() => { setSelected(r); setShowPayModal(true); }}
                      className="flex items-center gap-1 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition-all border border-slate-700"
                      title="Encaisser"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGenerateInvoice(r); }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs transition-all border border-slate-700"
                    title="Générer facture"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  {canDelete && !['annulé', 'terminé'].includes(r.statut) && (
                    <button
                      onClick={() => handleDelete(r)}
                      className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl text-xs transition-all border border-slate-700 hover:border-red-500/30"
                      title="Annuler"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm">
            Aucune réservation trouvée
          </div>
        )}
      </div>

      {showPayModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">Encaisser un paiement</h2>
              <button onClick={() => { setShowPayModal(false); setSelected(null); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-3 text-sm">
                <p className="text-slate-400">{selected.client_name}</p>
                <p className="text-white font-medium">{selected.terrain?.name}</p>
                <p className="text-slate-400 text-xs mt-1">
                  Dû: {fmt(selected.amount_due)} FCFA — Payé: {fmt(selected.amount_paid)} FCFA
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Montant (FCFA)</label>
                <input
                  type="number"
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={String(selected.amount_due - selected.amount_paid)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Type de versement</label>
                  <select value={payType} onChange={(e) => setPayType(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="avance">Avance</option>
                    <option value="acompte">Acompte</option>
                    <option value="solde">Solde</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Mode de paiement</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="especes">Espèces</option>
                    <option value="wave">Wave</option>
                    <option value="orange_money">Orange Money</option>
                    <option value="mixte">Mixte</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowPayModal(false); setSelected(null); }} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Annuler</button>
                <button onClick={handlePay} disabled={loading || !payAmount} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Encaisser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
