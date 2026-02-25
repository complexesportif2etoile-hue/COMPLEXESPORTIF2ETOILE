import { useState } from 'react';
import { Plus, Edit2, Trash2, MapPin, Loader2, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Terrain } from '../../types';

interface TerrainForm {
  name: string;
  description: string;
  tarif_horaire: string;
  is_active: boolean;
}

const EMPTY_FORM: TerrainForm = { name: '', description: '', tarif_horaire: '', is_active: true };

export function TerrainsList() {
  const { terrains, refreshTerrains } = useData();
  const { hasPermission } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Terrain | null>(null);
  const [form, setForm] = useState<TerrainForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canManage = hasPermission('manage_terrains');

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (t: Terrain) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description || '', tarif_horaire: String(t.tarif_horaire), is_active: t.is_active });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const payload = { name: form.name, description: form.description, tarif_horaire: parseFloat(form.tarif_horaire), is_active: form.is_active };
    try {
      if (editing) {
        const { error } = await supabase.from('terrains').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('terrains').insert(payload);
        if (error) throw error;
      }
      await refreshTerrains();
      setShowModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
    setLoading(false);
  };

  const handleToggle = async (t: Terrain) => {
    await supabase.from('terrains').update({ is_active: !t.is_active }).eq('id', t.id);
    await refreshTerrains();
  };

  const handleDelete = async (t: Terrain) => {
    if (!window.confirm(`Supprimer "${t.name}" ?`)) return;
    await supabase.from('terrains').delete().eq('id', t.id);
    await refreshTerrains();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Terrains</h1>
          <p className="text-slate-400 text-sm mt-0.5">{terrains.length} terrain{terrains.length !== 1 ? 's' : ''}</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouveau terrain
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {terrains.map((terrain) => (
          <div key={terrain.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{terrain.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${terrain.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>
                    {terrain.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(terrain)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(terrain)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            {terrain.description && (
              <p className="text-xs text-slate-500 mb-3 line-clamp-2">{terrain.description}</p>
            )}
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Tarif horaire</p>
              <p className="text-lg font-bold text-emerald-400">{new Intl.NumberFormat('fr-FR').format(terrain.tarif_horaire)} <span className="text-sm font-normal text-slate-400">FCFA/h</span></p>
            </div>
            {canManage && (
              <button
                onClick={() => handleToggle(terrain)}
                className={`mt-3 w-full py-2 rounded-xl text-xs font-medium transition-all ${terrain.is_active ? 'bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'}`}
              >
                {terrain.is_active ? 'Désactiver' : 'Activer'}
              </button>
            )}
          </div>
        ))}
        {terrains.length === 0 && (
          <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
            <MapPin className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Aucun terrain configuré</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">{editing ? 'Modifier le terrain' : 'Nouveau terrain'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">{error}</div>}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Nom</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ex: Terrain A" className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Description optionnelle..." className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Tarif horaire (FCFA)</label>
                <input type="number" min="0" value={form.tarif_horaire} onChange={(e) => setForm({ ...form, tarif_horaire: e.target.value })} required placeholder="5000" className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setForm({ ...form, is_active: !form.is_active })} className={`relative w-10 h-5 rounded-full transition-all ${form.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow ${form.is_active ? 'right-0.5' : 'left-0.5'}`} />
                </button>
                <label className="text-sm text-slate-300">{form.is_active ? 'Actif' : 'Inactif'}</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Annuler</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
