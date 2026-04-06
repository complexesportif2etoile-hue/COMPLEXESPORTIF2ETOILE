import { useState, useMemo } from 'react';
import { Plus, X, Loader2, Trash2, CreditCard as Edit2, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Depense, DepenseCategorie } from '../../types';

const CATEGORIES: DepenseCategorie[] = [
  'salaires', 'entretien', 'electricite', 'eau', 'loyer', 'equipement', 'fournitures', 'autre',
];

const CATEGORIE_LABELS: Record<DepenseCategorie, string> = {
  salaires: 'Salaires',
  entretien: 'Entretien',
  electricite: 'Électricité',
  eau: 'Eau',
  loyer: 'Loyer',
  equipement: 'Équipement',
  fournitures: 'Fournitures',
  autre: 'Autre',
};

const CATEGORIE_COLORS: Record<DepenseCategorie, string> = {
  salaires: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  entretien: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  electricite: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  eau: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  loyer: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  equipement: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  fournitures: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  autre: 'bg-slate-700/50 text-slate-400 border-slate-600/20',
};

const emptyForm = {
  libelle: '',
  montant: '',
  categorie: 'autre' as DepenseCategorie,
  date_depense: new Date().toISOString().slice(0, 10),
  notes: '',
};

export function DepensesPage() {
  const { depenses, refreshDepenses } = useData();
  const { profile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingDepense, setEditingDepense] = useState<Depense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterCategorie, setFilterCategorie] = useState<DepenseCategorie | 'all'>('all');
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const filtered = useMemo(() => {
    return depenses.filter((d) => {
      const matchMonth = !filterMonth || d.date_depense.startsWith(filterMonth);
      const matchCat = filterCategorie === 'all' || d.categorie === filterCategorie;
      return matchMonth && matchCat;
    });
  }, [depenses, filterMonth, filterCategorie]);

  const totalFiltered = useMemo(() => filtered.reduce((s, d) => s + d.montant, 0), [filtered]);

  const byCategorie = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((d) => {
      map[d.categorie] = (map[d.categorie] || 0) + d.montant;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

  const openCreate = () => {
    setEditingDepense(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (d: Depense) => {
    setEditingDepense(d);
    setForm({
      libelle: d.libelle,
      montant: String(d.montant),
      categorie: d.categorie,
      date_depense: d.date_depense,
      notes: d.notes,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      libelle: form.libelle,
      montant: parseFloat(form.montant) || 0,
      categorie: form.categorie,
      date_depense: form.date_depense,
      notes: form.notes,
    };
    if (editingDepense) {
      await supabase.from('depenses').update(payload).eq('id', editingDepense.id);
    } else {
      await supabase.from('depenses').insert({ ...payload, created_by: profile?.id });
    }
    await refreshDepenses();
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('depenses').delete().eq('id', id);
    await refreshDepenses();
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dépenses</h1>
          <p className="text-slate-400 text-sm mt-0.5">{filtered.length} entrée{filtered.length !== 1 ? 's' : ''} — Total : <span className="text-red-400 font-medium">{fmt(totalFiltered)}</span></p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          value={filterCategorie}
          onChange={(e) => setFilterCategorie(e.target.value as DepenseCategorie | 'all')}
          className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Toutes catégories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORIE_LABELS[c]}</option>)}
        </select>
      </div>

      {byCategorie.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            Répartition par catégorie
          </h2>
          <div className="space-y-3">
            {byCategorie.map(([cat, amount]) => {
              const pct = Math.round((amount / totalFiltered) * 100);
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{CATEGORIE_LABELS[cat as DepenseCategorie]}</span>
                    <span className="text-slate-400">{pct}% — <span className="text-red-400 font-medium">{fmt(amount)}</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">Aucune dépense pour cette période</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map((d) => (
              <div key={d.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-800/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{d.libelle}</p>
                  <p className="text-xs text-slate-500">{new Date(d.date_depense).toLocaleDateString('fr-FR')}{d.notes ? ` — ${d.notes}` : ''}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${CATEGORIE_COLORS[d.categorie]}`}>
                  {CATEGORIE_LABELS[d.categorie]}
                </span>
                <span className="text-sm font-semibold text-red-400 flex-shrink-0">{fmt(d.montant)}</span>
                {canEdit && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(d)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      disabled={deletingId === d.id}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      {deletingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">{editingDepense ? 'Modifier la dépense' : 'Ajouter une dépense'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Libellé</label>
                <input
                  type="text"
                  value={form.libelle}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  placeholder="Ex: Facture électricité mars"
                  required
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Montant (FCFA)</label>
                  <input
                    type="number"
                    value={form.montant}
                    onChange={(e) => setForm({ ...form, montant: e.target.value })}
                    placeholder="0"
                    required
                    min="0"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Date</label>
                  <input
                    type="date"
                    value={form.date_depense}
                    onChange={(e) => setForm({ ...form, date_depense: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Catégorie</label>
                <select
                  value={form.categorie}
                  onChange={(e) => setForm({ ...form, categorie: e.target.value as DepenseCategorie })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORIE_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Notes (optionnel)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notes supplémentaires"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingDepense ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
