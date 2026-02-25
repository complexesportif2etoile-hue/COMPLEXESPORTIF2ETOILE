import React, { useState, useEffect } from 'react';
import { X, MapPin, Save } from 'lucide-react';
import { supabase, Terrain } from '../../lib/supabase';
import { IconPill } from '../ui/IconPill';

interface TerrainFormModalProps {
  terrain?: Terrain | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  'w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all duration-200 min-h-[44px]';

export const TerrainFormModal: React.FC<TerrainFormModalProps> = ({ terrain, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!terrain;

  useEffect(() => {
    if (terrain) {
      setName(terrain.name);
      setDescription(terrain.description || '');
      setIsActive(terrain.is_active);
    }
  }, [terrain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Le nom du terrain est requis');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && terrain) {
        const { error: updateError } = await supabase
          .from('terrains')
          .update({
            name: name.trim(),
            description: description.trim(),
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', terrain.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('terrains')
          .insert({
            name: name.trim(),
            description: description.trim(),
            is_active: isActive,
          });

        if (insertError) throw insertError;
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/60 max-w-lg w-full">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <IconPill variant="primary">
              <MapPin className="w-5 h-5" />
            </IconPill>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isEdit ? 'Modifier le Terrain' : 'Nouveau Terrain'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEdit ? 'Mettez a jour les informations' : 'Ajoutez un nouveau terrain'}
              </p>
            </div>
          </div>
          <IconPill variant="default" size="sm" onClick={onClose} title="Fermer">
            <X className="w-4 h-4" />
          </IconPill>
        </div>

        {/* ---- Form ---- */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 ring-1 ring-red-500/5">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Nom du terrain
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Terrain A"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du terrain (optionnel)"
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-900/40 rounded-xl border border-slate-700/40">
            <div>
              <p className="text-sm font-semibold text-slate-200">Statut du terrain</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {isActive ? 'Le terrain est disponible aux reservations' : 'Le terrain est desactive'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                isActive ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transform transition-transform duration-200 ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* ---- Footer actions ---- */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-semibold text-slate-300 bg-slate-700/60 hover:bg-slate-600/70 border border-slate-600/50 rounded-xl transition-all duration-200 min-h-[44px]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl transition-all duration-200 disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/20 min-h-[44px]"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Enregistrement...' : isEdit ? 'Mettre a jour' : 'Creer le terrain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
