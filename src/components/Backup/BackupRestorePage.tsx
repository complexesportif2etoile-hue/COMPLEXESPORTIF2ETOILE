import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CardShell } from '../ui/CardShell';
import {
  Download,
  Upload,
  Trash2,
  Shield,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Database,
  RefreshCw,
  FileJson,
  Clock,
  HardDrive,
} from 'lucide-react';

interface BackupData {
  version: string;
  exported_at: string;
  app: string;
  tables: {
    terrains: unknown[];
    clients: unknown[];
    reservations: unknown[];
    encaissements: unknown[];
    factures: unknown[];
    company_settings: unknown[];
    deposit_settings: unknown[];
    payments: unknown[];
    role_permissions: unknown[];
  };
}

type Status = { type: 'success' | 'error' | 'info'; message: string } | null;

type ExportStep = { label: string; done: boolean };

const TABLE_LABELS: Record<string, string> = {
  terrains: 'Terrains',
  clients: 'Clients',
  reservations: 'Réservations',
  encaissements: 'Encaissements',
  factures: 'Factures',
  payments: 'Paiements',
  company_settings: 'Paramètres société',
  deposit_settings: 'Paramètres acompte',
  role_permissions: 'Permissions rôles',
};

export const BackupRestorePage: React.FC = () => {
  const { profile } = useAuth();
  const [exportLoading, setExportLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingFile, setPendingFile] = useState<BackupData | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportStep[]>([]);
  const [restoreProgress, setRestoreProgress] = useState<string>('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === 'admin';

  const showStatus = (type: 'success' | 'error' | 'info', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 8000);
  };

  const handleExport = async () => {
    setExportLoading(true);
    setExportProgress([]);
    try {
      const steps = [
        'terrains', 'clients', 'reservations', 'encaissements',
        'factures', 'payments', 'company_settings', 'deposit_settings', 'role_permissions',
      ];

      const markStep = (label: string) =>
        setExportProgress(prev => [...prev, { label: TABLE_LABELS[label] ?? label, done: true }]);

      const fetchTable = async (table: string, order?: string) => {
        const q = supabase.from(table).select('*');
        if (order) q.order(order);
        const { data, error } = await q;
        if (error) throw new Error(`${table}: ${error.message}`);
        markStep(table);
        return data ?? [];
      };

      const [
        terrains, clients, reservations, encaissements,
        factures, payments, company_settings, deposit_settings, role_permissions,
      ] = await Promise.all([
        fetchTable('terrains', 'created_at'),
        fetchTable('clients', 'created_at'),
        fetchTable('reservations', 'created_at'),
        fetchTable('encaissements', 'created_at'),
        fetchTable('factures', 'created_at'),
        fetchTable('payments', 'created_at'),
        fetchTable('company_settings'),
        fetchTable('deposit_settings'),
        fetchTable('role_permissions', 'created_at'),
      ]);

      const backup: BackupData = {
        version: '2.0',
        app: 'complexe-sportif',
        exported_at: new Date().toISOString(),
        tables: {
          terrains,
          clients,
          reservations,
          encaissements,
          factures,
          company_settings,
          deposit_settings,
          payments,
          role_permissions,
        },
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toISOString().slice(11, 16).replace(':', 'h');
      a.href = url;
      a.download = `backup-complexe-${dateStr}-${timeStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const totalRows = steps.reduce((sum, k) => sum + (backup.tables[k as keyof typeof backup.tables]?.length ?? 0), 0);
      showStatus('success', `Sauvegarde exportée avec succès — ${totalRows} enregistrements dans ${steps.length} tables`);
    } catch (err: unknown) {
      showStatus('error', `Erreur export: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setExportLoading(false);
      setTimeout(() => setExportProgress([]), 4000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as BackupData;
        if (!data.version || !data.tables) {
          showStatus('error', 'Fichier de sauvegarde invalide ou corrompu');
          return;
        }
        setPendingFile(data);
        setConfirmRestore(true);
      } catch {
        showStatus('error', 'Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRestore = async () => {
    if (!pendingFile) return;
    setRestoreLoading(true);
    setConfirmRestore(false);
    setRestoreProgress('Envoi des données au serveur...');

    try {
      const { error, data } = await supabase.rpc('restore_backup', {
        p_terrains: pendingFile.tables.terrains ?? [],
        p_clients: pendingFile.tables.clients ?? [],
        p_reservations: pendingFile.tables.reservations ?? [],
        p_encaissements: pendingFile.tables.encaissements ?? [],
        p_factures: pendingFile.tables.factures ?? [],
        p_payments: pendingFile.tables.payments ?? [],
        p_company_settings: pendingFile.tables.company_settings ?? [],
        p_deposit_settings: pendingFile.tables.deposit_settings ?? [],
        p_role_permissions: pendingFile.tables.role_permissions ?? [],
      });

      if (error) throw new Error(error.message);

      const result = data as { success: boolean; errors?: string[] };
      if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Erreur inconnue');
      }

      const totalRows = Object.values(pendingFile.tables).reduce((sum, rows) => sum + (rows as unknown[]).length, 0);
      showStatus('success', `Restauration réussie — ${totalRows} enregistrements restaurés. Rechargez la page pour voir les données.`);
      setPendingFile(null);
    } catch (err: unknown) {
      showStatus('error', `Erreur restauration: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setRestoreLoading(false);
      setRestoreProgress('');
    }
  };

  const handleReset = async () => {
    setResetLoading(true);
    setConfirmReset(false);

    try {
      await supabase.from('encaissements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('factures').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      showStatus('success', 'Toutes les données ont été supprimées. La structure de la base est intacte.');
    } catch (err: unknown) {
      showStatus('error', `Erreur réinitialisation: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setResetLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Sauvegarde & Restauration</h1>
        <CardShell className="text-center py-8">
          <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
        </CardShell>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Sauvegarde & Restauration</h1>
        <p className="text-sm sm:text-base text-slate-400 mt-1">Gérez les sauvegardes complètes et la réinitialisation des données</p>
      </div>

      {status && (
        <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium ${
          status.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : status.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          {status.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          {status.type === 'error' && <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
          {status.type === 'info' && <Database className="w-5 h-5 shrink-0 mt-0.5" />}
          <span>{status.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Export */}
        <CardShell>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 ring-1 ring-emerald-500/5 inline-flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Exporter</h2>
              <p className="text-xs text-slate-500">Télécharger une sauvegarde complète</p>
            </div>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Exportez toutes les données dans un fichier JSON horodaté. Conservez ce fichier en lieu sûr.
          </p>

          <div className="bg-slate-900/40 rounded-xl border border-slate-700/40 p-3 mb-4 space-y-1.5">
            {Object.entries(TABLE_LABELS).map(([key, label]) => {
              const step = exportProgress.find(s => s.label === label);
              return (
                <div key={key} className="flex items-center gap-2 text-xs text-slate-400">
                  {step?.done
                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    : exportLoading
                    ? <Loader2 className="w-3 h-3 animate-spin text-slate-500 shrink-0" />
                    : <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                  }
                  {label}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20"
          >
            {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
            {exportLoading ? 'Export en cours...' : 'Télécharger la sauvegarde'}
          </button>
        </CardShell>

        {/* Restore */}
        <CardShell>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 border border-blue-500/20 ring-1 ring-blue-500/5 inline-flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Restaurer</h2>
              <p className="text-xs text-slate-500">Importer une sauvegarde</p>
            </div>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Restaurez les données depuis un fichier JSON. Les données actuelles seront <span className="text-amber-400 font-medium">remplacées</span> par celles du fichier.
          </p>

          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/80 leading-relaxed">
                Cette action remplace toutes les données existantes. Une confirmation sera demandée avant de continuer.
              </p>
            </div>
          </div>

          {restoreLoading && restoreProgress && (
            <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 mb-4">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
              <p className="text-xs text-blue-400">{restoreProgress}</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={restoreLoading}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20"
          >
            {restoreLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {restoreLoading ? 'Restauration...' : 'Choisir un fichier .json'}
          </button>
        </CardShell>

        {/* Reset */}
        <CardShell>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/20 ring-1 ring-red-500/5 inline-flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Réinitialiser</h2>
              <p className="text-xs text-slate-500">Vider les données opérationnelles</p>
            </div>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Supprimez toutes les données opérationnelles sans toucher à la structure ni aux paramètres.
          </p>

          <div className="bg-slate-900/40 rounded-xl border border-slate-700/40 p-3 mb-4 space-y-1.5">
            <p className="text-xs font-medium text-slate-300 mb-2">Supprimé :</p>
            {['Réservations', 'Clients', 'Encaissements', 'Factures', 'Paiements'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-red-400/70">
                <Trash2 className="w-3 h-3 shrink-0" />
                {item}
              </div>
            ))}
            <div className="pt-2 border-t border-slate-700/40">
              <p className="text-xs font-medium text-slate-300 mb-1.5">Conservé :</p>
              {['Terrains', 'Paramètres', 'Permissions', 'Comptes utilisateurs'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-emerald-400/70">
                  <CheckCircle className="w-3 h-3 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setConfirmReset(true)}
            disabled={resetLoading}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-red-600/80 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20"
          >
            {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {resetLoading ? 'Réinitialisation...' : 'Réinitialiser les données'}
          </button>
        </CardShell>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3.5">
        <HardDrive className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed space-y-0.5">
          <p><span className="text-slate-300 font-medium">Sauvegarde complète v2 :</span> inclut terrains, clients, réservations, encaissements, factures, paiements, paramètres société, paramètres acompte et permissions par rôle.</p>
          <p className="flex items-center gap-1.5 text-slate-500"><Clock className="w-3 h-3" /> Effectuez une sauvegarde régulière pour protéger vos données.</p>
        </div>
      </div>

      {/* Confirm Reset Modal */}
      {confirmReset && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Confirmer la réinitialisation</h3>
                <p className="text-sm text-slate-400">Cette action est irréversible</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Vous êtes sur le point de supprimer <span className="text-red-400 font-semibold">toutes les réservations, clients, encaissements, factures et paiements</span>. La structure de la base et les paramètres seront conservés.
            </p>
            <p className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mb-6">
              Nous vous recommandons d'exporter une sauvegarde avant de continuer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 min-h-[44px] bg-slate-700/60 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-all duration-200"
              >
                Annuler
              </button>
              <button
                onClick={handleReset}
                className="flex-1 min-h-[44px] bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-all duration-200"
              >
                Oui, réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Restore Modal */}
      {confirmRestore && pendingFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Upload className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Confirmer la restauration</h3>
                <p className="text-sm text-slate-400">Cette action est irréversible</p>
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Exporté le <span className="text-white font-medium">{new Date(pendingFile.exported_at).toLocaleString('fr-FR')}</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Database className="w-3.5 h-3.5" />
                <span>Version <span className="text-white font-medium">{pendingFile.version}</span></span>
              </div>
              <div className="pt-1 border-t border-slate-700/40 grid grid-cols-2 gap-x-3 gap-y-1">
                {Object.entries(pendingFile.tables).map(([key, rows]) => (
                  <p key={key} className="text-xs text-slate-500">
                    <span className="text-slate-200 font-medium tabular-nums">{(rows as unknown[]).length}</span>{' '}
                    {TABLE_LABELS[key] ?? key}
                  </p>
                ))}
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Toutes les données actuelles seront <span className="text-red-400 font-semibold">remplacées</span> par celles de ce fichier.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmRestore(false); setPendingFile(null); }}
                className="flex-1 min-h-[44px] bg-slate-700/60 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-all duration-200"
              >
                Annuler
              </button>
              <button
                onClick={handleRestore}
                className="flex-1 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all duration-200"
              >
                Oui, restaurer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
