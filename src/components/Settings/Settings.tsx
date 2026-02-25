import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CardShell } from '../ui/CardShell';
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  FileText,
  Upload,
  Save,
  X,
  Image as ImageIcon,
  Shield,
  DollarSign,
  Hash,
  Percent,
  Link,
  Copy,
  CheckCheck,
  ExternalLink,
  Smartphone,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface CompanySettings {
  id: string;
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

interface DepositSettings {
  deposit_type: 'PERCENTAGE' | 'FIXED';
  deposit_value: number;
  online_payment_enabled: boolean;
  wave_number: string;
  orange_money_number: string;
}

interface Profile {
  id: string;
  role: string;
}

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    tax_id: '',
    logo_url: '',
    currency: 'FCFA',
    tax_rate: 18,
    invoice_prefix: 'INV',
    invoice_footer: '',
  });

  const [depositForm, setDepositForm] = useState<DepositSettings>({
    deposit_type: 'PERCENTAGE',
    deposit_value: 30,
    online_payment_enabled: false,
    wave_number: '',
    orange_money_number: '',
  });

  useEffect(() => {
    loadProfile();
    loadSettings();
    loadDepositSettings();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (data && !error) {
      setProfile(data);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data && !error) {
      setSettings(data);
      setFormData({
        company_name: data.company_name || '',
        company_address: data.company_address || '',
        company_phone: data.company_phone || '',
        company_email: data.company_email || '',
        company_website: data.company_website || '',
        tax_id: data.tax_id || '',
        logo_url: data.logo_url || '',
        currency: data.currency || 'FCFA',
        tax_rate: data.tax_rate || 18,
        invoice_prefix: data.invoice_prefix || 'INV',
        invoice_footer: data.invoice_footer || '',
      });
      setLogoPreview(data.logo_url || '');
    }
    setLoading(false);
  };

  const loadDepositSettings = async () => {
    const { data } = await supabase
      .from('deposit_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      setDepositForm({
        deposit_type: data.deposit_type,
        deposit_value: data.deposit_value,
        online_payment_enabled: data.online_payment_enabled,
        wave_number: data.wave_number || '',
        orange_money_number: data.orange_money_number || '',
      });
    }
  };

  const handleSaveDeposit = async () => {
    setSavingDeposit(true);
    try {
      const { error } = await supabase
        .from('deposit_settings')
        .upsert({
          id: 1,
          ...depositForm,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      alert('Paramètres de paiement enregistrés');
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setSavingDeposit(false);
    }
  };

  const isAdmin = profile?.role === 'admin';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Le fichier est trop volumineux. Taille maximale: 2 MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image valide');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setLogoPreview(base64String);
      setFormData({ ...formData, logo_url: base64String });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview('');
    setFormData({ ...formData, logo_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      alert('Vous n\'avez pas les permissions pour modifier les paramètres');
      return;
    }

    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update({
            company_name: formData.company_name,
            company_address: formData.company_address,
            company_phone: formData.company_phone,
            company_email: formData.company_email,
            company_website: formData.company_website,
            tax_id: formData.tax_id,
            logo_url: formData.logo_url,
            currency: formData.currency,
            tax_rate: formData.tax_rate,
            invoice_prefix: formData.invoice_prefix,
            invoice_footer: formData.invoice_footer,
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert([formData]);

        if (error) throw error;
      }

      await loadSettings();
      alert('Paramètres enregistrés avec succès');
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const bookingUrl = `${window.location.origin}/reserver`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const inputClass = "w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200";

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Paramètres</h1>
        <CardShell className="text-center py-8">
          <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
        </CardShell>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Paramètres</h1>
        <CardShell className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
        </CardShell>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Paramètres de la Société
          </h1>
          <p className="text-sm sm:text-base text-slate-400 mt-1">
            Configurez les informations de votre entreprise
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-[1px] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5 sm:space-y-6">
          <CardShell>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 ring-1 ring-emerald-500/5 inline-flex items-center justify-center">
                <Building2 className="w-4 h-4 text-emerald-400" />
              </div>
              Informations de l'Entreprise
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nom de la société
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) =>
                    setFormData({ ...formData, company_name: e.target.value })
                  }
                  className={inputClass}
                  placeholder="Terrain de Football Premium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Adresse
                </label>
                <textarea
                  value={formData.company_address}
                  onChange={(e) =>
                    setFormData({ ...formData, company_address: e.target.value })
                  }
                  rows={3}
                  className={`${inputClass} min-h-0 py-2.5`}
                  placeholder="123 Rue Exemple, Ville, Pays"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.company_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, company_phone: e.target.value })
                    }
                    className={inputClass}
                    placeholder="+221 XX XXX XX XX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.company_email}
                    onChange={(e) =>
                      setFormData({ ...formData, company_email: e.target.value })
                    }
                    className={inputClass}
                    placeholder="contact@exemple.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Globe className="w-4 h-4 inline mr-1" />
                    Site web
                  </label>
                  <input
                    type="url"
                    value={formData.company_website}
                    onChange={(e) =>
                      setFormData({ ...formData, company_website: e.target.value })
                    }
                    className={inputClass}
                    placeholder="https://www.exemple.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <FileText className="w-4 h-4 inline mr-1" />
                    Numéro d'identification fiscale
                  </label>
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_id: e.target.value })
                    }
                    className={inputClass}
                    placeholder="NINEA, RC, etc."
                  />
                </div>
              </div>
            </div>
          </CardShell>

          <CardShell>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 ring-1 ring-emerald-500/5 inline-flex items-center justify-center">
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
              Paramètres de Facturation
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Devise
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="FCFA">FCFA</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="MAD">MAD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Percent className="w-4 h-4 inline mr-1" />
                    Taux TVA (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tax_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })
                    }
                    className={inputClass}
                    placeholder="18"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Hash className="w-4 h-4 inline mr-1" />
                    Préfixe facture
                  </label>
                  <input
                    type="text"
                    value={formData.invoice_prefix}
                    onChange={(e) =>
                      setFormData({ ...formData, invoice_prefix: e.target.value })
                    }
                    className={inputClass}
                    placeholder="INV"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Pied de page des factures
                </label>
                <textarea
                  value={formData.invoice_footer}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_footer: e.target.value })
                  }
                  rows={3}
                  className={`${inputClass} min-h-0 py-2.5`}
                  placeholder="Merci pour votre confiance. Conditions de paiement: ..."
                />
              </div>
            </div>
          </CardShell>
        </div>

        {/* Right column - Logo + Booking link */}
        <div className="lg:col-span-1 space-y-5 sm:space-y-6">
          <CardShell>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 ring-1 ring-emerald-500/5 inline-flex items-center justify-center">
                <Link className="w-4 h-4 text-emerald-400" />
              </div>
              Lien de reservation client
            </h2>
            <div className="space-y-3">
              <p className="text-sm text-slate-400 leading-relaxed">
                Partagez ce lien avec vos clients pour qu'ils puissent faire des reservations directement, sans avoir besoin d'un compte.
              </p>
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
                <span className="text-xs text-emerald-400 font-mono truncate flex-1">{bookingUrl}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className={`flex-1 flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-sm font-medium transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                    copied
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-700/50 hover:bg-slate-600/60 border-slate-600/50 text-white'
                  }`}
                >
                  {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copie !' : 'Copier le lien'}
                </button>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-xl text-sm font-medium bg-slate-700/50 hover:bg-slate-600/60 border border-slate-600/50 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                <p className="text-xs text-emerald-400/80 leading-relaxed">
                  Les reservations effectuees via ce lien apparaissent automatiquement dans votre calendrier avec le statut "reserve".
                </p>
              </div>
            </div>
          </CardShell>

          <CardShell>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 ring-1 ring-emerald-500/5 inline-flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-emerald-400" />
              </div>
              Paiement en ligne
            </h2>
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setDepositForm(prev => ({ ...prev, online_payment_enabled: !prev.online_payment_enabled }))}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl transition-all duration-200 hover:border-slate-600/70"
              >
                <span className="text-sm font-medium text-slate-300">Activer le paiement en ligne</span>
                {depositForm.online_payment_enabled
                  ? <ToggleRight className="w-6 h-6 text-emerald-400" />
                  : <ToggleLeft className="w-6 h-6 text-slate-500" />}
              </button>

              {depositForm.online_payment_enabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDepositForm(prev => ({ ...prev, deposit_type: 'PERCENTAGE' }))}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                        depositForm.deposit_type === 'PERCENTAGE'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:border-slate-600/70'
                      }`}
                    >
                      Pourcentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositForm(prev => ({ ...prev, deposit_type: 'FIXED' }))}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                        depositForm.deposit_type === 'FIXED'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:border-slate-600/70'
                      }`}
                    >
                      Montant fixe
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {depositForm.deposit_type === 'PERCENTAGE' ? (
                        <><Percent className="w-4 h-4 inline mr-1" />Pourcentage d'acompte</>
                      ) : (
                        <><DollarSign className="w-4 h-4 inline mr-1" />Montant fixe de l'acompte</>
                      )}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={depositForm.deposit_type === 'PERCENTAGE' ? 100 : undefined}
                      value={depositForm.deposit_value}
                      onChange={(e) => setDepositForm(prev => ({ ...prev, deposit_value: parseFloat(e.target.value) || 0 }))}
                      className={inputClass}
                      placeholder={depositForm.deposit_type === 'PERCENTAGE' ? '30' : '5000'}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      {depositForm.deposit_type === 'PERCENTAGE'
                        ? `Exemple : 30% de 10 000 CFA = acompte de 3 000 CFA`
                        : `Montant fixe demandé, indépendamment du tarif`}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <Phone className="w-4 h-4 inline mr-1 text-emerald-400" />
                      Numéro Wave
                    </label>
                    <input
                      type="tel"
                      value={depositForm.wave_number}
                      onChange={(e) => setDepositForm(prev => ({ ...prev, wave_number: e.target.value }))}
                      className={inputClass}
                      placeholder="Ex: 77 000 00 00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <Phone className="w-4 h-4 inline mr-1 text-orange-400" />
                      Numéro Orange Money
                    </label>
                    <input
                      type="tel"
                      value={depositForm.orange_money_number}
                      onChange={(e) => setDepositForm(prev => ({ ...prev, orange_money_number: e.target.value }))}
                      className={inputClass}
                      placeholder="Ex: 77 000 00 00"
                    />
                  </div>
                </>
              )}

              <button
                onClick={handleSaveDeposit}
                disabled={savingDeposit}
                className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-2xl transition-all duration-200"
              >
                <Save className="w-4 h-4" />
                {savingDeposit ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </CardShell>

          <CardShell className="sticky top-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 ring-1 ring-emerald-500/5 inline-flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
              </div>
              Logo de l'Entreprise
            </h2>

            <div className="space-y-4">
              <div className="relative aspect-square bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-700/60 overflow-hidden transition-all duration-200 hover:border-slate-600/70">
                {logoPreview ? (
                  <>
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-full h-full object-contain p-4"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute top-2 right-2 p-2 bg-red-500/90 hover:bg-red-500 text-white rounded-xl transition-all duration-200 shadow-lg shadow-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <Upload className="w-12 h-12 text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">
                      Cliquez pour ajouter un logo
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      PNG, JPG (max 2 MB)
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 min-h-[44px] bg-slate-700/50 hover:bg-slate-600/60 text-white rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-slate-600/50 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <Upload className="w-4 h-4" />
                {logoPreview ? 'Changer le logo' : 'Télécharger un logo'}
              </button>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                <p className="text-xs text-blue-300">
                  <strong>Conseil:</strong> Utilisez un logo carré avec fond transparent (PNG) pour un meilleur rendu sur les factures.
                </p>
              </div>
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
};
