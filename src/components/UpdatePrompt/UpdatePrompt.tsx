import { useEffect, useState } from 'react';
import { RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0';

interface AppVersionRow {
  version: string;
  release_notes: string;
}

export function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from('app_version')
        .select('version, release_notes')
        .eq('id', 1)
        .maybeSingle<AppVersionRow>();

      if (data && data.version !== APP_VERSION) {
        setNewVersion(data.version);
        setReleaseNotes(data.release_notes ?? '');
        setUpdateAvailable(true);
      }
    };

    check();

    const channel = supabase
      .channel('app_version_watch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_version' },
        (payload) => {
          const row = payload.new as AppVersionRow;
          if (row.version !== APP_VERSION) {
            setNewVersion(row.version);
            setReleaseNotes(row.release_notes ?? '');
            setUpdateAvailable(true);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    window.location.reload();
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-100 uppercase tracking-wider">Mise à jour disponible</p>
            <p className="text-white font-bold text-lg leading-tight">Version {newVersion}</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            Une nouvelle version de l'application est disponible. Veuillez installer la mise à jour pour continuer.
          </p>

          {releaseNotes.trim().length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nouveautés</p>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{releaseNotes}</p>
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            <p className="text-amber-300 text-xs">
              Cette fenêtre restera visible jusqu'à ce que la mise à jour soit appliquée.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-70 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {refreshing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Mise à jour en cours…</>
              : <><RefreshCw className="w-4 h-4" /> Installer la mise à jour</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
