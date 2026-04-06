import { useState } from 'react';
import { Plus, CreditCard as Edit2, Trash2, MapPin, Loader2, X, Sun, Moon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Terrain } from '../../types';

interface TerrainForm {
  name: string;
  description: string;
  tarif_horaire: string;
  tarif_jour: string;
  tarif_nuit: string;
  heure_debut_jour: string;
  heure_debut_nuit: string;
  is_active: boolean;
}

const EMPTY_FORM: TerrainForm = {
  name: '',
  description: '',
  tarif_horaire: '',
  tarif_jour: '',
  tarif_nuit: '',
  heure_debut_jour: '08:00',
  heure_debut_nuit: '18:00',
  is_active: true,
};

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

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
    setForm({
      name: t.name,
      description: t.description || '',
      tarif_horaire: String(t.tarif_horaire || ''),
      tarif_jour: String(t.tarif_jour || ''),
      tarif_nuit: String(t.tarif_nuit || ''),
      heure_debut_jour: t.heure_debut_jour ? t.heure_debut_jour.slice(0, 5) : '08:00',
      heure_debut_nuit: t.heure_debut_nuit ? t.heure_debut_nuit.slice(0, 5) : '18:00',
      is_active: t.is_active,
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const payload = {
      name: form.name,
      description: form.description,
      tarif_horaire: parseFloat(form.tarif_horaire) || 0,
      tarif_jour: parseFloat(form.tarif_jour) || 0,
      tarif_nuit: parseFloat(form.tarif_nuit) || 0,
      heure_debut_jour: form.heure_debut_jour,
      heure_debut_nuit: form.heure_debut_nuit,
      is_active: form.is_active,
    };
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
            <div className="grid grid-cols-2 gap-2">
              {terrain.tarif_jour > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sun className="w-3 h-3 text-amber-400" />
                    <p className="text-xs text-amber-400/70">Journée</p>
                  </div>
                  <p className="text-sm font-bold text-amber-400">{fmt(terrain.tarif_jour)} <span className="text-xs font-normal text-slate-400">F</span></p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{terrain.heure_debut_jour?.slice(0,5)} – {terrain.heure_debut_nuit?.slice(0,5)}</p>
                </div>
              )}
              {terrain.tarif_nuit > 0 && (
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Moon className="w-3 h-3 text-blue-400" />
                    <p className="text-xs text-blue-400/70">Nuit</p>
                  </div>
                  <p className="text-sm font-bold text-blue-400">{fmt(terrain.tarif_nuit)} <span className="text-xs font-normal text-slate-400">F</span></p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{terrain.heure_debut_nuit?.slice(0,5)} – {terrain.heure_debut_jour?.slice(0,5)}</p>
                </div>
              )}
              {terrain.tarif_horaire > 0 && (
                <div className={`bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 ${terrain.tarif_jour > 0 || terrain.tarif_nuit > 0 ? 'col-span-2' : 'col-span-2'}`}>
                  <p className="text-xs text-slate-500 mb-0.5">Tarif horaire</p>
                  <p className="text-sm font-bold text-emerald-400">{fmt(terrain.tarif_horaire)} <span className="text-xs font-normal text-slate-400">FCFA/h</span></p>
                </div>
              )}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900">
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

              <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">Créneau Journée</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Heure début</label>
                    <input type="time" value={form.heure_debut_jour} onChange={(e) => setForm({ ...form, heure_debut_jour: e.target.value })} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Tarif (FCFA)</label>
                    <input type="number" min="0" value={form.tarif_jour} onChange={(e) => setForm({ ...form, tarif_jour: e.target.value })} placeholder="0" className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">Créneau Nuit</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Heure début</label>
                    <input type="time" value={form.heure_debut_nuit} onChange={(e) => setForm({ ...form, heure_debut_nuit: e.target.value })} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Tarif (FCFA)</label>
                    <input type="number" min="0" value={form.tarif_nuit} onChange={(e) => setForm({ ...form, tarif_nuit: e.target.value })} placeholder="0" className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Tarif horaire (FCFA/h) — pour réservations personnalisées</label>
                <input type="number" min="0" value={form.tarif_horaire} onChange={(e) => setForm({ ...form, tarif_horaire: e.target.value })} placeholder="5000" className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
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
