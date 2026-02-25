import { useState, useEffect } from 'react';
import { Save, Loader2, Settings as SettingsIcon, Building, CreditCard, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { CompanySettings, DepositSettings, RolePermission } from '../../types';

type Tab = 'company' | 'payments' | 'permissions';

const ALL_PERMISSIONS = [
  { key: 'view_dashboard', label: 'Voir le tableau de bord' },
  { key: 'view_calendar', label: 'Voir le calendrier' },
  { key: 'view_terrains', label: 'Voir les terrains' },
  { key: 'manage_terrains', label: 'Gérer les terrains' },
  { key: 'view_clients', label: 'Voir les clients' },
  { key: 'manage_clients', label: 'Gérer les clients' },
  { key: 'delete_clients', label: 'Supprimer des clients' },
  { key: 'view_reservations', label: 'Voir les réservations' },
  { key: 'manage_reservations', label: 'Gérer les réservations' },
  { key: 'cancel_reservations', label: 'Annuler des réservations' },
  { key: 'view_payments', label: 'Voir les paiements' },
  { key: 'manage_payments', label: 'Gérer les paiements' },
  { key: 'view_rapports', label: 'Voir les rapports' },
  { key: 'view_backup', label: 'Voir la sauvegarde' },
];

const ROLES = ['manager', 'receptionist', 'user'] as const;
const ROLE_LABELS: Record<string, string> = { manager: 'Manager', receptionist: 'Réceptionniste', user: 'Utilisateur' };

export function Settings() {
  const { companySettings, depositSettings, rolePermissions, refreshCompanySettings, refreshDepositSettings, refreshRolePermissions } = useData();
  const [tab, setTab] = useState<Tab>('company');
  const [company, setCompany] = useState<Partial<CompanySettings>>({});
  const [deposit, setDeposit] = useState<Partial<DepositSettings>>({});
  const [perms, setPerms] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (companySettings) setCompany(companySettings);
  }, [companySettings]);

  useEffect(() => {
    if (depositSettings) setDeposit(depositSettings);
  }, [depositSettings]);

  useEffect(() => {
    setPerms(rolePermissions);
  }, [rolePermissions]);

  const saveCompany = async () => {
    setLoading(true);
    if (companySettings) {
      await supabase.from('company_settings').update(company).eq('id', companySettings.id);
    } else {
      await supabase.from('company_settings').insert(company);
    }
    await refreshCompanySettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setLoading(false);
  };

  const saveDeposit = async () => {
    setLoading(true);
    await supabase.from('deposit_settings').upsert({ id: 1, ...deposit });
    await refreshDepositSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setLoading(false);
  };

  const togglePerm = async (role: string, permission: string, enabled: boolean) => {
    const existing = perms.find((p) => p.role === role && p.permission === permission);
    if (existing) {
      await supabase.from('role_permissions').update({ enabled }).eq('id', existing.id);
    } else {
      await supabase.from('role_permissions').insert({ role, permission, enabled });
    }
    await refreshRolePermissions();
  };

  const getPerm = (role: string, permission: string) => {
    return perms.find((p) => p.role === role && p.permission === permission)?.enabled ?? false;
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'company', label: 'Entreprise', icon: Building },
    { id: 'payments', label: 'Paiements', icon: CreditCard },
    { id: 'permissions', label: 'Permissions', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Paramètres</h1>
        <p className="text-slate-400 text-sm mt-0.5">Configuration de votre complexe</p>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-2xl">
          <h2 className="font-semibold text-white">Informations de l'entreprise</h2>
          {[
            { key: 'company_name', label: 'Nom', placeholder: 'Complexe Sportif ...' },
            { key: 'company_address', label: 'Adresse', placeholder: 'Dakar, Sénégal' },
            { key: 'company_phone', label: 'Téléphone', placeholder: '+221...' },
            { key: 'company_email', label: 'Email', placeholder: 'contact@exemple.com' },
            { key: 'company_website', label: 'Site web', placeholder: 'https://...' },
            { key: 'tax_id', label: 'Numéro fiscal', placeholder: 'NINEA...' },
            { key: 'invoice_prefix', label: 'Préfixe factures', placeholder: 'INV' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">{label}</label>
              <input
                value={(company as Record<string, string>)[key] || ''}
                onChange={(e) => setCompany({ ...company, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Pied de facture</label>
            <textarea
              value={company.invoice_footer || ''}
              onChange={(e) => setCompany({ ...company, invoice_footer: e.target.value })}
              placeholder="Merci pour votre confiance..."
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
          <button onClick={saveCompany} disabled={loading} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Sauvegardé !' : 'Sauvegarder'}
          </button>
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-xl">
          <h2 className="font-semibold text-white">Paramètres de paiement</h2>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Type d'acompte</label>
            <div className="flex gap-3">
              {(['PERCENTAGE', 'FIXED'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDeposit({ ...deposit, deposit_type: t })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${deposit.deposit_type === t ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  {t === 'PERCENTAGE' ? 'Pourcentage' : 'Montant fixe'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">
              Valeur {deposit.deposit_type === 'PERCENTAGE' ? '(%)' : '(FCFA)'}
            </label>
            <input
              type="number"
              min="0"
              value={deposit.deposit_value || ''}
              onChange={(e) => setDeposit({ ...deposit, deposit_value: parseFloat(e.target.value) })}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDeposit({ ...deposit, online_payment_enabled: !deposit.online_payment_enabled })}
              className={`relative w-10 h-5 rounded-full transition-all ${deposit.online_payment_enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow ${deposit.online_payment_enabled ? 'right-0.5' : 'left-0.5'}`} />
            </button>
            <label className="text-sm text-slate-300">Paiements en ligne activés</label>
          </div>
          {deposit.online_payment_enabled && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Numéro Wave</label>
                <input value={deposit.wave_number || ''} onChange={(e) => setDeposit({ ...deposit, wave_number: e.target.value })} placeholder="+221..." className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Numéro Orange Money</label>
                <input value={deposit.orange_money_number || ''} onChange={(e) => setDeposit({ ...deposit, orange_money_number: e.target.value })} placeholder="+221..." className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </>
          )}
          <button onClick={saveDeposit} disabled={loading} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Sauvegardé !' : 'Sauvegarder'}
          </button>
        </div>
      )}

      {tab === 'permissions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Permission</th>
                  {ROLES.map((role) => (
                    <th key={role} className="text-center px-5 py-3 text-xs font-medium text-slate-500">{ROLE_LABELS[role]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ALL_PERMISSIONS.map(({ key, label }) => (
                  <tr key={key} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 text-sm text-slate-300">{label}</td>
                    {ROLES.map((role) => {
                      const enabled = getPerm(role, key);
                      return (
                        <td key={role} className="px-5 py-3 text-center">
                          <button
                            onClick={() => togglePerm(role, key, !enabled)}
                            className={`w-8 h-4 rounded-full transition-all relative ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                          >
                            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow ${enabled ? 'right-0.5' : 'left-0.5'}`} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
