import { useState } from 'react';
import { Download, Upload, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { format } from '../utils/dateUtils';

export function BackupRestorePage() {
  const { terrains, clients, reservations, encaissements, refreshAll } = useData();
  const [restoring, setRestoring] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleExport = async () => {
    const { data: factures } = await supabase.from('factures').select('*');
    const { data: payments } = await supabase.from('payments').select('*');
    const { data: companySettings } = await supabase.from('company_settings').select('*');
    const { data: depositSettings } = await supabase.from('deposit_settings').select('*');
    const { data: rolePermissions } = await supabase.from('role_permissions').select('*');

    const backup = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      terrains,
      clients,
      reservations,
      encaissements,
      factures: factures || [],
      payments: payments || [],
      company_settings: companySettings || [],
      deposit_settings: depositSettings || [],
      role_permissions: rolePermissions || [],
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setRestoring(true);

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const { data, error } = await supabase.rpc('restore_backup', {
        p_terrains: backup.terrains || [],
        p_clients: backup.clients || [],
        p_reservations: backup.reservations || [],
        p_encaissements: backup.encaissements || [],
        p_factures: backup.factures || [],
        p_payments: backup.payments || [],
        p_company_settings: backup.company_settings || [],
        p_deposit_settings: backup.deposit_settings || [],
        p_role_permissions: backup.role_permissions || [],
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.errors?.join(', ') || 'Erreur lors de la restauration');
      }

      await refreshAll();
      setSuccess('Sauvegarde restaurée avec succès !');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la restauration');
    }
    setRestoring(false);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Sauvegarde & Restauration</h1>
        <p className="text-slate-400 text-sm mt-0.5">Exportez et importez vos données</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
            <Download className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="font-semibold text-white mb-2">Exporter les données</h2>
          <p className="text-sm text-slate-400 mb-4">
            Téléchargez une sauvegarde complète de toutes vos données au format JSON.
          </p>
          <div className="space-y-2 text-xs text-slate-500 mb-6">
            <p>• {terrains.length} terrains</p>
            <p>• {clients.length} clients</p>
            <p>• {reservations.length} réservations</p>
            <p>• {encaissements.length} encaissements</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <Download className="w-4 h-4" />
            Exporter maintenant
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
            <Upload className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="font-semibold text-white mb-2">Restaurer une sauvegarde</h2>
          <p className="text-sm text-slate-400 mb-4">
            Importez un fichier de sauvegarde JSON. Attention: cette action remplacera toutes les données actuelles.
          </p>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">Cette action est irréversible. Toutes les données actuelles seront remplacées.</p>
          </div>

          {success && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 mb-4">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-300">{success}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-xl mb-4">
              {error}
            </div>
          )}

          <label className={`flex items-center gap-2 cursor-pointer ${restoring ? 'opacity-50 cursor-not-allowed' : ''} bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-5 py-2.5 rounded-xl text-sm font-medium transition-all w-fit`}>
            {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {restoring ? 'Restauration...' : 'Choisir un fichier'}
            <input type="file" accept=".json" onChange={handleImport} disabled={restoring} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
}
