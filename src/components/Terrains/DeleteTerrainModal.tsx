import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase, Terrain } from '../../lib/supabase';
import { IconPill } from '../ui/IconPill';

interface DeleteTerrainModalProps {
  terrain: Terrain;
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteTerrainModal: React.FC<DeleteTerrainModalProps> = ({ terrain, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const { count } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('terrain_id', terrain.id)
        .in('statut', ['reserve', 'check_in']);

      if (count && count > 0) {
        setError(`Ce terrain a ${count} reservation(s) active(s). Veuillez les annuler ou les terminer avant de supprimer.`);
        setDeleting(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from('terrains')
        .delete()
        .eq('id', terrain.id);

      if (deleteError) throw deleteError;

      onDeleted();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de la suppression');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/60 max-w-md w-full">
        <div className="p-6 sm:p-8 text-center space-y-5">
          {/* ---- Warning icon ---- */}
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20 ring-1 ring-red-500/5">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          {/* ---- Message ---- */}
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Supprimer le terrain</h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Voulez-vous vraiment supprimer{' '}
              <span className="font-semibold text-white">{terrain.name}</span> ?
              Cette action est irreversible et supprimera toutes les reservations associees.
            </p>
          </div>

          {/* ---- Error ---- */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 text-left ring-1 ring-red-500/5">
              {error}
            </div>
          )}

          {/* ---- Actions ---- */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-semibold text-slate-300 bg-slate-700/60 hover:bg-slate-600/70 border border-slate-600/50 rounded-xl transition-all duration-200 min-h-[44px]"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 rounded-xl transition-all duration-200 disabled:opacity-50 hover:shadow-lg hover:shadow-red-500/20 min-h-[44px]"
            >
              {deleting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {deleting ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
