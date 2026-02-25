import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, Printer, FileText, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { IconPill } from '../ui/IconPill';
import { jsPDF } from 'jspdf';

interface InvoiceModalProps {
  reservation: {
    id: string;
    client_name: string;
    client_phone: string;
    terrain_id: string;
    date_debut: string;
    date_fin: string;
    tarif_total: number;
    montant_tva: number;
    montant_ttc: number;
    tva_applicable: boolean;
  };
  terrainName: string;
  onClose: () => void;
}

interface Facture {
  id: string;
  numero_facture: string;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  date_emission: string;
}

interface Encaissement {
  montant_total: number;
  mode_paiement: string;
  created_at: string;
}

interface CompanySettings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  tax_id: string;
  logo_url: string;
  currency: string;
  tax_rate: number;
  invoice_prefix: string;
  invoice_footer: string;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ reservation, terrainName, onClose }) => {
  const { profile } = useAuth();
  const [facture, setFacture] = useState<Facture | null>(null);
  const [payments, setPayments] = useState<Encaissement[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [autoDownloadPending, setAutoDownloadPending] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const buildInvoiceHtml = useCallback((forPrint = false) => {
    if (!facture) return '';
    const cn = company?.company_name || 'Votre Entreprise';
    const cur = company?.currency || 'CFA';
    const fmt = (v: number) => `${new Intl.NumberFormat('fr-FR').format(v)} ${cur}`;
    const fmtDate = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const fmtDt = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const tvaRate = company?.tax_rate ?? 18;
    const totalPaid = payments.reduce((s, p) => s + Number(p.montant_total), 0);
    const ttc = Number(reservation.montant_ttc);
    const remaining = ttc - totalPaid;
    const modeMap: Record<string, string> = { especes: 'Especes', orange_money: 'Orange Money', wave: 'Wave', mixte: 'Mixte', autre: 'Autre' };

    const paymentStatus = totalPaid <= 0
      ? 'NON PAYEE'
      : remaining <= 0.01
        ? 'PAYEE'
        : 'PARTIELLEMENT PAYEE';

    const stampColor = paymentStatus === 'PAYEE'
      ? '#16a34a'
      : paymentStatus === 'PARTIELLEMENT PAYEE'
        ? '#d97706'
        : '#dc2626';

    const stampBg = paymentStatus === 'PAYEE'
      ? 'rgba(22,163,74,0.08)'
      : paymentStatus === 'PARTIELLEMENT PAYEE'
        ? 'rgba(217,119,6,0.08)'
        : 'rgba(220,38,38,0.08)';

    const accentColor = '#0ea5e9';

    const logoHtml = company?.logo_url
      ? `<img src="${company.logo_url}" alt="logo" style="height:60px;width:60px;object-fit:contain;border-radius:10px;background:#f8fafc;padding:4px;border:1px solid #e2e8f0;" />`
      : `<div style="height:60px;width:60px;background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:10px;display:flex;align-items:center;justify-content:center;border:1px solid #334155;">
           <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
           </svg>
         </div>`;

    const printOnly = forPrint ? `@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }` : '';

    const paymentsRows = payments.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding:10px 14px;font-size:12px;color:#475569;">${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
        <td style="padding:10px 14px;font-size:12px;color:#475569;">${modeMap[p.mode_paiement] || p.mode_paiement}</td>
        <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#1e293b;text-align:right;">${fmt(Number(p.montant_total))}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Facture ${facture.numero_facture}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: ${forPrint ? '#fff' : '#e8edf2'}; }
    ${printOnly}
  </style>
</head>
<body>
<div style="width:794px;min-height:1123px;margin:${forPrint ? '0' : '20px auto'};background:#ffffff;font-family:'Segoe UI',Arial,sans-serif;color:#1a2332;position:relative;display:flex;flex-direction:column;${forPrint ? '' : 'box-shadow:0 8px 40px rgba(0,0,0,0.13);'}">

  <!-- Watermark -->
  <div style="position:absolute;top:48%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);z-index:5;pointer-events:none;">
    <div style="border:5px solid ${stampColor};border-radius:8px;padding:14px 32px;opacity:0.12;">
      <div style="font-size:${paymentStatus === 'PARTIELLEMENT PAYEE' ? '30px' : '40px'};font-weight:900;color:${stampColor};letter-spacing:4px;white-space:nowrap;text-transform:uppercase;">${paymentStatus}</div>
    </div>
  </div>

  <!-- Header band -->
  <div style="background:#0f172a;padding:0 40px;display:flex;align-items:stretch;">
    <div style="flex:1;padding:28px 0;border-right:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex;align-items:center;gap:14px;">
        ${logoHtml}
        <div>
          <div style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">${cn}</div>
          ${company?.company_address ? `<div style="font-size:10.5px;color:#94a3b8;margin-top:4px;">${company.company_address}</div>` : ''}
          <div style="margin-top:6px;display:flex;flex-direction:column;gap:2px;">
            ${company?.company_phone ? `<span style="font-size:10px;color:#64748b;">${company.company_phone}</span>` : ''}
            ${company?.company_email ? `<span style="font-size:10px;color:#64748b;">${company.company_email}</span>` : ''}
            ${company?.tax_id ? `<span style="font-size:10px;color:#64748b;">NINEA: ${company.tax_id}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
    <div style="padding:28px 0 28px 36px;text-align:right;min-width:220px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:2.5px;margin-bottom:6px;">Document Officiel</div>
      <div style="font-size:36px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1;">FACTURE</div>
      <div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:8px;">
        <span style="font-size:11px;color:#64748b;">N&deg;</span>
        <span style="font-size:13px;font-weight:800;color:${accentColor};font-family:monospace;letter-spacing:0.5px;">${facture.numero_facture}</span>
      </div>
      <div style="font-size:10px;color:#475569;margin-top:6px;">Emise le ${fmtDate(facture.date_emission)}</div>
    </div>
  </div>

  <!-- Accent line -->
  <div style="height:3px;background:linear-gradient(90deg,${accentColor},#38bdf8,#7dd3fc,#e2e8f0);"></div>

  <!-- Bill-to + Reservation info (2 columns) -->
  <div style="display:flex;padding:28px 40px;gap:0;border-bottom:1px solid #e8edf2;">
    <div style="flex:1;padding-right:28px;border-right:1px solid #e8edf2;">
      <div style="font-size:8.5px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Facture etablie pour</div>
      <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px;">${reservation.client_name}</div>
      <div style="font-size:11.5px;color:#64748b;">${reservation.client_phone}</div>
    </div>
    <div style="flex:1;padding-left:28px;padding-right:28px;border-right:1px solid #e8edf2;">
      <div style="font-size:8.5px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Details de la reservation</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:10.5px;color:#94a3b8;padding:3px 0;width:50px;vertical-align:top;">Terrain</td>
          <td style="font-size:10.5px;font-weight:700;color:#1a2332;padding:3px 0;">${terrainName}</td>
        </tr>
        <tr>
          <td style="font-size:10.5px;color:#94a3b8;padding:3px 0;vertical-align:top;">Debut</td>
          <td style="font-size:10.5px;font-weight:700;color:#1a2332;padding:3px 0;">${fmtDt(reservation.date_debut)}</td>
        </tr>
        <tr>
          <td style="font-size:10.5px;color:#94a3b8;padding:3px 0;vertical-align:top;">Fin</td>
          <td style="font-size:10.5px;font-weight:700;color:#1a2332;padding:3px 0;">${fmtDt(reservation.date_fin)}</td>
        </tr>
      </table>
    </div>
    <div style="flex:0 0 160px;padding-left:28px;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;">
      <div style="font-size:8.5px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Statut</div>
      <div style="display:inline-block;background:${stampBg};border:2px solid ${stampColor};border-radius:6px;padding:5px 14px;">
        <span style="font-size:${paymentStatus === 'PARTIELLEMENT PAYEE' ? '8px' : '10px'};font-weight:900;color:${stampColor};text-transform:uppercase;letter-spacing:1.5px;white-space:nowrap;">${paymentStatus}</span>
      </div>
    </div>
  </div>

  <!-- Line items table -->
  <div style="padding:24px 40px 0;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#0f172a;">
          <th style="padding:11px 16px;text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;border-radius:0;">Description</th>
          <th style="padding:11px 16px;text-align:center;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;width:70px;">Qte</th>
          <th style="padding:11px 16px;text-align:right;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;width:160px;">Prix unit. HT</th>
          <th style="padding:11px 16px;text-align:right;font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:1.5px;width:160px;">Total HT</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
          <td style="padding:16px;">
            <div style="font-size:12.5px;font-weight:700;color:#0f172a;">Location de terrain sportif</div>
            <div style="font-size:10.5px;color:#64748b;margin-top:3px;">${terrainName}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:1px;">${fmtDt(reservation.date_debut)} &rarr; ${fmtDt(reservation.date_fin)}</div>
          </td>
          <td style="padding:16px;font-size:12.5px;color:#475569;text-align:center;font-weight:600;">1</td>
          <td style="padding:16px;font-size:12.5px;color:#475569;text-align:right;">${fmt(Number(reservation.tarif_total))}</td>
          <td style="padding:16px;font-size:13px;font-weight:800;color:#0f172a;text-align:right;">${fmt(Number(reservation.tarif_total))}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Totals section (right-aligned block) -->
  <div style="padding:16px 40px 24px;display:flex;justify-content:flex-end;">
    <div style="width:320px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          <tr style="border-bottom:1px solid #e8edf2;">
            <td style="padding:9px 16px;font-size:11px;color:#64748b;">Sous-total HT</td>
            <td style="padding:9px 16px;font-size:11px;font-weight:700;color:#1a2332;text-align:right;">${fmt(Number(reservation.tarif_total))}</td>
          </tr>
          ${reservation.tva_applicable ? `
          <tr style="border-bottom:1px solid #e8edf2;">
            <td style="padding:9px 16px;font-size:11px;color:#64748b;">TVA (${tvaRate}%)</td>
            <td style="padding:9px 16px;font-size:11px;font-weight:700;color:#1a2332;text-align:right;">${fmt(Number(reservation.montant_tva))}</td>
          </tr>` : ''}
          <tr style="background:#0f172a;">
            <td style="padding:13px 16px;font-size:13px;font-weight:800;color:#ffffff;">TOTAL TTC</td>
            <td style="padding:13px 16px;font-size:16px;font-weight:900;color:${accentColor};text-align:right;">${fmt(ttc)}</td>
          </tr>
          ${totalPaid > 0 ? `
          <tr style="border-bottom:1px solid #e8edf2;background:#f0fdf4;">
            <td style="padding:9px 16px;font-size:11px;color:#16a34a;">Deja regle</td>
            <td style="padding:9px 16px;font-size:11px;font-weight:700;color:#16a34a;text-align:right;">&minus; ${fmt(totalPaid)}</td>
          </tr>
          <tr style="background:${remaining > 0.01 ? '#fffbeb' : '#f0fdf4'};">
            <td style="padding:11px 16px;font-size:12px;font-weight:800;color:${remaining > 0.01 ? '#b45309' : '#16a34a'};">Reste a payer</td>
            <td style="padding:11px 16px;font-size:13px;font-weight:900;color:${remaining > 0.01 ? '#b45309' : '#16a34a'};text-align:right;">${fmt(Math.max(0, remaining))}</td>
          </tr>` : ''}
        </tbody>
      </table>
    </div>
  </div>

  ${payments.length > 0 ? `
  <!-- Payment history -->
  <div style="margin:0 40px 24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <div style="background:#f8fafc;padding:10px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1.5px;">Historique des reglements</span>
      <span style="font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:1px;">${payments.length} versement${payments.length > 1 ? 's' : ''}</span>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 16px;text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Date</th>
          <th style="padding:8px 16px;text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Mode de paiement</th>
          <th style="padding:8px 16px;text-align:right;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Montant</th>
        </tr>
      </thead>
      <tbody>${paymentsRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Spacer -->
  <div style="flex:1;"></div>

  <!-- Footer -->
  <div style="margin:0 40px;padding:18px 0;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="font-size:10px;color:#94a3b8;line-height:1.8;max-width:440px;">
      ${company?.invoice_footer ? company.invoice_footer : `Merci de votre confiance &mdash; ${cn}`}
    </div>
    <div style="text-align:right;">
      <div style="font-size:9px;color:#cbd5e1;">Document genere le ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  <!-- Bottom bar -->
  <div style="height:4px;background:linear-gradient(90deg,${accentColor},#38bdf8,#7dd3fc,#e2e8f0);"></div>

</div>
</body>
</html>`;
  }, [facture, company, payments, reservation, terrainName]);

  const generatePdfBlob = useCallback(async (): Promise<{ blob: Blob; filename: string } | null> => {
    if (!facture) return null;
    const html = buildInvoiceHtml(false);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '800px';
    iframe.style.height = '1200px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.srcdoc = html;
    });

    await new Promise(r => setTimeout(r, 600));

    const { default: html2canvas } = await import('html2canvas');
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) { document.body.removeChild(iframe); return null; }
    const target = iframeDoc.querySelector('div') as HTMLElement;

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
    });

    document.body.removeChild(iframe);

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const blob = pdf.output('blob');
    return { blob, filename: `${facture.numero_facture}.pdf` };
  }, [facture, buildInvoiceHtml]);

  const handleDownloadPDF = useCallback(async () => {
    if (!facture) return;
    setDownloadingPdf(true);
    try {
      const result = await generatePdfBlob();
      if (!result) return;
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setDownloadingPdf(false);
    }
  }, [facture, generatePdfBlob]);

  useEffect(() => {
    if (autoDownloadPending && facture) {
      setAutoDownloadPending(false);
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoDownloadPending, facture, handleDownloadPDF]);

  const loadData = async () => {
    try {
      const [factureRes, paymentsRes, companyRes] = await Promise.all([
        supabase
          .from('factures')
          .select('*')
          .eq('reservation_id', reservation.id)
          .maybeSingle(),
        supabase
          .from('encaissements')
          .select('*')
          .eq('reservation_id', reservation.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('company_settings')
          .select('*')
          .limit(1)
          .maybeSingle(),
      ]);

      if (factureRes.data) setFacture(factureRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (companyRes.data) setCompany(companyRes.data);
    } catch (err) {
      console.error('Error loading invoice data:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateInvoice = async () => {
    setGenerating(true);
    try {
      const prefix = company?.invoice_prefix || 'FACT';
      const timestamp = Date.now().toString(36).toUpperCase();
      const numero = `${prefix}-${new Date().getFullYear()}-${timestamp}`;

      const { data, error } = await supabase
        .from('factures')
        .insert({
          reservation_id: reservation.id,
          numero_facture: numero,
          montant_ht: reservation.tarif_total,
          montant_tva: reservation.montant_tva,
          montant_ttc: reservation.montant_ttc,
          emise_par: profile?.id,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFacture(data);
        setAutoDownloadPending(true);
      }
    } catch (err) {
      console.error('Error generating invoice:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!facture) return;
    const html = buildInvoiceHtml(true);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) { document.body.removeChild(iframe); return; }
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 600);
  };

  const handleWhatsApp = async () => {
    if (!facture) return;
    setSendingWhatsApp(true);
    try {
      const cur = company?.currency || 'CFA';
      const fmt = (v: number) => `${new Intl.NumberFormat('fr-FR').format(v)} ${cur}`;
      const fmtDt = (s: string) => new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const ttc = Number(reservation.montant_ttc);
      const totalPaid = payments.reduce((s, p) => s + Number(p.montant_total), 0);
      const remaining = ttc - totalPaid;

      const paymentStatus = totalPaid <= 0
        ? 'Non payée'
        : remaining <= 0.01
          ? 'Payée'
          : 'Partiellement payée';

      const pdfResult = await generatePdfBlob();

      let pdfLink = '';
      if (pdfResult) {
        const path = `${facture.numero_facture}-${Date.now()}.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(path, pdfResult.blob, { contentType: 'application/pdf', upsert: true });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(uploadData.path);
          if (urlData?.publicUrl) pdfLink = urlData.publicUrl;
        }
      }

      let msg = `Bonjour ${reservation.client_name},\n\nVoici votre facture *${facture.numero_facture}* :\n\n`;
      msg += `Terrain : ${terrainName}\n`;
      msg += `Debut : ${fmtDt(reservation.date_debut)}\n`;
      msg += `Fin : ${fmtDt(reservation.date_fin)}\n`;
      msg += `Montant TTC : *${fmt(ttc)}*\n`;
      if (totalPaid > 0) msg += `Deja regle : ${fmt(totalPaid)}\n`;
      if (remaining > 0.01) msg += `Reste a payer : *${fmt(remaining)}*\n`;
      msg += `Statut : ${paymentStatus}`;
      if (pdfLink) msg += `\n\nTelecharger la facture PDF :\n${pdfLink}`;

      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (err) {
      console.error('WhatsApp send error:', err);
    } finally {
      setSendingWhatsApp(false);
    }
  };


  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700/60 p-8 flex items-center gap-3 shadow-2xl shadow-black/30">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent" />
          <span className="text-slate-300 text-sm font-medium">Chargement...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/60 max-w-3xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-700/60 sticky top-0 bg-slate-800/95 backdrop-blur-md rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <IconPill variant="primary">
              <FileText className="w-5 h-5" />
            </IconPill>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Facture</h2>
              {facture && (
                <p className="text-xs text-slate-400 font-mono">{facture.numero_facture}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {facture && (
              <>
                <button
                  onClick={handleWhatsApp}
                  disabled={sendingWhatsApp}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#25D366] hover:bg-[#20bb58] rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20 disabled:opacity-50"
                  title="Envoyer sur WhatsApp"
                >
                  {sendingWhatsApp ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{sendingWhatsApp ? 'Preparation...' : 'WhatsApp'}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 bg-slate-700/60 hover:bg-slate-600/70 border border-slate-600/50 rounded-xl transition-all duration-200"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Imprimer</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloadingPdf}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl transition-all duration-200 disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/20"
                >
                  {downloadingPdf ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {downloadingPdf ? 'Export...' : 'PDF'}
                </button>
              </>
            )}
            <IconPill variant="default" size="sm" onClick={onClose} title="Fermer">
              <X className="w-4 h-4" />
            </IconPill>
          </div>
        </div>

        {!facture ? (
          <div className="p-8 sm:p-10 text-center space-y-5">
            <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto border border-slate-600/40 ring-1 ring-white/5">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">Aucune facture generee</p>
              <p className="text-sm text-slate-400 mt-1.5">Creez une facture pour cette reservation</p>
            </div>
            <button
              onClick={generateInvoice}
              disabled={generating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/25 min-h-[44px]"
            >
              {generating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {generating ? 'Generation...' : 'Generer la Facture'}
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <iframe
              srcDoc={buildInvoiceHtml(false)}
              title="Apercu facture"
              className="w-full rounded-xl border-0"
              style={{ height: '680px' }}
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
};
